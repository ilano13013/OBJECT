/** Public address of a showroom. Sandboxed previews have no real origin, so they show the path. */
export function publicUrl(slug: string) {
  const path = `/s/${slug}`
  if (import.meta.env.VITE_MEMORY_ROUTER || typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}
