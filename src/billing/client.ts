import { cloudEnabled, supabase } from '@/lib/supabase'

/** Payments exist only with accounts (cloud mode). */
export const paymentsAvailable = cloudEnabled

/** Stripe stays in test mode until launch is authorised (VITE_PAYMENTS_LIVE=true). */
export const paymentsTestMode = import.meta.env.VITE_PAYMENTS_LIVE !== 'true'

export interface BillingOverview {
  plan: 'none' | 'one' | 'studio'
  subscription_status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  has_customer: boolean
  paid_showrooms: string[]
  allowance: number
  used: number
}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('Payments need an account.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to continue.')
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('We couldn’t reach the payment service. Check your connection. Nothing was charged.')
  }
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok) throw new Error(payload.error ?? 'Payment could not start. Nothing was charged.')
  return payload as T
}

/** Sends the merchant to Stripe Checkout. Payment is confirmed later by the server webhook, never by this page. */
export async function startCheckout(body: { plan: 'one'; showroomId: string } | { plan: 'studio' }) {
  const { url } = await call<{ url: string }>('/api/billing/checkout', body)
  window.location.assign(url)
}

export async function openBillingPortal() {
  const { url } = await call<{ url: string }>('/api/billing/portal', {})
  window.location.assign(url)
}

export async function billingOverview(): Promise<BillingOverview | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('billing_overview')
  if (error) throw new Error(error.message)
  return ((data as BillingOverview[])[0] as BillingOverview | undefined) ?? null
}

/**
 * After returning from Checkout: waits until the webhook has recorded the
 * payment (the page itself never decides a payment succeeded).
 */
export async function waitForPayment(check: (o: BillingOverview) => boolean, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const o = await billingOverview().catch(() => null)
    if (o && check(o)) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}
