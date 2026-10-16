import { describe, expect, it } from 'vitest'
import { safeExternalUrl, slugify } from './url'

describe('safeExternalUrl', () => {
  it('accepts absolute http(s) links', () => {
    expect(safeExternalUrl('https://shop.example.com/p/1?ref=object')).toBe('https://shop.example.com/p/1?ref=object')
    expect(safeExternalUrl('  http://example.org ')).toBe('http://example.org/')
  })

  it.each([
    ['javascript:alert(1)'],
    ['JAVASCRIPT:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox'],
    ['/relative/path'],
    ['//evil.example.com'],
    ['ftp://example.com'],
    ['https://user:pass@example.com'],
    ['https://localhost'],
    [''],
    [null],
    [undefined],
  ])('rejects %s', (input) => {
    expect(safeExternalUrl(input as string | null | undefined)).toBeNull()
  })

  it('rejects absurdly long URLs', () => {
    expect(safeExternalUrl('https://example.com/' + 'a'.repeat(3000))).toBeNull()
  })
})

describe('slugify', () => {
  it('produces URL-safe slugs', () => {
    expect(slugify('Nº 07 Lumière — Édition')).toBe('no-07-lumiere-edition')
    expect(slugify('  --Hello__World--  ')).toBe('hello-world')
  })
  it('caps length', () => {
    expect(slugify('a'.repeat(100)).length).toBe(60)
  })
})
