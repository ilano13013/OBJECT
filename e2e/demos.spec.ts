import { expect, test } from '@playwright/test'

const DEMOS = [
  { slug: 'aura', title: /lumière/i, mode: 'True 3D' },
  { slug: 'form', title: /cuff/i, mode: 'Photo Motion' },
  { slug: 'mono', title: /vessel iii/i, mode: 'True 3D' },
]

for (const d of DEMOS) {
  test(`${d.slug} demo is labelled fictional and honest about its mode`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/demo/${d.slug}`)
    await expect(page.getByRole('note')).toContainText(/fictional brand/i)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(d.title)
    await expect(page.getByText(d.mode, { exact: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('demo purchase button explains instead of leaving the site', async ({ page }) => {
  await page.goto('/demo/aura')
  const buy = page.getByRole('button', { name: /buy nº 07/i })
  await buy.click()
  await expect(page).toHaveURL(/\/demo\/aura$/)
  await expect(page.getByText(/nothing is sold here/i)).toBeVisible()
})

test('gallery navigates between views by button and keyboard', async ({ page }) => {
  await page.goto('/demo/mono')
  await expect(page.getByText(/01 \/ 04/)).toBeVisible()
  await page.getByRole('button', { name: 'Next view' }).click()
  await expect(page.getByText(/02 \/ 04/)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(/03 \/ 04/)).toBeVisible()
  await page.getByRole('radio', { name: /#1d1d20/ }).click()
  await expect(page.getByRole('radio', { name: /#1d1d20/ })).toHaveAttribute('aria-checked', 'true')
})

test('unknown demo shows 404', async ({ page }) => {
  await page.goto('/demo/does-not-exist')
  await expect(page.getByText('404')).toBeVisible()
})

test('create page does not pretend checkout exists', async ({ page }) => {
  await page.goto('/create?plan=studio')
  await expect(page.getByText(/nothing can be purchased at this stage/i)).toBeVisible()
})
