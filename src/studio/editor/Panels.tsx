import { ArrowDown, ArrowUp, Box, Check, Images, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { contrastRatio } from '@/lib/color'
import { safeExternalUrl, slugify } from '@/lib/url'
import type { FontId, ShowroomChapter, ShowroomConfig, ShowroomFeature, TemplateId } from '@/showroom/types'
import { assetIdOf, assetRef, assetUrl, forgetAsset, isAssetRef } from '../assets'
import { backend } from '../backend'
import { newId } from '../ids'
import { TEMPLATE_INFO } from '../starters'
import { DEFAULT_PRESET, presetTheme, THEME_PRESETS } from '../themes'
import type { StudioShowroom } from '../types'
import { checkUpload, LIMITS } from '../validation'
import { ColorInput, Field, Section, Segmented, Select, Slider, SmallButton, TextArea, TextInput, Toggle } from '../ui'

export type Update = (change: (draft: ShowroomConfig) => ShowroomConfig) => void

interface PanelProps {
  showroom: StudioShowroom
  draft: ShowroomConfig
  update: Update
}

const set =
  <K extends keyof ShowroomConfig>(update: Update, key: K) =>
  (value: ShowroomConfig[K]) =>
    update((d) => ({ ...d, [key]: value }))

function deleteAsset(key: string) {
  forgetAsset(key)
  return backend.deleteAsset(key)
}

/** Assets still referenced by the live (published) version must survive draft edits. */
function usedByPublished(showroom: StudioShowroom, assetId: string) {
  const p = showroom.published
  if (!p) return false
  return p.images.some((i) => i.src === assetRef(assetId)) || (p.model?.kind === 'upload' && p.model.assetId === assetId)
}

// ── Template ────────────────────────────────────────────────────────────────

export function TemplatePanel({ draft, update }: PanelProps) {
  return (
    <Section id="template" title="Template" summary={TEMPLATE_INFO[draft.template].name}>
      <div role="radiogroup" aria-label="Template" className="grid gap-2">
        {(Object.keys(TEMPLATE_INFO) as TemplateId[]).map((id) => {
          const info = TEMPLATE_INFO[id]
          const active = draft.template === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update((d) => ({ ...d, template: id }))}
              className={`cursor-pointer rounded-lg p-4 text-left ring-1 ring-inset transition-colors ${
                active ? 'bg-porcelain/[0.06] ring-lime' : 'ring-hairline hover:ring-silver/40'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="display text-lg">{info.name}</span>
                {active && <Check aria-hidden className="size-4 text-lime" />}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-silver">{info.line}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => update((d) => ({ ...d, theme: presetTheme(DEFAULT_PRESET[d.template]) }))}
        className="cursor-pointer text-[13px] text-silver underline decoration-hairline underline-offset-4 hover:text-porcelain"
      >
        Use {TEMPLATE_INFO[draft.template].name}’s suggested look
      </button>
    </Section>
  )
}

// ── Media ───────────────────────────────────────────────────────────────────

function AssetThumb({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(isAssetRef(src) ? null : src)
  useEffect(() => {
    if (!isAssetRef(src)) return
    let alive = true
    assetUrl(assetIdOf(src)).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [src])
  return url ? <img src={url} alt={alt} className="size-16 shrink-0 rounded object-cover ring-1 ring-hairline" /> : <div className="size-16 shrink-0 rounded bg-graphite" />
}

function UploadButton({ label, accept, multiple, onFiles, busy }: { label: string; accept: string; multiple?: boolean; onFiles: (f: File[]) => void; busy?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const id = useId()
  return (
    <>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-silver/30 text-sm text-silver transition-colors hover:border-lime hover:text-porcelain disabled:cursor-wait disabled:opacity-60"
      >
        <Upload aria-hidden className="size-4" />
        {busy ? 'Checking file…' : label}
      </button>
    </>
  )
}

export function MediaPanel({ showroom, draft, update }: PanelProps) {
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function addImages(files: File[]) {
    setBusy(true)
    const problems: string[] = []
    const room = LIMITS.maxImages - draft.images.length
    if (files.length > room) problems.push(`You can add ${room} more image${room === 1 ? '' : 's'} (maximum ${LIMITS.maxImages}).`)
    const added: { src: string; alt: string }[] = []
    for (const file of files.slice(0, Math.max(0, room))) {
      const check = await checkUpload(file, 'image')
      if (!check.ok) {
        problems.push(check.error)
        continue
      }
      try {
        const key = await backend.putAsset(showroom.id, 'image', file, file.name, check.mime)
        added.push({ src: assetRef(key), alt: '' })
      } catch (e) {
        problems.push(e instanceof Error ? e.message : 'Couldn’t store this file.')
      }
    }
    if (added.length) update((d) => ({ ...d, images: [...d.images, ...added] }))
    setErrors(problems)
    setBusy(false)
  }

  async function setModel(files: File[]) {
    const file = files[0]!
    setBusy(true)
    const check = await checkUpload(file, 'model')
    if (!check.ok) {
      setErrors([check.error])
      setBusy(false)
      return
    }
    try {
      const key = await backend.putAsset(showroom.id, 'model', file, file.name, check.mime)
      const previous = draft.model
      update((d) => ({ ...d, model: { kind: 'upload', assetId: key, name: file.name } }))
      if (previous?.kind === 'upload' && !usedByPublished(showroom, previous.assetId)) deleteAsset(previous.assetId).catch(() => undefined)
      setErrors([])
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Couldn’t store this file.'])
    }
    setBusy(false)
  }

  function removeImage(index: number) {
    const img = draft.images[index]
    update((d) => ({ ...d, images: d.images.filter((_, i) => i !== index) }))
    if (img && isAssetRef(img.src) && !usedByPublished(showroom, assetIdOf(img.src))) deleteAsset(assetIdOf(img.src)).catch(() => undefined)
  }

  function moveImage(index: number, dir: -1 | 1) {
    update((d) => {
      const images = [...d.images]
      const [item] = images.splice(index, 1)
      images.splice(index + dir, 0, item!)
      return { ...d, images }
    })
  }

  const summary = `${draft.mode === 'true3d' ? 'True 3D' : 'Photo Motion'} · ${draft.images.length} image${draft.images.length === 1 ? '' : 's'}${draft.model ? ' · model' : ''}`

  return (
    <Section id="media" title="Media" summary={summary} defaultOpen>
      <Segmented
        label="Presentation mode"
        value={draft.mode}
        onChange={set(update, 'mode')}
        options={[
          { value: 'photo', label: 'Photo Motion', icon: <Images aria-hidden className="size-4" /> },
          { value: 'true3d', label: 'True 3D', icon: <Box aria-hidden className="size-4" /> },
        ]}
      />
      <p className="text-[13px] leading-relaxed text-ash">
        {draft.mode === 'photo'
          ? 'Your photos are animated with depth, parallax and light. They stay 2D images: OBJECT. never turns a photo into a 3D model.'
          : 'Visitors turn a real 3D model of your product. Upload a .glb file (or a self-contained .gltf). Photos below are used for the poster and if a device cannot show 3D.'}
      </p>

      {draft.mode === 'true3d' && (
        <Field label="3D model" hint={`GLB or glTF, up to ${LIMITS.modelBytes / 1024 / 1024} MB. Meshopt compression is supported; Draco is not yet.`}>
          {draft.model?.kind === 'upload' ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-graphite-2 px-3 py-2 ring-1 ring-inset ring-hairline">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Box aria-hidden className="size-4 shrink-0 text-lime" />
                <span className="truncate">{draft.model.name}</span>
              </span>
              <SmallButton
                tone="danger"
                label="Remove model"
                onClick={() => {
                  const m = draft.model
                  update((d) => ({ ...d, model: undefined }))
                  if (m?.kind === 'upload' && !usedByPublished(showroom, m.assetId)) deleteAsset(m.assetId).catch(() => undefined)
                }}
              >
                <X aria-hidden className="size-4" />
              </SmallButton>
            </div>
          ) : draft.model ? (
            <p className="text-sm text-silver">Built-in demo model</p>
          ) : null}
          <div className="pt-1">
            <UploadButton label={draft.model ? 'Replace model' : 'Upload a model'} accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onFiles={setModel} busy={busy} />
          </div>
        </Field>
      )}

      <Field label="Images" hint={`JPG, PNG or WebP, up to ${LIMITS.imageBytes / 1024 / 1024} MB each, ${LIMITS.maxImages} maximum. The first image leads.`}>
        <ul className="space-y-2">
          {draft.images.map((img, i) => (
            <li key={img.src + i} className="flex items-center gap-3 rounded-md bg-graphite-2 p-2 ring-1 ring-inset ring-hairline">
              <AssetThumb src={img.src} alt="" />
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`alt-${i}`}>
                  Describe image {i + 1}
                </label>
                <input
                  id={`alt-${i}`}
                  value={img.alt}
                  maxLength={160}
                  placeholder="Describe this image"
                  aria-invalid={!img.alt.trim()}
                  onChange={(e) => update((d) => ({ ...d, images: d.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)) }))}
                  className="w-full min-h-10 rounded bg-transparent px-2 text-sm text-porcelain placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-lime aria-[invalid=true]:placeholder:text-danger"
                />
              </div>
              <div className="flex shrink-0">
                <SmallButton label="Move up" disabled={i === 0} onClick={() => moveImage(i, -1)}>
                  <ArrowUp aria-hidden className="size-4" />
                </SmallButton>
                <SmallButton label="Move down" disabled={i === draft.images.length - 1} onClick={() => moveImage(i, 1)}>
                  <ArrowDown aria-hidden className="size-4" />
                </SmallButton>
                <SmallButton label="Remove image" tone="danger" onClick={() => removeImage(i)}>
                  <Trash2 aria-hidden className="size-4" />
                </SmallButton>
              </div>
            </li>
          ))}
        </ul>
        {draft.images.length < LIMITS.maxImages && (
          <div className="pt-1">
            <UploadButton label="Add images" accept="image/jpeg,image/png,image/webp" multiple onFiles={addImages} busy={busy} />
          </div>
        )}
      </Field>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md bg-danger/10 p-3 text-[13px] text-danger-soft">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ── Content ─────────────────────────────────────────────────────────────────

export function ContentPanel({ draft, update }: PanelProps) {
  return (
    <Section id="content" title="Product" summary={draft.productName || 'Name, story, price'} defaultOpen>
      <TextInput label="Product name" value={draft.productName} onChange={set(update, 'productName')} maxLength={60} error={draft.productName.trim() ? null : 'Your showroom needs a product name.'} />
      <TextInput label="Brand" value={draft.brand} onChange={set(update, 'brand')} maxLength={40} placeholder="Your brand name" />
      <TextInput label="Tagline" value={draft.tagline} onChange={set(update, 'tagline')} maxLength={90} placeholder="One line visitors remember" />
      <TextArea label="Description" value={draft.description} onChange={set(update, 'description')} placeholder="What it is, what it’s made of, why it matters." maxLength={500} />
      <TextInput label="Price" value={draft.price ?? ''} onChange={set(update, 'price')} maxLength={40} placeholder="e.g. 148 € · 50 ml" hint="Shown as written. Leave empty to hide it." />
    </Section>
  )
}

// ── Highlights / hotspots ───────────────────────────────────────────────────

function hotspotFrom(height: number, aroundDeg: number): [number, number, number] {
  const a = (aroundDeg * Math.PI) / 180
  return [Number((Math.sin(a) * 0.85).toFixed(3)), height, Number((Math.cos(a) * 0.85).toFixed(3))]
}

function hotspotParts(h: [number, number, number]) {
  return { height: h[1], around: Math.round(((Math.atan2(h[0], h[2]) * 180) / Math.PI + 360) % 360) }
}

export function FeaturesPanel({ draft, update }: PanelProps) {
  const orbit = draft.template === 'orbit'
  const patch = (id: string, change: Partial<ShowroomFeature>) =>
    update((d) => ({ ...d, features: d.features.map((f) => (f.id === id ? { ...f, ...change } : f)) }))
  return (
    <Section id="features" title={orbit ? 'Highlights & hotspots' : 'Highlights'} summary={`${draft.features.length} highlight${draft.features.length === 1 ? '' : 's'}`}>
      {draft.features.length === 0 && <p className="text-[13px] text-ash">Name up to six things that make this product worth its price.</p>}
      {draft.features.map((f, i) => {
        const parts = f.hotspot ? hotspotParts(f.hotspot) : null
        return (
          <div key={f.id} className="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-hairline">
            <div className="flex items-center justify-between">
              <span className="meta text-ash">Highlight {i + 1}</span>
              <SmallButton label={`Remove highlight ${i + 1}`} tone="danger" onClick={() => update((d) => ({ ...d, features: d.features.filter((x) => x.id !== f.id) }))}>
                <Trash2 aria-hidden className="size-4" />
              </SmallButton>
            </div>
            <TextInput label="Title" value={f.title} onChange={(v) => patch(f.id, { title: v })} maxLength={40} />
            <TextArea label="Text" value={f.body} onChange={(v) => patch(f.id, { body: v })} maxLength={160} rows={2} />
            {orbit && draft.mode === 'true3d' && (
              <>
                <Toggle label="Pin as hotspot on the model" checked={!!f.hotspot} onChange={(on) => patch(f.id, { hotspot: on ? hotspotFrom(0.4, 30) : undefined })} />
                {parts && (
                  <>
                    <Slider label="Height" min={-1.3} max={1.6} step={0.05} value={parts.height} onChange={(v) => patch(f.id, { hotspot: hotspotFrom(v, parts.around) })} />
                    <Slider label="Around" min={0} max={359} step={1} value={parts.around} format={(v) => `${Math.round(v)}°`} onChange={(v) => patch(f.id, { hotspot: hotspotFrom(parts.height, v) })} />
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
      {draft.features.length < 6 && (
        <SmallButton onClick={() => update((d) => ({ ...d, features: [...d.features, { id: newId(), title: '', body: '' }] }))}>
          <Plus aria-hidden className="size-4" /> Add a highlight
        </SmallButton>
      )}
    </Section>
  )
}

// ── Story chapters / gallery views ──────────────────────────────────────────

const VIEWS: { id: string; label: string; angle: number; elevation: number; zoom: number }[] = [
  { id: 'front', label: 'Front', angle: 0, elevation: 0.12, zoom: 1 },
  { id: 'side', label: 'Side', angle: Math.PI / 2, elevation: 0.12, zoom: 1 },
  { id: 'back', label: 'Back', angle: Math.PI, elevation: 0.12, zoom: 1 },
  { id: 'above', label: 'Above', angle: Math.PI * 0.25, elevation: 1.15, zoom: 1 },
  { id: 'detail', label: 'Close-up', angle: Math.PI * 1.25, elevation: 0.15, zoom: 1.9 },
]

function viewOf(c: ShowroomChapter) {
  return (
    VIEWS.find((v) => Math.abs(v.angle - (c.angle ?? 0)) < 0.01 && Math.abs(v.elevation - (c.elevation ?? 0.12)) < 0.01 && Math.abs(v.zoom - (c.zoom ?? 1)) < 0.01)?.id ??
    'front'
  )
}

export function ChaptersPanel({ draft, update }: PanelProps) {
  const gallery = draft.template === 'gallery'
  if (draft.template === 'orbit') return null
  const patch = (id: string, change: Partial<ShowroomChapter>) =>
    update((d) => ({ ...d, chapters: d.chapters.map((c) => (c.id === id ? { ...c, ...change } : c)) }))
  const max = gallery ? 6 : 5
  return (
    <Section id="chapters" title={gallery ? 'Views' : 'Story chapters'} summary={`${draft.chapters.length} ${gallery ? 'view' : 'chapter'}${draft.chapters.length === 1 ? '' : 's'}`}>
      <p className="text-[13px] text-ash">
        {gallery
          ? 'Each view is an angle visitors can step through, with a short caption.'
          : 'Each chapter is a full-screen image with a title, revealed as visitors scroll.'}
      </p>
      {draft.chapters.map((c, i) => (
        <div key={c.id} className="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-hairline">
          <div className="flex items-center justify-between">
            <span className="meta text-ash">
              {gallery ? 'View' : 'Chapter'} {i + 1}
            </span>
            <SmallButton label={`Remove ${gallery ? 'view' : 'chapter'} ${i + 1}`} tone="danger" onClick={() => update((d) => ({ ...d, chapters: d.chapters.filter((x) => x.id !== c.id) }))}>
              <Trash2 aria-hidden className="size-4" />
            </SmallButton>
          </div>
          <TextInput label="Title" value={c.title} onChange={(v) => patch(c.id, { title: v })} maxLength={32} />
          <TextArea label="Caption" value={c.body} onChange={(v) => patch(c.id, { body: v })} maxLength={180} rows={2} />
          {gallery && draft.mode === 'true3d' ? (
            <Select
              label="Camera angle"
              value={viewOf(c)}
              options={VIEWS.map((v) => ({ value: v.id, label: v.label }))}
              onChange={(id) => {
                const v = VIEWS.find((x) => x.id === id)!
                patch(c.id, { angle: v.angle, elevation: v.elevation, zoom: v.zoom })
              }}
            />
          ) : draft.images.length > 0 ? (
            <Select
              label="Image"
              value={String(c.image ?? Math.min(i + 1, draft.images.length - 1))}
              options={draft.images.map((img, j) => ({ value: String(j), label: `Image ${j + 1}${img.alt ? ` · ${img.alt.slice(0, 28)}` : ''}` }))}
              onChange={(v) => patch(c.id, { image: Number(v) })}
            />
          ) : null}
        </div>
      ))}
      {draft.chapters.length < max && (
        <SmallButton
          onClick={() =>
            update((d) => ({
              ...d,
              chapters: [...d.chapters, { id: newId(), title: '', body: '', ...(gallery ? { angle: 0, elevation: 0.12, zoom: 1 } : { image: Math.min(d.chapters.length + 1, Math.max(0, d.images.length - 1)) }) }],
            }))
          }
        >
          <Plus aria-hidden className="size-4" /> Add a {gallery ? 'view' : 'chapter'}
        </SmallButton>
      )}
    </Section>
  )
}

// ── Details ─────────────────────────────────────────────────────────────────

export function DetailsPanel({ draft, update }: PanelProps) {
  return (
    <Section id="details" title="Specifications" summary={`${draft.details.length} line${draft.details.length === 1 ? '' : 's'}`}>
      <p className="text-[13px] text-ash">Material, size, volume, origin: short facts shown as a list.</p>
      {draft.details.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
          <TextInput label={i === 0 ? 'Label' : ' '} value={row.label} maxLength={24} onChange={(v) => update((d) => ({ ...d, details: d.details.map((x, j) => (j === i ? { ...x, label: v } : x)) }))} />
          <TextInput label={i === 0 ? 'Value' : ' '} value={row.value} maxLength={48} onChange={(v) => update((d) => ({ ...d, details: d.details.map((x, j) => (j === i ? { ...x, value: v } : x)) }))} />
          <SmallButton label={`Remove line ${i + 1}`} tone="danger" onClick={() => update((d) => ({ ...d, details: d.details.filter((_, j) => j !== i) }))}>
            <Trash2 aria-hidden className="size-4" />
          </SmallButton>
        </div>
      ))}
      {draft.details.length < 8 && (
        <SmallButton onClick={() => update((d) => ({ ...d, details: [...d.details, { label: '', value: '' }] }))}>
          <Plus aria-hidden className="size-4" /> Add a line
        </SmallButton>
      )}
    </Section>
  )
}

// ── Look ────────────────────────────────────────────────────────────────────

function ContrastNote({ fg, bg, what }: { fg: string; bg: string; what: string }) {
  const ratio = contrastRatio(fg, bg)
  const ok = ratio >= 4.5
  return (
    <p className={`text-[12px] tabular-nums ${ok ? 'text-ash' : 'text-danger-soft'}`}>
      {ok ? `${ratio.toFixed(1)}:1 contrast with ${what}` : `${ratio.toFixed(1)}:1 with ${what}: hard to read. Aim for 4.5:1 or more.`}
    </p>
  )
}

const DISPLAY_FONTS: { value: FontId; label: string }[] = [
  { value: 'archivo-wide', label: 'Archivo Expanded (monumental)' },
  { value: 'archivo-narrow', label: 'Archivo Condensed (gallery)' },
  { value: 'instrument', label: 'Instrument Serif (editorial)' },
  { value: 'inter', label: 'Inter Tight (modern)' },
]

export function LookPanel({ draft, update }: PanelProps) {
  const t = draft.theme
  const setTheme = (patch: Partial<typeof t>) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }))
  return (
    <Section id="look" title="Colours & type" summary={THEME_PRESETS.find((p) => JSON.stringify(p.theme) === JSON.stringify(t))?.name ?? 'Custom'}>
      <div role="radiogroup" aria-label="Colour presets" className="grid grid-cols-2 gap-2">
        {THEME_PRESETS.map((p) => {
          const active = JSON.stringify(p.theme) === JSON.stringify(t)
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme({ ...p.theme })}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] ring-1 ring-inset transition-colors ${active ? 'ring-lime' : 'ring-hairline hover:ring-silver/40'}`}
            >
              <span className="flex shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                <span className="size-5" style={{ background: p.theme.background }} />
                <span className="size-5" style={{ background: p.theme.text }} />
                <span className="size-5" style={{ background: p.theme.accent }} />
              </span>
              <span className="leading-tight text-silver">{p.name}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4">
        <ColorInput label="Background" value={t.background} onChange={(v) => setTheme({ background: v })} />
        <ColorInput label="Surface" value={t.surface} onChange={(v) => setTheme({ surface: v })} />
        <ColorInput label="Text" value={t.text} onChange={(v) => setTheme({ text: v })} note={<ContrastNote fg={t.text} bg={t.background} what="the background" />} />
        <ColorInput label="Secondary text" value={t.muted} onChange={(v) => setTheme({ muted: v })} note={<ContrastNote fg={t.muted} bg={t.background} what="the background" />} />
        <ColorInput label="Accent (buttons)" value={t.accent} onChange={(v) => setTheme({ accent: v })} />
        <ColorInput label="Text on accent" value={t.onAccent} onChange={(v) => setTheme({ onAccent: v })} note={<ContrastNote fg={t.onAccent} bg={t.accent} what="the accent" />} />
      </div>
      <Select label="Headline typeface" value={t.displayFont} options={DISPLAY_FONTS} onChange={(v) => setTheme({ displayFont: v })} />
      <Select
        label="Text typeface"
        value={t.bodyFont === 'instrument' ? 'instrument' : 'inter'}
        options={[
          { value: 'inter', label: 'Inter Tight (clean)' },
          { value: 'instrument', label: 'Instrument Serif (literary)' },
        ]}
        onChange={(v) => setTheme({ bodyFont: v as FontId })}
      />
      {draft.template === 'gallery' && (
        <Field label="Wall colours visitors can choose" hint="Up to four. The first is the default wall.">
          <div className="flex flex-wrap items-center gap-2">
            {(draft.backdrops ?? []).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-graphite-2 p-1 ring-1 ring-inset ring-hairline">
                <input
                  type="color"
                  aria-label={`Wall colour ${i + 1}`}
                  value={c}
                  onChange={(e) => update((d) => ({ ...d, backdrops: (d.backdrops ?? []).map((x, j) => (j === i ? e.target.value : x)) }))}
                  className="size-9 cursor-pointer rounded bg-transparent"
                />
                {(draft.backdrops ?? []).length > 1 && (
                  <SmallButton label={`Remove wall colour ${i + 1}`} onClick={() => update((d) => ({ ...d, backdrops: (d.backdrops ?? []).filter((_, j) => j !== i) }))}>
                    <X aria-hidden className="size-3.5" />
                  </SmallButton>
                )}
              </span>
            ))}
            {(draft.backdrops ?? []).length < 4 && (
              <SmallButton label="Add a wall colour" onClick={() => update((d) => ({ ...d, backdrops: [...(d.backdrops ?? []), '#1d1d20'] }))}>
                <Plus aria-hidden className="size-4" />
              </SmallButton>
            )}
          </div>
        </Field>
      )}
    </Section>
  )
}

// ── Purchase ────────────────────────────────────────────────────────────────

export function PurchasePanel({ draft, update }: PanelProps) {
  const [raw, setRaw] = useState(draft.purchaseUrl ?? '')
  const valid = !raw.trim() || !!safeExternalUrl(raw)
  return (
    <Section id="purchase" title="Purchase button" summary={draft.purchaseUrl ? new URL(draft.purchaseUrl).hostname : 'No link yet'}>
      <TextInput
        id="purchase-url"
        type="url"
        label="Link to your store"
        value={raw}
        maxLength={2048}
        placeholder="https://yourshop.com/products/…"
        error={valid ? null : 'Enter a full address starting with https:// (for example your Shopify or Etsy product page).'}
        hint="Opens your own store in a new tab. Leave empty to hide the button."
        onChange={(v) => {
          setRaw(v)
          const safe = safeExternalUrl(v)
          if (!v.trim()) update((d) => ({ ...d, purchaseUrl: null }))
          else if (safe) update((d) => ({ ...d, purchaseUrl: safe }))
        }}
      />
      <TextInput label="Button text" value={draft.purchaseLabel} onChange={set(update, 'purchaseLabel')} maxLength={28} />
    </Section>
  )
}

// ── Motion ──────────────────────────────────────────────────────────────────

export function MotionPanel({ draft, update, onReplay }: PanelProps & { onReplay: () => void }) {
  const a = draft.animation
  const setA = (patch: Partial<typeof a>) => update((d) => ({ ...d, animation: { ...d.animation, ...patch } }))
  return (
    <Section id="motion" title="Animation" summary={`${a.entrance} · ${a.speed.toFixed(1)}×`}>
      <Select
        label="Entrance"
        value={a.entrance}
        options={[
          { value: 'rise', label: 'Rise: the product lifts into place' },
          { value: 'fade', label: 'Fade: lights come up slowly' },
          { value: 'orbit', label: 'Orbit: the product swings round to face you' },
        ]}
        onChange={(v) => setA({ entrance: v })}
      />
      <Slider label="Speed" min={0.5} max={2} step={0.1} value={a.speed} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => setA({ speed: v })} />
      {draft.template === 'orbit' && <Toggle label="Turn slowly on its own" checked={a.autoRotate} onChange={(v) => setA({ autoRotate: v })} />}
      <p className="text-[13px] text-ash">Visitors who ask their device for reduced motion always get a still version.</p>
      <SmallButton onClick={onReplay}>Replay entrance in preview</SmallButton>
    </Section>
  )
}

