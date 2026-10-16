import type { StatsDay } from '../backend'

/**
 * Deterministic example series for the local preview. Shown only with a
 * visible "Example data" label, never mixed with recorded statistics.
 */
export function exampleStats(days: number, seed = 7): StatsDay[] {
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - 1 - i))
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.35 : 1
    const views = Math.round((40 + i * 1.6 + rand() * 30) * weekend)
    const visitors = Math.round(views * (0.62 + rand() * 0.12))
    const clicks = Math.round(visitors * (0.05 + rand() * 0.05))
    return { day: d.toISOString().slice(0, 10), views, visitors, clicks }
  })
}

export function summarise(series: StatsDay[]) {
  const views = series.reduce((a, d) => a + d.views, 0)
  const visitors = series.reduce((a, d) => a + d.visitors, 0)
  const clicks = series.reduce((a, d) => a + d.clicks, 0)
  return { views, visitors, clicks, rate: visitors ? clicks / visitors : 0 }
}
