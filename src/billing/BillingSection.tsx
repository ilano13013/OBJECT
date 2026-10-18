import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatPrice, PLANS } from '@/lib/plans'
import { billingOverview, openBillingPortal, paymentsTestMode, startCheckout, waitForPayment, type BillingOverview } from './client'

const PLAN_LABEL = { none: 'No plan yet', one: 'One Showroom', studio: 'Studio' } as const
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const STATUS_NOTE: Record<string, string> = {
  past_due: 'Your last payment failed. Stripe retries automatically; update your card in the billing portal to keep your showrooms live.',
  unpaid: 'Payments failed and Studio is suspended. Showrooms beyond your purchases were unpublished; drafts are kept.',
  canceled: 'Studio has ended. Showrooms bought with One Showroom stay live; drafts are kept.',
  incomplete: 'Your Studio payment needs confirmation. Open the billing portal to finish it.',
}

export function BillingSection() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<BillingOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'studio' | 'portal' | null>(null)
  const [returning, setReturning] = useState<null | 'confirming' | 'confirmed' | 'slow' | 'cancelled'>(() =>
    params.get('checkout') === 'success' ? 'confirming' : params.get('checkout') === 'cancelled' ? 'cancelled' : null,
  )
  const highlightStudio = params.get('plan') === 'studio'
  const studio = PLANS.find((p) => p.id === 'studio')!

  useEffect(() => {
    billingOverview().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Billing is unavailable.'))
    if (!params.get('checkout')) return
    setParams({}, { replace: true })
    if (params.get('checkout') !== 'success') return
    let alive = true
    waitForPayment((o) => o.plan === 'studio').then(async (ok) => {
      if (!alive) return
      setReturning(ok ? 'confirmed' : 'slow')
      setData(await billingOverview().catch(() => null))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function act(kind: 'studio' | 'portal') {
    setPending(kind)
    setError(null)
    try {
      if (kind === 'studio') await startCheckout({ plan: 'studio' })
      else await openBillingPortal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.')
      setPending(null)
    }
  }

  const active = data?.subscription_status && ['active', 'trialing', 'past_due'].includes(data.subscription_status)

  return (
    <section aria-labelledby="plan-h" className="grid gap-5 border-t border-hairline pt-10">
      <h2 id="plan-h" className="text-xl font-semibold tracking-tight">
        Plan & billing
      </h2>
      {returning && (
        <p role="status" className={`rounded-md p-3 text-sm ${returning === 'confirmed' ? 'bg-lime text-obsidian' : 'bg-white/5 text-silver'}`}>
          {returning === 'confirming' && 'Payment received by Stripe. Confirming your subscription…'}
          {returning === 'confirmed' && 'Studio is active. Welcome.'}
          {returning === 'slow' && 'Stripe hasn’t confirmed yet. It can take a minute: reload this page shortly. You won’t be charged twice.'}
          {returning === 'cancelled' && 'Checkout cancelled. Nothing was charged.'}
        </p>
      )}
      {data ? (
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <dt className="meta text-ash">Current plan</dt>
            <dd className="mt-1 text-lg">{PLAN_LABEL[data.plan]}</dd>
          </div>
          <div>
            <dt className="meta text-ash">Publishing slots</dt>
            <dd className="mt-1 text-lg tabular-nums">
              {data.used} / {data.allowance}
              {data.paid_showrooms.length > 0 && <span className="block text-xs text-ash">+ {data.paid_showrooms.length} bought separately</span>}
            </dd>
          </div>
          {data.current_period_end && active && (
            <div>
              <dt className="meta text-ash">{data.cancel_at_period_end ? 'Ends on' : 'Renews on'}</dt>
              <dd className="mt-1 text-lg">{dateFmt.format(new Date(data.current_period_end))}</dd>
            </div>
          )}
        </dl>
      ) : (
        !error && <p className="text-sm text-ash">Loading your plan…</p>
      )}
      {data?.subscription_status && STATUS_NOTE[data.subscription_status] && <p className="text-sm leading-relaxed text-[#ffcf8f]">{STATUS_NOTE[data.subscription_status]}</p>}
      {data?.cancel_at_period_end && active && (
        <p className="text-sm text-silver">Studio is cancelled and stays active until the end of the paid period. Then showrooms beyond your purchases are unpublished; drafts are kept.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#ff9d8f]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {data && !active && (
          <button
            type="button"
            disabled={!!pending}
            onClick={() => void act('studio')}
            className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-6 text-sm font-semibold disabled:cursor-wait disabled:opacity-70 ${
              highlightStudio || data.plan === 'none' ? 'bg-lime text-obsidian' : 'bg-porcelain text-obsidian'
            }`}
          >
            {pending === 'studio' ? 'Opening secure checkout…' : `Start Studio · ${formatPrice(studio)} / month`}
          </button>
        )}
        {data?.has_customer && (
          <button
            type="button"
            disabled={!!pending}
            onClick={() => void act('portal')}
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain disabled:cursor-wait disabled:opacity-70"
          >
            <ExternalLink aria-hidden className="size-4" /> {pending === 'portal' ? 'Opening…' : 'Invoices, card and cancellation'}
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-ash">
        One Showroom ({formatPrice(PLANS[0]!)}) is bought from the editor when you publish a showroom. Studio covers up to {data?.allowance && active ? data.allowance : 5} live
        showrooms. Cancel anytime: showrooms stay live until the end of the paid period.
        {paymentsTestMode && ' Test mode: no real money moves.'}
      </p>
    </section>
  )
}
