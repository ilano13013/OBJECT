import type { ShowroomTheme, TemplateId } from '@/showroom/types'

export interface ThemePreset {
  id: string
  name: string
  theme: ShowroomTheme
}

const t = (
  background: string,
  surface: string,
  text: string,
  muted: string,
  accent: string,
  onAccent: string,
  displayFont: ShowroomTheme['displayFont'],
): ShowroomTheme => ({ background, surface, text, muted, accent, onAccent, displayFont, bodyFont: 'inter' })

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'obsidian', name: 'Obsidian studio', theme: t('#09090b', '#161618', '#f2f0eb', '#a4a7ab', '#d7ff43', '#09090b', 'archivo-wide') },
  { id: 'champagne', name: 'Champagne noir', theme: t('#09090b', '#141416', '#f2f0eb', '#a4a7ab', '#e8c9a4', '#09090b', 'instrument') },
  { id: 'porcelain', name: 'Porcelain & lime', theme: t('#f2f0eb', '#e4e1da', '#09090b', '#55555b', '#d7ff43', '#09090b', 'archivo-wide') },
  { id: 'plaster', name: 'Gallery plaster', theme: t('#d9d5cd', '#ebe8e2', '#1a1a1c', '#58585c', '#1a1a1c', '#f2f0eb', 'archivo-narrow') },
  { id: 'graphite', name: 'Graphite silver', theme: t('#252529', '#2f2f34', '#f2f0eb', '#b4b7bb', '#bfc3c8', '#09090b', 'inter') },
  { id: 'bone', name: 'Bone & ink', theme: t('#ebe6dc', '#f5f1ea', '#1a1a1c', '#5a5850', '#1a1a1c', '#ebe6dc', 'instrument') },
]

export const DEFAULT_PRESET: Record<TemplateId, string> = {
  orbit: 'obsidian',
  editorial: 'porcelain',
  gallery: 'plaster',
}

export function presetTheme(id: string): ShowroomTheme {
  return { ...(THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]!).theme }
}
