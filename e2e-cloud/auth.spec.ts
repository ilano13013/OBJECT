import { expect, test } from '@playwright/test'

/**
 * Real sign-up screen: email + password against Supabase Auth, and the
 * Google / Apple / GitHub buttons. Provider consent screens are external:
 * the test stops at the redirect to them. The local stack switches GitHub on
 * with a dummy client id (GITHUB_CLIENT_ID); Google and Apple are off.
 */
const run = Date.now().toString(36)

test('“Create an account” replaces Start and opens the sign-up screen', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: /^start/i })).toHaveCount(0)
  await header.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/login\?mode=signup$/)
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  for (const p of ['Google', 'Apple', 'GitHub']) await expect(page.getByRole('button', { name: `Sign up with ${p}` })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})

test('a provider that is switched on sends the visitor to its consent screen', async ({ page, request }) => {
  const settings = await (await request.get(`${process.env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' } })).json()
  test.skip(!settings.external.github, 'GitHub is not enabled on this stack')
  await page.goto('/login?mode=signup')
  const toGitHub = page.waitForRequest((r) => r.url().startsWith('https://github.com/login/oauth/authorize'))
  await page.getByRole('button', { name: 'Sign up with GitHub' }).click()
  const url = new URL((await toGitHub).url())
  expect(url.searchParams.get('client_id')).toBeTruthy()
  expect(url.searchParams.get('redirect_to')).toContain('/auth/callback')
})

test('a provider that is not switched on says so instead of failing', async ({ page, request }) => {
  const settings = await (await request.get(`${process.env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' } })).json()
  test.skip(settings.external.google, 'Google is enabled on this stack')
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('alert')).toHaveText(/Sign-in with Google isn’t switched on for this site yet/)
  await expect(page).toHaveURL(/\/login$/)
})

test('email + password: create an account, sign out, sign back in', async ({ page }) => {
  const email = `new-${run}@example.com`
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name or brand').fill('Atelier Nord')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page.getByRole('alert')).toHaveText(/at least 10 characters/)
  await page.getByLabel('Password').fill('a-long-enough-password')
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Open the studio' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Create an account' })).toHaveCount(0)

  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText(/don’t match/)
  await page.getByLabel('Password').fill('a-long-enough-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/studio$/)
})
