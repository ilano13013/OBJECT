import { ArrowUpRight, Box, Images, Info } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { safeExternalUrl } from '@/lib/url'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useShowroomEnv } from './frame'
import type { FontId, MediaMode, ShowroomConfig, ShowroomImage } from './types'

export function fontClass(id: FontId) {
  switch (id) {
    case 'archivo-wide':
      return 'display'
    case 'archivo-narrow':
      return 'display-narrow'
    case 'instrument':
      return 'font-serif font-normal tracking-[-0.02em] leading-[0.92]'
    case 'inter':
      return 'font-sans font-semibold tracking-[-0.04em] leading-[0.95]'
  }
}

export function bodyFontFamily(id: FontId) {
  return id === 'instrument' ? 'var(--font-serif)' : 'var(--font-sans)'
}

export function themeVars(config: ShowroomConfig): CSSProperties {
  const t = config.theme
  return {
    fontFamily: bodyFontFamily(t.bodyFont),
    '--sr-bg': t.background,
    '--sr-surface': t.surface,
    '--sr-text': t.text,
    '--sr-muted': t.muted,
    '--sr-accent': t.accent,
    '--sr-on-accent': t.onAccent,
    backgroundColor: t.background,
    color: t.text,
  } as CSSProperties
}

/** Shows what a viewer is looking at, so 2D is never mistaken for 3D. */
export function ModeBadge({ mode, className = '' }: { mode: MediaMode; className?: string }) {
  const Icon = mode === 'true3d' ? Box : Images
  return (
    <span
      className={`meta inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ring-inset ring-current/25 ${className}`}
      title={mode === 'true3d' ? 'Interactive 3D model' : '2D images animated with depth effects. Not a 3D model.'}
    >
      <Icon aria-hidden className="size-3.5" />
      {mode === 'true3d' ? 'True 3D' : 'Photo Motion'}
    </span>
  )
}

export function DemoNotice({ brand }: { brand: string }) {
  return (
    <div role="note" className="meta flex items-center justify-center gap-2 bg-lime px-4 py-2 text-center text-obsidian">
      <Info aria-hidden className="size-3.5 shrink-0" />
      <span className="@3xl:hidden">Demo — {brand} is a fictional brand</span>
      <span className="hidden @3xl:inline">Demo showroom — {brand} is a fictional brand created by OBJECT. Not a real product.</span>
    </div>
  )
}

/**
 * The purchase CTA. Only http(s) links render; demo showrooms never leave the
 * site and explain what the button would do instead.
 */
export function PurchaseButton({
  config,
  className = '',
  onClick,
}: {
  config: ShowroomConfig
  className?: string
  onClick?: () => void
}) {
  const [explained, setExplained] = useState(false)
  const { onPurchase } = useShowroomEnv()
  const href = safeExternalUrl(config.purchaseUrl)
  const cls = `group inline-flex min-h-13 items-center justify-center gap-3 rounded-full px-7 py-3.5 text-base font-semibold tracking-tight transition-[transform,filter] duration-300 ease-out-expo hover:brightness-110 active:scale-[0.98] cursor-pointer ${className}`
  const style = { backgroundColor: 'var(--sr-accent)', color: 'var(--sr-on-accent)' }

  if (config.isDemo) {
    return (
      <span className="relative inline-flex flex-col items-start gap-2">
        <button
          type="button"
          className={cls}
          style={style}
          aria-describedby={`demo-buy-${config.slug}`}
          onClick={() => {
            onClick?.()
            setExplained(true)
          }}
        >
          {config.purchaseLabel}
          <span className="meta rounded-full bg-black/10 px-2 py-0.5 text-[0.65rem]">Demo</span>
        </button>
        <span id={`demo-buy-${config.slug}`} role="status" className={`max-w-xs text-xs leading-snug ${explained ? '' : 'sr-only'}`}>
          Demo link: in a real showroom this button opens the brand’s own store. Nothing is sold here.
        </span>
      </span>
    )
  }

  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cls}
      style={style}
      onClick={() => {
        onPurchase?.()
        onClick?.()
      }}
    >
      {config.purchaseLabel}
      <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  )
}

/**
 * Photo Motion: a flat image given depth with perspective tilt, a parallax
 * backdrop and a moving light sweep. Explicitly a 2D effect.
 */
export function PhotoMotion({
  image,
  className = '',
  intensity = 1,
  fit = 'cover',
  priority = false,
}: {
  image: ShowroomImage
  className?: string
  intensity?: number
  fit?: 'cover' | 'contain'
  priority?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    let raf = 0
    const target = { x: 0, y: 0 }
    const now = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    const tick = () => {
      now.x += (target.x - now.x) * 0.06
      now.y += (target.y - now.y) * 0.06
      el.style.setProperty('--px', now.x.toFixed(4))
      el.style.setProperty('--py', now.y.toFixed(4))
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  const k = intensity
  return (
    <div ref={ref} className={`relative overflow-hidden [perspective:1200px] ${className}`} style={{ '--px': 0, '--py': 0 } as CSSProperties}>
      <img
        src={image.src}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl"
        style={{ transform: `translate3d(calc(var(--px) * ${-18 * k}px), calc(var(--py) * ${-18 * k}px), 0) scale(1.25)` }}
      />
      <img
        src={image.src}
        alt={image.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`relative size-full ${fit === 'cover' ? 'object-cover' : 'object-contain'} will-change-transform`}
        style={{
          transform: `rotateY(calc(var(--px) * ${4 * k}deg)) rotateX(calc(var(--py) * ${-4 * k}deg)) translate3d(calc(var(--px) * ${10 * k}px), calc(var(--py) * ${10 * k}px), 0) scale(1.06)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{
          background: `radial-gradient(40% 50% at calc(50% + var(--px) * 30%) calc(40% + var(--py) * 30%), rgb(255 255 255 / 0.55), transparent 70%)`,
        }}
      />
    </div>
  )
}
