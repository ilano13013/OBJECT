import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * AI 3D generation through the real studio UI and /api/ai/*, with the Tripo
 * TEST DOUBLE (scripts/tripo-mock.mjs, returns a fixture cube) on :12122.
 */
const fixture = (name: string) => fileURLToPath(new URL(`../e2e/fixtures/${name}`, import.meta.url))
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/object_stack'
const MOCK = 'http://127.0.0.1:12122'
const sql = (q: string) => execFileSync('psql', [DB, '-Atqc', q], { encoding: 'utf8' }).trim()
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

async function signUp(page: Page, email: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name or brand').fill('Maker')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}
const workspaceOf = (email: string) => sql(`select w.id from workspaces w join auth.users u on u.id = w.owner_id where u.email = '${email}'`)
/** Stands in for Stripe's webhook: an active, paid Studio period. */
const subscribe = (email: string) =>
  sql(`insert into subscriptions (workspace_id, stripe_subscription_id, status, current_period_start, current_period_end)
       values ('${workspaceOf(email)}', 'sub_e2e_${email.split('@')[0]}', 'active', now(), now() + interval '30 days')
       on conflict (workspace_id) do update set status = 'active', current_period_end = excluded.current_period_end`)

test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK}/__reset`)
})

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile)
  test.describe.configure({ mode: 'serial' })
  const merchant = `ai-${run}@example.com`

  test('non-subscribers see the locked module, not a generate button', async ({ page, request }) => {
    await signUp(page, merchant)
    await page.getByRole('link', { name: 'Library' }).click()
    await expect(page.getByRole('heading', { name: 'Model library' })).toBeVisible()
    await expect(page.getByText('AI 3D generation is reserved for OBJECT subscribers. Subscribe to generate up to 5 3D models per month.')).toBeVisible()
    await expect(page.getByRole('button', { name: /generate a 3d model/i })).toHaveCount(0)
    await page.getByRole('link', { name: 'Discover the subscription' }).click()
    await expect(page).toHaveURL(/\/account\?plan=studio$/)
    expect((await (await request.get(`${MOCK}/__stats`)).json()).tasks).toBe(0)
  })

  test('subscriber: photo → AI → 3D preview → library → showroom, persists after signing in again', async ({ page, request }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(merchant)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    subscribe(merchant)

    await page.goto('/studio/new')
    await page.getByRole('radio', { name: /orbit template/i }).click()
    await page.getByRole('radio', { name: /^photos/i }).click()
    await page.getByLabel('Product name').fill(`AI Vase ${run}`)
    await page.getByRole('button', { name: /create and open the editor/i }).click()
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/)
    const showroomId = page.url().split('/studio/')[1]!

    await page.goto('/studio/library')
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 5 / 5')
    await expect(page.getByText(/renews on/i)).toBeVisible()
    const go = page.getByRole('button', { name: 'Generate a 3D model with AI' })
    await expect(go).toBeDisabled() // no front photo yet
    await page.getByLabel('Front photo (required)').setInputFiles(fixture('product.webp'))
    await expect(page.getByRole('img', { name: 'Front photo' })).toBeVisible()
    await page.getByLabel('Model name').fill('Amber vase')
    await expect(page.getByText(/uses 1 of your 5 remaining generations/i)).toBeVisible()
    await expect(page.getByText(/the ai estimates the parts of your product it cannot see/i)).toBeVisible()
    // A double click still sends one request.
    await go.dblclick()
    await expect(page.getByRole('progressbar', { name: 'Generation progress' })).toBeVisible()
    await expect(page.getByText(/“Amber vase” is ready and saved in your library/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 4 / 5')
    expect((await (await request.get(`${MOCK}/__stats`)).json()).tasks).toBe(1)

    // The 3D preview is a real WebGL canvas of the stored GLB.
    await expect(page.getByRole('group', { name: /amber vase, 3d model preview/i }).locator('canvas')).toBeVisible()

    // Stored in permanent storage as a real GLB in the workspace library.
    const path = sql(`select storage_path from library_models where workspace_id = '${workspaceOf(merchant)}'`)
    expect(path).toMatch(/\/library\/[0-9a-f-]{36}\.glb$/)

    // Straight into the showroom, as its True 3D model.
    const review = page.getByRole('region', { name: 'Generate a 3D model with AI' })
    await review.getByRole('button', { name: 'Add to showroom' }).click()
    await expect(review.getByText('Added as the True 3D model.')).toBeVisible()
    const settings = JSON.parse(sql(`select settings_json from showroom_content where showroom_id = '${showroomId}'`))
    expect(settings.mode).toBe('true3d')
    expect(settings.model).toMatchObject({ kind: 'upload', name: 'Amber vase.glb' })
    expect(settings.model.assetId).toMatch(new RegExp(`/${showroomId}/[0-9a-f-]{36}\\.glb$`))
    expect(sql(`select asset_type from assets where storage_path = '${settings.model.assetId}'`)).toBe('model')
    await review.getByRole('link', { name: 'Open the editor' }).click()
    await expect(page.getByText('Amber vase.glb')).toBeVisible()

    // Signed out and back in: library and history are still there.
    await page.goto('/account')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.goto('/login')
    await page.getByLabel('Email').fill(merchant)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await page.goto('/studio/library')
    await expect(page.getByRole('heading', { name: 'Your models · 1' })).toBeVisible()
    await expect(page.getByLabel('Model name').nth(1)).toHaveValue('Amber vase')
    await expect(page.getByRole('heading', { name: 'Generation history' })).toBeVisible()
    await expect(page.getByText('Ready', { exact: true })).toBeVisible()

    // The library model can also be picked from the editor of another showroom.
    await page.goto('/studio/new')
    await page.getByRole('radio', { name: /orbit template/i }).click()
    await page.getByRole('radio', { name: /3d model/i }).click()
    await page.getByLabel('Product name').fill(`Second ${run}`)
    await page.getByRole('button', { name: /create and open the editor/i }).click()
    await page.getByRole('button', { name: 'Choose from your library' }).click()
    await page.getByRole('button', { name: /amber vase/i }).click()
    await expect(page.getByText('Amber vase.glb')).toBeVisible()
  })

  test('a generation continues after leaving the page; failures give the credit back; exhausted quota blocks', async ({ page, request }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(merchant)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/studio$/)

    await request.post(`${MOCK}/__control`, { data: { mode: 'slow' } })
    await page.goto('/studio/library')
    await page.getByLabel('Front photo (required)').setInputFiles(fixture('product.webp'))
    await page.getByRole('button', { name: 'Generate a 3D model with AI' }).click()
    await expect(page.getByText(/building geometry|waiting for the ai/i)).toBeVisible({ timeout: 15_000 })
    await page.goto('/studio')
    await page.goto('/studio/library')
    await expect(page.getByRole('progressbar', { name: 'Generation progress' })).toBeVisible()
    await expect(page.getByText(/you can leave this page/i)).toBeVisible()

    // Tripo never finishes: after the timeout the server releases the credit.
    sql(`update ai_generations set created_at = now() - interval '2 hours' where workspace_id = '${workspaceOf(merchant)}' and status = 'running'`)
    await expect(page.getByText(/did not finish in time\. your generation was not used/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 4 / 5')

    // Tripo out of credits on OBJECT's side: refused, nothing consumed.
    await request.post(`${MOCK}/__control`, { data: { mode: 'credits' } })
    await page.getByLabel('Front photo (required)').setInputFiles(fixture('product.webp'))
    await page.getByRole('button', { name: 'Generate a 3D model with AI' }).click()
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable on our side. Your generation was not used')
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 4 / 5')

    // Quota used up.
    sql(`update workspaces set ai_generation_quota = 1 where id = '${workspaceOf(merchant)}'`)
    await page.reload()
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 0 / 1')
    await expect(page.getByText(/your quota renews on your next subscription billing date/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate a 3D model with AI' })).toBeDisabled()
    sql(`update workspaces set ai_generation_quota = 5 where id = '${workspaceOf(merchant)}'`)
  })
})

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile)
  test('a subscriber generates and previews a model on a phone', async ({ page }) => {
    const email = `ai-mobile-${run}@example.com`
    await signUp(page, email)
    subscribe(email)
    await page.goto('/studio/library')
    await expect(page.getByTestId('ai-remaining')).toHaveText('Generations remaining: 5 / 5')
    await page.getByLabel('Front photo (required)').setInputFiles(fixture('product.webp'))
    await page.getByLabel('Back photo (optional)').setInputFiles(fixture('product.webp'))
    await expect(page.getByText(/2 photos/)).toBeVisible()
    await page.getByRole('button', { name: 'Generate a 3D model with AI' }).click()
    await expect(page.getByText(/is ready and saved in your library/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('group', { name: /3d model preview/i }).first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(sql(`select mode from ai_generations where workspace_id = '${workspaceOf(email)}'`)).toBe('multiview')
  })
})
