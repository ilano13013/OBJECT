import type { ShowroomConfig } from '@/showroom/types'

/**
 * A per-showroom copy of the last unsaved draft, written synchronously on
 * every change. If the network save never lands (closed tab, lost
 * connection), the editor offers to restore it next time.
 */
const key = (id: string) => `object.draft-backup.${id}`

export function writeBackup(id: string, draft: ShowroomConfig) {
  try {
    localStorage.setItem(key(id), JSON.stringify({ savedAt: new Date().toISOString(), draft }))
  } catch {
    /* storage full or blocked: the network save still runs */
  }
}

export function clearBackup(id: string) {
  try {
    localStorage.removeItem(key(id))
  } catch {
    /* ignore */
  }
}

/** Returns the backup only if it is newer than what the server has. */
export function readBackup(id: string, serverUpdatedAt: string): { savedAt: string; draft: ShowroomConfig } | null {
  try {
    const raw = localStorage.getItem(key(id))
    if (!raw) return null
    const b = JSON.parse(raw) as { savedAt: string; draft: ShowroomConfig }
    if (!b?.draft || !b.savedAt || b.savedAt <= serverUpdatedAt) {
      localStorage.removeItem(key(id))
      return null
    }
    return b
  } catch {
    return null
  }
}
