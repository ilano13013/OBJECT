import { Check, Minus } from 'lucide-react'
import { LinkButton } from '@/components/Button'
import { formatPrice, PLANS } from '@/lib/plans'

export function Pricing() {
  const [one, studio] = PLANS as [(typeof PLANS)[0], (typeof PLANS)[1]]
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="gutter relative py-28 md:py-40">
      <div className="grid gap-6 md:grid-cols-12">
        <h2 id="pricing-title" className="display text-[clamp(2.4rem,7vw,6.5rem)] md:col-span-7">
          Pay for <span className="text-silver">what you</span> show.
        </h2>
        <p className="max-w-sm self-end text-silver md:col-span-5 md:justify-self-end">
          No setup fee, no commission on your sales. Purchases happen on your own store.
        </p>
      </div>

      <div className="mt-16 grid gap-px overflow-hidden rounded-sm bg-hairline md:mt-24 md:grid-cols-12">
        {[one, studio].map((plan) => {
          const featured = plan.id === 'studio'
          return (
            <article
              key={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={`relative flex flex-col p-6 md:p-10 ${featured ? 'bg-graphite md:col-span-7' : 'bg-graphite-2 md:col-span-5'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 id={`plan-${plan.id}`} className="meta text-silver">
                  {plan.name}
                </h3>
                {featured && <span className="meta rounded-full bg-lime px-3 py-1 text-obsidian">For collections</span>}
              </div>
              <p className="mt-8 flex items-baseline gap-3">
                <span className="display text-[clamp(4rem,9vw,8rem)] tabular-nums">{formatPrice(plan)}</span>
                <span className="text-silver">{plan.cadence}</span>
              </p>
              <p className="mt-4 max-w-md text-lg text-porcelain">{plan.pitch}</p>

              <div className="mt-10 grid gap-10 sm:grid-cols-2">
                <div>
                  <h4 className="meta mb-4 text-ash">Included</h4>
                  <ul className="space-y-3 text-sm text-porcelain">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="meta mb-4 text-ash">Limits & usage rights</h4>
                  <ul className="space-y-3 text-sm text-silver">
                    {plan.limits.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-ash" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-auto pt-12">
                <LinkButton to={plan.id === 'studio' ? '/account?plan=studio' : '/studio/new'} variant={featured ? 'primary' : 'ghost'}>
                  {featured ? 'Start Studio' : 'Create one showroom'}
                </LinkButton>
              </div>
            </article>
          )
        })}
      </div>
      <p className="mt-6 text-sm text-ash">
        Prices include VAT where applicable. You only pay when you publish: drafts and previews are free.
      </p>
    </section>
  )
}
