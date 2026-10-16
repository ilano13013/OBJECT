import type { ShowroomConfig, TemplateId, MediaMode } from '@/showroom/types'
import type { AssetKind, StudioShowroom } from '../types'
import type { PublishIssue } from '../validation'

export interface StatsDay {
  day: string
  views: number
  visitors: number
  clicks: number
}

export interface Entitlement {
  plan: 'none' | 'one' | 'studio'
  allowance: number
  used: number
}

export type SlugResult = { ok: true; slug: string } | { ok: false; error: string }
export type PublishResult = { ok: true } | { ok: false; issues: PublishIssue[] }

/**
 * Everything the studio and public pages need from storage. Two
 * implementations: `local` (this browser) and `cloud` (Supabase).
 */
export interface StudioBackend {
  mode: 'local' | 'cloud'
  list(): Promise<StudioShowroom[]>
  create(input: { template: TemplateId; mode: MediaMode; productName: string }): Promise<StudioShowroom>
  saveDraft(id: string, draft: ShowroomConfig): Promise<void>
  setSlug(id: string, slug: string): Promise<SlugResult>
  publish(id: string): Promise<PublishResult>
  unpublish(id: string): Promise<void>
  duplicate(id: string): Promise<StudioShowroom>
  remove(id: string): Promise<void>
  getPublished(slug: string): Promise<ShowroomConfig | null>
  /** Stores a file for a showroom and returns its asset key. */
  putAsset(showroomId: string, kind: AssetKind, file: Blob, name: string, mime: string): Promise<string>
  getAssetBlob(key: string): Promise<Blob | null>
  deleteAsset(key: string): Promise<void>
  /** Recorded statistics, or null when this backend does not record any. */
  stats(id: string, days: number): Promise<StatsDay[] | null>
  totals(days: number): Promise<Record<string, { views: number; clicks: number }> | null>
  entitlement(): Promise<Entitlement | null>
  track(slug: string, event: 'view' | 'purchase_click'): void
  /** Called after every write so lists can refresh. */
  onChange(listener: () => void): () => void
}
