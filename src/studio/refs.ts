/**
 * Asset references inside a ShowroomConfig: `asset:<key>`.
 * Local mode: key = IndexedDB id. Cloud mode: key = storage path
 * (`<workspace>/<showroom>/<file>`), so visitors can fetch published files
 * without reading the private assets table.
 */
export const ASSET_PREFIX = 'asset:'

export function isAssetRef(src: string) {
  return src.startsWith(ASSET_PREFIX)
}

export function assetRef(key: string) {
  return ASSET_PREFIX + key
}

export function assetIdOf(src: string) {
  return src.slice(ASSET_PREFIX.length)
}
