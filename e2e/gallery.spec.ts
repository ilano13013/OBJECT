import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

test('the gallery shows published showrooms as a wall, with labelled demos, search and filters', async ({ page }) => {
  // A published showroom from this browser (local mode).
  await page.goto('/studio/new')
  await page.getByRole('radio', { name: /gallery template/i }).click()
  await page.getByRole('radio', { name: /^photos/i }).click()
  await page.getByLabel('Product name').fill('Linen Lamp')
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  const edit = page.getByRole('tab', { name: 'Edit' })
  if (await edit.isVisible()) await edit.click()
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.getByPlaceholder('Describe this image').fill('Linen lamp, lit')
  await page.getByRole('button', { name: /^publish$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('switch', { name: 'Show in the OBJECT. gallery' })).toHaveAttribute('aria-checked', 'true')

  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Gallery' }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', level: 1 })).toBeVisible()
  const wall = page.getByRole('region', { name: 'Showrooms' })
  await expect(wall.getByRole('link', { name: /linen lamp/i })).toBeVisible()
  await expect(wall.getByRole('img', { name: 'Linen lamp, lit' })).toBeVisible()
  // Demos are always labelled as fictional.
  await expect(wall.getByText(/^Demo/)).toHaveCount(3)

  await page.getByLabel('Search the gallery').fill('linen')
  await expect(wall.getByRole('listitem')).toHaveCount(1)
  await page.getByLabel('Search the gallery').fill('')
  await page.getByRole('radio', { name: 'True 3D' }).click()
  await expect(wall.getByRole('link', { name: /linen lamp/i })).toHaveCount(0)
  await expect(wall.getByRole('link', { name: /lumière/i })).toBeVisible()
  await page.getByRole('radio', { name: 'All' }).click()

  await wall.getByRole('link', { name: /linen lamp/i }).click()
  await expect(page).toHaveURL(/\/s\/linen-lamp$/)

  // Taken out of the gallery by its owner.
  await page.goto('/studio')
  await page.getByRole('link', { name: /linen lamp/i }).first().click()
  if (await edit.isVisible()) await edit.click()
  await page.getByRole('button', { name: /^live$/i }).click()
  await page.getByRole('switch', { name: 'Show in the OBJECT. gallery' }).click()
  await page.goto('/gallery')
  await expect(page.getByRole('region', { name: 'Showrooms' }).getByText(/^Demo/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /linen lamp/i })).toHaveCount(0)
})
