import { Box, Eye, EyeOff, Trash2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AiGenerator } from '@/ai/AiGenerator'
import { aiAvailable, deleteModel, formatSize, listGenerations, listLibrary, renameModel, type Generation, type LibraryModel } from '@/ai/client'
import { AddToShowroom } from '@/ai/useInShowroom'
import { useAuth } from '@/auth/AuthProvider'
import { assetUrl } from '@/studio/assets'
import { StudioShell } from './StudioShell'

const ModelViewer = lazy(() => import('@/ai/ModelViewer'))

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS: Record<Generation['status'], { label: string; tone: string }> = {
  reserved: { label: 'Starting', tone: 'text-silver' },
  running: { label: 'In progress', tone: 'text-lime' },
  succeeded: { label: 'Ready', tone: 'text-porcelain' },
  failed: { label: 'Refused · counted', tone: 'text-danger-soft' },
  released: { label: 'Failed · not counted', tone: 'text-ash' },
}

function Thumb({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let alive = true
    assetUrl(path).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [path])
  return url ? (
    <img src={url} alt={`Photo ${name} was generated from`} className="size-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center text-ash">
      <Box aria-hidden className="size-6" />
    </span>
  )
}

function ModelCard({ m, onChanged }: { m: LibraryModel; onChanged: () => void }) {
  const [preview, setPreview] = useState(false)
  const [name, setName] = useState(m.name)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="grid content-start gap-4 rounded-xl bg-graphite/40 p-4 ring-1 ring-inset ring-hairline">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-obsidian">
        {preview ? (
          <Suspense fallback={<div className="grid size-full place-items-center text-sm text-ash">Loading 3D preview…</div>}>
            <ModelViewer storagePath={m.storagePath} name={m.name} />
          </Suspense>
        ) : (
          <Thumb path={m.previewPath} name={m.name} />
        )}
        <span className="meta absolute left-3 top-3 rounded-full bg-obsidian/80 px-2.5 py-1 text-[11px] text-silver">AI · Tripo</span>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`name-${m.id}`} className="sr-only">
          Model name
        </label>
        <input
          id={`name-${m.id}`}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== m.name) renameModel(m.id, name).then(onChanged, (e: Error) => setError(e.message))
          }}
          className="-mx-1 rounded px-1 text-[15px] font-semibold tracking-tight text-porcelain hover:ring-1 hover:ring-hairline focus:outline-none focus:ring-2 focus:ring-lime"
        />
        <p className="text-xs text-ash">
          {dateFmt.format(new Date(m.createdAt))} · {formatSize(m.fileSize)} GLB
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain">
          {preview ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          {preview ? 'Hide 3D' : 'View in 3D'}
        </button>
        {confirm ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => deleteModel(m).then(onChanged, (e: Error) => setError(e.message))}
              className="min-h-11 cursor-pointer rounded-full bg-danger/15 px-4 text-sm text-danger-soft ring-1 ring-inset ring-danger/40"
            >
              Delete for good
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 cursor-pointer px-3 text-sm text-silver">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} aria-label={`Delete ${m.name}`} className="grid size-11 cursor-pointer place-items-center rounded-full text-silver ring-1 ring-inset ring-hairline hover:text-danger">
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <AddToShowroom model={m} />
      {confirm && <p className="text-xs text-ash">Showrooms already using this model keep their copy.</p>}
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </li>
  )
}

export default function Library() {
  const { mode } = useAuth()
  const [models, setModels] = useState<LibraryModel[] | null>(null)
  const [history, setHistory] = useState<Generation[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!aiAvailable) return
    listLibrary().then((m) => (setModels(m), setError(null)), (e: Error) => setError(e.message))
    listGenerations().then(setHistory, () => undefined)
  }, [])

  useEffect(() => {
    document.title = 'Model library · OBJECT.'
    reload()
  }, [reload])

  return (
    <StudioShell>
      <main className="gutter grid gap-12 py-10 md:py-14">
        <div className="grid gap-3">
          <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">Model library</h1>
          <p className="max-w-[62ch] text-silver">3D models of your products, ready to use in any of your showrooms. You can still upload your own .glb in each showroom’s editor.</p>
        </div>

        {mode === 'local' || !aiAvailable ? (
          <p className="max-w-[62ch] rounded-xl p-6 text-silver ring-1 ring-inset ring-hairline">AI generation and the model library need an OBJECT. account. They aren’t connected on this site yet.</p>
        ) : (
          <>
            <AiGenerator models={models ?? []} onModelReady={reload} renderUse={(m) => <AddToShowroom model={m} />} />

            <section aria-labelledby="lib-h" className="grid gap-5">
              <h2 id="lib-h" className="text-xl font-semibold tracking-tight">
                Your models{models ? ` · ${models.length}` : ''}
              </h2>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              {models === null ? (
                <div className="h-48 animate-pulse rounded-xl bg-graphite/50" aria-busy="true" aria-label="Loading your models" />
              ) : models.length === 0 ? (
                <p className="text-sm text-ash">No models yet. Models generated from your photos with AI appear here.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {models.map((m) => (
                    <ModelCard key={m.id} m={m} onChanged={reload} />
                  ))}
                </ul>
              )}
            </section>

            {history.length > 0 && (
              <section aria-labelledby="hist-h" className="grid gap-4">
                <h2 id="hist-h" className="text-xl font-semibold tracking-tight">
                  Generation history
                </h2>
                <ul className="divide-y divide-hairline rounded-xl ring-1 ring-inset ring-hairline">
                  {history.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm">
                      <span className="min-w-0 truncate text-porcelain">{g.name}</span>
                      <span className="flex items-center gap-4 text-xs">
                        <span className="text-ash">
                          {g.mode === 'multiview' ? `${g.inputPaths.length} photos` : '1 photo'} · {dateFmt.format(new Date(g.createdAt))}
                        </span>
                        <span className={STATUS[g.status].tone}>{STATUS[g.status].label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </StudioShell>
  )
}
