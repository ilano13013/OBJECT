import { EditorialTemplate } from './templates/EditorialTemplate'
import { GalleryTemplate } from './templates/GalleryTemplate'
import { OrbitTemplate } from './templates/OrbitTemplate'
import type { ShowroomConfig } from './types'

/** Renders any showroom config with its template. Used by demos, preview and public pages. */
export function ShowroomRenderer({ config }: { config: ShowroomConfig }) {
  switch (config.template) {
    case 'orbit':
      return <OrbitTemplate config={config} />
    case 'editorial':
      return <EditorialTemplate config={config} />
    case 'gallery':
      return <GalleryTemplate config={config} />
  }
}
