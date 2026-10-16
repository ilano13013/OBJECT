import { lazy, Suspense, useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'

const StoryCanvas = lazy(() => import('@/three/scenes/StoryCanvas'))

const CHAPTERS = [
  {
    title: 'Light, first.',
    body: 'Every showroom opens in a lit studio. Soft boxes, strip lights, reflections: set before your visitor arrives.',
  },
  {
    title: 'Turn it.',
    body: 'Zoom, rotation, camera moves. The object is staged the way a director would shoot it.',
  },
  {
    title: 'Every detail.',
    body: 'Close enough to read the facets of the cap. Hotspots name what makes it worth the price.',
  },
  {
    title: 'Then, sell.',
    body: 'One clear path to your own store. Your checkout, your margins, no marketplace in between.',
  },
]

const CALLOUTS = [
  { label: 'Octagonal mirror cap', at: 2, className: 'right-[8%] top-[22%] md:right-[22%] md:top-[18%]' },
  { label: 'Weighted crystal base', at: 1, className: 'left-[6%] bottom-[30%] md:left-[24%] md:bottom-[24%]' },
  { label: 'Amber resin heart', at: 1, className: 'right-[6%] bottom-[38%] md:right-[18%] md:bottom-[40%]' },
]

export function Story() {
  const root = useRef<HTMLElement>(null)
  const progress = useRef(0)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      const chapters = gsap.utils.toArray<HTMLElement>('[data-chapter]')
      const callouts = gsap.utils.toArray<HTMLElement>('[data-callout]')
      if (reduced) {
        progress.current = 1
        return
      }
      gsap.set(chapters, { autoAlpha: 0, y: 40 })
      gsap.set(chapters[0]!, { autoAlpha: 1, y: 0 })
      gsap.set(callouts, { autoAlpha: 0, scale: 0.9 })

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut', duration: 1 },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: '+=320%',
          pin: '[data-story-pin]',
          scrub: 1,
          onUpdate: (self) => (progress.current = self.progress),
        },
      })
      chapters.forEach((el, i) => {
        if (i === 0) return
        tl.to(chapters[i - 1]!, { autoAlpha: 0, y: -40, filter: 'blur(6px)' }, i * 2 - 0.6)
        tl.to(el, { autoAlpha: 1, y: 0, filter: 'blur(0px)' }, i * 2 - 0.2)
      })
      callouts.forEach((el) => {
        const at = Number(el.dataset.at)
        tl.to(el, { autoAlpha: 1, scale: 1, duration: 0.6 }, at * 2 - 0.2)
        tl.to(el, { autoAlpha: 0, duration: 0.5 }, at * 2 + 1.4)
      })
      tl.to({}, { duration: 0.6 })
      tl.fromTo('[data-progress]', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0)
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <section ref={root} id="story" aria-labelledby="story-title" className="relative">
      <h2 id="story-title" className="sr-only">
        A product, staged in four movements
      </h2>
      <div data-story-pin className={`relative overflow-hidden bg-obsidian ${reduced ? 'min-h-[100svh] pb-24' : 'h-[100svh]'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_60%_50%,#1a1712_0%,#09090b_70%)]" />
        <Suspense fallback={null}>
          <StoryCanvas
            progress={progress}
            fallback={
              <div className="grid h-full place-items-center">
                <div className="h-[46vh] w-[30vh] rounded-[10%] bg-[linear-gradient(160deg,#f6e3c8_0%,#c99a62_60%,#3a2a18_100%)] opacity-80" />
              </div>
            }
          />
        </Suspense>

        {CALLOUTS.map((c) => (
          <div
            key={c.label}
            data-callout
            data-at={c.at}
            className={`pointer-events-none absolute flex items-center gap-3 ${c.className} ${reduced ? 'hidden' : ''}`}
          >
            <span className="size-2 rounded-full bg-lime shadow-[0_0_0_6px_rgb(215_255_67/0.15)]" />
            <span className="meta text-porcelain">{c.label}</span>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent md:hidden" />
        <div
          className={`gutter pointer-events-none inset-x-0 ${
            reduced ? 'relative pt-[60svh]' : 'absolute bottom-0 pb-16 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:pb-0'
          }`}
        >
          <div className={`relative max-w-xl ${reduced ? 'flex flex-col gap-16' : 'grid'}`}>
            {CHAPTERS.map((c, i) => (
              <div
                key={c.title}
                data-chapter
                className={reduced ? '' : 'col-start-1 row-start-1'}
              >
                <p className="meta mb-4 text-ash">
                  {String(i + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}
                </p>
                <h3 className="display text-[clamp(2.4rem,7vw,6rem)]">{c.title}</h3>
                <p className="mt-5 max-w-sm text-base leading-relaxed text-silver md:text-lg">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="gutter absolute inset-x-0 bottom-4 flex items-center justify-between md:bottom-8">
          <p className="meta hidden text-ash md:block">AURA is a fictional brand, modelled for this demo</p>
          <div className="h-px w-32 bg-hairline md:w-48" aria-hidden>
            <div data-progress className="h-px origin-left bg-lime" />
          </div>
        </div>
      </div>
    </section>
  )
}
