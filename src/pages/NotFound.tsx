import { LinkButton } from '@/components/Button'

export default function NotFound() {
  return (
    <main className="gutter grid min-h-[100svh] place-content-center gap-8">
      <p className="display text-[clamp(5rem,20vw,16rem)] text-graphite">404</p>
      <p className="max-w-sm text-silver">This page does not exist, or this showroom is no longer published.</p>
      <div>
        <LinkButton to="/">Back to OBJECT.</LinkButton>
      </div>
    </main>
  )
}
