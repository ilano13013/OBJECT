import type { Plugin } from 'vite'

/**
 * Serves /api/* in `vite dev` with the same Web-standard handlers Vercel runs
 * (export async function POST(req: Request): Response).
 */
export function apiDev(): Plugin {
  return {
    name: 'object-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const path = req.url.split('?')[0]!
        if (!/^\/api\/[a-z0-9/-]+$/.test(path)) {
          res.statusCode = 404
          return res.end()
        }
        let mod: Record<string, unknown>
        try {
          mod = await server.ssrLoadModule(`${path}.ts`)
        } catch {
          res.statusCode = 404
          return res.end()
        }
        const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
        if (!handler) {
          res.statusCode = 405
          return res.end()
        }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
        const response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }))
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}