// ── Link ────────────────────────────────────────────────────────────────────

export function LinkPanel({ showroom }: PanelProps) {
  const [value, setValue] = useState(showroom.slug)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const normalised = slugify(value)
  return (
    <Section id="link" title="Public link" summary={`/s/${showroom.slug}`}>
      <TextInput
        label="Address"
        value={value}
        maxLength={60}
        onChange={(v) => {
          setValue(v)
          setError(null)
          setSaved(false)
        }}
        error={error}
        hint={
          <>
            Your showroom will live at <span className="text-porcelain">/s/{normalised || '…'}</span>
            {showroom.status === 'published' && normalised !== showroom.slug && '. Changing it breaks links you already shared.'}
          </>
        }
      />
      <SmallButton
        disabled={normalised === showroom.slug || busy}
        onClick={async () => {
          setBusy(true)
          const r = await backend.setSlug(showroom.id, value)
          setBusy(false)
          if (r.ok) {
            setValue(r.slug)
            setSaved(true)
          } else setError(r.error)
        }}
      >
        {busy ? 'Saving…' : saved ? 'Address saved' : 'Save address'}
      </SmallButton>
    </Section>
  )
}

export function PanelStack({ children }: { children: ReactNode }) {
  return <div className="divide-y-0">{children}</div>
}
