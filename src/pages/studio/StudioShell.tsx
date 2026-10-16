import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Wordmark } from '@/components/Wordmark'
import { storageAvailable } from '@/studio/repository'

export function StudioShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-obsidian text-porcelain">
      <header className="gutter flex h-16 items-center justify-between border-b border-hairline md:h-20">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="OBJECT. home" className="text-lg md:text-xl">
            <Wordmark />
          </Link>
          <span className="meta text-ash">Studio</span>
        </div>
        {action}
      </header>
      <div className="gutter flex items-start gap-2 border-b border-hairline py-3 text-[13px] text-silver">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
        {storageAvailable() ? (
          <p>
            Local mode: your showrooms are saved in this browser. Accounts, syncing across devices and payments are coming next. Nothing is charged.
          </p>
        ) : (
          <p className="text-[#ffb8ad]">This browser blocks storage (private browsing?). You can try the editor, but nothing will be saved.</p>
        )}
      </div>
      {children}
    </div>
  )
}
