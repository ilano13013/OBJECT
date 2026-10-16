import type { ShowroomConfig } from './types'

/**
 * Three fictional brands that demonstrate what OBJECT. produces.
 * They are not customers. Products are modelled procedurally in Three.js and
 * any imagery is a studio render of those models, labelled as such.
 */

export const AURA: ShowroomConfig = {
  slug: 'aura',
  template: 'orbit',
  mode: 'true3d',
  isDemo: true,
  brand: 'AURA',
  productName: 'Nº 07 Lumière',
  tagline: 'A fragrance that bends the light around you.',
  description:
    'Amber resin, white tea and a cold mineral edge, held in a weighted crystal flacon with a mirror-polished cap. Drag to turn it in your hand.',
  price: '148 € · 50 ml',
  purchaseUrl: 'https://example.com/aura-demo',
  purchaseLabel: 'Buy Nº 07',
  theme: {
    background: '#09090b',
    surface: '#141416',
    text: '#f2f0eb',
    muted: '#a4a7ab',
    accent: '#e8c9a4',
    onAccent: '#09090b',
    displayFont: 'instrument',
    bodyFont: 'inter',
  },
  model: { kind: 'procedural', id: 'aura-bottle' },
  images: [],
  features: [
    { id: 'cap', title: 'Mirror cap', body: 'Solid zamak, hand-polished to a liquid finish.', hotspot: [0.42, 1.42, 0.2] },
    { id: 'glass', title: 'Weighted crystal', body: 'An 11 mm base that catches and splits studio light.', hotspot: [0.62, -0.75, 0.25] },
    { id: 'juice', title: 'Amber resin heart', body: 'Top: white tea. Heart: iris. Base: amber resin and musk.', hotspot: [-0.38, 0.05, 0.22] },
  ],
  chapters: [],
  details: [
    { label: 'Concentration', value: 'Eau de parfum, 18 %' },
    { label: 'Volume', value: '50 ml' },
    { label: 'Family', value: 'Amber mineral' },
  ],
  animation: { entrance: 'orbit', speed: 1, autoRotate: true },
}

export const FORM: ShowroomConfig = {
  slug: 'form',
  template: 'editorial',
  mode: 'photo',
  isDemo: true,
  brand: 'FORM',
  productName: 'Cuff 01',
  tagline: 'Worn like architecture.',
  description:
    'A single sweep of brushed titanium, open at the wrist, lined in electric enamel. Machined from one billet, finished by hand.',
  price: '320 €',
  purchaseUrl: 'https://example.com/form-demo',
  purchaseLabel: 'Order Cuff 01',
  theme: {
    background: '#f2f0eb',
    surface: '#e4e1da',
    text: '#09090b',
    muted: '#55555b',
    accent: '#d7ff43',
    onAccent: '#09090b',
    displayFont: 'archivo-wide',
    bodyFont: 'inter',
  },
  images: [
    { src: '/renders/form-hero.webp', alt: 'Cuff 01 in brushed titanium, three-quarter view on a porcelain background' },
    { src: '/renders/form-side.webp', alt: 'Cuff 01 seen from the side, showing the open gap' },
    { src: '/renders/form-top.webp', alt: 'Cuff 01 from above, revealing the lime enamel lining' },
    { src: '/renders/form-detail.webp', alt: 'Close-up of the cuff edge and its brushed finish' },
  ],
  features: [
    { id: 'billet', title: 'One billet', body: 'Machined from a single block of grade 5 titanium. No joins, no solder.' },
    { id: 'enamel', title: 'Electric lining', body: 'Kiln-fired enamel inside the curve: only the wearer sees it whole.' },
    { id: 'fit', title: 'Open fit', body: 'A 24 mm opening flexes once to your wrist, then holds its line.' },
  ],
  chapters: [
    { id: 'line', title: 'One line', body: 'Drawn as a single gesture: a curve that refuses to close.', image: 1 },
    { id: 'inside', title: 'Lime inside', body: 'A colour you carry against the skin, revealed only in motion.', image: 2 },
    { id: 'edge', title: 'The edge', body: 'Brushed by hand along the grain until it reads like silk.', image: 3 },
  ],
  details: [
    { label: 'Material', value: 'Grade 5 titanium, enamel' },
    { label: 'Weight', value: '38 g' },
    { label: 'Sizes', value: 'S · M · L' },
    { label: 'Made in', value: 'Small series, numbered' },
  ],
  animation: { entrance: 'rise', speed: 1, autoRotate: false },
}

export const MONO: ShowroomConfig = {
  slug: 'mono',
  template: 'gallery',
  mode: 'true3d',
  isDemo: true,
  brand: 'MONO',
  productName: 'Vessel III',
  tagline: 'An object that asks for a room around it.',
  description:
    'A hand-thrown stoneware vessel with a narrow neck and a chalk-matte glaze. Shown here the way a gallery would show it: alone, lit, with space to look.',
  price: '210 €',
  purchaseUrl: 'https://example.com/mono-demo',
  purchaseLabel: 'Acquire Vessel III',
  theme: {
    background: '#d9d5cd',
    surface: '#ebe8e2',
    text: '#1a1a1c',
    muted: '#58585c',
    accent: '#1a1a1c',
    onAccent: '#f2f0eb',
    displayFont: 'archivo-narrow',
    bodyFont: 'inter',
  },
  model: { kind: 'procedural', id: 'mono-vase' },
  images: [],
  features: [],
  chapters: [
    { id: 'front', title: 'Front', body: 'Silhouette: a shoulder that rises and pinches into the neck.', angle: 0 },
    { id: 'side', title: 'Profile', body: 'The throw lines stay visible: proof of the wheel.', angle: Math.PI / 2 },
    { id: 'above', title: 'Above', body: 'An 18 mm mouth sized for a single stem.', angle: Math.PI * 0.25, elevation: 1.15 },
    { id: 'detail', title: 'Glaze', body: 'Chalk glaze, fired at 1 280 °C, dry to the touch.', angle: Math.PI * 1.25, elevation: 0.15, zoom: 1.9 },
  ],
  details: [
    { label: 'Maker', value: 'MONO studio (fictional)' },
    { label: 'Medium', value: 'Stoneware, chalk glaze' },
    { label: 'Dimensions', value: 'H 34 × Ø 16 cm' },
    { label: 'Edition', value: '1 of 40' },
  ],
  animation: { entrance: 'fade', speed: 1, autoRotate: false },
  backdrops: ['#d9d5cd', '#1d1d20', '#b9bcc0', '#e8dccb'],
}

export const DEMOS: ShowroomConfig[] = [AURA, FORM, MONO]

export function getDemo(slug: string | undefined): ShowroomConfig | undefined {
  return DEMOS.find((d) => d.slug === slug)
}
