import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShowroomConfig } from '@/showroom/types'
import { createStarterConfig, withDefaults } from '../starters'
import type { AssetKind, StudioShowroom } from '../types'
import type { Entitlement, PublishResult, SlugResult, StatsDay, StudioBackend } from './types'

const BUCKET = 'showroom-assets'

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
}

interface ShowroomRow {
  id: string
  slug: string
  status: 'draft' | 'published'
  template: StudioShowroom['draft']['template']
  created_at: string
  updated_at: string
  published_at: string | null
  showroom_content:
    | { settings_json: Partial<ShowroomConfig>; published_json: Partial<ShowroomConfig> | null; updated_at: string }
    | { settings_json: Partial<ShowroomConfig>; published_json: Partial<ShowroomConfig> | null; updated_at: string }[]
    | null
}

function fail(error: { message: string } | null, fallback = 'Something went wrong. Try again.'): never {
  throw new Error(error?.message || fallback)
}

function toShowroom(row: ShowroomRow): StudioShowroom {
  const content = Array.isArray(row.showroom_content) ? row.showroom_content[0] : row.showroom_content
  const fallback = { template: row.template, slug: row.slug }
  const contentUpdated = content?.updated_at ?? row.updated_at
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: contentUpdated > row.updated_at ? contentUpdated : row.updated_at,
    publishedAt: row.published_at,
    draft: withDefaults({ ...content?.settings_json, slug: row.slug }, fallback),
    published: content?.published_json ? withDefaults({ ...content.published_json, slug: row.slug }, fallback) : null,
  }
}

const SELECT = 'id, slug, status, template, created_at, updated_at, published_at, showroom_content(settings_json, published_json, updated_at)'

/** A random id per browser session: counts unique visitors without cookies or fingerprints. */
function visitorId(): string | null {
  try {
    if (navigator.doNotTrack === '1') return null
    let v = sessionStorage.getItem('object.visit')
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('')
      sessionStorage.setItem('object.visit', v)
    }
    return v
  } catch {
    return null
  }
}

/** Supabase: Postgres with row-level security, Auth, and Storage. */
export class CloudBackend implements StudioBackend {
  readonly mode = 'cloud' as const
  private listeners = new Set<() => void>()
  private workspaceId: Promise<string> | null = null

