import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`../e2e/fixtures/${name}`, import.meta.url))
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/object_stack'
const run = Date.now().toString(36)
const alice = { email: `alice-${run}@example.com`, password: 'correct-horse-battery' }
const bruno = { email: `bruno-${run}@example.com`, password: 'another-long-password' }
let editorUrl = ''
let slug = ''

function sql(query: string) {
  return execFileSync('psql', [DB, '-Atqc', query], { encoding: 'utf8' }).trim()
}

async function signUp(page: Page, who: { email: string; password: string }, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name or brand').fill(name)
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(who.password)
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}

test.describe.configure({ mode: 'serial' })

test('signed-out visitors are sent to sign in, then brought back', async ({ page }) => {
  await page.goto('/studio/new')
  await expect(page).toHaveURL(/\/login\?next=%2Fstudio%2Fnew/)
  await page.getByLabel('Email').fill('nobody@example.com')
  await page.getByLabel('Password').fill('wrong-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText(/don’t match/)
})

test('a merchant signs up, builds a showroom, is held by the publish quota, then publishes', async ({ page }) => {
  await signUp(page, alice, 'Alice Studio')
  await expect(page.getByText(/no showrooms yet/i)).toBeVisible()
  await expect(page.getByText(/local mode/i)).toHaveCount(0)

  await page.getByRole('link', { name: /create your first showroom/i }).click()
  await page.getByRole('radio', { name: /editorial template/i }).click()
  await page.getByRole('radio', { name: /^photos/i }).click()
  await page.getByLabel('Product name').fill('Cloud Cuff')
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/)
  editorUrl = page.url()

  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.getByPlaceholder('Describe this image').fill('Titanium cuff, side view')
  await page.getByLabel('Tagline').fill('Stored in the cloud.')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 })

  // The server refuses: no plan, no slot.
  await page.getByRole('button', { name: /^publish$/i }).click()
  await expect(page.getByRole('dialog')).toContainText(/no free publishing slot/i)
  await page.getByRole('button', { name: 'Back to editing' }).click()

  // An operator grants one slot (Phase D: a paid order or subscription does this).
  sql(`update public.workspaces set bonus_publish_slots = 1 where owner_id = (select id from auth.users where email = '${alice.email}')`)
  await page.getByRole('button', { name: /^publish$/i }).click()
  await expect(page.getByRole('dialog')).toContainText('Your showroom is live')
  slug = (await page.getByLabel('Public link').inputValue()).split('/s/')[1]!
  expect(slug).toMatch(/^cloud-cuff(-\d+)?$/)

  // Changes after publishing stay private until republished.
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByLabel('Tagline').fill('Draft change, not public yet.')
  await expect(page.getByText('Live, with unpublished changes')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('anyone can open the public link, from any browser, and visits are counted', async ({ browser }) => {
  const ctx = await browser.newContext()
  const visitor = await ctx.newPage()
  await visitor.goto(`/s/${slug}`)
  await expect(visitor.getByRole('heading', { level: 1 })).toContainText(/cloud/i)
  await expect(visitor.getByText('Stored in the cloud.')).toBeVisible()
  await expect(visitor.getByText('Draft change, not public yet.')).toHaveCount(0)
  // The uploaded image streams from Storage under the published-only policy.
  await expect(visitor.locator('img[alt="Titanium cuff, side view"]')).toHaveAttribute('src', /^blob:/, { timeout: 15_000 })
  await ctx.close()
  await expect.poll(() => Number(sql(`select count(*) from public.showroom_analytics a join public.showrooms s on s.id = a.showroom_id where s.slug = '${slug}' and a.event_type = 'view'`)), { timeout: 10_000 }).toBeGreaterThan(0)
})

test('the owner sees recorded statistics', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(alice.email)
  await page.getByLabel('Password').fill(alice.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await expect(page.getByText(/1 of 1 publishing slot used/)).toBeVisible()
  await page.getByRole('link', { name: 'Stats' }).click()
  await expect(page.getByText(/example data/i)).toHaveCount(0)
  await expect(page.locator('dt', { hasText: /^Views$/ }).locator('xpath=following-sibling::dd[1]').first()).toHaveText(/^[1-9]/)
})

test('another merchant cannot see or open the first merchant’s work', async ({ page }) => {
  await signUp(page, bruno, 'Bruno')
  await expect(page.getByText(/no showrooms yet/i)).toBeVisible()
  await page.goto(editorUrl.replace(/^https?:\/\/[^/]+/, ''))
  await expect(page.getByText('404')).toBeVisible()
  // Public pages still work for him like for anyone.
  await page.goto(`/s/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cloud/i)
})

test('unpublishing takes the public link down everywhere', async ({ page, browser }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(alice.email)
  await page.getByLabel('Password').fill(alice.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto(editorUrl.replace(/^https?:\/\/[^/]+/, ''))
  await page.getByRole('button', { name: 'Publish changes' }).waitFor()
  await page.getByRole('button', { name: 'Publish changes' }).click()
  await expect(page.getByRole('dialog')).toContainText('Your showroom is live')
  await page.getByRole('button', { name: 'Unpublish…' }).click()
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  const ctx = await browser.newContext()
  const visitor = await ctx.newPage()
  await visitor.goto(`/s/${slug}`)
  await expect(visitor.getByText('404')).toBeVisible()
  await ctx.close()
})
