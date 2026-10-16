import type { ReactNode } from 'react'
import { Link } from 'react-router'
import auraPoster from '@/assets/renders/aura-poster.webp'
import { Wordmark } from '@/components/Wordmark'

export function AuthShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-obsidian text-porcelain lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
        <img src={auraPoster} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-obsidian" />
        <p className="display absolute bottom-10 left-10 max-w-[12ch] text-5xl">
          Make it <span className="serif-accent text-silver">unforgettable.</span>
        </p>
      </aside>
      <main className="gutter flex flex-col py-8">
        <Link to="/" className="text-xl" aria-label="OBJECT. home">
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">
          <h1 className="display text-4xl">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const cls =
    tone === 'error' ? 'bg-[#ff9d8f]/10 text-[#ffb8ad]' : tone === 'success' ? 'bg-[#3ccf6e]/10 text-[#9ae9b5]' : 'bg-white/5 text-silver'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md p-3 text-sm leading-relaxed ${cls}`}>
      {children}
    </p>
  )
}
