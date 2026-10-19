import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`../e2e/fixtures/${name}`, import.meta.url))
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/object_stack'
const sql = (q: string) => execFileSync('psql', [DB, '-Atqc', q], { encoding: 'utf8' }).trim()
const run = Date.now().toString(36)

test('a showroom published by one merchant appears in everyone’s gallery until unlisted', async ({ page, browser }) => {
  const email = `wall-${run}@example.com`
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name or brand').fill('Atelier Wall')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  sql(`update workspaces set bonus_publish_slots = 2 where owner_id = (select id from auth.users where email = '${email}')`)

  const name = `Wall Vase ${run}`
  await page.goto('/studio/new')
  await page.getByRole('radio', { name: /orbit template/i }).click()
  await page.getByRole('radio', { name: /^photos/i }).click()
  await page.getByLabel('Product name').fill(name)
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.getByPlaceholder('Describe this image').fill('Stoneware vase')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^publish$/i }).click()
  const toggle = page.getByRole('dialog').getByRole('switch', { name: 'Show in the OBJECT. gallery' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  // A visitor who is not signed in.
  const visitor = await browser.newPage()
  await visitor.goto('/gallery')
  await visitor.getByLabel('Search the gallery').fill(run)
  const card = visitor.getByRole('region', { name: 'Showrooms' }).getByRole('link', { name: new RegExp(name, 'i') })
  await expect(card).toBeVisible()
  await expect(visitor.getByRole('img', { name: 'Stoneware vase' })).toBeVisible() // cover read from private storage, published only
  await card.click()
  await expect(visitor).toHaveURL(/\/s\/wall-vase-/)

  // Unlisted by the owner: gone from the gallery, still reachable by its link.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await visitor.goto('/gallery')
  await visitor.getByLabel('Search the gallery').fill(run)
  await expect(visitor.getByText(/nothing matches/i)).toBeVisible()
  await visitor.close()
})
