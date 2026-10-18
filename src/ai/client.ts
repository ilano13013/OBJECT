import { cloudEnabled, supabase } from '@/lib/supabase'

/**
 * AI 3D generation (Tripo), browser side. The browser never talks to Tripo:
 * it uploads photos to the workspace's own storage, then asks /api/ai/* — the
 * server checks the subscription and quota, holds the Tripo key and stores
 * the resulting GLB in the library.
 */

const BUCKET = 'showroom-assets'
export const aiAvailable = cloudEnabled

export interface AiQuota {
  eligible: boolean
  reason: 'not_subscribed' | 'period_ended' | 'quota_exhausted' | 'no_workspace' | null
  quota: number
  used: number
  periodStart: string | null
  periodEnd: string | null
  inProgress: string | null
}

export interface Generation {
  id: string
  status: 'reserved' | 'running' | 'succeeded' | 'failed' | 'released'
  mode: 'single' | 'multiview'
  name: string
  progress: number
  error: string | null
  libraryModelId: string | null
  inputPaths: string[]
  createdAt: string
}

export interface LibraryModel {
  id: string
  name: string
  storagePath: string
  fileSize: number
  previewPath: string | null
  generationId: string | null
  createdAt: string
}

export class AiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

function db() {
  if (!supabase) throw new AiError('AI generation needs an OBJECT. account.')
  return supabase
}

let workspace: Promise<string> | null = null
function workspaceId(): Promise<string> {
  workspace ??= Promise.resolve(db().from('workspaces').select('id').order('created_at').limit(1).single()).then(({ data, error }) => {
    if (error || !data) {
      workspace = null
      throw new AiError('Your studio could not be loaded. Sign in again.')
    }
    return data.id as string
  })
  return workspace
}
supabase?.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') workspace = null
})

export async function getQuota(): Promise<AiQuota> {
  const { data, error } = await db().rpc('ai_quota')
  if (error) throw new AiError('Your AI generation balance could not be loaded.')
  const r = (data as { eligible: boolean; reason: AiQuota['reason']; quota: number; used: number; period_start: string | null; period_end: string | null; in_progress: string | null }[])[0]
  if (!r) return { eligible: false, reason: 'no_workspace', quota: 5, used: 0, periodStart: null, periodEnd: null, inProgress: null }
  return { eligible: r.eligible, reason: r.reason, quota: r.quota, used: r.used, periodStart: r.period_start, periodEnd: r.period_end, inProgress: r.in_progress }
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Uploads one photo for a generation request. `view`: 0 front, 1 left, 2 back, 3 right. */
export async function uploadPhoto(requestId: string, view: number, file: Blob, mime: string): Promise<string> {
  const ws = await workspaceId()
  const path = `${ws}/ai-inputs/${requestId}/${view}.${EXT[mime] ?? 'jpg'}`
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: true })
  if (error) throw new AiError('A photo could not be uploaded. Check your connection and try again.')
  return path
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const { data } = await db().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AiError('Sign in to continue.', 'unauthenticated')
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  } catch {
    throw new AiError('We couldn’t reach OBJECT. Check your connection.', 'network')
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string }
  if (!res.ok) throw new AiError(payload.error ?? 'Something went wrong. Try again.', payload.code)
  return payload
}

export const startGeneration = (body: { requestId: string; name: string; inputs: string[] }) => api<Generation>('/api/ai/generate', body)
export const generationStatus = (id: string) => api<Generation>('/api/ai/status', { id })

interface GenRow {
  id: string
  status: Generation['status']
  mode: Generation['mode']
  name: string
  progress: number
  error_message: string | null
  library_model_id: string | null
  input_paths: string[]
  created_at: string
}

export async function listGenerations(limit = 12): Promise<Generation[]> {
  const ws = await workspaceId()
  const { data, error } = await db()
    .from('ai_generations')
    .select('id, status, mode, name, progress, error_message, library_model_id, input_paths, created_at')
    .eq('workspace_id', ws)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new AiError('Your generation history could not be loaded.')
  return (data as GenRow[]).map((r) => ({
    id: r.id,
    status: r.status,
    mode: r.mode,
    name: r.name,
    progress: r.progress,
    error: r.error_message,
    libraryModelId: r.library_model_id,
    inputPaths: r.input_paths,
    createdAt: r.created_at,
  }))
}

interface ModelRow {
  id: string
  name: string
  storage_path: string
  file_size: number
  preview_path: string | null
  generation_id: string | null
  created_at: string
}

const toModel = (r: ModelRow): LibraryModel => ({
  id: r.id,
  name: r.name,
  storagePath: r.storage_path,
  fileSize: r.file_size,
  previewPath: r.preview_path,
  generationId: r.generation_id,
  createdAt: r.created_at,
})

export async function listLibrary(): Promise<LibraryModel[]> {
  const ws = await workspaceId()
  const { data, error } = await db().from('library_models').select('*').eq('workspace_id', ws).order('created_at', { ascending: false })
  if (error) throw new AiError('Your library could not be loaded.')
  return (data as ModelRow[]).map(toModel)
}

export async function renameModel(id: string, name: string) {
  const { error } = await db().from('library_models').update({ name: name.trim().slice(0, 120) || 'Untitled model' }).eq('id', id)
  if (error) throw new AiError('The model could not be renamed.')
}

/** Removes a model from the library. Showrooms already using it keep their own copy. */
export async function deleteModel(m: LibraryModel) {
  const { error } = await db().from('library_models').delete().eq('id', m.id)
  if (error) throw new AiError('The model could not be deleted.')
  await db().storage.from(BUCKET).remove([m.storagePath])
}

/**
 * Copies a library model into a showroom as an ordinary uploaded model
 * (same storage layout and asset row as a manual .glb upload), so it is
 * published, duplicated and deleted exactly like one. Returns the asset key.
 */
export async function copyModelToShowroom(m: LibraryModel, showroomId: string): Promise<string> {
  const ws = await workspaceId()
  const id = crypto.randomUUID()
  const path = `${ws}/${showroomId}/${id}.glb`
  const { error: copyError } = await db().storage.from(BUCKET).copy(m.storagePath, path)
  if (copyError) throw new AiError('The model could not be added to this showroom.')
  const { error } = await db().from('assets').insert({
    id,
    showroom_id: showroomId,
    workspace_id: ws,
    storage_path: path,
    asset_type: 'model',
    mime_type: 'model/gltf-binary',
    file_size: m.fileSize,
    original_name: `${m.name}.glb`.slice(0, 200),
  })
  if (error) {
    await db().storage.from(BUCKET).remove([path])
    throw new AiError('The model could not be added to this showroom.')
  }
  return path
}


export function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
