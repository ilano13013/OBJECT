import type { MediaMode, ShowroomConfig, TemplateId } from '@/showroom/types'
import { DEFAULT_PRESET, presetTheme } from './themes'

export const TEMPLATE_INFO: Record<TemplateId, { name: string; line: string; best: string }> = {
  orbit: {
    name: 'Orbit',
    line: 'Black, chrome, studio light. One object at the centre that visitors turn in their hands.',
    best: 'Best with a 3D model: fragrance, watches, tech, jewellery.',
  },
  editorial: {
    name: 'Editorial',
    line: 'Full-bleed imagery, giant type and a story told as you scroll.',
    best: 'Best with 3–5 strong photos: fashion, accessories, drops.',
  },
  gallery: {
    name: 'Gallery',
    line: 'The product as a work of art: a plinth, a wall colour, several angles and a wall label.',
    best: 'Works with a model or photos: objects, ceramics, furniture, art.',
  },
}

/** A fresh, honest starting point: nothing pre-filled that a visitor could mistake for real content. */
export function createStarterConfig(template: TemplateId, mode: MediaMode, productName: string, slug: string): ShowroomConfig {
  const gallery = template === 'gallery'
  return {
    slug,
    template,
    mode,
    isDemo: false,
    brand: '',
    productName: productName.trim(),
    tagline: '',
    description: '',
    price: '',
    purchaseUrl: null,
    purchaseLabel: 'Buy now',
    theme: presetTheme(DEFAULT_PRESET[template]),
    model: undefined,
    images: [],
    features: [],
    chapters: gallery
      ? [
          { id: 'front', title: 'Front', body: '', angle: 0 },
          { id: 'side', title: 'Profile', body: '', angle: Math.PI / 2 },
          { id: 'above', title: 'Above', body: '', angle: Math.PI * 0.25, elevation: 1.15 },
          { id: 'detail', title: 'Detail', body: '', angle: Math.PI * 1.25, elevation: 0.15, zoom: 1.9 },
        ]
      : [],
    details: [],
    animation: { entrance: template === 'orbit' ? 'orbit' : template === 'editorial' ? 'rise' : 'fade', speed: 1, autoRotate: template === 'orbit' },
    backdrops: gallery ? ['#d9d5cd', '#1d1d20', '#b9bcc0', '#e8dccb'] : undefined,
  }
}
