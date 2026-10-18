import { ArrowLeft, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { backend, type StatsDay } from '@/studio/backend'
import { exampleStats, summarise } from '@/studio/stats/exampleStats'
import { StatsChart, StatsTable } from '@/studio/stats/StatsChart'
import { useShowroom } from '@/studio/store'
import NotFound from '../NotFound'
import { StudioShell } from './StudioShell'

const pct = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('en-GB')

export default function Stats() {
  const { id } = useParams()
  const { showroom, loaded } = useShowroom(id)
  const [days, setDays] = useState<7 | 30>(30)
  const [series, setSeries] = useState<StatsDay[] | null>(null)
  const [example, setExample] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [table, setTable] = useState(false)

  useEffect(() => {
    if (!showroom) return
    let alive = true
    setSeries(null)
    backend
      .stats(showroom.id, days)
      .then((s) => {
        if (!alive) return
        if (s === null) {
          setExample(true)
          setSeries(exampleStats(days))
        } else {
          setExample(false)
          setSeries(s)
        }
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Couldn’t load statistics.'))
    return () => {
      alive = false
    }
  }, [showroom, days])

  useEffect(() => {
    if (showroom) document.title = `Statistics · ${showroom.draft.productName} · OBJECT.`
  }, [showroom])

  if (!showroom) return loaded ? <NotFound /> : <StudioShell>{null}</StudioShell>
  const total = series ? summarise(series) : null

  return (
    <StudioShell>
      <main className="gutter grid gap-10 py-10 md:py-14">
        <div className="grid gap-4">
          <Link to="/studio" className="inline-flex w-fit items-center gap-2 text-sm text-silver hover:text-porcelain">
            <ArrowLeft aria-hidden className="size-4" /> My showrooms
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h1 className="display text-[clamp(2rem,4.5vw,3.5rem)]">{showroom.draft.productName || 'Untitled'}</h1>
            <div role="radiogroup" aria-label="Period" className="flex gap-1 rounded-lg bg-graphite-2 p-1 ring-1 ring-inset ring-hairline">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={days === d}
                  onClick={() => setDays(d)}
                  className={`min-h-10 cursor-pointer rounded-md px-4 text-sm ${days === d ? 'bg-porcelain text-obsidian' : 'text-silver hover:text-porcelain'}`}
                >
                  Last {d} days
                </button>
              ))}
            </div>
          </div>
        </div>

        {example && (
          <div role="note" className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-4 text-sm text-silver ring-1 ring-inset ring-dashed ring-silver/30">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
            <p>
              <strong className="font-semibold text-porcelain">Example data.</strong> These numbers are made up to show the layout. Real statistics are recorded
              once your account is connected and your showroom is published.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}

        {total && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-hairline py-8 md:grid-cols-4">
            {[
              ['Views', num.format(total.views)],
              ['Visitors (approx.)', num.format(total.visitors)],
              ['Purchase clicks', num.format(total.clicks)],
              ['Click rate', total.visitors ? pct.format(total.rate) : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="meta text-ash">{label}</dt>
                <dd className="display mt-2 text-[clamp(2rem,4vw,3.25rem)] tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {series && total && !example && total.views === 0 ? (
          <p className="max-w-lg text-silver">
            No visits in this period yet. {showroom.status === 'published' ? 'Share your link to bring the first visitors in.' : 'Publish your showroom to start counting visits.'}
          </p>
        ) : series ? (
          <section className="grid gap-6">
            <StatsChart series={series} title={`${example ? 'Example: ' : ''}views per day, last ${days} days`} />
            <button type="button" onClick={() => setTable((t) => !t)} aria-expanded={table} className="w-fit cursor-pointer text-sm text-silver underline decoration-hairline underline-offset-4 hover:text-porcelain">
              {table ? 'Hide table' : 'Show as a table'}
            </button>
            {table && <StatsTable series={series} />}
          </section>
        ) : (
          !error && <p className="text-sm text-ash">Loading statistics…</p>
        )}

        <p className="max-w-2xl text-xs leading-relaxed text-ash">
          How we count: a view is a visit to the public page; the same browser session reloading within 30 minutes counts once. Visitors are distinct
          browser sessions, so the number is approximate. Click rate is purchase clicks divided by visitors. No cookies, no IP addresses, no
          fingerprinting; browsers that send Do Not Track are counted as views but not as visitors.
        </p>
      </main>
    </StudioShell>
  )
}
