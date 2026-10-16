// Minimal stand-in for Supabase's API gateway: one origin, three services.
import http from 'node:http'

const routes = [
  ['/rest/v1', 3000, ''],
  ['/auth/v1', 9999, ''],
  ['/storage/v1', 5000, ''],
]
const port = Number(process.env.GATEWAY_PORT ?? 54321)

http
  .createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': req.headers.origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
      'access-control-expose-headers': 'content-range, content-length, content-type, x-upsert, etag',
    }
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
    const route = routes.find(([p]) => req.url.startsWith(p + '/') || req.url === p)
    if (!route) return res.writeHead(404, cors).end('no route')
    const [prefix, target] = route
    const headers = { ...req.headers, host: `127.0.0.1:${target}` }
    // PostgREST/storage want the bearer token; supabase-js always sends one (anon key when signed out).
    const upstream = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url.slice(prefix.length) || '/', headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors })
      up.pipe(res)
    })
    upstream.on('error', (e) => res.writeHead(502, cors).end(String(e)))
    req.pipe(upstream)
  })
  .listen(port, () => console.log(`gateway on http://127.0.0.1:${port}`))
