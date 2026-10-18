import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

/**
 * Studio form primitives. Operate-mode surfaces: quiet graphite, hairlines,
 * lime reserved for the one primary action and the focus ring.
 */

export const inputClass =
  'w-full min-h-11 rounded-md bg-graphite-2 px-3 py-2 text-[15px] text-porcelain ring-1 ring-inset ring-hairline placeholder:text-ash transition-shadow hover:ring-silver/30 focus:outline-none focus:ring-2 focus:ring-lime aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#ff8a7a]'

export function Section({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `panel-${id}`
  return (
    <section id={`section-${id}`} className="border-b border-hairline">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold tracking-tight text-porcelain">{title}</span>
            {summary && !open && <span className="truncate text-xs text-ash">{summary}</span>}
          </span>
          <ChevronDown aria-hidden className={`size-4 shrink-0 text-ash transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="space-y-5 px-5 pb-6">
        {children}
      </div>
    </section>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-silver">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-ash">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  maxLength = 120,
  type = 'text',
  id: idProp,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: ReactNode
  error?: string | null
  maxLength?: number
  type?: 'text' | 'url'
  id?: string
}) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        type={type}
        inputMode={type === 'url' ? 'url' : undefined}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength = 600,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  maxLength?: number
  rows?: number
}) {
  const id = useId()
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        <span className="flex justify-between gap-4">
          <span>{hint}</span>
          <span className="tabular-nums">
            {value.length}/{maxLength}
          </span>
        </span>
      }
    >
      <textarea
        id={id}
        rows={rows}
        className={`${inputClass} resize-y leading-relaxed`}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: string
}) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className={`${inputClass} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-graphite-2 p-1 ring-1 ring-inset ring-hairline">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-porcelain text-obsidian' : 'text-silver hover:text-porcelain'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(1),
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[13px]">
        <label htmlFor={id} className="font-medium text-silver">
          {label}
        </label>
        <span className="tabular-nums text-ash">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-lime"
      />
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-silver">
          {label}
        </label>
        {hint && <p className="text-[13px] text-ash">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? 'bg-lime' : 'bg-graphite ring-1 ring-inset ring-hairline'}`}
      >
        <span className={`inline-block size-5 rounded-full transition-transform ${checked ? 'translate-x-6 bg-obsidian' : 'translate-x-1 bg-silver'}`} />
      </button>
    </div>
  )
}

export function ColorInput({ label, value, onChange, note }: { label: string; value: string; onChange: (v: string) => void; note?: ReactNode }) {
  const id = useId()
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium text-silver">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-md bg-transparent ring-1 ring-inset ring-hairline"
        />
        <input
          id={id}
          className={`${inputClass} font-mono text-sm uppercase`}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value)
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase())
          }}
        />
      </div>
      {note}
    </div>
  )
}

export function SmallButton({
  children,
  onClick,
  tone = 'default',
  label,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-silver hover:bg-white/5 hover:text-porcelain'
      }`}
    >
      {children}
    </button>
  )
}
