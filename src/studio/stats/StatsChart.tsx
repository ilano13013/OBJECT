import { useId, useMemo, useState } from 'react'
import type { StatsDay } from '../backend'

const BAR = '#7f9f14' // brand lime stepped into the dark-mode band (validated)
const BAR_ACTIVE = '#d7ff43'
const W = 720
const H = 240
const PAD = { top: 16, right: 12, bottom: 28, left: 40 }

function niceMax(v: number) {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * p
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fmtDay = (iso: string) => dayFmt.format(new Date(iso + 'T12:00:00'))

/** Daily views as columns; hover or focus a day for its full breakdown. */
export function StatsChart({ series, title }: { series: StatsDay[]; title: string }) {
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const max = useMemo(() => niceMax(Math.max(...series.map((d) => d.views), 1)), [series])
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / series.length
  const barW = Math.min(24, Math.max(3, slot - 2))
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const labelEvery = series.length > 10 ? Math.ceil(series.length / 6) : 1
  const a = active !== null ? series[active] : null

  return (
    <figure className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="mb-3 text-sm text-silver">
        {title}
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}. Use the table below for exact values.`} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#252529" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#8e9297" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(t)}
              </text>
            </g>
          ))}
          {series.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2
            const top = y(d.views)
            const h = PAD.top + innerH - top
            const r = Math.min(4, h)
            return (
              <g key={d.day}>
                {h > 0 && (
                  <path
                    d={`M${x},${PAD.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + innerH} Z`}
                    fill={active === i ? BAR_ACTIVE : BAR}
                  />
                )}
                {/* Hit target: the whole column slot, taller than the bar. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${fmtDay(d.day)}: ${d.views} views, ${d.visitors} visitors, ${d.clicks} purchase clicks`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none focus-visible:stroke-lime"
                />
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#8e9297">
                    {fmtDay(d.day)}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#3a3a40" strokeWidth={1} />
        </svg>
        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-md bg-graphite px-3 py-2 text-xs shadow-[0_12px_40px_-12px_rgb(0_0_0/0.8)] ring-1 ring-hairline"
            style={{ left: `${((PAD.left + active * slot + slot / 2) / W) * 100}%` }}
          >
            <p className="mb-1 font-medium text-porcelain">{fmtDay(a.day)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 tabular-nums text-silver">
              <dt>Views</dt>
              <dd className="text-right text-porcelain">{a.views}</dd>
              <dt>Visitors</dt>
              <dd className="text-right text-porcelain">{a.visitors}</dd>
              <dt>Purchase clicks</dt>
              <dd className="text-right text-porcelain">{a.clicks}</dd>
            </dl>
          </div>
        )}
      </div>
    </figure>
  )
}

export function StatsTable({ series }: { series: StatsDay[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-hairline text-left text-ash">
            <th scope="col" className="py-2 font-medium">
              Day
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Views
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Visitors
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Purchase clicks
            </th>
          </tr>
        </thead>
        <tbody>
          {[...series].reverse().map((d) => (
            <tr key={d.day} className="border-b border-hairline/60">
              <th scope="row" className="py-2 text-left font-normal text-silver">
                {fmtDay(d.day)}
              </th>
              <td className="py-2 text-right">{d.views}</td>
              <td className="py-2 text-right">{d.visitors}</td>
              <td className="py-2 text-right">{d.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
