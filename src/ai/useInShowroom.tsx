import { Check } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { backend } from '@/studio/backend'
import { useShowrooms } from '@/studio/store'
import type { StudioShowroom } from '@/studio/types'
import { copyModelToShowroom, type LibraryModel } from './client'

/** Puts a library model in a showroom draft as its True 3D model (published at the next Publish). */
export async function putModelInShowroom(m: LibraryModel, showroom: StudioShowroom) {
  const key = await copyModelToShowroom(m, showroom.id)
  const previous = showroom.draft.model
  await backend.saveDraft(showroom.id, { ...showroom.draft, mode: 'true3d', model: { kind: 'upload', assetId: key, name: `${m.name}.glb` } })
  const live = showroom.published?.model
  if (previous?.kind === 'upload' && !(live?.kind === 'upload' && live.assetId === previous.assetId)) backend.deleteAsset(previous.assetId).catch(() => undefined)
}

export function AddToShowroom({ model }: { model: LibraryModel }) {
  const showrooms = useShowrooms()
  const id = useId()
  const [target, setTarget] = useState('')
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; showroomId: string } | { kind: 'error'; message: string }>({ kind: 'idle' })

  if (showrooms.length === 0) {
    return (
      <Link to="/studio/new" className="inline-flex min-h-11 items-center rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain">
        Create a showroom first
      </Link>
    )
  }
  const chosen = target || showrooms[0]!.id

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Showroom for {model.name}
        </label>
        <select id={id} value={chosen} onChange={(e) => (setTarget(e.target.value), setState({ kind: 'idle' }))} className="min-h-11 max-w-56 cursor-pointer truncate rounded-full bg-graphite-2 px-4 text-sm text-porcelain ring-1 ring-inset ring-hairline focus:outline-none focus:ring-2 focus:ring-lime">
          {showrooms.map((s) => (
            <option key={s.id} value={s.id}>
              {s.draft.productName || 'Untitled'}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={state.kind === 'busy'}
          onClick={async () => {
            const s = showrooms.find((x) => x.id === chosen)
            if (!s) return
            setState({ kind: 'busy' })
            try {
              await putModelInShowroom(model, s)
              setState({ kind: 'done', showroomId: s.id })
            } catch (e) {
              setState({ kind: 'error', message: e instanceof Error ? e.message : 'The model could not be added.' })
            }
          }}
          className="min-h-11 cursor-pointer rounded-full bg-porcelain px-5 text-sm font-semibold text-obsidian disabled:opacity-50"
        >
          {state.kind === 'busy' ? 'Adding…' : 'Add to showroom'}
        </button>
      </div>
      <p role="status" className="text-[13px]">
        {state.kind === 'done' && (
          <span className="inline-flex items-center gap-1.5 text-porcelain">
            <Check aria-hidden className="size-4 text-lime" /> Added as the True 3D model.{' '}
            <Link to={`/studio/${state.showroomId}`} className="underline underline-offset-4">
              Open the editor
            </Link>
          </span>
        )}
        {state.kind === 'error' && <span className="text-danger">{state.message}</span>}
      </p>
    </div>
  )
}
