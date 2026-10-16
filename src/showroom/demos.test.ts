import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/color'
import { safeExternalUrl } from '@/lib/url'
import { DEMOS, getDemo } from './demos'

describe('demo showrooms', () => {
  it('are three distinct brands on three distinct templates', () => {
    expect(DEMOS.map((d) => d.brand)).toEqual(['AURA', 'FORM', 'MONO'])
    expect(new Set(DEMOS.map((d) => d.template)).size).toBe(3)
  })

  it('are all flagged as demos so the fictional notice renders', () => {
    for (const d of DEMOS) expect(d.isDemo).toBe(true)
  })

  it('never claim 3D without a model', () => {
    for (const d of DEMOS) if (d.mode === 'true3d') expect(d.model).toBeDefined()
  })

  it('use photo mode only with images, each with alt text', () => {
    for (const d of DEMOS) {
      if (d.mode === 'photo') expect(d.images.length).toBeGreaterThan(0)
      for (const img of d.images) expect(img.alt.length).toBeGreaterThan(10)
    }
  })

  it('have safe purchase links and readable themes', () => {
    for (const d of DEMOS) {
      expect(safeExternalUrl(d.purchaseUrl)).not.toBeNull()
      expect(contrastRatio(d.theme.text, d.theme.background)).toBeGreaterThan(4.5)
      expect(contrastRatio(d.theme.muted, d.theme.background)).toBeGreaterThan(4.5)
      expect(contrastRatio(d.theme.onAccent, d.theme.accent)).toBeGreaterThan(4.5)
    }
  })

  it('resolves by slug', () => {
    expect(getDemo('mono')?.productName).toBe('Vessel III')
    expect(getDemo('nope')).toBeUndefined()
  })
})
