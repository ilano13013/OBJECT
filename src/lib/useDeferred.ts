import { useEffect, useState, type RefObject } from 'react'

/** True once the browser is idle (or after `timeout` ms), for work that must not delay first paint. */
export function useIdle(timeout = 1500) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Safari has no requestIdleCallback: fall back to a short delay.
    const w = window as Window & { requestIdleCallback?: Window['requestIdleCallback'] }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(() => setIdle(true), Math.min(timeout, 600))
    return () => clearTimeout(t)
  }, [timeout])
  return idle
}

/** True once the element comes within `margin` of the viewport; stays true. */
export function useNearViewport(ref: RefObject<Element | null>, margin = '100% 0px') {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') return setNear(true)
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin, near])
  return near
}
