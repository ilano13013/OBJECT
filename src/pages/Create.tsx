import { useSearchParams } from 'react-router'
import { LinkButton } from '@/components/Button'
import { Nav } from '@/components/Nav'

/**
 * Phase A placeholder for the studio entry point. The editor, accounts and
 * checkout arrive in phases B–D; until then this page says so plainly
 * instead of pretending.
 */
export default function Create() {
  const [params] = useSearchParams()
  const plan = params.get('plan')
  return (
    <>
      <Nav />
      <main className="gutter grid min-h-[100svh] content-center gap-10 py-32">
        <h1 className="display max-w-[12ch] text-[clamp(3rem,9vw,8rem)]">
          The studio <span className="serif-accent text-silver">is being</span> built.
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-silver">
          The showroom editor, accounts and checkout{plan ? ` for the ${plan === 'studio' ? 'Studio' : 'One Showroom'} plan` : ''} are not open yet. Nothing
          can be purchased at this stage. Meanwhile, the three demo showrooms show exactly what you will be able to build.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton to="/demo/aura">Explore the demos</LinkButton>
          <LinkButton to="/" variant="ghost">
            Back to home
          </LinkButton>
        </div>
      </main>
    </>
  )
}
