import { Float } from '@react-three/drei'
import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { ProductModel } from '@/three/ProductModel'
import { SceneCanvas } from '@/three/SceneCanvas'
import { Studio } from '@/three/Studio'
import { useShowroomEnv } from '../frame'
import { fontClass, ModeBadge, PhotoMotion, PurchaseButton, themeVars } from '../parts'
import type { ShowroomConfig, ShowroomImage } from '../types'

function Media({ config, image, priority, className = '' }: { config: ShowroomConfig; image?: ShowroomImage; priority?: boolean; className?: string }) {
  if (config.mode === 'true3d' && config.model) {
    return (
      <SceneCanvas
        className={className}
        label={`${config.productName}, interactive 3D model`}
        camera={{ position: [0, 0.3, 5.4], fov: 32 }}
        fallback={image ? <PhotoMotion image={image} className="size-full" /> : <div className="size-full" style={{ background: 'var(--sr-surface)' }} />}
      >
        <Studio accent={config.theme.accent} />
        <Float speed={config.animation.speed} rotationIntensity={0.6} floatIntensity={0.5}>
          <group rotation={[0.35, -0.6, 0]}>
            <ProductModel source={config.model} />
          </group>
        </Float>
      </SceneCanvas>
    )
  }
  if (!image) return <div className={className} style={{ background: 'var(--sr-surface)' }} />
  return <PhotoMotion image={image} className={className} priority={priority} intensity={0.8} />
}

