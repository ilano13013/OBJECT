// @vitest-environment node
/**
 * Billing end to end against a Supabase-compatible stack and stripe-mock.
 * Opt-in: BILLING_IT=1 with SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY and stripe-mock on 127.0.0.1:12111.
 * Webhooks are signed exactly like Stripe signs them, then sent to the real
 * /api/stripe/webhook handler.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { beforeAll, describe, expect, it } from 'vitest'

const run = process.env.BILLING_IT === '1'
const WEBHOOK_SECRET = 'whsec_integration_test'
const RUN = Date.now().toString(36)

const env = {
  STRIPE_SECRET_KEY: 'sk_test_integration',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_ONE: 'price_one_test',
  STRIPE_PRICE_STUDIO: 'price_studio_test',
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  APP_URL: 'http://localhost:4174',
  STRIPE_API_HOST: '127.0.0.1',
  STRIPE_API_PORT: '12111',
  STRIPE_API_PROTOCOL: 'http',
}

describe.skipIf(!run)('billing (integration)', () => {
  let admin: SupabaseClient
  let user: SupabaseClient
  let intruder: SupabaseClient
  let token = ''
  let intruderToken = ''
  let workspaceId = ''
  let showroomId = ''
  let checkout: (req: Request) => Promise<Response>
  let webhook: (req: Request) => Promise<Response>
  let portal: (req: Request) => Promise<Response>

  const post = (handler: (r: Request) => Promise<Response>, path: string, body: unknown, auth = token) =>
    handler(
      new Request(`${env.APP_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${auth}`, origin: env.APP_URL },
        body: JSON.stringify(body),
      }),
    )

  const deliver = (event: object, secret = WEBHOOK_SECRET) => {
    const payload = JSON.stringify(event)
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret })
    return webhook(new Request(`${env.APP_URL}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': signature }, body: payload }))
  }

  const evt = (type: string, object: object) => ({ id: `evt_${type}_${Math.random().toString(36).slice(2)}`, object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object } })

  beforeAll(async () => {
    const anonKey = process.env.SUPABASE_ANON_KEY ?? ''
    admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    user = createClient(env.SUPABASE_URL, anonKey, { auth: { persistSession: false } })
    intruder = createClient(env.SUPABASE_URL, anonKey, { auth: { persistSession: false } })
    Object.assign(process.env, env)
    ;({ POST: checkout } = await import('../api/billing/checkout'))
    ;({ POST: webhook } = await import('../api/stripe/webhook'))
    ;({ POST: portal } = await import('../api/billing/portal'))
    // Fresh customers each run: stripe-mock returns a fixed customer id.
    await admin.from('workspaces').update({ stripe_customer_id: null }).not('stripe_customer_id', 'is', null)
    const email = `buyer-${Date.now()}@example.com`
    const signed = await user.auth.signUp({ email, password: 'correct-horse-battery' })
    token = signed.data.session!.access_token
    const other = await intruder.auth.signUp({ email: `intruder-${Date.now()}@example.com`, password: 'correct-horse-battery' })
    intruderToken = other.data.session!.access_token
    workspaceId = (await user.from('workspaces').select('id').single()).data!.id
    const created = await user.rpc('create_showroom', { p_title: 'Paid Vase', p_template: 'gallery', p_settings: {} })
    showroomId = (created.data as { id: string }).id
    await user.rpc('save_draft', { p_id: showroomId, p_settings: { mode: 'photo', productName: 'Paid Vase', images: [{ src: 'asset:x', alt: 'Vase' }] } })
  })

  it('refuses to publish before any payment', async () => {
    const { data } = await user.rpc('publish_showroom', { p_id: showroomId })
    expect(data[0].ok).toBe(false)
  })

  it('requires a signed-in user and an owned showroom', async () => {
    expect((await post(checkout, '/api/billing/checkout', { plan: 'one', showroomId }, 'not-a-token')).status).toBe(401)
    expect((await post(checkout, '/api/billing/checkout', { plan: 'one', showroomId }, intruderToken)).status).toBe(404)
    expect((await post(checkout, '/api/billing/checkout', { plan: 'gold' })).status).toBe(400)
  })

  it('a Checkout session alone does not unlock anything', async () => {
    const res = await post(checkout, '/api/billing/checkout', { plan: 'one', showroomId })
    expect(res.status).toBe(200)
    expect((await res.json()).url).toMatch(/^https?:\/\//)
    const { data: order } = await admin.from('orders').select('status, stripe_session_id').eq('showroom_id', showroomId).single()
    expect(order!.status).toBe('pending')
    const { data } = await user.rpc('publish_showroom', { p_id: showroomId })
    expect(data[0].ok).toBe(false)
  })

  it('forged or unsigned webhooks are rejected', async () => {
    const forged = await deliver(evt('checkout.session.completed', {}), 'whsec_attacker')
    expect(forged.status).toBe(400)
    const unsigned = await webhook(new Request(`${env.APP_URL}/api/stripe/webhook`, { method: 'POST', body: '{}' }))
    expect(unsigned.status).toBe(400)
  })

  it('a verified checkout.session.completed marks the order paid and unlocks publishing; replays are ignored', async () => {
    const { data: order } = await admin.from('orders').select('stripe_session_id').eq('showroom_id', showroomId).single()
    const event = evt('checkout.session.completed', {
      id: order!.stripe_session_id,
      object: 'checkout.session',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 4900,
      currency: 'eur',
      payment_intent: `pi_test_paid_vase_${RUN}`,
      metadata: { workspace_id: workspaceId, showroom_id: showroomId, plan: 'one' },
    })
    const first = await deliver(event)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ received: true, duplicate: false })
    const replay = await deliver(event)
    expect(await replay.json()).toEqual({ received: true, duplicate: true })
    const { data: paid } = await admin.from('orders').select('status, amount_total, currency').eq('showroom_id', showroomId).single()
    expect(paid).toEqual({ status: 'paid', amount_total: 4900, currency: 'eur' })
    const { data } = await user.rpc('publish_showroom', { p_id: showroomId })
    expect(data[0].ok).toBe(true)
  })

  it('if recording a payment fails, the webhook answers 500 so Stripe retries, and the event is not marked done', async () => {
    const event = evt('checkout.session.completed', {
      id: `cs_conflict_${RUN}`,
      object: 'checkout.session',
      mode: 'payment',
      payment_status: 'paid',
      // Re-uses the payment intent of the order paid above: the database refuses.
      payment_intent: `pi_test_paid_vase_${RUN}`,
      metadata: { workspace_id: workspaceId, showroom_id: showroomId, plan: 'one' },
    })
    const res = await deliver(event)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/try again/i)
    const { data } = await admin.from('stripe_events').select('id').eq('id', event.id)
    expect(data).toEqual([])
  })

  it('cannot buy the same showroom twice', async () => {
    expect((await post(checkout, '/api/billing/checkout', { plan: 'one', showroomId })).status).toBe(409)
  })

  it('a full refund takes the showroom offline', async () => {
    const res = await deliver(evt('charge.refunded', { id: 'ch_1', object: 'charge', refunded: true, payment_intent: `pi_test_paid_vase_${RUN}` }))
    expect(res.status).toBe(200)
    const { data: s } = await admin.from('showrooms').select('status').eq('id', showroomId).single()
    expect(s!.status).toBe('draft')
  })

  it('Studio: subscription events grant the quota; cancellation unpublishes', async () => {
    expect((await post(checkout, '/api/billing/checkout', { plan: 'studio' })).status).toBe(200)
    const { data: ws } = await admin.from('workspaces').select('stripe_customer_id').eq('id', workspaceId).single()
    const sub = {
      id: `sub_test_studio_${RUN}`,
      object: 'subscription',
      customer: ws!.stripe_customer_id,
      status: 'active',
      cancel_at_period_end: false,
      metadata: { workspace_id: workspaceId, plan: 'studio' },
      items: { object: 'list', data: [{ id: 'si_1', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    }
    expect((await deliver(evt('customer.subscription.created', sub))).status).toBe(200)
    const { data: row } = await admin.from('subscriptions').select('status, current_period_end').eq('workspace_id', workspaceId).single()
    expect(row!.status).toBe('active')
    expect(row!.current_period_end).toBeTruthy()

    const { data: pub } = await user.rpc('publish_showroom', { p_id: showroomId })
    expect(pub[0].ok).toBe(true)
    // Already subscribed: a second Studio checkout is refused.
    expect((await post(checkout, '/api/billing/checkout', { plan: 'studio' })).status).toBe(409)

    // Stripe sends `deleted` at the end of the paid period after a cancellation.
    expect((await deliver(evt('customer.subscription.deleted', { ...sub, status: 'canceled' }))).status).toBe(200)
    const { data: after } = await admin.from('showrooms').select('status').eq('id', showroomId).single()
    expect(after!.status).toBe('draft')
    const { data: s2 } = await admin.from('subscriptions').select('status').eq('workspace_id', workspaceId).single()
    expect(s2!.status).toBe('canceled')
  })

  it('payment failure keeps a grace period (past_due) before unpublishing', async () => {
    const { data: ws } = await admin.from('workspaces').select('stripe_customer_id').eq('id', workspaceId).single()
    const sub = {
      id: `sub_test_studio_2_${RUN}`,
      object: 'subscription',
      customer: ws!.stripe_customer_id,
      status: 'active',
      cancel_at_period_end: false,
      metadata: { workspace_id: workspaceId },
      items: { object: 'list', data: [{ id: 'si_2', current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    }
    await deliver(evt('customer.subscription.created', sub))
    await user.rpc('publish_showroom', { p_id: showroomId })
    await deliver(evt('customer.subscription.updated', { ...sub, status: 'past_due' }))
    expect((await admin.from('showrooms').select('status').eq('id', showroomId).single()).data!.status).toBe('published')
    await deliver(evt('customer.subscription.updated', { ...sub, status: 'unpaid' }))
    expect((await admin.from('showrooms').select('status').eq('id', showroomId).single()).data!.status).toBe('draft')
  })

  it('an old subscription’s late event cannot cancel a newer active one', async () => {
    const { data: ws } = await admin.from('workspaces').select('stripe_customer_id').eq('id', workspaceId).single()
    const base = { object: 'subscription', customer: ws!.stripe_customer_id, cancel_at_period_end: false, metadata: { workspace_id: workspaceId }, items: { object: 'list', data: [] } }
    await deliver(evt('customer.subscription.created', { ...base, id: `sub_new_${RUN}`, status: 'active' }))
    await deliver(evt('customer.subscription.deleted', { ...base, id: `sub_old_${RUN}`, status: 'canceled' }))
    expect((await admin.from('subscriptions').select('status, stripe_subscription_id').eq('workspace_id', workspaceId).single()).data).toEqual({
      status: 'active',
      stripe_subscription_id: `sub_new_${RUN}`,
    })
  })

  it('opens the billing portal for an existing customer', async () => {
    const res = await post(portal, '/api/billing/portal', {})
    expect(res.status).toBe(200)
    expect((await res.json()).url).toMatch(/^https?:\/\//)
  })

  it('the browser can read, but never write, its billing records', async () => {
    const { data } = await user.rpc('billing_overview')
    expect(data[0].plan).toBe('studio')
    const write = await user.from('orders').insert({ workspace_id: workspaceId, stripe_session_id: 'cs_fake', status: 'paid' })
    expect(write.error).toBeTruthy()
    const upd = await user.from('subscriptions').update({ status: 'active' }).eq('workspace_id', workspaceId)
    expect(upd.error).toBeTruthy()
  })
})
