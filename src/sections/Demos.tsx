import { ArrowUpRight } from 'lucide-react'
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
    poster: '/renders/aura-poster.webp',
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
    poster: '/renders/form-hero.webp',
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
    poster: '/renders/mono-poster.webp',
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
          Three worlds. <span className="serif-accent text-silver">one studio.</span>
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

      {/* Desktop cursor-following poster */}
      <div
        ref={preview}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-20 hidden md:block"
        style={{ willChange: 'transform' }}
      >
        <div
          className="relative -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] transition-[opacity,transform,clip-path] duration-700 ease-out-expo"
          style={{
            width: 'min(22vw, 340px)',
            aspectRatio: '4 / 5',
            opacity: active === null ? 0 : 1,
            clipPath: active === null ? 'inset(50% 0 50% 0)' : 'inset(0 0 0 0)',
          }}
        >
          {ROWS.map((row, i) => (
            <img
              key={row.slug}
              src={row.poster}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-opacity duration-500"
              style={{ opacity: active === i ? 1 : 0, backgroundColor: row.slug === 'aura' ? '#09090b' : row.tint }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
