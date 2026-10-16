import { useEffect } from 'react'
import { Nav } from '@/components/Nav'
import { bindPointer } from '@/lib/pointer'
import { ScrollTrigger } from '@/lib/gsap'
import { Demos } from '@/sections/Demos'
import { Faq } from '@/sections/Faq'
import { Footer } from '@/sections/Footer'
import { Hero } from '@/sections/Hero'
import { HowItWorks } from '@/sections/HowItWorks'
import { Pricing } from '@/sections/Pricing'
import { Story } from '@/sections/Story'

export default function Landing() {
  useEffect(() => {
    bindPointer()
    document.title = 'OBJECT. — The immersive product studio'
    // Fonts change line heights; re-measure pinned sections once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
  }, [])

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-lime focus:px-4 focus:py-2 focus:text-obsidian">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Story />
        <Demos />
        <HowItWorks />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
