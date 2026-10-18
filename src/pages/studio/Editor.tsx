import { ArrowLeft, Check, CircleAlert, Copy, ExternalLink, Eye, LoaderCircle, Monitor, Smartphone, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { paymentsAvailable, waitForPayment } from '@/billing/client'
import { PlanChoice } from '@/billing/PlanChoice'
import { ShowroomFrame } from '@/showroom/frame'
import { ShowroomRenderer } from '@/showroom/ShowroomRenderer'
import type { ShowroomConfig } from '@/showroom/types'
import {
  ChaptersPanel,
  ContentPanel,
  DetailsPanel,
  FeaturesPanel,
  LinkPanel,
  LookPanel,
  MediaPanel,
  MotionPanel,
  PurchasePanel,
  TemplatePanel,
  type Update,
} from '@/studio/editor/Panels'
import { backend } from '@/studio/backend'
import { clearBackup, readBackup, writeBackup } from '@/studio/draftBackup'
import { refreshShowrooms, useShowroom } from '@/studio/store'
import type { StudioShowroom } from '@/studio/types'
import { useResolvedConfig } from '@/studio/useResolvedConfig'
import type { PublishIssue } from '@/studio/validation'
import NotFound from '../NotFound'
import { publicUrl } from './links'

type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'error'; message: string }

export default function Editor() {
  const { id } = useParams()
  const { showroom, loaded, error } = useShowroom(id)
  if (!showroom) {
    if (!loaded) return <div className="grid min-h-[100dvh] place-items-center bg-obsidian text-sm text-ash" aria-busy="true">Opening your showroom…</div>
    if (error) return <LoadError message={error} />
    return <NotFound />
  }
  return <EditorInner key={showroom.id} showroom={showroom} />
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="gutter grid min-h-[100dvh] content-center gap-6 bg-obsidian">
      <p className="max-w-md text-lg text-porcelain">Your showroom couldn’t be loaded.</p>
      <p className="max-w-md text-sm text-ash">{message}</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => void refreshShowrooms()} className="min-h-11 cursor-pointer rounded-full bg-lime px-5 text-sm font-semibold text-obsidian">
          Try again
        </button>
        <Link to="/studio" className="inline-flex min-h-11 items-center rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30">
          My showrooms
        </Link>
      </div>
    </main>
  )
}

