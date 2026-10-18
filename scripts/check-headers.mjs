// Keeps vercel.json's headers identical to security-headers.json (used by `vite preview`).
import { readFileSync } from 'node:fs'
const expected = JSON.parse(readFileSync(new URL('../security-headers.json', import.meta.url)))
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
const all = vercel.headers.find((h) => h.source === '/(.*)')
const got = Object.fromEntries(all.headers.map((h) => [h.key, h.value]))
const diff = Object.keys(expected).filter((k) => expected[k] !== got[k])
if (diff.length) {
  console.error('vercel.json headers differ from security-headers.json:', diff.join(', '))
  process.exit(1)
}
console.log('security headers in sync')
