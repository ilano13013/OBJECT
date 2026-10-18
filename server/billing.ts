import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import type { ServerEnv } from './env'
import { HttpError } from './http'

export interface BillingDeps {
  env: ServerEnv
  stripe: Stripe
  db: SupabaseClient
}

export function makeDeps(env: ServerEnv): BillingDeps {
  const stripe = new Stripe(env.stripeSecretKey, {
    maxNetworkRetries: 2,
    timeout: 15_000,
    ...(env.stripeApiHost ? { host: env.stripeApiHost, port: env.stripeApiPort, protocol: env.stripeApiProtocol } : {}),
  })
  const db = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return { env, stripe, db }
}

interface Workspace {
  id: string
  stripe_customer_id: string | null
}

/** Resolves the signed-in user from their Supabase access token (verified by Supabase Auth). */
async function currentUser(deps: BillingDeps, token: string) {
  const { data, error } = await deps.db.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Sign in again.')
  return data.user
}

async function workspaceOf(deps: BillingDeps, userId: string): Promise<Workspace> {
  const { data, error } = await deps.db.from('workspaces').select('id, stripe_customer_id').eq('owner_id', userId).order('created_at').limit(1).single()
  if (error || !data) throw new HttpError(404, 'No studio found for this account.')
  return data as Workspace
}

async function ensureCustomer(deps: BillingDeps, ws: Workspace, email: string | undefined): Promise<string> {
  if (ws.stripe_customer_id) return ws.stripe_customer_id
  const customer = await deps.stripe.customers.create(
    { email, metadata: { workspace_id: ws.id } },
    { idempotencyKey: `customer-${ws.id}` },
  )
  // Only set it if no concurrent request did first.
  const { data } = await deps.db
    .from('workspaces')
    .update({ stripe_customer_id: customer.id })
    .eq('id', ws.id)
    .is('stripe_customer_id', null)
    .select('stripe_customer_id')
  if (data && data.length) return customer.id
  const { data: again } = await deps.db.from('workspaces').select('stripe_customer_id').eq('id', ws.id).single()
  return (again?.stripe_customer_id as string) ?? customer.id
}

export type CheckoutRequest = { plan: 'one'; showroomId: string } | { plan: 'studio' }

const ACTIVE = ['active', 'trialing', 'past_due']

export async function createCheckout(deps: BillingDeps, token: string, body: CheckoutRequest): Promise<{ url: string }> {
  const user = await currentUser(deps, token)
  const ws = await workspaceOf(deps, user.id)
  const { env, stripe, db } = deps

  if (body?.plan === 'one') {
    if (typeof body.showroomId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.showroomId)) throw new HttpError(400, 'Choose a showroom to buy.')
    const { data: showroom } = await db.from('showrooms').select('id, title').eq('id', body.showroomId).eq('workspace_id', ws.id).maybeSingle()
    if (!showroom) throw new HttpError(404, 'Showroom not found.')
    const { data: paid } = await db.from('orders').select('id').eq('showroom_id', showroom.id).eq('status', 'paid').maybeSingle()
    if (paid) throw new HttpError(409, 'This showroom is already paid for. You can publish it.')
    const customer = await ensureCustomer(deps, ws, user.email)
    const back = `${env.appUrl}/studio/${showroom.id}`
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: ws.id,
      line_items: [{ price: env.priceOne, quantity: 1 }],
      metadata: { workspace_id: ws.id, showroom_id: showroom.id, plan: 'one' },
      payment_intent_data: { metadata: { workspace_id: ws.id, showroom_id: showroom.id, plan: 'one' } },
      invoice_creation: { enabled: true },
      success_url: `${back}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?checkout=cancelled`,
    })
    const { error } = await db.from('orders').insert({ workspace_id: ws.id, showroom_id: showroom.id, stripe_session_id: session.id, status: 'pending' })
    if (error) throw new Error(`order insert failed: ${error.message}`)
    if (!session.url) throw new Error('Stripe returned no checkout URL')
    return { url: session.url }
  }

  if (body?.plan === 'studio') {
    const { data: sub } = await db.from('subscriptions').select('status').eq('workspace_id', ws.id).maybeSingle()
    if (sub && ACTIVE.includes(sub.status as string)) throw new HttpError(409, 'Studio is already active. Manage it from the billing portal.')
    const customer = await ensureCustomer(deps, ws, user.email)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: ws.id,
      line_items: [{ price: env.priceStudio, quantity: 1 }],
      metadata: { workspace_id: ws.id, plan: 'studio' },
      subscription_data: { metadata: { workspace_id: ws.id, plan: 'studio' } },
      success_url: `${env.appUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/account?checkout=cancelled`,
    })
    if (!session.url) throw new Error('Stripe returned no checkout URL')
    return { url: session.url }
  }

  throw new HttpError(400, 'Choose One Showroom or Studio.')
}

