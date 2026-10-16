// Renders the demo posters and FORM imagery from the procedural models.
// Requires the dev server (npm run dev) on :5173. Outputs PNG; convert with
// scripts/to-webp.py. These are labelled studio renders, not photographs.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.argv[2] ?? 'renders-png'
mkdirSync(OUT, { recursive: true })

const shots = [
  { name: 'aura-poster', id: 'aura-bottle', w: 800, h: 1000, q: { bg: '#09090b', rx: 0.12, ry: -0.5, y: 0.25, z: 7.5, backlight: '#f3dcc0' } },
  { name: 'form-hero', id: 'form-cuff', w: 1200, h: 1500, q: { bg: '#e7e4dd', rx: 0.9, ry: -0.5, rz: 0.3, z: 6.6 } },
  { name: 'form-side', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#dcd8cf', rx: 0.15, ry: 1.25, rz: 0.1, z: 5.4 } },
  { name: 'form-top', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#1b1b1e', rx: 1.35, ry: 0.0, rz: 2.6, z: 5.6, accent: '#d7ff43' } },
  { name: 'form-detail', id: 'form-cuff', w: 1600, h: 1000, q: { bg: '#e7e4dd', rx: 0.55, ry: -1.0, rz: 0.4, z: 2.9, y: -0.35 } },
  { name: 'mono-poster', id: 'mono-vase', w: 800, h: 1000, q: { bg: '#d9d5cd', rx: 0.05, ry: 0, z: 7.5, y: 0.2, env: 0.45, spot: 18, amb: 0.25 } },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
  const qs = new URLSearchParams(Object.entries(s.q).map(([k, v]) => [k, String(v)]))
  await page.goto(`${BASE}/__capture/${s.id}?${qs}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/${s.name}.png` })
  await page.close()
  console.log('rendered', s.name)
}
await browser.close()