function EditorInner({ showroom }: { showroom: StudioShowroom }) {
  const navigate = useNavigate()
  const [backup] = useState(() => readBackup(showroom.id, showroom.updatedAt))
  const [draft, setDraft] = useState<ShowroomConfig>(showroom.draft)
  const [save, setSave] = useState<SaveState>({ kind: 'saved' })
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [replay, setReplay] = useState(0)
  const [busy, setBusy] = useState(false)
  const [showRestore, setShowRestore] = useState(!!backup)
  const [params, setParams] = useSearchParams()
  const [checkout, setCheckout] = useState<null | 'confirming' | 'paid' | 'slow' | 'cancelled'>(() => {
    const c = params.get('checkout')
    return c === 'success' ? 'confirming' : c === 'cancelled' ? 'cancelled' : null
  })

  // Back from Stripe: wait for the server webhook to record the payment. The return URL proves nothing.
  useEffect(() => {
    if (!params.get('checkout')) return
    setParams({}, { replace: true })
    if (checkout !== 'confirming') return
    let alive = true
    waitForPayment((o) => o.paid_showrooms.includes(showroom.id) || o.plan === 'studio').then((ok) => alive && setCheckout(ok ? 'paid' : 'slow'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [dialog, setDialog] = useState<null | { kind: 'issues'; issues: PublishIssue[] } | { kind: 'live' }>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(draft)
  const dirty = useRef(false)
  const chain = useRef<Promise<boolean>>(Promise.resolve(true))

  /** Saves the latest draft. Saves run one after another so an older one never overwrites a newer one. */
  const flush = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return chain.current
    dirty.current = false
    const snapshot = latest.current
    chain.current = chain.current.then(async () => {
      try {
        await backend.saveDraft(showroom.id, snapshot)
        if (!dirty.current) {
          clearBackup(showroom.id)
          setSave({ kind: 'saved' })
        }
        return true
      } catch (e) {
        dirty.current = true
        setSave({ kind: 'error', message: e instanceof Error ? e.message : 'Couldn’t save your changes. Try again.' })
        return false
      }
    })
    return chain.current
  }, [showroom.id])

  const update: Update = useCallback((change) => {
    setDraft((d) => change(d))
    // Same render as the change: the status never claims "Saved" while an edit is pending.
    setSave({ kind: 'saving' })
  }, [])

  // Autosave half a second after the last change; a local backup is written at once.
  useEffect(() => {
    if (draft === latest.current) return
    latest.current = draft
    dirty.current = true
    writeBackup(showroom.id, draft)
    setSave({ kind: 'saving' })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 500)
  }, [draft, flush, showroom.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flush()
      }
    }
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return
      void flush()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onLeave)
      void flush()
    }
  }, [flush])

  useEffect(() => {
    document.title = `${draft.productName || 'Untitled'} · Studio · OBJECT.`
  }, [draft.productName])

  const changedSincePublish =
    showroom.status === 'published' && JSON.stringify({ ...draft, slug: '' }) !== JSON.stringify({ ...showroom.published, slug: '' })

  async function publish() {
    setBusy(true)
    try {
      if (!(await flush())) return
      const result = await backend.publish(showroom.id)
      setDialog(result.ok ? { kind: 'live' } : { kind: 'issues', issues: result.issues })
    } catch (e) {
      setDialog({ kind: 'issues', issues: [{ field: 'server', message: e instanceof Error ? e.message : 'Publishing failed. Try again.' }] })
    } finally {
      setBusy(false)
    }
  }

  const panelProps = { showroom, draft, update }

  return (
    <div className="flex h-[100dvh] flex-col bg-obsidian text-porcelain">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-hairline px-3 md:gap-4 md:px-5">
        <Link to="/studio" onClick={() => void flush()} className="grid size-11 shrink-0 place-items-center rounded-md text-silver hover:bg-white/5 hover:text-porcelain" aria-label="Back to my showrooms">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">{draft.productName || 'Untitled showroom'}</p>
          <SaveStatus save={save} status={showroom.status} changed={changedSincePublish} />
        </div>
        <div role="radiogroup" aria-label="Preview size" className="hidden items-center rounded-lg bg-graphite-2 p-1 ring-1 ring-inset ring-hairline lg:flex">
          <DeviceButton active={device === 'desktop'} onClick={() => setDevice('desktop')} label="Desktop preview">
            <Monitor aria-hidden className="size-4" />
          </DeviceButton>
          <DeviceButton active={device === 'mobile'} onClick={() => setDevice('mobile')} label="Phone preview">
            <Smartphone aria-hidden className="size-4" />
          </DeviceButton>
        </div>
        <button
          type="button"
          onClick={() => {
            flush()
            navigate(`/studio/${showroom.id}/preview`)
          }}
          className="hidden min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm text-silver ring-1 ring-inset ring-silver/30 hover:text-porcelain hover:ring-porcelain sm:inline-flex"
        >
          <Eye aria-hidden className="size-4" /> Full preview
        </button>
        {showroom.status === 'published' && !changedSincePublish ? (
          <button
            type="button"
            onClick={() => setDialog({ kind: 'live' })}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-porcelain px-4 text-sm font-semibold text-obsidian hover:bg-white"
          >
            <span className="size-2 rounded-full bg-success" aria-hidden /> Live
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-obsidian hover:shadow-[0_8px_30px_-8px_rgb(215_255_67/0.6)] disabled:cursor-wait disabled:opacity-70"
          >
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {showroom.status === 'published' ? 'Publish changes' : 'Publish'}
          </button>
        )}
      </header>

      {checkout && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 text-sm ${checkout === 'paid' ? 'bg-lime text-obsidian' : 'bg-graphite'}`}
        >
          <span>
            {checkout === 'confirming' && 'Payment received by Stripe. Confirming it with our server…'}
            {checkout === 'paid' && 'Payment confirmed. You can publish this showroom now.'}
            {checkout === 'slow' && 'Stripe hasn’t confirmed the payment yet. It can take a minute: reload this page shortly. You won’t be charged twice.'}
            {checkout === 'cancelled' && 'Checkout cancelled. Nothing was charged.'}
          </span>
          <span className="flex gap-2">
            {checkout === 'paid' && (
              <button type="button" onClick={() => void publish()} className="min-h-10 cursor-pointer rounded-full bg-obsidian px-4 font-semibold text-porcelain">
                Publish now
              </button>
            )}
            <button type="button" onClick={() => setCheckout(null)} className="min-h-10 cursor-pointer px-3 opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </span>
        </div>
      )}

      {showRestore && backup && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-graphite px-4 py-3 text-sm">
          <span>You have changes from {new Date(backup.savedAt).toLocaleString()} that weren’t saved.</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(backup.draft)
                setShowRestore(false)
              }}
              className="min-h-10 cursor-pointer rounded-full bg-lime px-4 font-semibold text-obsidian"
            >
              Restore them
            </button>
            <button
              type="button"
              onClick={() => {
                clearBackup(showroom.id)
                setShowRestore(false)
              }}
              className="min-h-10 cursor-pointer px-3 text-ash hover:text-porcelain"
            >
              Discard
            </button>
          </span>
        </div>
      )}

      {/* Mobile tabs */}
      <div role="tablist" aria-label="Editor view" className="grid grid-cols-2 border-b border-hairline lg:hidden">
        {(['edit', 'preview'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-12 cursor-pointer text-sm font-medium transition-colors ${tab === t ? 'text-porcelain shadow-[inset_0_-2px_0_var(--color-lime)]' : 'text-ash'}`}
          >
            {t === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Settings */}
        <aside aria-label="Showroom settings" className={`w-full shrink-0 overflow-y-auto border-r border-hairline lg:block lg:w-[380px] ${tab === 'edit' ? 'block' : 'hidden'}`}>
          <Guide showroom={showroom} draft={draft} />
          <TemplatePanel {...panelProps} />
          <MediaPanel {...panelProps} />
          <ContentPanel {...panelProps} />
          <FeaturesPanel {...panelProps} />
          <ChaptersPanel {...panelProps} />
          <DetailsPanel {...panelProps} />
          <LookPanel {...panelProps} />
          <PurchasePanel {...panelProps} />
          <MotionPanel {...panelProps} onReplay={() => setReplay((r) => r + 1)} />
          <LinkPanel {...panelProps} />
          <DangerZone showroom={showroom} onDeleted={() => navigate('/studio')} />
        </aside>

        {/* Live preview */}
        <main aria-label="Live preview" className={`relative min-w-0 flex-1 bg-[#050506] lg:block ${tab === 'preview' ? 'block' : 'hidden'}`}>
          <Preview draft={draft} device={device} replay={replay} />
        </main>
      </div>

      {dialog && (
        <Dialog onClose={() => setDialog(null)} title={
            dialog.kind === 'issues'
              ? dialog.issues.length === 1 && dialog.issues[0]!.field === 'plan'
                ? 'Choose a plan to publish'
                : 'Almost ready to publish'
              : 'Your showroom is live'
          }>
          {dialog.kind === 'issues' ? (
            <IssuesBody issues={dialog.issues} showroomId={showroom.id} onClose={() => setDialog(null)} />
          ) : (
            <LiveBody
              showroom={showroom}
              onUnpublish={async () => {
                await backend.unpublish(showroom.id)
                setDialog(null)
              }}
            />
          )}
        </Dialog>
      )}
    </div>
  )
}

function DeviceButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-9 cursor-pointer place-items-center rounded-md transition-colors ${active ? 'bg-porcelain text-obsidian' : 'text-silver hover:text-porcelain'}`}
    >
      {children}
    </button>
  )
}

function SaveStatus({ save, status, changed }: { save: SaveState; status: StudioShowroom['status']; changed: boolean }) {
  const state =
    save.kind === 'saving' ? (
      <span className="inline-flex items-center gap-1.5">
        <LoaderCircle aria-hidden className="size-3 animate-spin" /> Saving…
      </span>
    ) : save.kind === 'error' ? (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <CircleAlert aria-hidden className="size-3" /> {save.message}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <Check aria-hidden className="size-3" /> Saved
      </span>
    )
  return (
    <p className="flex items-center gap-2 truncate text-xs text-ash" role="status" aria-live="polite">
      {state}
      <span aria-hidden>·</span>
      {status === 'published' ? (changed ? 'Live, with unpublished changes' : 'Live') : 'Draft'}
    </p>
  )
}

function Preview({ draft, device, replay }: { draft: ShowroomConfig; device: 'desktop' | 'mobile'; replay: number }) {
  const resolved = useResolvedConfig(draft)
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const empty = draft.mode === 'photo' ? draft.images.length === 0 : !draft.model
  const content = scroller && (
    <ShowroomFrame scroller={scroller}>
      <ShowroomRenderer key={`${replay}-${draft.template}-${draft.mode}`} config={resolved} />
    </ShowroomFrame>
  )
  const overlay = empty && (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 grid place-items-center px-6">
      <p className="max-w-xs rounded-lg bg-obsidian/85 px-4 py-3 text-center text-sm text-silver ring-1 ring-hairline backdrop-blur">
        {draft.mode === 'photo' ? 'Add images in Media to see your product here.' : 'Upload a GLB or glTF model in Media to see it here in 3D.'}
      </p>
    </div>
  )
  if (device === 'mobile') {
    return (
      <div className="absolute inset-0 grid place-items-center overflow-auto p-6">
        <div className="relative h-[min(844px,100%)] w-[390px] max-w-full overflow-hidden rounded-[2.2rem] ring-8 ring-graphite">
          <div ref={setScroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            {content}
          </div>
          {overlay}
        </div>
      </div>
    )
  }
  return (
    <>
      <div ref={setScroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden" data-testid="preview-scroller">
        {content}
      </div>
      {overlay}
    </>
  )
}

function Guide({ showroom, draft }: { showroom: StudioShowroom; draft: ShowroomConfig }) {
  const [hidden, setHidden] = useState(false)
  const steps = useMemo(
    () => [
      { label: 'Name your product', done: !!draft.productName.trim(), target: 'content' },
      { label: draft.mode === 'photo' ? 'Add your photos' : 'Upload your 3D model', done: draft.mode === 'photo' ? draft.images.length > 0 : !!draft.model, target: 'media' },
      { label: 'Write a tagline or description', done: !!(draft.tagline.trim() || draft.description.trim()), target: 'content' },
      { label: 'Link your store', done: !!draft.purchaseUrl, target: 'purchase' },
      { label: 'Publish and share', done: showroom.status === 'published', target: null },
    ],
    [draft, showroom.status],
  )
  const done = steps.filter((s) => s.done).length
  if (hidden || done === steps.length) return null
  return (
    <div className="m-4 rounded-lg bg-graphite-2 p-4 ring-1 ring-inset ring-hairline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">First showroom</p>
          <p className="text-[13px] text-ash">
            {done} of {steps.length} done. Changes save automatically.
          </p>
        </div>
        <button type="button" onClick={() => setHidden(true)} className="grid size-9 cursor-pointer place-items-center rounded-md text-ash hover:text-porcelain" aria-label="Hide guide">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${s.done ? 'bg-lime text-obsidian' : 'ring-1 ring-inset ring-silver/30'}`}>
              {s.done && <Check aria-hidden className="size-3" strokeWidth={3} />}
            </span>
            {s.target && !s.done ? (
              <a href={`#section-${s.target}`} className="text-porcelain underline decoration-hairline underline-offset-4 hover:decoration-lime">
                {s.label}
              </a>
            ) : (
              <span className={s.done ? 'text-ash line-through decoration-ash/40' : 'text-porcelain'}>{s.label}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal?.()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl bg-graphite p-0 text-porcelain shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8)] ring-1 ring-hairline backdrop:bg-obsidian/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-2">
        <h2 id="dialog-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="grid size-9 cursor-pointer place-items-center rounded-md text-ash hover:text-porcelain" aria-label="Close">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="p-6 pt-2">{children}</div>
    </dialog>
  )
}

