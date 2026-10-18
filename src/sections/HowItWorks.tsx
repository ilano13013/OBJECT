import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'

const STEPS = [
  {
    n: '01',
    title: 'Upload your product.',
    body: 'Photos you already have (JPG, PNG or WebP), or a GLB / glTF model if you own one. No photographer, no 3D artist required.',
  },
  {
    n: '02',
    title: 'Design your experience.',
    body: 'Pick a template, set colours and typefaces, write the story, place hotspots. Every change shows live in the preview.',
  },
  {
    n: '03',
    title: 'Publish and share.',
    body: 'One click gives you a public link for Instagram bios, newsletters, QR codes or your own site. Edit it whenever you like.',
  },
]

export function HowItWorks() {
  const root = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  useGSAP(
    () => {
      if (reduced) return
      gsap.utils.toArray<HTMLElement>('[data-step]').forEach((el) => {
        gsap.from(el.querySelector('[data-step-n]'), {
          clipPath: 'inset(100% 0 0 0)',
          duration: 1.4,
          scrollTrigger: { trigger: el, start: 'top 82%' },
        })
        gsap.from(el.querySelectorAll('[data-step-copy]'), {
          y: 24,
          opacity: 0,
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 78%' },
        })
      })
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <section ref={root} id="how" aria-labelledby="how-title" className="gutter relative bg-porcelain py-28 text-obsidian md:py-40">
      <h2 id="how-title" className="display max-w-[14ch] text-[clamp(2.4rem,7vw,6.5rem)]">
        Ten minutes to unforgettable.
      </h2>
      <p className="mt-6 max-w-md text-[#3c3c41]">
        With your images and product details ready, a first showroom takes less time than a coffee.
      </p>

      <ol className="mt-20 grid gap-y-16 md:mt-28 md:grid-cols-12 md:gap-x-6">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            data-step
            className={`border-t border-obsidian/15 pt-6 md:col-span-4 ${i === 1 ? 'md:mt-24' : ''} ${i === 2 ? 'md:mt-48' : ''}`}
          >
            <span data-step-n aria-hidden className="display block text-[clamp(5rem,12vw,10rem)] text-obsidian">
              {s.n}
            </span>
            <h3 data-step-copy className="mt-6 text-2xl font-semibold tracking-tight">
              <span className="sr-only">Step {s.n}: </span>
              {s.title}
            </h3>
            <p data-step-copy className="mt-3 max-w-sm leading-relaxed text-[#3c3c41]">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
