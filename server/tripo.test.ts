// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { imageType, isGlb, toError, TripoClient } from './tripo'

function stub(responses: Record<string, unknown>) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const key = Object.keys(responses).find((k) => url.endsWith(k))
    return new Response(JSON.stringify(key ? responses[key] : { code: 404 }), { status: key ? 200 : 404 })
  }) as unknown as typeof fetch
  return { calls, client: new TripoClient({ apiKey: 'tsk_secret', base: 'https://tripo.test/v2/openapi', modelVersion: 'v3.1-20260211', fetch: f }) }
}

describe('Tripo client', () => {
  it('sends the key only as a bearer header and requests H3.1 with PBR textures', async () => {
    const { calls, client } = stub({ '/task': { code: 0, data: { task_id: 't1' } } })
    expect(await client.createTask([{ token: 'tok', type: 'jpg' }])).toBe('t1')
    const body = JSON.parse(calls[0]!.init.body as string)
    expect(body).toEqual({ type: 'image_to_model', file: { type: 'jpg', file_token: 'tok' }, model_version: 'v3.1-20260211', texture: true, pbr: true, texture_quality: 'detailed' })
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer tsk_secret')
    expect(calls[0]!.url).not.toContain('tsk_secret')
  })

  it('maps several views to a 4-slot multiview task', async () => {
    const { calls, client } = stub({ '/task': { code: 0, data: { task_id: 't2' } } })
    await client.createTask([{ token: 'f', type: 'png' }, null, { token: 'b', type: 'png' }, null])
    const body = JSON.parse(calls[0]!.init.body as string)
    expect(body.type).toBe('multiview_to_model')
    expect(body.files).toEqual([{ type: 'png', file_token: 'f' }, {}, { type: 'png', file_token: 'b' }, {}])
  })

  it('requires a front view', async () => {
    const { client } = stub({})
    await expect(client.createTask([null, { token: 'l', type: 'jpg' }])).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('reads task status and prefers the PBR model', async () => {
    const { client } = stub({ '/task/t1': { code: 0, data: { status: 'success', progress: 100, output: { model: 'https://m/a.glb', pbr_model: 'https://m/pbr.glb' } } } })
    expect(await client.getTask('t1')).toEqual({ status: 'success', progress: 100, modelUrl: 'https://m/pbr.glb' })
  })

  it('maps documented error codes', () => {
    expect(toError(403, 2010, 'credits', null).kind).toBe('credits')
    expect(toError(429, 1007, 'rate', '7')).toMatchObject({ kind: 'rate_limited', retryAfter: 7 })
    expect(toError(429, 2000, 'concurrency', null).kind).toBe('rate_limited')
    expect(toError(401, 1002, 'auth', null).kind).toBe('auth')
    expect(toError(400, 2002, 'bad', null).kind).toBe('invalid')
    expect(toError(502, undefined, undefined, null).kind).toBe('upstream')
  })

  it('recognises GLB and photo formats by their bytes', () => {
    const glb = new Uint8Array(20)
    new DataView(glb.buffer).setUint32(0, 0x46546c67, true)
    new DataView(glb.buffer).setUint32(4, 2, true)
    new DataView(glb.buffer).setUint32(8, 20, true)
    expect(isGlb(glb)).toBe(true)
    expect(isGlb(new TextEncoder().encode('<html>not a model</html>'))).toBe(false)
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(imageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png')
    expect(imageType(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))).toBe('webp')
    expect(imageType(new TextEncoder().encode('GIF89a'))).toBeNull()
  })

  it('rejects a download that is not a GLB', async () => {
    const f = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch
    const client = new TripoClient({ apiKey: 'k', base: 'https://t', modelVersion: 'v', fetch: f })
    await expect(client.downloadModel('https://t/x.glb')).rejects.toMatchObject({ kind: 'upstream' })
  })
})
