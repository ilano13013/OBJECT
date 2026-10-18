/**
 * Tripo OpenAPI client (server only — the API key never reaches a browser).
 *
 * Uses the documented task API: upload each photo for a file token, create an
 * image_to_model (one photo) or multiview_to_model (front + other views) task
 * with H3.1 textures and PBR materials, poll it, then download the GLB.
 * https://platform.tripo3d.ai/docs/generation
 * https://docs.tripo3d.ai/model-generation/image-to-model-v3-0-v3-1.html
 * https://docs.tripo3d.ai/model-generation/multiview-to-model-v3-0-v3-1.html
 */

export type TripoErrorKind = 'credits' | 'rate_limited' | 'auth' | 'invalid' | 'upstream'

export class TripoError extends Error {
  name = 'TripoError'
  constructor(
    public kind: TripoErrorKind,
    message: string,
    public tripoCode?: number,
    public retryAfter?: number,
  ) {
    super(message)
  }
}

export type TripoStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'banned' | 'expired' | 'unknown'

export interface TripoTask {
  status: TripoStatus
  progress: number
  modelUrl: string | null
}

export interface TripoImage {
  bytes: Uint8Array
  type: 'jpg' | 'png' | 'webp'
}

/** Views in the order Tripo's multiview endpoint expects. Front is required. */
export const VIEWS = ['front', 'left', 'back', 'right'] as const

export interface TripoOptions {
  apiKey: string
  base: string
  modelVersion: string
  fetch?: typeof fetch
  timeoutMs?: number
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

export const MAX_MODEL_BYTES = 50 * 1024 * 1024

export class TripoClient {
  private f: typeof fetch
  constructor(private o: TripoOptions) {
    this.f = o.fetch ?? fetch
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await this.f(`${this.o.base}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.o.apiKey}`, ...init.headers },
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 20_000),
      })
    } catch (e) {
      throw new TripoError('upstream', `Tripo unreachable: ${(e as Error).message}`)
    }
    const body = (await res.json().catch(() => null)) as { code?: number; message?: string; data?: T } | null
    const code = body?.code
    if (res.ok && code === 0 && body?.data) return body.data
    throw toError(res.status, code, body?.message, res.headers.get('retry-after'))
  }

  async upload(img: TripoImage): Promise<string> {
    const form = new FormData()
    form.append('file', new Blob([img.bytes as BlobPart], { type: MIME[img.type] }), `photo.${img.type}`)
    const data = await this.call<{ image_token?: string; file_token?: string }>('/upload', { method: 'POST', body: form })
    const token = data.image_token ?? data.file_token
    if (!token) throw new TripoError('upstream', 'Tripo upload returned no file token.')
    return token
  }

  /** `views[0]` is the front; missing views are null. One view → image_to_model. */
  async createTask(views: ({ token: string; type: TripoImage['type'] } | null)[]): Promise<string> {
    const given = views.filter(Boolean)
    if (!views[0] || given.length === 0) throw new TripoError('invalid', 'A front photo is required.')
    const common = { model_version: this.o.modelVersion, texture: true, pbr: true, texture_quality: 'detailed' }
    const body =
      given.length === 1
        ? { type: 'image_to_model', file: { type: views[0].type, file_token: views[0].token }, ...common }
        : {
            type: 'multiview_to_model',
            files: VIEWS.map((_, i) => (views[i] ? { type: views[i]!.type, file_token: views[i]!.token } : {})),
            ...common,
          }
    const data = await this.call<{ task_id?: string }>('/task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!data.task_id) throw new TripoError('upstream', 'Tripo returned no task id.')
    return data.task_id
  }

  async getTask(taskId: string): Promise<TripoTask> {
    const data = await this.call<{ status?: string; progress?: number; output?: Record<string, string | undefined> }>(
      `/task/${encodeURIComponent(taskId)}`,
      { method: 'GET' },
    )
    const known: TripoStatus[] = ['queued', 'running', 'success', 'failed', 'cancelled', 'banned', 'expired', 'unknown']
    const status = known.includes(data.status as TripoStatus) ? (data.status as TripoStatus) : 'unknown'
    const out = data.output ?? {}
    return {
      status,
      progress: Math.max(0, Math.min(100, Math.round(Number(data.progress) || 0))),
      // PBR model when requested; plain textured model otherwise.
      modelUrl: out.pbr_model ?? out.model ?? out.base_model ?? null,
    }
  }

  /** Downloads the generated GLB (Tripo-hosted, short-lived URL) and checks it is one. */
  async downloadModel(url: string): Promise<Uint8Array> {
    if (!/^https?:\/\//.test(url)) throw new TripoError('upstream', 'Tripo returned an invalid model URL.')
    let res: Response
    try {
      res = await this.f(url, { signal: AbortSignal.timeout(45_000) })
    } catch (e) {
      throw new TripoError('upstream', `Model download failed: ${(e as Error).message}`)
    }
    if (!res.ok) throw new TripoError('upstream', `Model download failed (${res.status}).`)
    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > MAX_MODEL_BYTES) throw new TripoError('upstream', 'Generated model is larger than 50 MB.')
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > MAX_MODEL_BYTES) throw new TripoError('upstream', 'Generated model is larger than 50 MB.')
    if (!isGlb(bytes)) throw new TripoError('upstream', 'Tripo did not return a GLB file.')
    return bytes
  }
}

/** Binary glTF 2.0: "glTF" magic, version 2, declared length within the file. */
export function isGlb(b: Uint8Array): boolean {
  if (b.byteLength < 20) return false
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2 && v.getUint32(8, true) <= b.byteLength
}

export function imageType(b: Uint8Array): TripoImage['type'] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return null
}

/** Maps Tripo's documented error codes. https://docs.tripo3d.ai/get-started/errors-and-error-handling.html */
export function toError(http: number, code: number | undefined, message: string | undefined, retryAfter: string | null): TripoError {
  const msg = message || `Tripo error ${code ?? http}`
  const wait = retryAfter ? Number(retryAfter) || undefined : undefined
  if (code === 2010) return new TripoError('credits', msg, code)
  if (code === 1007 || code === 2000 || http === 429) return new TripoError('rate_limited', msg, code, wait)
  if (http === 401 || code === 1002) return new TripoError('auth', msg, code)
  if (http >= 400 && http < 500) return new TripoError('invalid', msg, code)
  return new TripoError('upstream', msg, code)
}
