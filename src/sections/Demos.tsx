import { ArrowUpRight } from 'lucide-react'
import auraPoster from '@/assets/renders/aura-poster.webp'
import formHero from '@/assets/renders/form-hero.webp'
import monoPoster from '@/assets/renders/mono-poster.webp'
import auraCutout from '@/assets/renders/aura-cutout.webp'
import formCutout from '@/assets/renders/form-cutout.webp'
import monoCutout from '@/assets/renders/mono-cutout.webp'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'

const ROWS = [
  {
    slug: 'aura',
    name: 'AURA',
    product: 'Nº 07 Lumière',
    category: 'Fragrance',
    template: 'Orbit',
    mode: 'True 3D',
    poster: auraPoster,
    cutout: auraCutout,
    tint: '#e8c9a4',
    line: 'Black, chrome and a crystal flacon you can turn in your hand.',
  },
  {
    slug: 'form',
    name: 'FORM',
    product: 'Cuff 01',
    category: 'Design accessory',
    template: 'Editorial',
    mode: 'Photo Motion',
    poster: formHero,
    cutout: formCutout,
    tint: '#d7ff43',
    line: 'Giant type, full-bleed imagery and a story told in scroll.',
  },
  {
    slug: 'mono',
    name: 'MONO',
    product: 'Vessel III',
    category: 'Home object',
    template: 'Gallery',
    mode: 'True 3D',
    poster: monoPoster,
    cutout: monoCutout,
    tint: '#d9d5cd',
    line: 'A single object on a plinth, lit like a museum piece.',
  },
]

export function Demos() {
  const root = useRef<HTMLElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const reduced = useReducedMotion()

  const { contextSafe } = useGSAP(
    () => {
      if (reduced) return
      gsap.from('[data-demo-row]', {
        yPercent: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.3,
        scrollTrigger: { trigger: '[data-demo-list]', start: 'top 80%' },
      })
    },
    { scope: root, dependencies: [reduced] },
  )

  const move = contextSafe((e: React.PointerEvent) => {
    if (!preview.current || e.pointerType === 'touch') return
    const bounds = root.current!.getBoundingClientRect()
    gsap.to(preview.current, {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      duration: reduced ? 0 : 0.7,
      ease: 'expo.out',
    })
  })

  return (
    <section ref={root} id="demos" aria-labelledby="demos-title" className="gutter relative py-28 md:py-40" onPointerMove={move}>
      <div className="grid gap-8 md:grid-cols-12">
        <h2 id="demos-title" className="display text-[clamp(2.4rem,7.5vw,7rem)] md:col-span-8">
          Three worlds. <span className="text-silver">One studio.</span>
        </h2>
        <p className="max-w-sm self-end text-silver md:col-span-4 md:justify-self-end">
          AURA, FORM and MONO are fictional brands we built to show what an OBJECT. showroom can be. They are not customers.
        </p>
      </div>

      <ul data-demo-list className="mt-16 border-t border-hairline md:mt-24" onPointerLeave={() => setActive(null)}>
        {ROWS.map((row, i) => (
          <li key={row.slug} data-demo-row className="border-b border-hairline">
            <Link
              to={`/demo/${row.slug}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group grid grid-cols-12 items-center gap-x-4 gap-y-4 py-8 md:py-10"
            >
              <span className="meta col-span-2 text-ash md:col-span-1">Demo</span>
              <span
                className="display col-span-10 text-[clamp(3.5rem,10vw,10rem)] transition-[color,letter-spacing] duration-700 ease-out-expo group-hover:tracking-[-0.02em] md:col-span-7"
                style={{ color: active === i ? row.tint : undefined }}
              >
                {row.name}
              </span>
              <img
                src={row.poster}
                alt=""
                loading="lazy"
                decoding="async"
                width={800}
                height={1000}
                className="col-span-12 aspect-[4/5] w-full rounded-sm object-cover md:hidden"
                style={{ backgroundColor: row.slug === 'aura' ? '#09090b' : row.tint }}
              />
              <span className="col-span-12 flex flex-col gap-2 md:col-span-3">
                <span className="text-lg font-medium text-porcelain">
                  {row.product} <span className="text-ash">· {row.category}</span>
                </span>
                <span className="text-sm leading-relaxed text-silver">{row.line}</span>
                <span className="meta mt-2 text-ash">
                  {row.template} template · {row.mode}
                </span>
              </span>
              <span className="col-span-12 flex justify-end md:col-span-1">
                <span className="grid size-12 place-items-center rounded-full ring-1 ring-silver/30 transition-all duration-500 ease-out-expo group-hover:bg-lime group-hover:text-obsidian group-hover:ring-lime">
                  <ArrowUpRight aria-hidden className="size-5" />
                  <span className="sr-only">Open the {row.name} demo showroom</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop cursor-following product: a transparent cut-out, no frame. */}
      <div ref={preview} aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 hidden md:block" style={{ willChange: 'transform' }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(19vw, 290px)', aspectRatio: '4 / 5' }}>
          {ROWS.map((row, i) => {
            const on = active === i
            return (
              <div
                key={row.slug}
                className="absolute inset-0 grid place-items-center transition-[opacity,transform,filter] duration-700 ease-out-expo"
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? 'translateY(0) scale(1) rotate(0deg)' : 'translateY(24px) scale(0.9) rotate(-4deg)',
                  filter: on ? 'blur(0px)' : 'blur(8px)',
                }}
              >
                {/* Soft light in the brand's tint behind the object, so it sits in the page rather than on it. */}
                {row.slug !== 'aura' && (
                  <span className="absolute inset-[18%] rounded-full opacity-25 blur-3xl" style={{ background: row.tint }} />
                )}
                <img
                  src={row.cutout}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="relative max-h-full max-w-full object-contain"
                  style={{ filter: row.slug === 'aura' ? undefined : 'drop-shadow(0 28px 36px rgb(0 0 0 / 0.55))' }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
