import { beforeEach, describe, expect, it } from 'vitest'
import { LocalShowroomRepository } from './repository'

class MemoryStorage implements Storage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  clear() {
    this.m.clear()
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
}

let repo: LocalShowroomRepository
let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  repo = new LocalShowroomRepository(storage)
})

describe('LocalShowroomRepository', () => {
  it('creates a draft with a unique slug and persists it', () => {
    const a = repo.create({ template: 'orbit', mode: 'true3d', productName: 'Nº 07 Lumière' })
    const b = repo.create({ template: 'gallery', mode: 'photo', productName: 'Nº 07 Lumière' })
    expect(a.status).toBe('draft')
    expect(a.slug).toBe('no-07-lumiere')
    expect(b.slug).toBe('no-07-lumiere-2')
    expect(new LocalShowroomRepository(storage).list()).toHaveLength(2)
  })

  it('never reuses reserved slugs', () => {
    expect(repo.create({ template: 'orbit', mode: 'photo', productName: 'Studio' }).slug).toBe('studio-2')
  })

  it('saves drafts without touching the published version', () => {
    const s = repo.create({ template: 'editorial', mode: 'photo', productName: 'Cuff' })
    repo.saveDraft(s.id, { ...s.draft, images: [{ src: 'asset:x', alt: 'Cuff' }] })
    const published = repo.publish(s.id)
    expect(published.ok).toBe(true)
    repo.saveDraft(s.id, { ...repo.get(s.id)!.draft, tagline: 'Changed after publishing' })
    const now = repo.get(s.id)!
    expect(now.draft.tagline).toBe('Changed after publishing')
    expect(now.published!.tagline).toBe('')
    expect(repo.getPublishedBySlug('cuff')?.published?.tagline).toBe('')
  })

  it('refuses to publish incomplete showrooms and says why', () => {
    const s = repo.create({ template: 'orbit', mode: 'true3d', productName: 'Watch' })
    const r = repo.publish(s.id)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.field)).toContain('model')
    expect(repo.getPublishedBySlug('watch')).toBeUndefined()
  })

  it('rejects unsafe purchase links at publish time', () => {
    const s = repo.create({ template: 'editorial', mode: 'photo', productName: 'Bag' })
    repo.saveDraft(s.id, { ...s.draft, images: [{ src: 'asset:x', alt: 'Bag' }], purchaseUrl: 'javascript:alert(1)' })
    const r = repo.publish(s.id)
    expect(r.ok).toBe(false)
  })

  it('unpublishes: the public slug stops resolving', () => {
    const s = repo.create({ template: 'editorial', mode: 'photo', productName: 'Lamp' })
    repo.saveDraft(s.id, { ...s.draft, images: [{ src: 'asset:x', alt: 'Lamp' }] })
    repo.publish(s.id)
    expect(repo.getPublishedBySlug('lamp')).toBeDefined()
    repo.unpublish(s.id)
    expect(repo.getPublishedBySlug('lamp')).toBeUndefined()
    expect(repo.get(s.id)!.status).toBe('draft')
  })

  it('changes the slug only when valid and free', () => {
    const a = repo.create({ template: 'orbit', mode: 'photo', productName: 'Alpha' })
    repo.create({ template: 'orbit', mode: 'photo', productName: 'Beta' })
    expect(repo.setSlug(a.id, 'beta')).toEqual({ ok: false, error: expect.stringContaining('already used') })
    expect(repo.setSlug(a.id, 'ab').ok).toBe(false)
    expect(repo.setSlug(a.id, 'Alpha One!')).toEqual({ ok: true })
    expect(repo.get(a.id)!.slug).toBe('alpha-one')
  })

  it('duplicates as a new draft and deletes cleanly', async () => {
    const s = repo.create({ template: 'gallery', mode: 'photo', productName: 'Vase' })
    const copy = await repo.duplicate(s.id)
    expect(copy.id).not.toBe(s.id)
    expect(copy.status).toBe('draft')
    expect(copy.draft.productName).toBe('Vase (copy)')
    await repo.remove(s.id)
    expect(repo.list().map((x) => x.id)).toEqual([copy.id])
  })

  it('survives corrupted storage', () => {
    storage.setItem('object.studio.showrooms.v1', '{not json')
    expect(new LocalShowroomRepository(storage).list()).toEqual([])
  })
})
