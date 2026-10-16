import { slugify } from '@/lib/url'
import type { MediaMode, ShowroomConfig, TemplateId } from '@/showroom/types'
import { copyAssets, deleteShowroomAssets } from './assets-idb'
import { assetIdOf, assetRef, isAssetRef } from './refs'
import { newId } from './ids'
import { createStarterConfig } from './starters'
import type { StudioShowroom } from './types'
import { publishIssues, type PublishIssue } from './validation'

/**
 * Local (this-browser) showroom store. Synchronous and fully unit-tested;
 * wrapped by backend/local.ts behind the async StudioBackend interface that
 * the cloud (Supabase) backend also implements.
 */
export interface ShowroomRepository {
  list(): StudioShowroom[]
  get(id: string): StudioShowroom | undefined
  getPublishedBySlug(slug: string): StudioShowroom | undefined
  create(input: { template: TemplateId; mode: MediaMode; productName: string }): StudioShowroom
  saveDraft(id: string, draft: ShowroomConfig): StudioShowroom
  setSlug(id: string, slug: string): { ok: true } | { ok: false; error: string }
  publish(id: string): { ok: true; showroom: StudioShowroom } | { ok: false; issues: PublishIssue[] }
  unpublish(id: string): StudioShowroom
  duplicate(id: string): Promise<StudioShowroom>
  remove(id: string): Promise<void>
  subscribe(listener: () => void): () => void
}

export class StorageError extends Error {}

const KEY = 'object.studio.showrooms.v1'
const RESERVED = new Set(['new', 'studio', 'demo', 'admin', 'api', 'create'])

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class LocalShowroomRepository implements ShowroomRepository {
  private cache: StudioShowroom[] | null = null
  private listeners = new Set<() => void>()
  private storage: Storage | null

  constructor(storage?: Storage | null) {
    this.storage = storage === undefined ? safeLocalStorage() : storage
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) {
          this.cache = null
          this.emit()
        }
      })
    }
  }

  private read(): StudioShowroom[] {
    if (this.cache) return this.cache
    let rows: StudioShowroom[] = []
    try {
      const raw = this.storage?.getItem(KEY)
      if (raw) rows = JSON.parse(raw) as StudioShowroom[]
    } catch {
      rows = []
    }
    this.cache = Array.isArray(rows) ? rows : []
    return this.cache
  }

  private write(rows: StudioShowroom[]) {
    try {
      this.storage?.setItem(KEY, JSON.stringify(rows))
    } catch {
      throw new StorageError('Couldn’t save: this browser’s storage is full or blocked. Remove an old showroom or free some space.')
    }
    this.cache = rows
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  list() {
    return this.read()
  }

  get(id: string) {
    return this.read().find((s) => s.id === id)
  }

  getPublishedBySlug(slug: string) {
    return this.read().find((s) => s.slug === slug && s.status === 'published' && s.published)
  }

  private uniqueSlug(base: string, exceptId?: string) {
    const root = slugify(base) || 'showroom'
    const taken = new Set(this.read().filter((s) => s.id !== exceptId).map((s) => s.slug))
    if (!taken.has(root) && !RESERVED.has(root)) return root
    for (let i = 2; ; i++) {
      const candidate = `${root}-${i}`
      if (!taken.has(candidate)) return candidate
    }
  }

  create({ template, mode, productName }: { template: TemplateId; mode: MediaMode; productName: string }) {
    const now = new Date().toISOString()
    const slug = this.uniqueSlug(productName)
    const showroom: StudioShowroom = {
      id: newId(),
      slug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      draft: createStarterConfig(template, mode, productName, slug),
      published: null,
    }
    this.write([showroom, ...this.read()])
    return showroom
  }

  private update(id: string, change: (s: StudioShowroom) => StudioShowroom) {
    const rows = this.read()
    const index = rows.findIndex((s) => s.id === id)
    if (index < 0) throw new Error('This showroom no longer exists.')
    const next = change(clone(rows[index]!))
    const copy = [...rows]
    copy[index] = next
    this.write(copy)
    return next
  }

  saveDraft(id: string, draft: ShowroomConfig) {
    return this.update(id, (s) => ({ ...s, draft: { ...clone(draft), slug: s.slug, isDemo: false }, updatedAt: new Date().toISOString() }))
  }

  setSlug(id: string, wanted: string): { ok: true } | { ok: false; error: string } {
    const slug = slugify(wanted)
    if (slug.length < 3) return { ok: false, error: 'Use at least 3 letters or numbers.' }
    if (RESERVED.has(slug)) return { ok: false, error: `“${slug}” is reserved. Try another.` }
    if (this.read().some((s) => s.slug === slug && s.id !== id)) return { ok: false, error: `“${slug}” is already used by another showroom.` }
    this.update(id, (s) => ({ ...s, slug, draft: { ...s.draft, slug }, published: s.published ? { ...s.published, slug } : null }))
    return { ok: true }
  }

  publish(id: string): { ok: true; showroom: StudioShowroom } | { ok: false; issues: PublishIssue[] } {
    const current = this.get(id)
    if (!current) return { ok: false, issues: [{ field: 'id', message: 'This showroom no longer exists.' }] }
    const issues = publishIssues(current.draft)
    if (issues.length) return { ok: false, issues }
    const now = new Date().toISOString()
    const showroom = this.update(id, (s) => ({ ...s, status: 'published', publishedAt: now, published: clone(s.draft), updatedAt: now }))
    return { ok: true, showroom }
  }

  unpublish(id: string) {
    return this.update(id, (s) => ({ ...s, status: 'draft', updatedAt: new Date().toISOString() }))
  }

  async duplicate(id: string) {
    const source = this.get(id)
    if (!source) throw new Error('This showroom no longer exists.')
    const now = new Date().toISOString()
    const newShowroomId = newId()
    const slug = this.uniqueSlug(source.slug + '-copy')
    const idMap = await copyAssets(source.id, newShowroomId).catch(() => new Map<string, string>())
    const draft = remapAssets(clone(source.draft), idMap)
    const copy: StudioShowroom = {
      id: newShowroomId,
      slug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      draft: { ...draft, slug, productName: `${draft.productName} (copy)` },
      published: null,
    }
    this.write([copy, ...this.read()])
    return copy
  }

  async remove(id: string) {
    this.write(this.read().filter((s) => s.id !== id))
    await deleteShowroomAssets(id).catch(() => undefined)
  }
}

function remapAssets(config: ShowroomConfig, map: Map<string, string>): ShowroomConfig {
  const swap = (src: string) => (isAssetRef(src) && map.has(assetIdOf(src)) ? assetRef(map.get(assetIdOf(src))!) : src)
  return {
    ...config,
    images: config.images.map((img) => ({ ...img, src: swap(img.src) })),
    model: config.model?.kind === 'upload' && map.has(config.model.assetId) ? { ...config.model, assetId: map.get(config.model.assetId)! } : config.model,
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const probe = '__object_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

/** True when showrooms can be kept in this browser. */
export const storageAvailable = () => safeLocalStorage() !== null
