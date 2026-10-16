/**
 * Commercial offers. Prices are display values; the server (Stripe price IDs
 * and quota checks) is the source of truth once billing ships in Phase D.
 */
export type PlanId = 'one' | 'studio'

export interface Plan {
  id: PlanId
  name: string
  price: number
  currency: 'EUR'
  cadence: 'per showroom' | 'per month'
  pitch: string
  includes: string[]
  limits: string[]
}

export const STUDIO_DEFAULT_QUOTA = { showrooms: 5, storageMb: 1024, uploadMb: 50 }
export const ONE_LIMITS = { storageMb: 200, uploadMb: 50 }

export const PLANS: Plan[] = [
  {
    id: 'one',
    name: 'One Showroom',
    price: 49,
    currency: 'EUR',
    cadence: 'per showroom',
    pitch: 'One product, one unforgettable page. Pay once, keep it live.',
    includes: [
      '1 published showroom on an object. URL',
      'All three templates — Orbit, Editorial, Gallery',
      'Photo Motion and True 3D modes',
      'Edit and republish at any time',
      'View and purchase-click statistics',
    ],
    limits: [
      `Up to ${ONE_LIMITS.storageMb} MB of media`,
      `Files up to ${ONE_LIMITS.uploadMb} MB each (JPG, PNG, WebP, GLB, glTF)`,
      'Commercial use for your own products',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 29,
    currency: 'EUR',
    cadence: 'per month',
    pitch: 'A living collection for brands that launch often.',
    includes: [
      `Up to ${STUDIO_DEFAULT_QUOTA.showrooms} published showrooms (quota adjustable)`,
      'Unlimited drafts',
      'All templates and both modes',
      '7- and 30-day statistics per showroom',
      'Billing portal: change or cancel anytime',
    ],
    limits: [
      `${STUDIO_DEFAULT_QUOTA.storageMb / 1024} GB of media across the workspace`,
      `Files up to ${STUDIO_DEFAULT_QUOTA.uploadMb} MB each`,
      'If you cancel, showrooms unpublish at the end of the paid period — drafts are kept',
    ],
  },
]

export function formatPrice(plan: Plan) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(plan.price)
}
