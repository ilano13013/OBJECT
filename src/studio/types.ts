import type { ShowroomConfig } from '@/showroom/types'

export type ShowroomStatus = 'draft' | 'published'

/** One showroom as the studio stores it: an editable draft plus the live snapshot. */
export interface StudioShowroom {
  id: string
  slug: string
  status: ShowroomStatus
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  /** What the editor changes. */
  draft: ShowroomConfig
  /** What visitors see. Only replaced when the merchant publishes again. */
  published: ShowroomConfig | null
}

export type AssetKind = 'image' | 'model'

export interface AssetMeta {
  id: string
  showroomId: string
  kind: AssetKind
  name: string
  mime: string
  size: number
  createdAt: string
}
