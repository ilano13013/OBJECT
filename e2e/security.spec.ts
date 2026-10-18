import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

test('production security headers are sent', async ({ request }) => {
  const res = await request.get('/')
  const h = res.headers()
  expect(h['content-security-policy']).toContain("default-src 'self'")
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect((await request.get('/robots.txt')).headers()['content-type']).toContain('text/plain')
})

test('no Content Security Policy violation across the site, 3D and uploads included', async ({ page }) => {
  const violations: string[] = []
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      ;(window as unknown as { __csp: string[] }).__csp ??= []
      ;(window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })
  page.on('console', (m) => m.text().includes('Content Security Policy') && violations.push(m.text().slice(0, 200)))
  const collect = async () => violations.push(...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])) as string[]))

  for (const path of ['/', '/demo/aura', '/demo/form', '/demo/mono']) {
    await page.goto(path)
    await page.waitForTimeout(3000)
    await collect()
  }
  // Studio: blob images and a GLB parsed in the browser.
  await page.goto('/studio/new')
  await page.getByRole('radio', { name: /orbit template/i }).click()
  await page.getByLabel('Product name').fill('CSP check')
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page).toHaveURL(/\/studio\/[^/]+$/)
  const settings = page.getByRole('tab', { name: 'Edit' })
  if (await settings.isVisible()) await settings.click()
  await page.locator('input[type=file][accept^=".glb"]').setInputFiles(fixture('cube.glb'))
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.waitForTimeout(3000)
  await collect()
  expect(violations).toEqual([])
})
