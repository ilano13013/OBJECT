import { ArrowRight, Box, Check, Images } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import auraPoster from '@/assets/renders/aura-poster.webp'
import formHero from '@/assets/renders/form-hero.webp'
import monoPoster from '@/assets/renders/mono-poster.webp'
import type { MediaMode, TemplateId } from '@/showroom/types'
import { backend } from '@/studio/backend'
import { TEMPLATE_INFO } from '@/studio/starters'
import { inputClass } from '@/studio/ui'
import { StudioShell } from './StudioShell'

const POSTERS: Record<TemplateId, { src: string; bg: string; demo: string }> = {
  orbit: { src: auraPoster, bg: '#09090b', demo: 'AURA' },
  editorial: { src: formHero, bg: '#e7e4dd', demo: 'FORM' },
  gallery: { src: monoPoster, bg: '#d9d5cd', demo: 'MONO' },
}

export default function NewShowroom() {
  const navigate = useNavigate()
  const [template, setTemplate] = useState<TemplateId>('orbit')
  const [mode, setMode] = useState<MediaMode>('true3d')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = 'New showroom · OBJECT.'
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give your product a name. You can change it later.')
    setPending(true)
    try {
      const s = await backend.create({ template, mode, productName: name })
      navigate(`/studio/${s.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create the showroom. Try again.')
      setPending(false)
    }
  }

  return (
    <StudioShell>
      <main className="gutter py-10 md:py-14">
        <form onSubmit={create} className="grid max-w-6xl gap-14">
          <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">New showroom</h1>

          <fieldset className="grid gap-5">
            <legend className="mb-5 text-xl font-semibold tracking-tight">1. Choose a template</legend>
            <div role="radiogroup" aria-label="Template" className="grid gap-4 md:grid-cols-3">
              {(Object.keys(TEMPLATE_INFO) as TemplateId[]).map((id) => {
                const info = TEMPLATE_INFO[id]
                const active = template === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${info.name} template`}
                    aria-describedby={`tpl-${id}`}
                    onClick={() => {
                      setTemplate(id)
                      if (id === 'orbit') setMode('true3d')
                      if (id === 'editorial') setMode('photo')
                    }}
                    className={`group cursor-pointer overflow-hidden rounded-lg text-left ring-1 ring-inset transition-shadow ${active ? 'ring-2 ring-lime' : 'ring-hairline hover:ring-silver/40'}`}
                  >
                    <div className="relative aspect-[5/4] overflow-hidden" style={{ background: POSTERS[id].bg }}>
                      <img src={POSTERS[id].src} alt="" className="size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
                      <span className="meta absolute bottom-2 left-2 rounded-full bg-obsidian/70 px-2 py-1 text-[10px] text-silver backdrop-blur">Example: {POSTERS[id].demo} demo</span>
                      {active && (
                        <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-lime text-obsidian">
                          <Check aria-hidden className="size-4" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="p-5" id={`tpl-${id}`}>
                      <p className="display text-2xl" aria-hidden>
                        {info.name}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-silver">{info.line}</p>
                      <p className="mt-2 text-[13px] text-ash">{info.best}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-5">
            <legend className="mb-5 text-xl font-semibold tracking-tight">2. What do you have?</legend>
            <div role="radiogroup" aria-label="Media" className="grid gap-4 md:grid-cols-2">
              {(
                [
                  { value: 'photo', icon: Images, title: 'Photos', mode: 'Photo Motion', body: 'JPG, PNG or WebP. We animate them with depth and light. They stay photos: no 3D conversion.' },
                  { value: 'true3d', icon: Box, title: 'A 3D model', mode: 'True 3D', body: 'A GLB or glTF file from your designer or 3D tool. Visitors can turn the real object.' },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === o.value}
                  aria-label={`${o.title} (${o.mode})`}
                  onClick={() => setMode(o.value)}
                  className={`flex cursor-pointer gap-4 rounded-lg p-5 text-left ring-1 ring-inset transition-shadow ${mode === o.value ? 'ring-2 ring-lime' : 'ring-hairline hover:ring-silver/40'}`}
                >
                  <o.icon aria-hidden className="mt-0.5 size-6 shrink-0 text-lime" />
                  <span>
                    <span className="block text-lg font-semibold tracking-tight">
                      {o.title} <span className="meta ml-1 text-ash">{o.mode}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-silver">{o.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid max-w-xl gap-3">
            <legend className="mb-5 text-xl font-semibold tracking-tight">3. Name your product</legend>
            <label htmlFor="product-name" className="sr-only">
              Product name
            </label>
            <input
              id="product-name"
              className={`${inputClass} min-h-13 text-lg`}
              value={name}
              maxLength={60}
              placeholder="e.g. Nº 07 Lumière"
              aria-invalid={!!error}
              aria-describedby="name-error"
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
            <p id="name-error" role="alert" className="text-[13px] text-[#ff9d8f]">
              {error}
            </p>
          </fieldset>

          <div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-13 cursor-pointer items-center gap-3 rounded-full bg-lime px-7 text-base font-semibold text-obsidian hover:shadow-[0_10px_40px_-8px_rgb(215_255_67/0.55)] disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? 'Creating…' : 'Create and open the editor'} <ArrowRight aria-hidden className="size-4" />
            </button>
          </div>
        </form>
      </main>
    </StudioShell>
  )
}
