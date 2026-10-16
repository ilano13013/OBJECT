import { describe, expect, it } from 'vitest'
import { friendly, safeNext } from './actions'

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/studio/abc?x=1')).toBe('/studio/abc?x=1')
  })
  it.each([['https://evil.example'], ['//evil.example'], ['/\\evil.example'], ['javascript:alert(1)'], [''], [null]])('refuses %s', (v) => {
    expect(safeNext(v as string | null)).toBe('/studio')
  })
})

describe('friendly auth errors', () => {
  it('explains wrong credentials without saying which part is wrong', () => {
    expect(friendly('Invalid login credentials')).toMatch(/don’t match/)
  })
})
