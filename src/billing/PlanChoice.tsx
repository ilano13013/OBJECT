import { CreditCard, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { formatPrice, PLANS } from '@/lib/plans'
import { paymentsTestMode, startCheckout } from './client'

/** Offered when publishing needs a plan: buy this showroom, or start Studio. */
export function PlanChoice({ showroomId }: { showroomId: string }) {
  const [pending, setPending] = useState<'one' | 'studio' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [one, studio] = PLANS as [(typeof PLANS)[0], (typeof PLANS)[1]]

  async function go(plan: 'one' | 'studio') {
    setPending(plan)
    setError(null)
    try {
      await startCheckout(plan === 'one' ? { plan, showroomId } : { plan })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not start.')
      setPending(null)
    }
  }

  return (
    <div className="mt-5 grid gap-3">
      <button
        type="button"
        disabled={!!pending}
        onClick={() => void go('one')}
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg bg-lime px-4 text-left text-obsidian disabled:cursor-wait disabled:opacity-70"
      >
        <span>
          <span className="block text-sm font-semibold">{pending === 'one' ? 'Opening secure checkout…' : 'Buy this showroom'}</span>
          <span className="block text-xs opacity-75">One payment, stays live</span>
        </span>
        <span className="text-lg font-semibold tabular-nums">{formatPrice(one)}</span>
      </button>
      <button
        type="button"
        disabled={!!pending}
        onClick={() => void go('studio')}
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg px-4 text-left ring-1 ring-inset ring-silver/30 hover:ring-porcelain disabled:cursor-wait disabled:opacity-70"
      >
        <span>
          <span className="block text-sm font-semibold">{pending === 'studio' ? 'Opening secure checkout…' : 'Start Studio'}</span>
          <span className="block text-xs text-ash">Several showrooms, cancel anytime</span>
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {formatPrice(studio)}
          <span className="text-xs font-normal text-ash"> /month</span>
        </span>
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ash">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Payment is handled by Stripe. OBJECT. never sees your card. Publishing unlocks once Stripe confirms the payment.
      </p>
      {paymentsTestMode && (
        <p className="flex items-start gap-2 rounded-md bg-lime/10 p-2.5 text-xs leading-relaxed text-lime">
          <CreditCard aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Test mode: no real money moves. Use card 4242 4242 4242 4242, any future date, any CVC.
        </p>
      )}
    </div>
  )
}
