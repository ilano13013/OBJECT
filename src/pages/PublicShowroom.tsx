import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Wordmark } from '@/components/Wordmark'
import { bindPointer } from '@/lib/pointer'
import { ShowroomFrame } from '@/showroom/frame'
import { ShowroomRenderer } from '@/showroom/ShowroomRenderer'
import type { ShowroomConfig } from '@/showroom/types'
import { repository, useShowrooms } from '@/studio/repository'
import { useResolvedConfig } from '@/studio/useResolvedConfig'
import NotFound from './NotFound'

/** The published, read-only showroom visitors see at /s/:slug. */
export default function PublicShowroom() {
  const { slug } = useParams()
  useShowrooms() // re-render on changes
  const showroom = slug ? repository.getPublishedBySlug(slug) : undefined
  if (!showroom?.published) return <NotFound />
  return <Live config={showroom.published} />
}

function Live({ config }: { config: ShowroomConfig }) {
  const resolved = useResolvedConfig(config)
  useEffect(() => {
    bindPointer()
    window.scrollTo(0, 0)
    document.title = [config.productName, config.brand].filter(Boolean).join(' · ')
  }, [config.productName, config.brand])
  return (
    <>
      <ShowroomFrame>
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
