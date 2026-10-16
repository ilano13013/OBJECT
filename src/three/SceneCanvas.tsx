import { Canvas, type CanvasProps } from '@react-three/fiber'
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { hasWebGL } from '@/lib/webgl'

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[OBJECT.] 3D scene failed, showing fallback.', error)
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

interface SceneCanvasProps extends Omit<CanvasProps, 'children' | 'fallback'> {
  children: ReactNode
  /** Rendered instead of the canvas when WebGL is unavailable or the scene crashes. */
  fallback: ReactNode
  className?: string
  /** Pause rendering while off-screen (default true). */
  pauseOffscreen?: boolean
  label: string
}

/**
 * Every 3D surface goes through here: WebGL detection, crash isolation,
 * context-loss recovery, capped pixel ratio and off-screen pausing, so a
 * failing scene never blocks the page around it.
 */
export function SceneCanvas({ children, fallback, className, pauseOffscreen = true, label, ...canvas }: SceneCanvasProps) {
  const [supported] = useState(hasWebGL)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pauseOffscreen || !ref.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), { rootMargin: '120px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [pauseOffscreen])

  if (!supported || failed) return <div className={className}>{fallback}</div>

  return (
    <div ref={ref} className={className} role="img" aria-label={label}>
      <SceneErrorBoundary onError={() => setFailed(true)}>
        <Canvas
          dpr={[1, 1.75]}
          frameloop={visible ? 'always' : 'never'}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              setFailed(true)
            })
          }}
          {...canvas}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  )
}
