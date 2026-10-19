import { ArrowUpRight, Box, Images, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import auraPoster from '@/assets/renders/aura-poster.webp'
import formHero from '@/assets/renders/form-hero.webp'
import monoPoster from '@/assets/renders/mono-poster.webp'
import { Nav } from '@/components/Nav'
import { useNearViewport } from '@/lib/useDeferred'
import { DEMOS } from '@/showroom/demos'
import type { MediaMode } from '@/showroom/types'
import { Footer } from '@/sections/Footer'
import { assetIdOf, assetUrl, isAssetRef } from '@/studio/assets'
import { backend, type GalleryItem } from '@/studio/backend'

const PAGE = 24
const POSTERS: Record<string, string> = { aura: auraPoster, form: formHero, mono: monoPoster }

interface Card extends GalleryItem {
  demo?: boolean
}

/** The three fictional demo brands, labelled as demos, so the wall is never empty. */
const DEMO_CARDS: Card[] = DEMOS.map((d) => ({
  slug: d.slug,
  productName: d.productName,
  brand: d.brand,
  tagline: d.tagline,
  cover: POSTERS[d.slug] ?? null,
  coverAlt: `${d.productName} by ${d.brand}, studio render of the demo product`,
  mode: d.mode,
  background: d.theme.background,
  accent: d.theme.accent,
  text: d.theme.text,
  publishedAt: '',
  demo: true,
}))

/** Stable pseudo-random tile shape for showrooms without a photo. */
function tileRatio(slug: string) {
  const ratios = ['4 / 5', '1 / 1', '3 / 4', '4 / 6']
  let h = 0
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ratios[h % ratios.length]!
}

function Cover({ card }: { card: Card }) {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref, '600px 0px')
  const src = card.cover
  const [url, setUrl] = useState<string | null>(src && !isAssetRef(src) ? src : null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!near || !src || !isAssetRef(src)) return
    let alive = true
    assetUrl(assetIdOf(src)).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [near, src])

  if (!src) {
    return (
      <div ref={ref} className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: tileRatio(card.slug), background: card.background, color: card.text }}>
        <span className="absolute left-5 top-5 h-1 w-10 rounded-full" style={{ background: card.accent }} />
        <span className="display absolute inset-x-5 bottom-5 line-clamp-4 text-[clamp(1.6rem,3vw,2.4rem)] leading-[0.95]">{card.productName || 'Untitled'}</span>
      </div>
    )
  }
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl" style={{ background: card.background, aspectRatio: loaded ? undefined : '4 / 5' }}>
      {url && (
        <img
          src={url}
          alt={card.coverAlt || `${card.productName} by ${card.brand}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`block w-full transition-[opacity,transform] duration-700 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'absolute inset-0 h-full object-cover opacity-0'}`}
        />
      )}
    </div>
  )
}

function GalleryCard({ card }: { card: Card }) {
  const to = card.demo ? `/demo/${card.slug}` : `/s/${card.slug}`
  return (
    <li className="mb-4 break-inside-avoid md:mb-6">
      <Link to={to} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-4 focus-visible:ring-offset-obsidian">
        <div className="relative">
          <Cover card={card} />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            {card.demo ? (
              <span className="rounded-full bg-obsidian/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-porcelain sm:text-[11px]">
                Demo<span className="hidden sm:inline"> · fictional brand</span>
                <span className="sr-only sm:hidden"> · fictional brand</span>
              </span>
            ) : (
              <span />
            )}
            <span className="grid size-10 place-items-center rounded-full bg-porcelain text-obsidian opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
              <ArrowUpRight aria-hidden className="size-4" />
            </span>
          </div>
          <span
            className="pointer-events-none absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-obsidian/75 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-porcelain backdrop-blur-sm sm:bottom-3 sm:left-3 sm:text-[11px]"
            title={card.mode === 'true3d' ? 'Interactive 3D model' : '2D images animated with depth effects. Not a 3D model.'}
          >
            {card.mode === 'true3d' ? <Box aria-hidden className="size-3" /> : <Images aria-hidden className="size-3" />}
            {card.mode === 'true3d' ? 'True 3D' : 'Photo Motion'}
          </span>
        </div>
        <div className="grid gap-0.5 px-1 pt-3">
          <span className="text-[15px] font-semibold leading-snug tracking-tight text-porcelain">{card.productName || 'Untitled'}</span>
          <span className="truncate text-[13px] text-ash">
            {card.brand}
            {card.tagline ? ` — ${card.tagline}` : ''}
          </span>
        </div>
      </Link>
    </li>
  )
}

const MODES: { value: MediaMode | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'true3d', label: 'True 3D' },
  { value: 'photo', label: 'Photo Motion' },
]

export default function Gallery() {
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [mode, setMode] = useState<MediaMode | null>(null)
  const [items, setItems] = useState<Card[] | null>(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  useEffect(() => {
    document.title = 'Gallery · OBJECT.'
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(
    async (before: string | null) => {
      const id = ++request.current
      setError(null)
      try {
        const page = await backend.gallery({ before, query: term, mode, limit: PAGE })
        if (id !== request.current) return
        setItems((prev) => (before ? [...(prev ?? []), ...page] : page))
        setMore(page.length === PAGE)
      } catch (e) {
        if (id !== request.current) return
        setError(e instanceof Error ? e.message : 'The gallery could not be loaded.')
        setItems((prev) => prev ?? [])
      }
    },
    [term, mode],
  )

  useEffect(() => {
    setItems(null)
    void load(null)
  }, [load])

  const t = term.toLowerCase()
  const demos = DEMO_CARDS.filter((d) => (!mode || d.mode === mode) && (!t || [d.productName, d.brand, d.tagline].some((x) => x.toLowerCase().includes(t))))
  // Real showrooms first; the labelled demos close the wall once everything is shown.
  const cards = items ? [...items, ...(more ? [] : demos)] : null

  return (
    <div className="min-h-[100dvh] bg-obsidian text-porcelain">
      <Nav />
      <main id="main" className="gutter pb-24 pt-28 md:pt-36">
        <header className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-4">
            <h1 className="display text-[clamp(3rem,9vw,8rem)] leading-[0.85]">Gallery</h1>
            <p className="max-w-[52ch] text-lg text-silver">Products presented with OBJECT., in 3D or in motion. Open one to step into its showroom.</p>
          </div>
          <div className="grid gap-3 md:w-[22rem]">
            <label htmlFor="gallery-search" className="sr-only">
              Search the gallery
            </label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
              <input
                id="gallery-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a product or a brand"
                className="min-h-12 w-full rounded-full bg-graphite-2 pl-11 pr-4 text-[15px] text-porcelain ring-1 ring-inset ring-hairline placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
            <div role="radiogroup" aria-label="Presentation" className="flex gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={`min-h-10 cursor-pointer rounded-full px-4 text-sm transition-colors ${mode === m.value ? 'bg-porcelain text-obsidian' : 'text-silver ring-1 ring-inset ring-hairline hover:text-porcelain'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section aria-label="Showrooms" aria-busy={cards === null} className="mt-12 md:mt-16">
          {error && (
            <p role="alert" className="mb-6 text-sm text-danger">
              {error}{' '}
              <button type="button" onClick={() => void load(null)} className="cursor-pointer underline underline-offset-4">
                Try again
              </button>
            </p>
          )}
          {cards === null ? (
            <ul aria-hidden className="columns-2 gap-4 md:columns-3 md:gap-6 xl:columns-4">
              {['4 / 5', '1 / 1', '3 / 4', '4 / 6', '1 / 1', '4 / 5', '3 / 4', '4 / 5'].map((r, i) => (
                <li key={i} className="mb-4 break-inside-avoid animate-pulse rounded-2xl bg-graphite/60 md:mb-6" style={{ aspectRatio: r }} />
              ))}
            </ul>
          ) : cards.length === 0 ? (
            <p className="py-16 text-center text-silver">Nothing matches “{term}”. Try another word.</p>
          ) : (
            <ul className="columns-2 gap-4 md:columns-3 md:gap-6 xl:columns-4">
              {cards.map((c) => (
                <GalleryCard key={(c.demo ? 'demo:' : '') + c.slug} card={c} />
              ))}
            </ul>
          )}
          {more && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true)
                  await load(items?.at(-1)?.publishedAt ?? null)
                  setLoadingMore(false)
                }}
                className="min-h-12 cursor-pointer rounded-full px-6 text-sm font-medium ring-1 ring-inset ring-silver/30 hover:ring-porcelain disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </section>

        <aside className="mt-20 grid gap-4 rounded-2xl p-8 ring-1 ring-inset ring-hairline md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div className="grid gap-2">
            <p className="text-xl font-semibold tracking-tight">Your product belongs here.</p>
            <p className="text-silver">Publish a showroom and choose to show it in the gallery. You can take it out at any time.</p>
          </div>
          <Link to="/login?mode=signup" className="inline-flex min-h-12 items-center justify-center rounded-full bg-lime px-6 text-sm font-semibold text-obsidian">
            Create an account
          </Link>
        </aside>
      </main>
      <Footer />
    </div>
  )
}
