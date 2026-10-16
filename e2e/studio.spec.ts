import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

async function createShowroom(page: Page, name: string, template: RegExp, mode: RegExp) {
  await page.goto('/studio/new')
  await page.getByRole('radio', { name: template }).click()
  await page.getByRole('radio', { name: mode }).click()
  await page.getByLabel('Product name').fill(name)
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page).toHaveURL(/\/studio\/[^/]+$/)
}

/** On phones the settings live behind the Edit tab. */
async function showSettings(page: Page) {
  const edit = page.getByRole('tab', { name: 'Edit' })
  if (await edit.isVisible()) await edit.click()
}

test('create, edit, publish, view, unpublish a Photo Motion showroom', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await createShowroom(page, 'Cuff 02', /editorial template/i, /^photos/i)
  await showSettings(page)

  // Publishing too early explains what is missing.
  await page.getByRole('button', { name: /^publish$/i }).click()
  await expect(page.getByRole('dialog')).toContainText(/photo motion needs at least one image/i)
  await page.getByRole('button', { name: 'Back to editing' }).click()

  // A fake image is refused by its bytes.
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('not-an-image.png'))
  await expect(page.getByRole('alert').filter({ hasText: /isn’t a JPG, PNG or WebP/ })).toBeVisible()

  // A real one is accepted.
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.getByPlaceholder('Describe this image').fill('Titanium cuff, side view')
  await page.getByLabel('Tagline').fill('Worn like architecture.')

  // Unsafe purchase links are flagged and not applied.
  await page.getByRole('button', { name: /purchase button/i }).click()
  await page.getByLabel('Link to your store').fill('javascript:alert(1)')
  await expect(page.getByText(/enter a full address starting with https/i)).toBeVisible()
  await page.getByLabel('Link to your store').fill('https://shop.example.com/cuff-02')

  // Live preview reflects edits.
  const preview = page.getByRole('main', { name: 'Live preview' })
  if (!(await preview.isVisible())) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(preview).toContainText('Worn like architecture.')
  await expect(preview).toContainText(/photo motion/i)
  await showSettings(page)

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^publish$/i }).click()
  await expect(page.getByRole('dialog')).toContainText('Your showroom is live')
  await expect(page.getByLabel('Public link')).toHaveValue(/\/s\/cuff-02$/)
  await page.getByRole('link', { name: 'Open showroom' }).click()

  await expect(page).toHaveURL(/\/s\/cuff-02$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cuff/i)
  const buy = page.getByRole('link', { name: /buy now/i })
  await expect(buy).toHaveAttribute('href', 'https://shop.example.com/cuff-02')
  await expect(buy).toHaveAttribute('rel', /noopener/)

  // Reload: it was really saved.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cuff/i)

  // Unpublish from the studio, and the public link stops working.
  await page.goto('/studio')
  await page.getByRole('link', { name: 'Edit Cuff 02' }).click()
  await page.getByRole('button', { name: 'Live' }).click()
  await page.getByRole('button', { name: 'Unpublish…' }).click()
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await page.goto('/s/cuff-02')
  await expect(page.getByText('404')).toBeVisible()
  expect(errors).toEqual([])
})

test('True 3D showroom renders an uploaded GLB model', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await createShowroom(page, 'Cube', /orbit template/i, /^a 3d model/i)
  await showSettings(page)
  await page.locator('input[type=file][accept^=".glb"]').setInputFiles(fixture('cube.glb'))
  await expect(page.getByText('cube.glb')).toBeVisible()
  const preview = page.getByRole('main', { name: 'Live preview' })
  if (!(await preview.isVisible())) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(preview.locator('canvas')).toBeAttached({ timeout: 20_000 })
  await expect(preview).toContainText(/true 3d/i)
  await expect(preview.getByText('3D preview unavailable')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('studio list: duplicate and delete', async ({ page }) => {
  await createShowroom(page, 'Vessel IV', /gallery template/i, /^photos/i)
  await page.goto('/studio')
  await expect(page.getByRole('link', { name: 'Edit Vessel IV', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page).toHaveURL(/\/studio\/[^/]+$/)
  await page.goto('/studio')
  await expect(page.getByRole('link', { name: 'Edit Vessel IV (copy)' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Vessel IV (copy)' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Edit Vessel IV (copy)' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit Vessel IV', exact: true })).toBeVisible()
})

test('new showroom requires a name', async ({ page }) => {
  await page.goto('/studio/new')
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page.getByText(/give your product a name/i)).toBeVisible()
  await expect(page).toHaveURL(/\/studio\/new$/)
})
