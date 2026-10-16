import { expect, test } from '@playwright/test'

test.describe('landing', () => {
  test('hero, sections and pricing render', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/your product/i)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/new dimension/i)
    await expect(page.getByText('Turn ordinary product pages into extraordinary digital experiences.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: /explore the demo/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create your showroom/i }).first()).toBeVisible()

    for (const id of ['demos', 'how', 'pricing', 'faq']) await expect(page.locator(`#${id}`)).toHaveCount(1)
    await expect(page.locator('#pricing')).toContainText('49')
    await expect(page.locator('#pricing')).toContainText('29')
    await expect(page.locator('#pricing')).toContainText(/limits/i)
    await expect(page.locator('#demos')).toContainText(/not customers/i)
    expect(errors).toEqual([])
  })

  test('FAQ answers expand and are honest about photos', async ({ page }) => {
    await page.goto('/')
    const q = page.getByText('Can I use a simple photo?')
    await q.scrollIntoViewIfNeeded()
    await q.click()
    await expect(page.getByText(/does not convert photos into 3D/i)).toBeVisible()
  })

  test('renders a WebGL canvas when supported', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#main canvas').first()).toBeAttached({ timeout: 20_000 })
  })

  test('falls back without WebGL and never blocks the page', async ({ page }) => {
    await page.goto('/?nowebgl')
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: /explore the demo/i }).click()
    await expect(page).toHaveURL(/\/demo\/aura/)
    await expect(page.getByRole('heading', { name: /lumière/i })).toBeVisible()
  })

  test('respects reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.getByText('Then, sell.')).toBeVisible()
    await ctx.close()
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
