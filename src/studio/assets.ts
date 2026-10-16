import { backend } from './backend'

export { ASSET_PREFIX, assetIdOf, assetRef, isAssetRef } from './refs'

const urls = new Map<string, Promise<string | null>>()
const blobs = new Map<string, Promise<Blob | null>>()

/** The file behind an asset key, cached for the session. */
export function assetBlob(key: string): Promise<Blob | null> {
  let p = blobs.get(key)
  if (!p) {
    p = backend.getAssetBlob(key).catch(() => null)
    p.then((b) => b ?? blobs.delete(key))
    blobs.set(key, p)
  }
  return p
}

/** A blob: URL for an asset, cached for the session. */
export function assetUrl(key: string): Promise<string | null> {
  let p = urls.get(key)
  if (!p) {
    p = assetBlob(key).then((b) => (b ? URL.createObjectURL(b) : null))
    urls.set(key, p)
  }
  return p
}

export function forgetAsset(key: string) {
  blobs.delete(key)
  const p = urls.get(key)
  urls.delete(key)
  p?.then((u) => u && URL.revokeObjectURL(u))
}
