import { newId } from './ids'
import type { AssetKind, AssetMeta } from './types'

/**
 * Local asset store (IndexedDB). Uploaded images and models live here as
 * Blobs and are referenced from a showroom config as `asset:<id>`.
 * Phase C swaps this for Supabase Storage behind the same functions.
 */

const DB_NAME = 'object-studio'
const STORE = 'assets'
export const ASSET_PREFIX = 'asset:'

interface AssetRow extends AssetMeta {
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot store files (IndexedDB unavailable).'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('showroomId', 'showroomId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open file storage.'))
  })
  dbPromise.catch(() => (dbPromise = null))
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(req ? req.result : (undefined as T))
        t.onerror = () => reject(t.error ?? new Error('File storage error.'))
        t.onabort = () => reject(t.error ?? new Error('File storage is full.'))
      }),
  )
}

export async function putAsset(showroomId: string, kind: AssetKind, file: Blob, name: string, mime: string): Promise<AssetMeta> {
  const meta: AssetMeta = { id: newId(), showroomId, kind, name, mime, size: file.size, createdAt: new Date().toISOString() }
  await tx('readwrite', (s) => s.put({ ...meta, blob: file } satisfies AssetRow))
  return meta
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  const row = await tx<AssetRow | undefined>('readonly', (s) => s.get(id))
  return row?.blob ?? null
}

export async function listAssets(showroomId: string): Promise<AssetMeta[]> {
  const rows = await tx<AssetRow[]>('readonly', (s) => s.index('showroomId').getAll(showroomId))
  return rows.map((row) => {
    const meta: AssetMeta & { blob?: Blob } = { ...row }
    delete meta.blob
    return meta
  })
}

export async function deleteAsset(id: string): Promise<void> {
  revoke(id)
  await tx('readwrite', (s) => s.delete(id))
}

export async function deleteShowroomAssets(showroomId: string): Promise<void> {
  const assets = await listAssets(showroomId)
  await Promise.all(assets.map((a) => deleteAsset(a.id)))
}

/** Copies every asset of one showroom to another; returns old id → new id. */
export async function copyAssets(fromShowroom: string, toShowroom: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const meta of await listAssets(fromShowroom)) {
    const blob = await getAssetBlob(meta.id)
    if (!blob) continue
    const copy = await putAsset(toShowroom, meta.kind, blob, meta.name, meta.mime)
    map.set(meta.id, copy.id)
  }
  return map
}

// ── Object URLs ────────────────────────────────────────────────────────────

const urls = new Map<string, Promise<string | null>>()

export function isAssetRef(src: string) {
  return src.startsWith(ASSET_PREFIX)
}

export function assetRef(id: string) {
  return ASSET_PREFIX + id
}

export function assetIdOf(src: string) {
  return src.slice(ASSET_PREFIX.length)
}

/** Resolves an asset to a blob: URL, cached for the session. */
export function assetUrl(id: string): Promise<string | null> {
  let p = urls.get(id)
  if (!p) {
    p = getAssetBlob(id)
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null)
    urls.set(id, p)
  }
  return p
}

function revoke(id: string) {
  const p = urls.get(id)
  urls.delete(id)
  p?.then((u) => u && URL.revokeObjectURL(u))
}
