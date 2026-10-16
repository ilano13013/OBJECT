import { describe, expect, it } from 'vitest'
import { contrastRatio, inkFor } from './color'

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('core palette text pairs pass AA', () => {
    expect(contrastRatio('#f2f0eb', '#09090b')).toBeGreaterThan(4.5)
    expect(contrastRatio('#bfc3c8', '#09090b')).toBeGreaterThan(4.5)
    expect(contrastRatio('#8e9297', '#09090b')).toBeGreaterThan(4.5)
    expect(contrastRatio('#09090b', '#d7ff43')).toBeGreaterThan(4.5)
  })
  it('picks readable ink for gallery walls', () => {
    expect(inkFor('#1d1d20')).toBe('#f2f0eb')
    expect(inkFor('#d9d5cd')).toBe('#1a1a1c')
  })
})
