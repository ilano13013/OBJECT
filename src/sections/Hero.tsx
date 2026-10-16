import { lazy, Suspense, useRef } from 'react'
import { LinkButton } from '@/components/Button'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { hasWebGL } from '@/lib/webgl'

// The 3D engine streams in after first paint; type and CTAs never wait for it.
const HeroCanvas = lazy(() => import('@/three/scenes/HeroCanvas'))

function HeroFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div className="relative size-[min(70vw,30rem)]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#f2f0eb_0%,#bfc3c8_18%,#3a3a40_52%,#09090b_78%)] shadow-[0_40px_120px_-20px_rgb(191_195_200/0.25)]" />
        <div className="absolute -inset-[18%] rotate-[24deg] rounded-full border border-lime/70 [transform:rotateX(70deg)]" />
      </div>
    </div>
  )
}

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  useGSAP(
    () => {
      if (reduced) return
      const tl = gsap.timeline({ delay: 0.35 })
      tl.from('[data-hero-line]', { yPercent: 105, duration: 1.5, stagger: 0.12, ease: 'expo.out' })
      // The offer and CTAs start almost visible and never wait on the headline.
      gsap.from('[data-hero-fade]', { opacity: 0.15, y: 14, filter: 'blur(6px)', duration: 1.2, stagger: 0.08, delay: 0.6 })
      // Leaving the hero: the type drifts apart as the next chapter arrives.
      gsap.to('[data-hero-a]', { xPercent: -8, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
      gsap.to('[data-hero-b]', { xPercent: 8, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
      gsap.to('[data-hero-canvas]', { scale: 0.86, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <section ref={root} className="grain relative h-[100svh] min-h-[620px] overflow-hidden" aria-labelledby="hero-title">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,#1c1c20_0%,#09090b_70%)]" />
      <div data-hero-canvas className="absolute inset-0 z-[1]">
        {hasWebGL() ? (
          <Suspense fallback={null}>
            <HeroCanvas reduced={reduced} mobile={mobile} fallback={<HeroFallback />} />
          </Suspense>
        ) : (
          <HeroFallback />
        )}
      </div>

      <div className="gutter pointer-events-none relative flex h-full flex-col justify-between pb-8 pt-24 md:pb-12 md:pt-28">
        <h1 id="hero-title" className="display text-[clamp(2.75rem,8vw,9.5rem)]">
          <span data-hero-a className="relative z-0 block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block">
              Your product.
            </span>
          </span>
          <span data-hero-b className="relative z-[2] mt-[38svh] block overflow-hidden pb-[0.06em] text-right md:mt-[28vh]">
            <span data-hero-line className="block">
              <span className="serif-accent text-silver">a</span> new dimension.
            </span>
          </span>
        </h1>

        <div className="pointer-events-auto relative z-[2] flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p data-hero-fade className="max-w-[26rem] text-base leading-relaxed text-silver md:text-lg">
            Turn ordinary product pages into extraordinary digital experiences.
          </p>
          <div data-hero-fade className="flex flex-wrap gap-3">
            <LinkButton to="/demo/aura">Explore the demo</LinkButton>
            <LinkButton to="/studio/new" variant="ghost">
              Create your showroom
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  )
}
