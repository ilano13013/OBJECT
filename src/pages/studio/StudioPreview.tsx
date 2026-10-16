import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { bindPointer } from '@/lib/pointer'
import { ShowroomFrame } from '@/showroom/frame'
import { ShowroomRenderer } from '@/showroom/ShowroomRenderer'
import { useShowroom } from '@/studio/repository'
import { useResolvedConfig } from '@/studio/useResolvedConfig'
import NotFound from '../NotFound'

export default function StudioPreview() {
  const { id } = useParams()
  const showroom = useShowroom(id)
  if (!showroom) return <NotFound />
  return <Inner id={showroom.id} config={showroom.draft} />
}

function Inner({ id, config }: { id: string; config: Parameters<typeof useResolvedConfig>[0] }) {
  const resolved = useResolvedConfig(config)
  useEffect(() => {
    bindPointer()
    window.scrollTo(0, 0)
  }, [])
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-lime px-[var(--gutter)] py-2 text-sm text-obsidian">
        <span className="meta">Preview of your draft · not public</span>
        <Link to={`/studio/${id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-obsidian px-3 text-porcelain">
          <ArrowLeft aria-hidden className="size-4" /> Back to editor
        </Link>
      </div>
      <ShowroomFrame>
        <ShowroomRenderer config={resolved} />
      </ShowroomFrame>
    </>
  )
}
