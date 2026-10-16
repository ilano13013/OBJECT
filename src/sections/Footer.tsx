import { Link } from 'react-router'
import { LinkButton } from '@/components/Button'

export function Footer() {
  return (
    <footer className="gutter relative overflow-hidden border-t border-hairline pb-10 pt-24 md:pt-32">
      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <p className="display max-w-[16ch] text-[clamp(2rem,5vw,4.5rem)]">
          Don’t just show it. <span className="text-lime">Make it unforgettable.</span>
        </p>
        <LinkButton to="/create">Create your showroom</LinkButton>
      </div>
      <p aria-hidden className="display mt-20 select-none text-[clamp(3.5rem,14.6vw,22rem)] leading-[0.78] text-graphite">
        OBJECT.
      </p>
      <div className="mt-8 flex flex-col gap-4 text-sm text-ash md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} OBJECT. — The immersive product studio.</p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link to="/demo/aura" className="hover:text-porcelain">AURA demo</Link>
          <Link to="/demo/form" className="hover:text-porcelain">FORM demo</Link>
          <Link to="/demo/mono" className="hover:text-porcelain">MONO demo</Link>
        </nav>
      </div>
    </footer>
  )
}
