import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Wordmark } from './Wordmark'

const LINKS = [
  { href: '#demos', label: 'Demos' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`gutter fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between transition-[background-color,backdrop-filter] duration-500 md:h-20 ${
        scrolled ? 'bg-obsidian/70 backdrop-blur-xl' : ''
      }`}
    >
      <Link to="/" className="text-xl md:text-2xl" aria-label="OBJECT. home">
        <Wordmark />
      </Link>
      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="text-sm text-silver transition-colors hover:text-porcelain">
            {l.label}
          </a>
        ))}
      </nav>
      <Link
        to="/studio"
        className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-obsidian bg-porcelain transition-colors hover:bg-lime"
      >
        Start<span className="sr-only"> a showroom</span>
      </Link>
    </header>
  )
}