/** TEMPLATE 02 — EDITORIAL. Premium imagery, giant type, asymmetric composition. */
export function EditorialTemplate({ config }: { config: ShowroomConfig }) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scroller } = useShowroomEnv()
  const display = fontClass(config.theme.displayFont)
  const [hero, ...rest] = config.images
  const hairline = { borderColor: 'color-mix(in srgb, var(--sr-text) 16%, transparent)' }
  const muted = { color: 'var(--sr-muted)' }

  useGSAP(
    () => {
      if (reduced) return
      const s = 1 / config.animation.speed
      gsap.from('[data-ed-title] > span', { yPercent: 110, stagger: 0.08, duration: 1.6 * s, delay: 0.2 })
      gsap.from('[data-ed-hero-media]', { clipPath: 'inset(100% 0 0 0)', duration: 1.8 * s, ease: 'expo.inOut' })
      gsap.from('[data-ed-fade]', { opacity: 0, y: 20, stagger: 0.1, delay: 0.9 * s })
      gsap.to('[data-ed-hero-media]', {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: { scroller: scroller ?? undefined, trigger: '[data-ed-hero]', start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.utils.toArray<HTMLElement>('[data-ed-chapter]').forEach((el) => {
        const media = el.querySelector('[data-ed-media]')
        const copy = el.querySelectorAll('[data-ed-copy]')
        gsap.fromTo(
          media,
          { clipPath: 'inset(18% 12% 18% 12%)', scale: 1.08 },
          { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, ease: 'none', scrollTrigger: { scroller: scroller ?? undefined, trigger: el, start: 'top 85%', end: 'top 15%', scrub: 1 } },
        )
        gsap.from(copy, { y: 60, opacity: 0, stagger: 0.1, duration: 1.2 * s, scrollTrigger: { scroller: scroller ?? undefined, trigger: el, start: 'top 55%' } })
      })
      gsap.from('[data-ed-feature]', { y: 40, opacity: 0, stagger: 0.12, scrollTrigger: { scroller: scroller ?? undefined, trigger: '[data-ed-features]', start: 'top 75%' } })
      ScrollTrigger.refresh()
    },
    { scope: root, dependencies: [reduced, scroller] },
  )

  return (
    <div ref={root} className="relative" style={themeVars(config)}>
      {/* Hero */}
      <section data-ed-hero className="relative grid min-h-[calc(var(--sr-vh)*100)] grid-cols-12 grid-rows-[auto_1fr_auto] gap-x-4 px-[var(--gutter)] pb-8 pt-32 @3xl:pt-36">
        <div className="col-span-12 flex items-start justify-between" data-ed-fade>
          <p className="meta">{config.brand}</p>
          <span style={muted}>
            <ModeBadge mode={config.mode === 'true3d' && config.model ? 'true3d' : 'photo'} />
          </span>
        </div>
        <div
          data-ed-hero-media
          className="col-span-12 row-start-2 mt-6 h-[calc(var(--sr-vh)*52)] overflow-hidden @3xl:col-span-7 @3xl:col-start-6 @3xl:row-span-2 @3xl:mt-0 @3xl:h-auto @3xl:min-h-[calc(var(--sr-vh)*78)]"
        >
          <Media config={config} image={hero} priority className="size-full" />
        </div>
        <h1
          data-ed-title
          className={`${display} relative z-10 col-span-12 row-start-3 -mt-[0.5em] text-[clamp(4rem,15vw,15rem)] @3xl:row-start-2 @3xl:mt-0 @3xl:self-end`}
          style={{ mixBlendMode: 'normal' }}
        >
          {config.productName.split(' ').map((word, i) => (
            <span key={i} className="block overflow-hidden pb-[0.04em]">
              <span className="block">{word}</span>
            </span>
          ))}
        </h1>
        <div className="col-span-12 row-start-4 mt-6 flex flex-col gap-4 @3xl:col-span-4 @3xl:row-start-3" data-ed-fade>
          <p className="max-w-xs text-xl leading-snug">{config.tagline}</p>
        </div>
      </section>

      {/* Statement */}
      <section className="grid grid-cols-12 gap-x-4 px-[var(--gutter)] py-24 @3xl:py-40">
        <p className="col-span-12 font-serif text-[clamp(1.9rem,4.2vw,4rem)] leading-[1.08] tracking-[-0.01em] @3xl:col-span-9 @3xl:col-start-3">
          {config.description}
        </p>
      </section>

      {/* Chapters */}
      {config.chapters.map((c, i) => {
        const image = c.image !== undefined ? config.images[c.image] : rest[i]
        const right = i % 2 === 1
        return (
          <section key={c.id} data-ed-chapter className="relative grid grid-cols-12 gap-x-4 px-[var(--gutter)] py-12 @3xl:py-20" aria-labelledby={`ch-${c.id}`}>
            <div
              data-ed-media
              className={`col-span-12 h-[calc(var(--sr-vh)*70)] overflow-hidden @3xl:row-start-1 @3xl:h-[calc(var(--sr-vh)*88)] ${right ? '@3xl:col-span-8 @3xl:col-start-5' : '@3xl:col-span-8'}`}
            >
              <Media config={config} image={image} className="size-full" />
            </div>
            <div
              className={`relative z-10 col-span-12 mt-8 @3xl:row-start-1 @3xl:mt-0 @3xl:self-end @3xl:pb-16 ${
                right ? '@3xl:col-span-4 @3xl:col-start-1' : '@3xl:col-span-4 @3xl:col-start-9'
              }`}
            >
              <h2
                id={`ch-${c.id}`}
                data-ed-copy
                className={`${display} text-[clamp(2.8rem,7vw,6.5rem)] ${right ? '@3xl:-mr-[60%]' : '@3xl:-ml-[60%]'}`}
              >
                {c.title}
              </h2>
              <p data-ed-copy className="mt-4 max-w-sm text-lg leading-relaxed" style={muted}>
                {c.body}
              </p>
            </div>
          </section>
        )
      })}

      {/* Features */}
      {config.features.length > 0 && (
        <section data-ed-features className="grid grid-cols-12 gap-x-4 gap-y-14 px-[var(--gutter)] py-24 @3xl:py-40" aria-label="Details">
          {config.features.map((f, i) => (
            <article
              key={f.id}
              data-ed-feature
              className={`col-span-12 border-t pt-6 @3xl:col-span-4 ${i === 1 ? '@3xl:mt-20' : ''} ${i === 2 ? '@3xl:mt-40' : ''}`}
              style={hairline}
            >
              <h3 className="text-3xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-3 max-w-sm leading-relaxed" style={muted}>
                {f.body}
              </p>
            </article>
          ))}
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden px-[var(--gutter)] pb-16 pt-24 @3xl:pt-36" style={{ backgroundColor: 'var(--sr-text)', color: 'var(--sr-bg)' }}>
        <div className="grid grid-cols-12 gap-x-4 gap-y-10">
          <h2 className={`${display} col-span-12 text-[clamp(3.5rem,12vw,12rem)] @3xl:col-span-8`}>{config.productName}</h2>
          <div className="col-span-12 flex flex-col gap-6 self-end @3xl:col-span-4">
            {config.details.length > 0 && (
              <dl className="grid grid-cols-2 gap-5">
                {config.details.map((d) => (
                  <div key={d.label}>
                    <dt className="meta opacity-60">{d.label}</dt>
                    <dd className="mt-1 text-sm">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {config.price && <p className="text-2xl font-semibold tracking-tight">{config.price}</p>}
            <PurchaseButton config={config} />
          </div>
        </div>
      </section>
    </div>
  )
}