function IssuesBody({ issues, showroomId, onClose }: { issues: PublishIssue[]; showroomId: string; onClose: () => void }) {
  const needsPlan = issues.some((i) => i.field === 'plan')
  if (needsPlan && issues.length === 1 && paymentsAvailable) {
    return (
      <>
        <p className="text-sm leading-relaxed text-silver">Your showroom is ready. Choose how to publish it:</p>
        <PlanChoice showroomId={showroomId} />
      </>
    )
  }
  return (
    <>
      <p className="text-sm text-silver">Fix these and publish again:</p>
      <ul className="mt-4 space-y-2">
        {issues.map((i) => (
          <li key={i.message} className="flex gap-2 text-sm">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            {i.message}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-porcelain px-5 text-sm font-semibold text-obsidian">
        Back to editing
      </button>
    </>
  )
}

function LiveBody({ showroom, onUnpublish }: { showroom: StudioShowroom; onUnpublish: () => Promise<void> }) {
  const url = publicUrl(showroom.slug)
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [confirm, setConfirm] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  return (
    <>
      <p className="text-sm text-silver">Anyone with this link sees the published version. Keep editing here: visitors see changes after you publish again.</p>
      <div className="mt-4 flex gap-2">
        <label htmlFor="live-url" className="sr-only">
          Public link
        </label>
        <input id="live-url" ref={field} readOnly value={url} onFocus={(e) => e.target.select()} className="min-h-11 min-w-0 flex-1 rounded-md bg-obsidian px-3 font-mono text-sm text-porcelain ring-1 ring-inset ring-hairline" />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied('copied'))
              .catch(() => {
                field.current?.select()
                setCopied('failed')
              })
          }}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-lime px-4 text-sm font-semibold text-obsidian"
        >
          {copied === 'copied' ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied === 'copied' ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p role="status" className="mt-2 text-xs text-ash">
        {copied === 'failed' ? 'Couldn’t copy automatically: the link is selected, copy it with your keyboard.' : ''}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-ash">
        Local mode: until accounts open, showrooms are stored in this browser, so the link works on this device only.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/s/${showroom.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain">
          <ExternalLink aria-hidden className="size-4" /> Open showroom
        </Link>
        {confirm ? (
          <span className="flex items-center gap-2 text-sm">
            Take it offline?
            <button type="button" onClick={() => void onUnpublish()} className="min-h-11 cursor-pointer rounded-full bg-danger px-4 font-semibold text-obsidian">
              Unpublish
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 cursor-pointer px-2 text-ash hover:text-porcelain">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-11 cursor-pointer px-2 text-sm text-ash underline underline-offset-4 hover:text-porcelain">
            Unpublish…
          </button>
        )}
      </div>
    </>
  )
}

function DangerZone({ showroom, onDeleted }: { showroom: StudioShowroom; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  return (
    <div className="p-5">
      {confirm ? (
        <div className="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-danger/40">
          <p className="text-sm">Delete “{showroom.draft.productName || 'Untitled'}” and its files? {showroom.status === 'published' && 'Its public link stops working.'} This can’t be undone.</p>
          {deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                try {
                  await backend.remove(showroom.id)
                  onDeleted()
                } catch (e) {
                  setDeleteError(e instanceof Error ? e.message : 'Couldn’t delete this showroom.')
                  setDeleting(false)
                }
              }}
              className="min-h-11 cursor-pointer rounded-full bg-danger px-4 text-sm font-semibold text-obsidian disabled:cursor-wait disabled:opacity-70"
            >
              {deleting ? 'Deleting…' : 'Delete showroom'}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 cursor-pointer px-3 text-sm text-ash hover:text-porcelain">
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 cursor-pointer text-sm text-ash hover:text-danger">
          Delete this showroom…
        </button>
      )}
    </div>
  )
}
