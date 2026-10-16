import { safeExternalUrl } from '@/lib/url'
import type { ShowroomConfig } from '@/showroom/types'
import type { AssetKind } from './types'

export const LIMITS = {
  imageBytes: 15 * 1024 * 1024,
  modelBytes: 50 * 1024 * 1024,
  maxImages: 8,
} as const

export type UploadCheck =
  | { ok: true; kind: AssetKind; mime: string }
  | { ok: false; error: string }

const MB = (n: number) => `${Math.round(n / 1024 / 1024)} MB`

function startsWith(bytes: Uint8Array, sig: number[], offset = 0) {
  return sig.every((b, i) => bytes[offset + i] === b)
}

/**
 * Checks a file by its actual bytes, not its name or claimed type: JPEG, PNG
 * and WebP for images; binary glTF (GLB) or a self-contained .gltf for models.
 * A .gltf that points at external files or URLs is refused, so a model can
 * never make the browser fetch something on its own.
 */
export async function checkUpload(file: File, expected: AssetKind): Promise<UploadCheck> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const name = file.name.toLowerCase()

  if (expected === 'image') {
    if (file.size > LIMITS.imageBytes) return { ok: false, error: `“${file.name}” is ${MB(file.size)}. Images can be up to ${MB(LIMITS.imageBytes)}.` }
    if (startsWith(head, [0xff, 0xd8, 0xff])) return { ok: true, kind: 'image', mime: 'image/jpeg' }
    if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, kind: 'image', mime: 'image/png' }
    if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8))
      return { ok: true, kind: 'image', mime: 'image/webp' }
    return { ok: false, error: `“${file.name}” isn’t a JPG, PNG or WebP image.` }
  }

  if (file.size > LIMITS.modelBytes) return { ok: false, error: `“${file.name}” is ${MB(file.size)}. Models can be up to ${MB(LIMITS.modelBytes)}.` }
  if (startsWith(head, [0x67, 0x6c, 0x54, 0x46])) return { ok: true, kind: 'model', mime: 'model/gltf-binary' }
  if (name.endsWith('.gltf')) {
    let json: { buffers?: { uri?: string }[]; images?: { uri?: string }[] }
    try {
      json = JSON.parse(await file.text())
    } catch {
      return { ok: false, error: `“${file.name}” isn’t valid glTF.` }
    }
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((x) => x.uri).filter((u): u is string => !!u)
    if (uris.some((u) => !u.startsWith('data:')))
      return { ok: false, error: `“${file.name}” refers to separate files. Export it as a single .glb (binary glTF) instead.` }
    return { ok: true, kind: 'model', mime: 'model/gltf+json' }
  }
  return { ok: false, error: `“${file.name}” isn’t a GLB or glTF model.` }
}

export interface PublishIssue {
  field: string
  message: string
}

/** What must be true before a showroom can go live. */
export function publishIssues(config: ShowroomConfig): PublishIssue[] {
  const issues: PublishIssue[] = []
  if (!config.productName.trim()) issues.push({ field: 'productName', message: 'Add a product name.' })
  if (config.mode === 'photo' && config.images.length === 0)
    issues.push({ field: 'images', message: 'Photo Motion needs at least one image.' })
  if (config.mode === 'true3d' && !config.model)
    issues.push({ field: 'model', message: 'True 3D needs a GLB or glTF model. Switch to Photo Motion to use images only.' })
  if (config.purchaseUrl && !safeExternalUrl(config.purchaseUrl))
    issues.push({ field: 'purchaseUrl', message: 'The purchase link must be a full web address starting with https://' })
  for (const img of config.images) if (!img.alt.trim()) {
    issues.push({ field: 'images', message: 'Describe every image (alt text) so it works for screen readers.' })
    break
  }
  return issues
}
