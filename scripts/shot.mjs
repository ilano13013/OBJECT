// Dev helper: screenshot URLs with the preinstalled Chromium.
// usage: node scripts/shot.mjs <url> <out.png> [width] [height] [scrollY] [waitMs] [fullPage]
import { chromium } from '@playwright/test'
const [url, out, w = '1440', h = '900', scrollY = '0', wait = '3500', full = ''] = process.argv.slice(2)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' })
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle' })
if (+scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), +scrollY)
}
await page.waitForTimeout(+wait)
await page.screenshot({ path: out, fullPage: !!full })
console.log(logs.slice(0, 15).join('\n') || 'no console errors')
await browser.close()
