// Renders the demo posters and FORM imagery from the procedural models.
// Requires the dev server (npm run dev) on :5173. Outputs PNG; convert with
// scripts/to-webp.py. These are labelled studio renders, not photographs.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.argv[2] ?? 'renders-png'
mkdirSync(OUT, { recursive: true })

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const shots = [
  { name: 'aura-poster', id: 'aura-bottle', w: 800, h: 1000, q: { bg: '#09090b', rx: 0.12, ry: -0.5, y: 0.25, z: 7.5, backlight: '#f3dcc0' } },
  { name: 'form-hero', id: 'form-cuff', w: 1200, h: 1500, q: { bg: '#e7e4dd', rx: 0.9, ry: -0.5, rz: 0.3, z: 6.6 } },
  { name: 'form-side', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#dcd8cf', rx: 0.15, ry: 1.25, rz: 0.1, z: 5.4 } },
  { name: 'form-top', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#1b1b1e', rx: 1.35, ry: 0.0, rz: 2.6, z: 5.6, accent: '#d7ff43' } },
  { name: 'form-detail', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#e7e4dd', rx: 0.55, ry: -1.0, rz: 0.4, z: 2.9, y: -0.35 } },
  // Cut-outs (transparent background) for the landing's hover preview.
  // Glass needs something behind it: rendered on black and on white, the
  // difference gives true transparency (to-webp.py), backlight glow included.
  { name: 'aura-cutout', id: 'aura-bottle', w: 900, h: 1100, matte: true, q: { rx: 0.12, ry: -0.5, y: 0.25, z: 7.2, backlight: '#f3dcc0' } },
  { name: 'form-cutout', id: 'form-cuff', w: 1000, h: 1000, q: { bg: 'transparent', rx: 0.9, ry: -0.5, rz: 0.3, z: 6.2 } },
  { name: 'mono-cutout', id: 'mono-vase', w: 900, h: 1100, q: { bg: 'transparent', rx: 0.05, ry: 0, z: 7.2, y: 0.2, env: 0.9, spot: 30, amb: 0.3 } },
  { name: 'mono-poster', id: 'mono-vase', w: 800, h: 1000, q: { bg: '#d9d5cd', rx: 0.05, ry: 0, z: 7.5, y: 0.2, env: 0.45, spot: 18, amb: 0.25 } },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
for (const s of shots.filter((x) => !only || only.test(x.name))) {
  const passes = s.matte ? [['#000000', '.black'], ['#ffffff', '.white']] : [[s.q.bg, '']]
  for (const [bg, suffix] of passes) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
    const qs = new URLSearchParams(Object.entries({ ...s.q, bg }).map(([k, v]) => [k, String(v)]))
    await page.goto(`${BASE}/__capture/${s.id}?${qs}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${OUT}/${s.name}${suffix}.png`, omitBackground: bg === 'transparent' })
    await page.close()
  }
  console.log('rendered', s.name)
}
await browser.close()
