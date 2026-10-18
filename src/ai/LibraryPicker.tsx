import { Library, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { aiAvailable, copyModelToShowroom, formatSize, listLibrary, type LibraryModel } from './client'

/**
 * Editor control: use a model from the workspace library in this showroom.
 * The file is copied into the showroom, so it then behaves exactly like a
 * model uploaded by hand.
 */
export function LibraryPicker({ showroomId, onPicked, disabled }: { showroomId: string; onPicked: (key: string, name: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<LibraryModel[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !models) listLibrary().then(setModels, (e: Error) => setError(e.message))
  }, [open, models])

  if (!aiAvailable) return null

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-silver ring-1 ring-inset ring-hairline hover:text-porcelain disabled:opacity-40"
        >
          <Library aria-hidden className="size-4" /> Choose from your library
        </button>
        <Link to="/studio/library" className="inline-flex items-center gap-1.5 text-[13px] text-ash underline-offset-4 hover:text-porcelain hover:underline">
          <Sparkles aria-hidden className="size-3.5" /> Generate one from photos with AI
        </Link>
      </div>
      {open && (
        <div className="rounded-md bg-graphite-2 p-2 ring-1 ring-inset ring-hairline">
          {error ? (
            <p role="alert" className="p-2 text-[13px] text-danger">
              {error}
            </p>
          ) : models === null ? (
            <p className="p-2 text-[13px] text-ash">Loading your models…</p>
          ) : models.length === 0 ? (
            <p className="p-2 text-[13px] text-ash">Your library is empty.</p>
          ) : (
            <ul className="grid max-h-56 gap-1 overflow-y-auto">
              {models.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(m.id)
                      setError(null)
                      try {
                        onPicked(await copyModelToShowroom(m, showroomId), `${m.name}.glb`)
                        setOpen(false)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'The model could not be added.')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded px-2 text-left text-sm hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="shrink-0 text-xs text-ash">{busy === m.id ? 'Adding…' : formatSize(m.fileSize)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
