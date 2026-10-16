import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Wordmark } from '@/components/Wordmark'
import { bindPointer } from '@/lib/pointer'
import { getDemo } from '@/showroom/demos'
import { DemoNotice } from '@/showroom/parts'
import { ShowroomFrame } from '@/showroom/frame'
import { ShowroomRenderer } from '@/showroom/ShowroomRenderer'
import NotFound from './NotFound'

export default function DemoShowroom() {
  const { slug } = useParams()
  const config = getDemo(slug)

  useEffect(() => {
    bindPointer()
    window.scrollTo(0, 0)
    if (config) document.title = `${config.brand} — ${config.productName} · OBJECT. demo`
  }, [config])

  if (!config) return <NotFound />

  return (
    <div className="relative">
      <div className="fixed inset-x-0 top-0 z-50">
        <DemoNotice brand={config.brand} />
        <div className="flex items-center justify-between px-[var(--gutter)] py-3">
          <Link
            to="/#demos"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-obsidian/80 px-4 text-sm text-porcelain backdrop-blur-md transition-colors hover:bg-obsidian"
          >
            <ArrowLeft aria-hidden className="size-4" /> All demos
          </Link>
          <Link to="/" className="rounded-full bg-obsidian/80 px-4 py-2.5 text-sm backdrop-blur-md" aria-label="OBJECT. home">
            <Wordmark className="text-base text-porcelain" />
          </Link>
        </div>
      </div>
      <main key={config.slug} className="pt-0">
        <ShowroomFrame>
          <ShowroomRenderer config={config} />
        </ShowroomFrame>
      </main>
      <DemoSwitcher current={config.slug} />
    </div>
  )
}

function DemoSwitcher({ current }: { current: string }) {
  const demos = [
    { slug: 'aura', name: 'AURA', t: 'Orbit' },
    { slug: 'form', name: 'FORM', t: 'Editorial' },
    { slug: 'mono', name: 'MONO', t: 'Gallery' },
  ]
  return (
    <nav aria-label="Other demos" className="gutter grid grid-cols-3 gap-6 bg-obsidian">
      {demos.map((d) => (
        <Link
          key={d.slug}
          to={`/demo/${d.slug}`}
          aria-current={d.slug === current ? 'page' : undefined}
          className="group border-t border-hairline py-8 text-porcelain transition-colors hover:border-lime md:py-12"
        >
          <span className="meta block text-ash">{d.t}</span>
          <span className={`display mt-2 block text-[clamp(1.6rem,5vw,4rem)] ${d.slug === current ? 'text-lime' : ''}`}>{d.name}</span>
        </Link>
      ))}
    </nav>
  )
}
