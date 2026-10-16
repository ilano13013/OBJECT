import { BarChart3, Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { fontClass } from '@/showroom/parts'
import { assetIdOf, assetUrl, isAssetRef } from '@/studio/assets'
import { backend, type Entitlement } from '@/studio/backend'
import { refreshShowrooms, useShowroomsState } from '@/studio/store'
import { TEMPLATE_INFO } from '@/studio/starters'
import type { StudioShowroom } from '@/studio/types'
import { StudioShell } from './StudioShell'

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function Thumb({ s }: { s: StudioShowroom }) {
  const first = s.draft.images[0]?.src
  const [url, setUrl] = useState<string | null>(first && !isAssetRef(first) ? first : null)
  useEffect(() => {
    if (!first || !isAssetRef(first)) return
    let alive = true
    assetUrl(assetIdOf(first)).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [first])
  const t = s.draft.theme
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md" style={{ background: t.background, color: t.text }}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className={`${fontClass(t.displayFont)} absolute inset-x-3 bottom-3 line-clamp-2 text-2xl`}>{s.draft.productName || 'Untitled'}</span>
      )}
      <span className="absolute left-3 top-3 h-1 w-8 rounded-full" style={{ background: t.accent }} />
    </div>
  )
}

export default function StudioHome() {
  const { showrooms, loaded, error } = useShowroomsState()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [views, setViews] = useState<Record<string, { views: number; clicks: number }> | null>(null)
  const [plan, setPlan] = useState<Entitlement | null>(null)

  useEffect(() => {
    document.title = 'My showrooms · OBJECT.'
    backend.totals(30).then(setViews).catch(() => setViews(null))
    backend.entitlement().then(setPlan).catch(() => setPlan(null))
  }, [showrooms.length])

  async function act(id: string, run: () => Promise<void>) {
    setBusy(id)
    setActionError(null)
    try {
      await run()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const list = showrooms.filter((s) => filter === 'all' || s.status === filter)
  const counts = { all: showrooms.length, draft: showrooms.filter((s) => s.status === 'draft').length, published: showrooms.filter((s) => s.status === 'published').length }

  return (
    <StudioShell
      action={
        <Link to="/studio/new" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-obsidian">
          <Plus aria-hidden className="size-4" /> New showroom
        </Link>
      }
    >
      <main className="gutter py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">My showrooms</h1>
          {showrooms.length > 0 && (
            <div role="tablist" aria-label="Filter showrooms" className="flex gap-1 rounded-lg bg-graphite-2 p-1 ring-1 ring-inset ring-hairline">
              {(['all', 'draft', 'published'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`min-h-10 cursor-pointer rounded-md px-3 text-sm transition-colors ${filter === f ? 'bg-porcelain text-obsidian' : 'text-silver hover:text-porcelain'}`}
                >
                  {f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : 'Published'} <span className="tabular-nums opacity-60">{counts[f]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {plan && (
          <p className="mt-6 text-sm text-silver">
            Plan: <span className="text-porcelain">{plan.plan === 'none' ? 'none yet' : plan.plan === 'one' ? 'One Showroom' : 'Studio'}</span> ·{' '}
            <span className="tabular-nums">
              {plan.used} of {plan.allowance} publishing slot{plan.allowance === 1 ? '' : 's'} used
            </span>{' '}
            · <Link to="/account" className="underline underline-offset-4">Account</Link>
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-6 text-sm text-[#ff9d8f]">
            {actionError}
          </p>
        )}

        {!loaded ? (
          <p className="mt-16 text-sm text-ash" aria-busy="true">
            Loading your showrooms…
          </p>
        ) : error ? (
          <div className="mt-16 grid max-w-lg gap-4">
            <p className="text-lg">Your showrooms couldn’t be loaded.</p>
            <p className="text-sm text-ash">{error}</p>
            <button type="button" onClick={() => void refreshShowrooms()} className="min-h-11 w-fit cursor-pointer rounded-full bg-lime px-5 text-sm font-semibold text-obsidian">
              Try again
            </button>
          </div>
        ) : showrooms.length === 0 ? (
          <div className="mt-16 grid max-w-xl gap-6">
            <p className="text-lg leading-relaxed text-silver">
              No showrooms yet. Start with your product’s photos or a 3D model: the first one takes about ten minutes.
            </p>
            <div>
              <Link to="/studio/new" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-obsidian">
                <Plus aria-hidden className="size-4" /> Create your first showroom
              </Link>
            </div>
          </div>
        ) : list.length === 0 ? (
          <p className="mt-12 text-silver">Nothing here yet.</p>
        ) : (
          <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <li key={s.id} className="flex flex-col gap-4">
                <Link to={`/studio/${s.id}`} className="group block rounded-md focus-visible:outline-offset-4" aria-label={`Edit ${s.draft.productName || 'Untitled'}`}>
                  <div className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-1">
                    <Thumb s={s} />
                  </div>
                </Link>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-tight">{s.draft.productName || 'Untitled'}</p>
                    <p className="text-[13px] text-ash">
                      {TEMPLATE_INFO[s.draft.template].name} · created {dateFmt.format(new Date(s.createdAt))}
                    </p>
                    <p className="text-[13px] tabular-nums text-ash">
                      {views ? `${views[s.id]?.views ?? 0} views · 30 days` : 'Views recorded once accounts are on'}
                    </p>
                  </div>
                  <span className={`meta shrink-0 rounded-full px-2.5 py-1 ${s.status === 'published' ? 'bg-[#3ccf6e]/15 text-[#7fe3a1]' : 'bg-white/5 text-silver'}`}>
                    {s.status === 'published' ? 'Live' : 'Draft'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 border-t border-hairline pt-3 text-sm">
                  <Link to={`/studio/${s.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-silver hover:bg-white/5 hover:text-porcelain">
                    <Pencil aria-hidden className="size-4" /> Edit
                  </Link>
                  {s.status === 'published' && (
                    <Link to={`/s/${s.slug}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-silver hover:bg-white/5 hover:text-porcelain">
                      <ExternalLink aria-hidden className="size-4" /> View
                    </Link>
                  )}
                  <Link to={`/studio/${s.id}/stats`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-silver hover:bg-white/5 hover:text-porcelain">
                    <BarChart3 aria-hidden className="size-4" /> Stats
                  </Link>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => act(s.id, async () => navigate(`/studio/${(await backend.duplicate(s.id)).id}`))}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-silver hover:bg-white/5 hover:text-porcelain disabled:cursor-wait disabled:opacity-60"
                  >
                    <Copy aria-hidden className="size-4" /> {busy === s.id ? 'Working…' : 'Duplicate'}
                  </button>
                  {confirm === s.id ? (
                    <span className="ml-auto inline-flex items-center gap-1">
                      <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => backend.remove(s.id))} className="min-h-10 cursor-pointer rounded-md bg-[#ff9d8f] px-3 font-semibold text-obsidian">
                        Delete
                      </button>
                      <button type="button" onClick={() => setConfirm(null)} className="min-h-10 cursor-pointer px-2 text-ash hover:text-porcelain">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirm(s.id)}
                      aria-label={`Delete ${s.draft.productName || 'Untitled'}`}
                      className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-ash hover:bg-[#ff9d8f]/10 hover:text-[#ff9d8f]"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </StudioShell>
  )
}
