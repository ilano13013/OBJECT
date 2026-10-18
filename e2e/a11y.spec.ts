import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PAGES = ['/', '/demo/aura', '/demo/form', '/demo/mono', '/studio', '/studio/new', '/login', '/account']
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const path of PAGES) {
  test(`WCAG 2.2 AA (axe-core): ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForTimeout(1500)
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
}

test('WCAG 2.2 AA (axe-core): editor and statistics', async ({ page }) => {
  await page.goto('/studio/new')
  await page.getByLabel('Product name').fill('A11y')
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page).toHaveURL(/\/studio\/[^/]+$/)
  let r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(r.violations.map((v) => v.id)).toEqual([])
  await page.goto(page.url() + '/stats')
  await page.waitForTimeout(800)
  r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(r.violations.map((v) => v.id)).toEqual([])
})
