import { deleteAsset, getAssetBlob, putAsset } from '../assets-idb'
import { LocalShowroomRepository } from '../repository'
import type { GalleryItem, GalleryQuery, StudioBackend } from './types'


/** This-browser storage: localStorage for showrooms, IndexedDB for files. */
export class LocalBackend implements StudioBackend {
  readonly mode = 'local' as const
  private repo = new LocalShowroomRepository()

  async list() {
    return this.repo.list()
  }
  async create(input: Parameters<StudioBackend['create']>[0]) {
    return this.repo.create(input)
  }
  async saveDraft(id: string, draft: Parameters<StudioBackend['saveDraft']>[1]) {
    this.repo.saveDraft(id, draft)
  }
  async setSlug(id: string, slug: string) {
    const r = this.repo.setSlug(id, slug)
    return r.ok ? { ok: true as const, slug: this.repo.get(id)!.slug } : r
  }
  async publish(id: string) {
    const r = this.repo.publish(id)
    return r.ok ? { ok: true as const } : { ok: false as const, issues: r.issues }
  }
  async unpublish(id: string) {
    this.repo.unpublish(id)
  }
  async setListed(id: string, listed: boolean) {
    this.repo.setListed(id, listed)
  }
  /** This browser's own listed showrooms (local mode has no shared catalogue). */
  async gallery({ before, query, mode, limit = 24 }: GalleryQuery): Promise<GalleryItem[]> {
    const term = query?.trim().toLowerCase()
    return this.repo
      .list()
      .filter((s) => s.status === 'published' && s.listed && s.published && s.publishedAt)
      .filter((s) => !before || s.publishedAt! < before)
      .filter((s) => !mode || s.published!.mode === mode)
      .filter((s) => !term || [s.published!.productName, s.published!.brand, s.published!.tagline].some((t) => t?.toLowerCase().includes(term)))
      .sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : -1))
      .slice(0, limit)
      .map((s) => {
        const p = s.published!
        return {
          slug: s.slug,
          productName: p.productName,
          brand: p.brand,
          tagline: p.tagline,
          cover: p.images[0]?.src ?? null,
          coverAlt: p.images[0]?.alt ?? '',
          mode: p.mode,
          background: p.theme.background,
          accent: p.theme.accent,
          text: p.theme.text,
          publishedAt: s.publishedAt!,
        }
      })
  }
  duplicate(id: string) {
    return this.repo.duplicate(id)
  }
  remove(id: string) {
    return this.repo.remove(id)
  }
  async getPublished(slug: string) {
    return this.repo.getPublishedBySlug(slug)?.published ?? null
  }
  async putAsset(showroomId: string, kind: 'image' | 'model', file: Blob, name: string, mime: string) {
    return (await putAsset(showroomId, kind, file, name, mime)).id
  }
  getAssetBlob(key: string) {
    return getAssetBlob(key)
  }
  deleteAsset(key: string) {
    return deleteAsset(key)
  }
  async stats() {
    return null
  }
  async totals() {
    return null
  }
  async entitlement() {
    return null
  }
  track() {}
  onChange(listener: () => void) {
    return this.repo.subscribe(listener)
  }
}