export async function createPortal(deps: BillingDeps, token: string): Promise<{ url: string }> {
  const user = await currentUser(deps, token)
  const ws = await workspaceOf(deps, user.id)
  if (!ws.stripe_customer_id) throw new HttpError(404, 'No billing account yet. It is created with your first purchase.')
  const session = await deps.stripe.billingPortal.sessions.create({ customer: ws.stripe_customer_id, return_url: `${deps.env.appUrl}/account` })
  return { url: session.url }
}

// ── Webhook ────────────────────────────────────────────────────────────────

/** Verifies Stripe's signature on the raw body. Throws 400 on any mismatch. */
export function verifyEvent(deps: BillingDeps, rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new HttpError(400, 'Missing signature.')
  try {
    return deps.stripe.webhooks.constructEvent(rawBody, signature, deps.env.stripeWebhookSecret)
  } catch {
    throw new HttpError(400, 'Invalid signature.')
  }
}

async function workspaceForCustomer(deps: BillingDeps, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null, hint?: string | null) {
  if (hint) return hint
  const id = typeof customer === 'string' ? customer : customer?.id
  if (!id) return null
  const { data } = await deps.db.from('workspaces').select('id').eq('stripe_customer_id', id).maybeSingle()
  return (data?.id as string) ?? null
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  const ts = item?.current_period_end ?? legacy
  return ts ? new Date(ts * 1000).toISOString() : null
}

async function syncSubscription(deps: BillingDeps, sub: Stripe.Subscription) {
  const ws = await workspaceForCustomer(deps, sub.customer, sub.metadata?.workspace_id)
  if (!ws) return
  const { data: existing } = await deps.db.from('subscriptions').select('stripe_subscription_id, status').eq('workspace_id', ws).maybeSingle()
  // An event about an older subscription must not overwrite a newer active one.
  if (existing && existing.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && ACTIVE.includes(existing.status as string) && !ACTIVE.includes(sub.status)) return
  const { error } = await deps.db.from('subscriptions').upsert(
    {
      workspace_id: ws,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: 'workspace_id' },
  )
  if (error) throw new Error(`subscription upsert failed: ${error.message}`)
  if (!ACTIVE.includes(sub.status)) await enforce(deps, ws)
}

async function enforce(deps: BillingDeps, workspace: string) {
  const { error } = await deps.db.rpc('enforce_entitlement', { p_workspace: workspace })
  if (error) throw new Error(`entitlement enforcement failed: ${error.message}`)
}

async function markOrder(deps: BillingDeps, session: Stripe.Checkout.Session, status: 'paid' | 'failed') {
  const workspace = session.metadata?.workspace_id
  const showroom = session.metadata?.showroom_id
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  const patch = { status, amount_total: session.amount_total, currency: session.currency, stripe_payment_intent_id: paymentIntent }
  // Errors are thrown, never swallowed: the webhook then answers 500 and Stripe retries.
  const { data, error } = await deps.db.from('orders').update(patch).eq('stripe_session_id', session.id).select('id')
  if (error) throw new Error(`order update failed: ${error.message}`)
  if (data.length === 0 && workspace) {
    // The order row is created at checkout; recreate it if it is missing.
    const { error: insertError } = await deps.db
      .from('orders')
      .insert({ workspace_id: workspace, showroom_id: showroom ?? null, stripe_session_id: session.id, ...patch })
    if (insertError) throw new Error(`order insert failed: ${insertError.message}`)
  }
}

/**
 * Applies one verified Stripe event. Idempotent: each event id is recorded
 * and replays are ignored. Returns false for an already-processed event.
 */
export async function applyEvent(deps: BillingDeps, event: Stripe.Event): Promise<boolean> {
  const { error: dup } = await deps.db.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dup) {
    if (dup.code === '23505') return false
    throw new Error(`event log failed: ${dup.message}`)
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object
        if (s.mode === 'payment' && s.payment_status === 'paid') await markOrder(deps, s, 'paid')
        if (s.mode === 'subscription' && s.subscription) {
          const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
          await syncSubscription(deps, await deps.stripe.subscriptions.retrieve(id))
        }
        break
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const s = event.data.object
        if (s.mode === 'payment') await markOrder(deps, s, 'failed')
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(deps, event.data.object)
        break
      case 'charge.refunded': {
        const charge = event.data.object
        if (!charge.refunded) break // partial refunds keep the purchase
        const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!pi) break
        const { data, error } = await deps.db.from('orders').update({ status: 'refunded' }).eq('stripe_payment_intent_id', pi).select('workspace_id')
        if (error) throw new Error(`refund update failed: ${error.message}`)
        for (const row of data) await enforce(deps, row.workspace_id as string)
        break
      }
      default:
        break
    }
  } catch (e) {
    // Let Stripe retry: forget the event so the retry is processed.
    await deps.db.from('stripe_events').delete().eq('id', event.id)
    throw e
  }
  return true
}
