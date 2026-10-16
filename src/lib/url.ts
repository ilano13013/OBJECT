/**
 * Validates a merchant-supplied purchase link before it is rendered.
 * Only absolute http(s) URLs pass; javascript:, data:, relative and
 * credential-bearing URLs are rejected. Returns the normalised href or null.
 */
export function safeExternalUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
  if (raw.length === 0 || raw.length > 2048) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (!url.hostname.includes('.')) return null
  return url.href
}

/** Lowercase, ASCII, hyphenated slug suitable for a public showroom URL. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
