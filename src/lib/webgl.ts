let cached: boolean | undefined

/** True when the browser can create a WebGL context. Cached after first probe. */
export function hasWebGL(): boolean {
  if (cached !== undefined) return cached
  if (typeof window === 'undefined' || typeof document === 'undefined') return (cached = false)
  if (new URLSearchParams(window.location.search).has('nowebgl')) return (cached = false)
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
