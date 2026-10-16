import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Wordmark } from '@/components/Wordmark'
import { bindPointer } from '@/lib/pointer'
import { ShowroomFrame } from '@/showroom/frame'
import { ShowroomRenderer } from '@/showroom/ShowroomRenderer'
import type { ShowroomConfig } from '@/showroom/types'
import { backend } from '@/studio/backend'
import { useResolvedConfig } from '@/studio/useResolvedConfig'
import NotFound from './NotFound'

/** The published, read-only showroom visitors see at /s/:slug. */
export default function PublicShowroom() {
  const { slug } = useParams()
  const [state, setState] = useState<{ slug: string; config: ShowroomConfig | null; error?: string } | null>(null)

  useEffect(() => {
    if (!slug) return
    let alive = true
    backend
      .getPublished(slug)
      .then((config) => alive && setState({ slug, config }))
      .catch((e: unknown) => alive && setState({ slug, config: null, error: e instanceof Error ? e.message : 'unavailable' }))
    return () => {
      alive = false
    }
  }, [slug])

  if (!slug) return <NotFound />
  if (!state || state.slug !== slug) return <div className="min-h-[100dvh] bg-obsidian" aria-busy="true" aria-label="Loading showroom" />
  if (state.error)
    return (
      <main className="gutter grid min-h-[100dvh] content-center gap-4 bg-obsidian">
        <p className="text-lg">This showroom couldn’t be loaded right now.</p>
        <p className="text-sm text-ash">Check your connection and reload the page.</p>
      </main>
    )
  if (!state.config) return <NotFound />
  return <Live slug={slug} config={state.config} />
}

function Live({ slug, config }: { slug: string; config: ShowroomConfig }) {
  const resolved = useResolvedConfig(config)
  useEffect(() => {
    bindPointer()
    window.scrollTo(0, 0)
    document.title = [config.productName, config.brand].filter(Boolean).join(' · ')
    backend.track(slug, 'view')
  }, [slug, config.productName, config.brand])
  return (
    <>
      <ShowroomFrame onPurchase={() => backend.track(slug, 'purchase_click')}>
        <ShowroomRenderer config={resolved} />
      </ShowroomFrame>
      <footer className="flex items-center justify-center gap-2 bg-obsidian py-6 text-xs text-ash">
        Made with
        <Link to="/" className="text-porcelain" aria-label="OBJECT.">
          <Wordmark className="text-sm" />
        </Link>
      </footer>
    </>
  )
}
