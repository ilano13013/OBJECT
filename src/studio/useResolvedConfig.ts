import { useEffect, useMemo, useState } from 'react'
import type { ShowroomConfig } from '@/showroom/types'
import { assetIdOf, assetUrl, isAssetRef } from './assets'

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

/** Swaps `asset:<id>` image references for blob: URLs the browser can show. */
export function useResolvedConfig(config: ShowroomConfig): ShowroomConfig {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const ids = useMemo(() => config.images.map((i) => i.src).filter(isAssetRef).map(assetIdOf), [config.images])
  const key = ids.join('|')

  useEffect(() => {
    let alive = true
    const missing = ids.filter((id) => !(id in urls))
    if (missing.length === 0) return
    Promise.all(missing.map(async (id) => [id, await assetUrl(id)] as const)).then((pairs) => {
      if (alive) setUrls((u) => ({ ...u, ...Object.fromEntries(pairs) }))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(
    () => ({
      ...config,
      images: config.images.map((img) => (isAssetRef(img.src) ? { ...img, src: urls[assetIdOf(img.src)] ?? BLANK } : img)),
    }),
    [config, urls],
  )
}
