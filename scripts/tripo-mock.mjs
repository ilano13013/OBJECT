#!/usr/bin/env node
/**
 * TEST DOUBLE of the Tripo OpenAPI (v2 task API) — for automated tests only.
 * It generates nothing: every successful task returns the same fixture cube
 * (e2e/fixtures/cube.glb). Never point a deployed site at it.
 *
 *   node scripts/tripo-mock.mjs [port=12122]
 *   TRIPO_API_BASE=http://127.0.0.1:12122/v2/openapi
 *
 * Control (tests): POST /__control {"mode": "ok" | "credits" | "rate" | "fail" | "banned" | "slow"}
 *                  GET  /__stats → { uploads, tasks, lastTask }
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const port = Number(process.argv[2] || process.env.TRIPO_MOCK_PORT || 12122)
const glb = readFileSync(fileURLToPath(new URL('../e2e/fixtures/cube.glb', import.meta.url)))
const KEY = process.env.TRIPO_MOCK_KEY || 'tsk_test_mock'

let mode = 'ok'
const stats = { uploads: 0, tasks: 0, lastTask: null }
const tasks = new Map()

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks)
  const url = new URL(req.url, 'http://x')

  if (url.pathname === '/__control') {
    mode = JSON.parse(raw.toString() || '{}').mode || 'ok'
    return send(res, 200, { mode })
  }
  if (url.pathname === '/__stats') return send(res, 200, stats)
  if (url.pathname === '/__reset') {
    mode = 'ok'
    stats.uploads = 0
    stats.tasks = 0
    stats.lastTask = null
    tasks.clear()
    return send(res, 200, {})
  }
  if (url.pathname === '/files/model.glb') {
    res.writeHead(200, { 'content-type': 'model/gltf-binary', 'content-length': glb.length })
    return res.end(glb)
  }

  if (req.headers.authorization !== `Bearer ${KEY}`) return send(res, 401, { code: 1002, message: 'Authentication failed' })

  if (req.method === 'POST' && url.pathname === '/v2/openapi/upload') {
    if (!/multipart\/form-data/.test(req.headers['content-type'] || '') || raw.length < 20) return send(res, 400, { code: 1004, message: 'bad file' })
    stats.uploads++
    return send(res, 200, { code: 0, data: { image_token: `img_${stats.uploads}_${Date.now()}` } })
  }

  if (req.method === 'POST' && url.pathname === '/v2/openapi/task') {
    if (mode === 'credits') return send(res, 403, { code: 2010, message: 'You need more credits to start a new task.' })
    if (mode === 'rate') return send(res, 429, { code: 2000, message: 'Too many concurrent tasks' }, { 'retry-after': '5' })
    const body = JSON.parse(raw.toString())
    stats.tasks++
    stats.lastTask = body
    const id = `task_${stats.tasks}_${Date.now()}`
    tasks.set(id, { polls: 0, outcome: mode })
    return send(res, 200, { code: 0, data: { task_id: id } })
  }

  const m = /^\/v2\/openapi\/task\/([\w-]+)$/.exec(url.pathname)
  if (req.method === 'GET' && m) {
    const t = tasks.get(m[1])
    if (!t) return send(res, 404, { code: 2001, message: 'Task not found' })
    t.polls++
    const ready = t.outcome === 'slow' ? 1e9 : 2
    if (t.polls < ready) return send(res, 200, { code: 0, data: { task_id: m[1], status: t.polls === 1 ? 'queued' : 'running', progress: Math.min(90, t.polls * 40) } })
    if (t.outcome === 'fail') return send(res, 200, { code: 0, data: { task_id: m[1], status: 'failed', progress: 0 } })
    if (t.outcome === 'banned') return send(res, 200, { code: 0, data: { task_id: m[1], status: 'banned', progress: 0 } })
    return send(res, 200, {
      code: 0,
      data: { task_id: m[1], status: 'success', progress: 100, output: { pbr_model: `http://127.0.0.1:${port}/files/model.glb` } },
    })
  }

  send(res, 404, { code: 404, message: 'not found' })
}).listen(port, '127.0.0.1', () => console.log(`tripo TEST DOUBLE on http://127.0.0.1:${port}/v2/openapi`))
