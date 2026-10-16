import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export interface ShowroomEnv {
  /** Scroll container the showroom lives in; null means the window. */
  scroller: HTMLElement | null
  /** True when the showroom is rendered narrower than 768px. */
  narrow: boolean
}

const EnvContext = createContext<ShowroomEnv>({ scroller: null, narrow: false })

export function useShowroomEnv() {
  return useContext(EnvContext)
}

/**
 * Hosts a showroom. Templates size themselves with container queries and the
 * `--sr-vh` unit instead of the window, so the same template renders
 * correctly full-screen, in the editor's desktop preview and inside its
 * phone-sized preview.
 *
 * - `scroller` omitted: the page scrolls (public pages, demos); 1 vh = 1svh.
 * - `scroller` given: the frame fills that element; 1 vh = its height / 100.
 */
export function ShowroomFrame({ children, scroller = null }: { children: ReactNode; scroller?: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const target = scroller ?? ref.current
    if (!target || typeof ResizeObserver === 'undefined') return
    const measure = () =>
      setSize({ w: (ref.current ?? target).clientWidth, h: scroller ? scroller.clientHeight : window.innerHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(target)
    if (ref.current && ref.current !== target) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [scroller])

  const style = { '--sr-vh': scroller && size ? `${size.h / 100}px` : '1svh' } as CSSProperties
  const narrow = (size?.w ?? (typeof window !== 'undefined' ? window.innerWidth : 1024)) < 768

  return (
    <EnvContext.Provider value={{ scroller, narrow }}>
      <div ref={ref} className="@container relative w-full" style={style}>
        {children}
      </div>
    </EnvContext.Provider>
  )
}
