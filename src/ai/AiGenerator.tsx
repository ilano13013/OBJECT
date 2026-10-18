import { Camera, ChevronDown, ImagePlus, Lock, RotateCcw, Sparkles, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { assetBlob } from '@/studio/assets'
import { checkUpload, LIMITS } from '@/studio/validation'
import { inputClass } from '@/studio/ui'
import { AiError, generationStatus, getQuota, startGeneration, uploadPhoto, type AiQuota, type Generation, type LibraryModel } from './client'

const ModelViewer = lazy(() => import('./ModelViewer'))

const VIEWS = [
  { label: 'Front', hint: 'Required' },
  { label: 'Left side', hint: 'Optional' },
  { label: 'Back', hint: 'Optional' },
  { label: 'Right side', hint: 'Optional' },
] as const

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const POLL_MS = 3000

export const LOCKED_MESSAGE = 'AI 3D generation is reserved for OBJECT subscribers. Subscribe to generate up to 5 3D models per month.'
export const EXHAUSTED_MESSAGE = 'You have used your 5 AI 3D generations for this period. Your quota renews on your next subscription billing date.'

interface Photo {
  file: File
  mime: string
  url: string
}

type Phase = { kind: 'compose' } | { kind: 'sending'; step: string } | { kind: 'tracking'; generation: Generation }

function progressMessage(g: Generation) {
  if (g.status === 'reserved') return 'Sending your photos to the AI…'
  if (g.progress >= 99) return 'Saving the model to your library…'
  if (g.progress === 0) return 'Waiting for the AI to start…'
  return 'Building geometry, textures and materials…'
}

/**
 * Photo → AI generation → 3D preview → library → showroom.
 * Every rule (subscription, quota, duplicates) is enforced by the server;
 * this component only mirrors it so the merchant knows where they stand.
 */
export function AiGenerator({ onModelReady, models, renderUse }: { onModelReady: () => void; models: LibraryModel[]; renderUse: (m: LibraryModel) => React.ReactNode }) {
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null, null, null])
  const [name, setName] = useState('')
  const [photoErrors, setPhotoErrors] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'compose' })
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [reviewing, setReviewing] = useState<Generation | null>(null)
  /** The request being sent: reused on a retry so one click never reserves twice. */
  const pending = useRef<{ requestId: string; inputs: string[] } | null>(null)

  const loadQuota = useCallback(async () => {
    try {
      const q = await getQuota()
      setQuota(q)
      setQuotaError(null)
      return q
    } catch (e) {
      setQuotaError(e instanceof Error ? e.message : 'Your AI generation balance could not be loaded.')
      return null
    }
  }, [])

  // Resume a generation started earlier (other tab, device, or before leaving the page).
  useEffect(() => {
    void loadQuota().then((q) => {
      if (q?.inProgress) {
        setPhase({ kind: 'tracking', generation: { id: q.inProgress, status: 'running', mode: 'single', name: 'Your model', progress: 0, error: null, libraryModelId: null, inputPaths: [], createdAt: '' } })
      }
    })
  }, [loadQuota])

  const trackingId = phase.kind === 'tracking' ? phase.generation.id : null
  useEffect(() => {
    if (!trackingId) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const g = await generationStatus(trackingId)
        if (!alive) return
        if (g.status === 'running' || g.status === 'reserved') {
          setPhase({ kind: 'tracking', generation: g })
          timer = setTimeout(tick, POLL_MS)
          return
        }
        setPhase({ kind: 'compose' })
        void loadQuota()
        if (g.status === 'succeeded') {
          setNotice({ tone: 'success', text: `“${g.name}” is ready and saved in your library. Check it from every angle before publishing.` })
          setReviewing(g)
          onModelReady()
        } else if (g.status === 'released') {
          setNotice({ tone: 'error', text: g.error ?? 'The generation failed. Your generation was not used.' })
        } else {
          setNotice({ tone: 'error', text: g.error ?? 'The generation was refused. It counts towards this period.' })
        }
      } catch {
        if (alive) timer = setTimeout(tick, POLL_MS * 2) // offline or server busy: keep trying
      }
    }
    timer = setTimeout(tick, 600)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [trackingId, loadQuota, onModelReady])

  // Revoke preview URLs when replaced or on unmount.
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(() => () => photosRef.current.forEach((p) => p && URL.revokeObjectURL(p.url)), [])

  async function pick(view: number, file: File | undefined) {
    if (!file) return
    const check = await checkUpload(file, 'image')
    if (!check.ok) {
      setPhotoErrors(check.error)
      return
    }
    setPhotoErrors(null)
    pending.current = null
    setPhotos((ps) => ps.map((p, i) => (i === view ? (p && URL.revokeObjectURL(p.url), { file, mime: check.mime, url: URL.createObjectURL(file) }) : p)))
  }

  function clear(view: number) {
    pending.current = null
    setPhotos((ps) => ps.map((p, i) => (i === view ? (p && URL.revokeObjectURL(p.url), null) : p)))
  }

  async function generate(fromPhotos: (Photo | null)[] | null, regenerate?: Generation) {
    setNotice(null)
    try {
      let req = pending.current
      if (!req) {
        const requestId = crypto.randomUUID()
        const inputs: string[] = []
        if (regenerate) {
          // Same photos, new request: a regeneration is a new generation.
          setPhase({ kind: 'sending', step: 'Preparing your photos…' })
          for (const path of regenerate.inputPaths) {
            const view = Number(/\/([0-3])\.\w+$/.exec(path)?.[1] ?? 0)
            const blob = await assetBlob(path)
            if (!blob) throw new AiError('The original photos are no longer available. Add them again.')
            inputs.push(await uploadPhoto(requestId, view, blob, blob.type || 'image/jpeg'))
          }
        } else {
          const list = (fromPhotos ?? []).map((p, i) => [p, i] as const).filter((x): x is readonly [Photo, number] => !!x[0])
          for (const [n, [p, view]] of list.entries()) {
            setPhase({ kind: 'sending', step: `Uploading photo ${n + 1} of ${list.length}…` })
            inputs.push(await uploadPhoto(requestId, view, p.file, p.mime))
          }
        }
        req = { requestId, inputs }
        pending.current = req
      }
      setPhase({ kind: 'sending', step: 'Checking your balance and starting the AI…' })
      const g = await startGeneration({ ...req, name: (regenerate?.name ?? name).trim() || 'Untitled model' })
      pending.current = null
      setReviewing(null)
      setPhase({ kind: 'tracking', generation: g })
      void loadQuota()
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('Something went wrong. Try again.')
      // A definitive answer (refusal, Tripo failure already released) needs a fresh request next time.
      if (err.code && err.code !== 'network') pending.current = null
      setPhase({ kind: 'compose' })
      setNotice({ tone: 'error', text: err.message })
      void loadQuota()
    }
  }

  const remaining = quota ? Math.max(0, quota.quota - quota.used) : 0
  const locked = quota && (quota.reason === 'not_subscribed' || quota.reason === 'period_ended' || quota.reason === 'no_workspace')
  const exhausted = quota?.reason === 'quota_exhausted'
  const busy = phase.kind !== 'compose'
  const hasFront = !!photos[0]
  const count = photos.filter(Boolean).length
  const reviewModel = reviewing ? models.find((m) => m.id === reviewing.libraryModelId) : undefined

  if (!quota && !quotaError) return <div className="h-40 animate-pulse rounded-xl bg-graphite/60" aria-busy="true" aria-label="Loading AI generation" />

  if (quotaError && !quota) {
    return (
      <div className="rounded-xl p-6 ring-1 ring-inset ring-hairline">
        <p role="alert" className="text-sm text-danger">{quotaError}</p>
        <button type="button" onClick={() => void loadQuota()} className="mt-3 min-h-11 cursor-pointer rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain">
          Try again
        </button>
      </div>
    )
  }

  if (locked) {
    return (
      <section aria-labelledby="ai-h" className="grid gap-5 rounded-xl bg-graphite/50 p-6 ring-1 ring-inset ring-hairline md:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-graphite-2 ring-1 ring-inset ring-hairline">
            <Lock aria-hidden className="size-4 text-silver" />
          </span>
          <h2 id="ai-h" className="text-xl font-semibold tracking-tight">
            Generate a 3D model with AI
          </h2>
        </div>
        <p className="max-w-[60ch] text-silver">
          {quota.reason === 'period_ended' ? 'Your subscription period has ended. AI generation resumes once your renewal is paid.' : LOCKED_MESSAGE}
        </p>
        <p className="max-w-[60ch] text-[13px] text-ash">A One Showroom purchase does not include AI generation. Models you already generated stay in your library.</p>
        <Link to="/account?plan=studio" className="inline-flex min-h-11 w-fit items-center rounded-full bg-lime px-5 text-sm font-semibold text-obsidian">
          Discover the subscription
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby="ai-h" className="grid gap-6 rounded-xl bg-graphite/50 p-5 ring-1 ring-inset ring-hairline md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 id="ai-h" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Sparkles aria-hidden className="size-5 text-lime" /> Generate a 3D model with AI
          </h2>
          <p className="max-w-[60ch] text-[13px] text-ash">Photograph your product, and the AI (Tripo) builds a textured 3D model you can put in any of your showrooms.</p>
        </div>
        <div className="grid gap-0.5 sm:justify-items-end sm:text-right" aria-live="polite">
          <p className="text-sm font-medium tabular-nums text-porcelain" data-testid="ai-remaining">
            Generations remaining: {remaining} / {quota!.quota}
          </p>
          {quota!.periodEnd && <p className="text-xs text-ash">Renews on {dateFmt.format(new Date(quota!.periodEnd))}</p>}
        </div>
      </div>

      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-md px-4 py-3 text-sm ring-1 ring-inset ${notice.tone === 'error' ? 'text-danger-soft ring-danger/40' : 'text-porcelain ring-lime/40'}`}>
          {notice.text}
        </p>
      )}

      {phase.kind === 'tracking' || phase.kind === 'sending' ? (
        <div className="grid gap-3" role="status" aria-live="polite">
          <p className="text-sm text-porcelain">{phase.kind === 'sending' ? phase.step : progressMessage(phase.generation)}</p>
          <div
            role="progressbar"
            aria-label="Generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase.kind === 'tracking' ? phase.generation.progress : 0}
            className="h-1.5 overflow-hidden rounded-full bg-graphite-2"
          >
            <div className="h-full rounded-full bg-lime transition-[width] duration-700" style={{ width: `${phase.kind === 'tracking' ? Math.max(4, phase.generation.progress) : 2}%` }} />
          </div>
          <p className="text-xs text-ash">
            Usually 1 to 3 minutes. You can leave this page: the generation continues and appears here and in your library when you come back.
          </p>
        </div>
      ) : reviewing && reviewModel ? (
        <div className="grid gap-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-obsidian ring-1 ring-inset ring-hairline md:aspect-[16/9]">
            <Suspense fallback={<div className="grid size-full place-items-center text-sm text-ash">Loading 3D preview…</div>}>
              <ModelViewer storagePath={reviewModel.storagePath} name={reviewModel.name} />
            </Suspense>
          </div>
          <p className="text-[13px] text-ash">Drag to turn, scroll or pinch to zoom. The AI estimated the parts it could not see: check every side before publishing.</p>
          <div className="flex flex-wrap items-center gap-3">
            {renderUse(reviewModel)}
            <button type="button" onClick={() => setReviewing(null)} className="min-h-11 cursor-pointer rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain">
              Keep in library
            </button>
            <button
              type="button"
              disabled={remaining === 0}
              onClick={() => void generate(null, reviewing)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-sm text-silver ring-1 ring-inset ring-hairline hover:text-porcelain disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw aria-hidden className="size-4" /> Regenerate · uses 1 generation
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <fieldset className="grid gap-3" disabled={exhausted || busy}>
            <legend className="mb-2 text-[13px] font-medium text-silver">Photos of your product</legend>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {VIEWS.map((v, i) => {
                const p = photos[i]
                return (
                  <li key={v.label} className="grid gap-1.5">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-graphite-2 ring-1 ring-inset ring-hairline focus-within:ring-2 focus-within:ring-lime">
                      {p ? (
                        <>
                          <img src={p.url} alt={`${v.label} photo`} className="size-full object-cover" />
                          <button type="button" onClick={() => clear(i)} aria-label={`Remove ${v.label.toLowerCase()} photo`} className="absolute right-1.5 top-1.5 grid size-9 cursor-pointer place-items-center rounded-full bg-obsidian/80 text-porcelain">
                            <X aria-hidden className="size-4" />
                          </button>
                        </>
                      ) : (
                        <label className="grid size-full cursor-pointer place-items-center text-ash hover:text-porcelain">
                          <span className="grid justify-items-center gap-1.5 text-xs">
                            {i === 0 ? <Camera aria-hidden className="size-5" /> : <ImagePlus aria-hidden className="size-5" />}
                            Add photo
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            aria-label={`${v.label} photo (${v.hint.toLowerCase()})`}
                            onChange={(e) => {
                              void pick(i, e.target.files?.[0])
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs">
                      <span className="text-silver">{v.label}</span> <span className="text-ash">· {v.hint}</span>
                    </p>
                  </li>
                )
              })}
            </ul>
            {photoErrors && (
              <p role="alert" className="text-[13px] text-danger">
                {photoErrors}
              </p>
            )}
            <p className="text-[13px] text-ash">JPG, PNG or WebP, up to {LIMITS.imageBytes / 1024 / 1024} MB. One photo works; adding the other sides gives the AI less to guess.</p>
          </fieldset>

          <details className="group rounded-lg ring-1 ring-inset ring-hairline">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm text-silver hover:text-porcelain">
              Tips for good photos
              <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid list-disc gap-1.5 px-4 pb-4 pl-8 text-[13px] text-ash">
              <li>The product alone, whole and in focus, on a plain background that contrasts with it.</li>
              <li>Soft, even light. Avoid hard shadows, reflections and flash glare.</li>
              <li>Fill most of the frame. Shoot the other sides from the same height and distance.</li>
              <li>Transparent, mirror-like or very thin parts are the hardest to reproduce.</li>
            </ul>
          </details>

          <div className="grid gap-1.5 md:max-w-sm">
            <label htmlFor="ai-name" className="text-[13px] font-medium text-silver">
              Model name
            </label>
            <input id="ai-name" className={inputClass} value={name} maxLength={120} placeholder="e.g. Aura bottle, amber" onChange={(e) => setName(e.target.value)} disabled={exhausted} />
          </div>

          <p className="max-w-[70ch] text-[13px] leading-relaxed text-ash">
            The AI estimates the parts of your product it cannot see in the photos. The result can differ from the real product: check it from every angle before publishing.
          </p>

          {exhausted ? (
            <p role="status" className="rounded-md px-4 py-3 text-sm text-silver ring-1 ring-inset ring-hairline">
              {EXHAUSTED_MESSAGE}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!hasFront || exhausted || busy || remaining === 0}
              onClick={() => void generate(photos)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles aria-hidden className="size-4" /> Generate a 3D model with AI
            </button>
            <p className="text-[13px] text-ash">
              {exhausted
                ? 'No generations left this period.'
                : !hasFront
                  ? 'Add at least a front photo.'
                  : `Uses 1 of your ${remaining} remaining generation${remaining === 1 ? '' : 's'} (${count} photo${count === 1 ? '' : 's'}).`}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
