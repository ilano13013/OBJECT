import { useEffect, useSyncExternalStore } from 'react'
import { backend } from './backend'
import type { StudioShowroom } from './types'

interface State {
  showrooms: StudioShowroom[]
  loaded: boolean
  loading: boolean
  error: string | null
}

let state: State = { showrooms: [], loaded: false, loading: false, error: null }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null
let again = false

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/** Reloads the showroom list; concurrent calls coalesce into one extra reload. */
export function refreshShowrooms(): Promise<void> {
  if (inflight) {
    again = true
    return inflight
  }
  set({ loading: true })
  inflight = backend
    .list()
    .then((showrooms) => set({ showrooms, loaded: true, error: null }))
    .catch((e: unknown) => set({ error: e instanceof Error ? e.message : 'Couldn’t load your showrooms.', loaded: true }))
    .finally(() => {
      inflight = null
      set({ loading: false })
      if (again) {
        again = false
        void refreshShowrooms()
      }
    })
  return inflight
}

backend.onChange(() => void refreshShowrooms())

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useShowroomsState(): State {
  const snap = useSyncExternalStore(subscribe, () => state, () => state)
  useEffect(() => {
    if (!state.loaded && !state.loading) void refreshShowrooms()
  }, [])
  return snap
}

export function useShowrooms(): StudioShowroom[] {
  return useShowroomsState().showrooms
}

export function useShowroom(id: string | undefined) {
  const s = useShowroomsState()
  return { showroom: id ? s.showrooms.find((x) => x.id === id) : undefined, loaded: s.loaded, error: s.error }
}