  constructor(private sb: SupabaseClient) {
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        this.workspaceId = null
        this.emit()
      }
    })
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  onChange(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private workspace(): Promise<string> {
    if (!this.workspaceId) {
      this.workspaceId = Promise.resolve(this.sb.from('workspaces').select('id').order('created_at').limit(1).single()).then(({ data, error }) => {
        if (error || !data) {
          this.workspaceId = null
          fail(error, 'Your workspace could not be loaded. Sign in again.')
        }
        return data.id as string
      })
    }
    return this.workspaceId
  }

  async list() {
    // RLS already limits rows to this user; the explicit filter is defence in depth.
    const ws = await this.workspace()
    const { data, error } = await this.sb.from('showrooms').select(SELECT).eq('workspace_id', ws).order('updated_at', { ascending: false })
    if (error) fail(error)
    return (data as unknown as ShowroomRow[]).map(toShowroom)
  }

  private async one(id: string) {
    const { data, error } = await this.sb.from('showrooms').select(SELECT).eq('id', id).single()
    if (error || !data) fail(error, 'This showroom no longer exists.')
    return toShowroom(data as unknown as ShowroomRow)
  }

  async create({ template, mode, productName }: Parameters<StudioBackend['create']>[0]) {
    const settings = createStarterConfig(template, mode, productName, '')
    const { data, error } = await this.sb.rpc('create_showroom', { p_title: productName.trim(), p_template: template, p_settings: settings })
    if (error) fail(error)
    const created = await this.one((data as { id: string }).id)
    this.emit()
    return created
  }

  async saveDraft(id: string, draft: ShowroomConfig) {
    const { error } = await this.sb.rpc('save_draft', { p_id: id, p_settings: draft })
    if (error) fail(error, 'Couldn’t save your changes.')
    this.emit()
  }

  async setSlug(id: string, slug: string): Promise<SlugResult> {
    const { data, error } = await this.sb.rpc('set_showroom_slug', { p_id: id, p_slug: slug })
    if (error) return { ok: false, error: error.message }
    this.emit()
    return { ok: true, slug: data as string }
  }

  async publish(id: string): Promise<PublishResult> {
    const { data, error } = await this.sb.rpc('publish_showroom', { p_id: id })
    if (error) fail(error)
    const row = (data as { ok: boolean; issues: string[] }[])[0]
    this.emit()
    if (row?.ok) return { ok: true }
    return { ok: false, issues: (row?.issues ?? ['Publishing failed.']).map((message) => ({ field: 'server', message })) }
  }

  async unpublish(id: string) {
    const { error } = await this.sb.rpc('unpublish_showroom', { p_id: id })
    if (error) fail(error)
    this.emit()
  }

  async duplicate(id: string) {
    const source = await this.one(id)
    const copy = await this.create({ template: source.draft.template, mode: source.draft.mode, productName: `${source.draft.productName} (copy)`.slice(0, 60) })
    const ws = await this.workspace()
    const { data: assets, error } = await this.sb.from('assets').select('storage_path, asset_type, mime_type, file_size, original_name').eq('showroom_id', id)
    if (error) fail(error)
    let json = JSON.stringify(source.draft)
    for (const a of assets ?? []) {
      const newId = crypto.randomUUID()
      const newPath = `${ws}/${copy.id}/${newId}.${EXT[a.mime_type] ?? 'bin'}`
      const { error: copyError } = await this.sb.storage.from(BUCKET).copy(a.storage_path, newPath)
      if (copyError) continue
      const { error: rowError } = await this.sb.from('assets').insert({ ...a, id: newId, storage_path: newPath, showroom_id: copy.id, workspace_id: ws })
      if (rowError) {
        await this.sb.storage.from(BUCKET).remove([newPath])
        continue
      }
      json = json.split(a.storage_path).join(newPath)
    }
    const draft = { ...(JSON.parse(json) as ShowroomConfig), productName: copy.draft.productName, slug: copy.slug }
    await this.saveDraft(copy.id, draft)
    return { ...copy, draft }
  }

  async remove(id: string) {
    const { data: assets } = await this.sb.from('assets').select('storage_path').eq('showroom_id', id)
    const paths = (assets ?? []).map((a) => a.storage_path as string)
    if (paths.length) await this.sb.storage.from(BUCKET).remove(paths)
    const { error, count } = await this.sb.from('showrooms').delete({ count: 'exact' }).eq('id', id)
    if (error) fail(error)
    if (!count) fail(null, 'This showroom could not be deleted.')
    this.emit()
  }

  async getPublished(slug: string) {
    const { data, error } = await this.sb.rpc('get_published_showroom', { p_slug: slug })
    if (error) fail(error)
    const row = (data as { config: Partial<ShowroomConfig>; slug: string }[])[0]
    return row?.config ? withDefaults({ ...row.config, slug: row.slug }, { template: 'orbit', slug: row.slug }) : null
  }

  async putAsset(showroomId: string, kind: AssetKind, file: Blob, name: string, mime: string) {
    const ws = await this.workspace()
    const id = crypto.randomUUID()
    const path = `${ws}/${showroomId}/${id}.${EXT[mime] ?? 'bin'}`
    const { error: upError } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false, cacheControl: '31536000' })
    if (upError) fail(upError, 'Upload failed. Check your connection and try again.')
    const { error } = await this.sb.from('assets').insert({
      id,
      showroom_id: showroomId,
      workspace_id: ws,
      storage_path: path,
      asset_type: kind,
      mime_type: mime,
      file_size: file.size,
      original_name: name.slice(0, 200),
    })
    if (error) {
      await this.sb.storage.from(BUCKET).remove([path])
      fail(error, 'Upload failed.')
    }
    return path
  }

  async getAssetBlob(key: string) {
    const { data, error } = await this.sb.storage.from(BUCKET).download(key)
    if (error) return null
    return data
  }

  async deleteAsset(key: string) {
    await this.sb.storage.from(BUCKET).remove([key])
    await this.sb.from('assets').delete().eq('storage_path', key)
  }

  async stats(id: string, days: number): Promise<StatsDay[]> {
    const { data, error } = await this.sb.rpc('showroom_stats', { p_id: id, p_days: days })
    if (error) fail(error)
    return (data as StatsDay[]).map((d) => ({ day: d.day, views: d.views, visitors: d.visitors, clicks: d.clicks }))
  }

  async totals(days: number) {
    const { data, error } = await this.sb.rpc('workspace_view_totals', { p_days: days })
    if (error) fail(error)
    return Object.fromEntries((data as { showroom_id: string; views: number; clicks: number }[]).map((r) => [r.showroom_id, { views: r.views, clicks: r.clicks }]))
  }

  async entitlement(): Promise<Entitlement | null> {
    const ws = await this.workspace()
    const { data, error } = await this.sb.rpc('publish_entitlement', { p_workspace: ws })
    if (error) fail(error)
    return ((data as Entitlement[])[0] as Entitlement | undefined) ?? null
  }

  track(slug: string, event: 'view' | 'purchase_click') {
    // Supabase queries are lazy: they only run once awaited or then-ed.
    this.sb.rpc('track_event', { p_slug: slug, p_event: event, p_visitor: visitorId() }).then(
      () => undefined,
      () => undefined,
    )
  }
}
