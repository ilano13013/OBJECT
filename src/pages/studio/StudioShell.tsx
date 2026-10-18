import { Info, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { Wordmark } from '@/components/Wordmark'
import { storageAvailable } from '@/studio/repository'

export function StudioShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const { mode, user } = useAuth()
  return (
    <div className="min-h-[100dvh] bg-obsidian text-porcelain">
      <header className="gutter flex h-16 items-center justify-between gap-3 border-b border-hairline md:h-20">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="OBJECT. home" className="text-lg md:text-xl">
            <Wordmark />
          </Link>
          <Link to="/studio" className="meta text-ash hover:text-porcelain">
            Studio
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {mode === 'cloud' && user && (
            <Link to="/account" className="grid size-11 place-items-center rounded-full text-silver ring-1 ring-inset ring-hairline hover:text-porcelain" aria-label={`Account (${user.email})`} title={user.email}>
              <UserRound aria-hidden className="size-5" />
            </Link>
          )}
        </div>
      </header>
      {mode === 'local' && (
        <div className="gutter flex items-start gap-2 border-b border-hairline py-3 text-[13px] text-silver">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
          {storageAvailable() ? (
            <p>Local mode: your showrooms are saved in this browser. Accounts, syncing across devices and payments are coming next. Nothing is charged.</p>
          ) : (
            <p className="text-danger-soft">This browser blocks storage (private browsing?). You can try the editor, but nothing will be saved.</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
