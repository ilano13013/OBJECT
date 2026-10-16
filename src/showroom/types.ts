/**
 * The single data model a showroom is rendered from. Demo showrooms, the
 * editor preview and published pages all feed this same shape into
 * <ShowroomRenderer>, so what a merchant previews is what visitors get.
 */

export type TemplateId = 'orbit' | 'editorial' | 'gallery'

/**
 * photo — Photo Motion: 2D images animated with depth and parallax.
 *         Never presented as a 3D model.
 * true3d — True 3D: an actual 3D model (GLB/glTF or built-in) rendered live.
 */
export type MediaMode = 'photo' | 'true3d'

export type FontId = 'archivo-wide' | 'archivo-narrow' | 'instrument' | 'inter'

export type ProceduralModelId = 'aura-bottle' | 'form-cuff' | 'mono-vase'

export type ModelSource =
  | { kind: 'procedural'; id: ProceduralModelId }
  | { kind: 'gltf'; url: string }

export interface ShowroomTheme {
  background: string
  surface: string
  text: string
  muted: string
  accent: string
  /** Text colour used on top of `accent` (buttons). */
  onAccent: string
  displayFont: FontId
  bodyFont: FontId
}

export interface ShowroomImage {
  src: string
  alt: string
}

export interface ShowroomFeature {
  id: string
  title: string
  body: string
  /** Position on the model for Orbit hotspots, in model space. */
  hotspot?: [number, number, number]
}

export interface ShowroomChapter {
  id: string
  title: string
  body: string
  /** Index into `images` for Editorial; camera angle (radians) for 3D templates. */
  image?: number
  angle?: number
  /** Camera elevation (radians) for 3D templates; 0 is eye level. */
  elevation?: number
  /** Camera zoom factor for 3D templates; 1 is the default framing. */
  zoom?: number
}

export interface ShowroomDetail {
  label: string
  value: string
}

export interface ShowroomAnimation {
  entrance: 'rise' | 'fade' | 'orbit'
  /** 0.5 – 2, multiplies all motion durations and rotation speed. */
  speed: number
  autoRotate: boolean
}

export interface ShowroomConfig {
  slug: string
  template: TemplateId
  mode: MediaMode
  /** Fictional brands used to demonstrate OBJECT. Rendered with a visible notice. */
  isDemo: boolean
  brand: string
  productName: string
  tagline: string
  description: string
  price?: string
  purchaseUrl: string | null
  purchaseLabel: string
  theme: ShowroomTheme
  model?: ModelSource
  images: ShowroomImage[]
  features: ShowroomFeature[]
  chapters: ShowroomChapter[]
  details: ShowroomDetail[]
  animation: ShowroomAnimation
  /** Gallery: selectable wall colours. */
  backdrops?: string[]
}
