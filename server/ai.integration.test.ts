// @vitest-environment node
/**
 * AI generation end to end against a Supabase-compatible stack and the Tripo
 * TEST DOUBLE (scripts/tripo-mock.mjs — returns a fixture cube, generates
 * nothing). Proves the server enforces subscription + quota before any Tripo
 * call, stores the GLB in the library, and releases quota on failures.
 * Opt-in: AI_IT=1 with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * and the mock on 127.0.0.1:12122.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const run = process.env.AI_IT === '1'
const MOCK = 'http://127.0.0.1:12122'
const env = {
  TRIPO_API_KEY: 'tsk_test_mock',
  TRIPO_API_BASE: `${MOCK}/v2/openapi`,
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  APP_URL: 'http://localhost:4174',
}
const photo = readFileSync(new URL('../e2e/fixtures/product.webp', import.meta.url))

describe.skipIf(!run)('AI generation (integration, Tripo test double)', () => {
  let admin: SupabaseClient
  let generate: (req: Request) => Promise<Response>
  let status: (req: Request) => Promise<Response>

  const control = (mode: string) => fetch(`${MOCK}/__control`, { method: 'POST', body: JSON.stringify({ mode }) })
  const stats = async () => (await (await fetch(`${MOCK}/__stats`)).json()) as { uploads: number; tasks: number; lastTask: Record<string, unknown> }
  const post = (handler: (r: Request) => Promise<Response>, path: string, body: unknown, token: string) =>
    handler(
      new Request(`${env.APP_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: env.APP_URL },
        body: JSON.stringify(body),
      }),
    )

  interface Account {
    client: SupabaseClient
    token: string
    ws: string
  }
  async function account(label: string): Promise<Account> {
    const client = createClient(env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY ?? '', { auth: { persistSession: false } })
    const { data } = await client.auth.signUp({ email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'correct-horse-battery' })
    const ws = (await client.from('workspaces').select('id').single()).data!.id as string
    return { client, token: data.session!.access_token, ws }
  }
  async function subscribe(a: Account, status = 'active', end = Date.now() + 20 * 864e5) {
    await admin.from('subscriptions').upsert(
      { workspace_id: a.ws, stripe_subscription_id: `sub_${a.ws.slice(0, 8)}`, status, current_period_start: new Date().toISOString(), current_period_end: new Date(end).toISOString() },
      { onConflict: 'workspace_id' },
    )
  }
  /** Uploads photos as the merchant (RLS), like the studio does. */
  async function photos(a: Account, views = [0]) {
    const requestId = crypto.randomUUID()
    const inputs: string[] = []
    for (const v of views) {
      const path = `${a.ws}/ai-inputs/${requestId}/${v}.webp`
      const { error } = await a.client.storage.from('showroom-assets').upload(path, new Blob([photo], { type: 'image/webp' }), { contentType: 'image/webp' })
      expect(error).toBeNull()
      inputs.push(path)
    }
    return { requestId, inputs, name: 'Test vase' }
  }
  async function poll(a: Account, id: string) {
    for (let i = 0; i < 6; i++) {
      const g = await (await post(status, '/api/ai/status', { id }, a.token)).json()
      if (g.status !== 'running') return g
    }
    throw new Error('generation did not finish')
  }
  const quota = async (a: Account) => ((await a.client.rpc('ai_quota')).data as { used: number; quota: number; eligible: boolean; reason: string | null }[])[0]!

  beforeAll(async () => {
    admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    Object.assign(process.env, env)
    ;({ POST: generate } = await import('../api/ai/generate'))
    ;({ POST: status } = await import('../api/ai/status'))
  })
  beforeEach(async () => {
    await fetch(`${MOCK}/__reset`)
  })

  it('refuses a free account and a One Showroom buyer without calling Tripo', async () => {
    const free = await account('free')
    const res = await post(generate, '/api/ai/generate', await photos(free), free.token)
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_subscribed')

    const buyer = await account('oneoff')
    const room = (await buyer.client.rpc('create_showroom', { p_title: 'Bought', p_template: 'orbit', p_settings: {} })).data as { id: string }
    await admin.from('orders').insert({ workspace_id: buyer.ws, showroom_id: room.id, stripe_session_id: `cs_${Date.now()}`, status: 'paid' })
    const res2 = await post(generate, '/api/ai/generate', await photos(buyer), buyer.token)
    expect(res2.status).toBe(403)
    expect((await res2.json()).code).toBe('not_subscribed')

    expect((await stats()).tasks).toBe(0)
    expect((await stats()).uploads).toBe(0)
  })

  it('refuses unauthenticated calls and an expired subscription', async () => {
    const res = await generate(new Request(`${env.APP_URL}/api/ai/generate`, { method: 'POST', body: '{}', headers: { origin: env.APP_URL } }))
    expect(res.status).toBe(401)
    const lapsed = await account('lapsed')
    await subscribe(lapsed, 'active', Date.now() - 864e5)
    const res2 = await post(generate, '/api/ai/generate', await photos(lapsed), lapsed.token)
    expect((await res2.json()).code).toBe('period_ended')
    await subscribe(lapsed, 'canceled')
    const res3 = await post(generate, '/api/ai/generate', await photos(lapsed), lapsed.token)
    expect((await res3.json()).code).toBe('not_subscribed')
    expect((await stats()).tasks).toBe(0)
  })

  it('single photo: generates, stores a real GLB in the library, counts one', async () => {
    const a = await account('single')
    await subscribe(a)
    const body = await photos(a)
    const res = await post(generate, '/api/ai/generate', body, a.token)
    expect(res.status).toBe(200)
    const started = await res.json()
    expect(started.status).toBe('running')
    const task = (await stats()).lastTask
    expect(task).toMatchObject({ type: 'image_to_model', model_version: 'v3.1-20260211', texture: true, pbr: true })
    expect((task.file as { file_token: string }).file_token).toMatch(/^img_/)

    // Duplicate delivery of the same click: same generation, no second task.
    const again = await (await post(generate, '/api/ai/generate', body, a.token)).json()
    expect(again.id).toBe(started.id)
    expect((await stats()).tasks).toBe(1)

    const done = await poll(a, started.id)
    expect(done.status).toBe('succeeded')
    expect(done.progress).toBe(100)
    const { data: model } = await a.client.from('library_models').select('*').eq('id', done.libraryModelId).single()
    expect(model.storage_path).toBe(`${a.ws}/library/${model.id}.glb`)
    expect(model.name).toBe('Test vase')
    const { data: file } = await a.client.storage.from('showroom-assets').download(model.storage_path)
    const bytes = new Uint8Array(await file!.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('glTF')
    expect(bytes.byteLength).toBe(model.file_size)
    expect(await quota(a)).toMatchObject({ used: 1, quota: 5, eligible: true })

    // Another account cannot read it or poll it.
    const other = await account('other')
    expect((await other.client.from('library_models').select('id').eq('id', model.id)).data).toEqual([])
    expect((await post(status, '/api/ai/status', { id: started.id }, other.token)).status).toBe(404)
  })

  it('multiple photos: sends a multiview task in front, left, back, right order', async () => {
    const a = await account('multi')
    await subscribe(a)
    const res = await post(generate, '/api/ai/generate', await photos(a, [0, 2, 3]), a.token)
    expect(res.status).toBe(200)
    const task = (await stats()).lastTask as { type: string; files: Record<string, string>[] }
    expect(task.type).toBe('multiview_to_model')
    expect(task.files).toHaveLength(4)
    expect(task.files[0]!.file_token).toBeTruthy()
    expect(task.files[1]).toEqual({})
    expect(task.files[2]!.file_token).toBeTruthy()
    expect(task.files[3]!.file_token).toBeTruthy()
    expect((await poll(a, (await res.json()).id)).status).toBe('succeeded')
  })

  it('without a front photo: refused before reserving', async () => {
    const a = await account('nofront')
    await subscribe(a)
    const res = await post(generate, '/api/ai/generate', await photos(a, [1, 2]), a.token)
    expect(res.status).toBe(400)
    expect((await quota(a)).used).toBe(0)
  })

  it('Tripo technical failures give the generation back', async () => {
    const a = await account('failures')
    await subscribe(a)
    await control('credits')
    let res = await post(generate, '/api/ai/generate', await photos(a), a.token)
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('tripo_credits')
    await control('rate')
    res = await post(generate, '/api/ai/generate', await photos(a), a.token)
    expect(res.status).toBe(429)
    await control('fail')
    res = await post(generate, '/api/ai/generate', await photos(a), a.token)
    const failed = await poll(a, (await res.json()).id)
    expect(failed.status).toBe('released')
    expect(failed.error).toMatch(/not used/)
    expect(await quota(a)).toMatchObject({ used: 0, eligible: true })
  })

  it('a content refusal (banned) counts; 4 used allows a fifth, then blocks; regeneration consumes', async () => {
    const a = await account('quota')
    await subscribe(a)
    await control('banned')
    const banned = await poll(a, (await (await post(generate, '/api/ai/generate', await photos(a), a.token)).json()).id)
    expect(banned.status).toBe('failed')
    await control('ok')
    for (let i = 0; i < 3; i++) await poll(a, (await (await post(generate, '/api/ai/generate', await photos(a), a.token)).json()).id)
    expect((await quota(a)).used).toBe(4)
    const fifth = await post(generate, '/api/ai/generate', await photos(a), a.token)
    expect(fifth.status).toBe(200)
    await poll(a, (await fifth.json()).id)
    const sixth = await post(generate, '/api/ai/generate', await photos(a), a.token)
    expect(sixth.status).toBe(403)
    expect((await sixth.json()).code).toBe('quota_exhausted')
    expect((await stats()).tasks).toBe(5)

    // Renewal confirmed by Stripe (new period end): quota back to 5.
    await subscribe(a, 'active', Date.now() + 31 * 864e5)
    expect(await quota(a)).toMatchObject({ used: 0, eligible: true })
  })

  it('concurrent requests (several tabs or devices) can never exceed the quota', async () => {
    const a = await account('race')
    await subscribe(a)
    // 4 already used this period.
    for (let i = 0; i < 4; i++) await poll(a, (await (await post(generate, '/api/ai/generate', await photos(a), a.token)).json()).id)
    const bodies = await Promise.all(Array.from({ length: 6 }, () => photos(a)))
    const results = await Promise.all(bodies.map((b) => post(generate, '/api/ai/generate', b, a.token)))
    const ok = results.filter((r) => r.status === 200)
    expect(ok).toHaveLength(1)
    expect((await stats()).tasks).toBe(5)
    await poll(a, (await ok[0]!.json()).id)
    expect((await quota(a)).used).toBe(5)
  })
})
