import { describe, expect, it } from 'vitest'
import { formatPrice, PLANS } from './plans'

describe('plans', () => {
  it('match the commercial offer', () => {
    const one = PLANS.find((p) => p.id === 'one')!
    const studio = PLANS.find((p) => p.id === 'studio')!
    expect([one.price, one.cadence]).toEqual([49, 'per showroom'])
    expect([studio.price, studio.cadence]).toEqual([29, 'per month'])
    expect(formatPrice(one)).toMatch(/49\s?€/)
  })
  it('always state their limits', () => {
    for (const p of PLANS) expect(p.limits.length).toBeGreaterThan(0)
  })
})
