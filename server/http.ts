import { ConfigError } from './env'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Stable machine-readable reason the client can branch on. */
    public code?: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

export function bearer(req: Request): string {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (!m) throw new HttpError(401, 'Sign in to continue.')
  return m[1]!
}

/** Same-origin check for browser calls: blocks cross-site form posts. */
export function assertSameOrigin(req: Request, appUrl: string) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(appUrl).origin) throw new HttpError(403, 'Request refused.')
}

export async function readJson<T>(req: Request, maxBytes = 4096): Promise<T> {
  const text = await req.text()
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large.')
  try {
    return JSON.parse(text || '{}') as T
  } catch {
    throw new HttpError(400, 'Invalid request.')
  }
}

/** Wraps a handler: HttpError → its status, anything else → 500 without leaking details. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json(e.code ? { error: e.message, code: e.code } : { error: e.message }, e.status)
      if (e instanceof ConfigError) return json({ error: e.message }, 503)
      console.error('[api] unexpected error', e)
      return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500)
    }
  }
}
