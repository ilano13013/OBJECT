import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const fixture = (name: string) => fileURLToPath(new URL(`../e2e/fixtures/${name}`, import.meta.url))
const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/object_stack'
const SECRET = 'whsec_e2e_secret'
const run = Date.now().toString(36)
const merchant = { email: `buyer-${run}@example.com`, password: 'correct-horse-battery' }

const sql = (q: string) => execFileSync('psql', [DB, '-Atqc', q], { encoding: 'utf8' }).trim()

/** Stripe-hosted pages are outside this test: answer them with a stand-in page. */
async function stubStripe(page: Page) {
  await page.route((url) => url.protocol === 'https:' && /stripe\.(com|me)$/.test(url.hostname), (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Stripe (test stand-in)</title><h1>Stripe test page</h1>' }),
  )
}

async function sendWebhook(page: Page, type: string, object: object) {
  const payload = JSON.stringify({ id: `evt_${type}_${Math.random().toString(36).slice(2)}`, object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object } })
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  const res = await page.request.post('/api/stripe/webhook', { headers: { 'stripe-signature': header, 'content-type': 'application/json' }, data: payload })
  expect(res.status()).toBe(200)
}

test.describe.configure({ mode: 'serial' })
let showroomId = ''

test('buying One Showroom from the editor unlocks publishing only after Stripe’s webhook', async ({ page }) => {
  await stubStripe(page)
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name or brand').fill('Buyer')
  await page.getByLabel('Email').fill(merchant.email)
  await page.getByLabel('Password').fill(merchant.password)
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/new')
  await page.getByRole('radio', { name: /editorial template/i }).click()
  await page.getByRole('radio', { name: /^photos/i }).click()
  await page.getByLabel('Product name').fill(`Bought Cuff ${run}`)
  await page.getByRole('button', { name: /create and open the editor/i }).click()
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/)
  showroomId = page.url().split('/studio/')[1]!
  await page.locator('input[type=file][accept^="image"]').setInputFiles(fixture('product.webp'))
  await page.getByPlaceholder('Describe this image').fill('Titanium cuff')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /^publish$/i }).click()
  await expect(page.getByRole('dialog')).toContainText('Choose a plan to publish')
  await expect(page.getByText(/test mode: no real money moves/i)).toBeVisible()
  await page.getByRole('button', { name: /buy this showroom/i }).click()
  await expect(page).toHaveTitle(/Stripe \(test stand-in\)/)

  const session = sql(`select stripe_session_id from orders where showroom_id = '${showroomId}' and status = 'pending'`)
  expect(session).toMatch(/^cs_test_/)

  // Coming back with ?checkout=success alone proves nothing: still not publishable.
  await page.goto(`/studio/${showroomId}?checkout=success&session_id=${session}`)
  await expect(page.getByText(/confirming it with our server/i)).toBeVisible()
  expect(sql(`select status from showrooms where id = '${showroomId}'`)).toBe('draft')

  // Stripe confirms through the signed webhook.
  await sendWebhook(page, 'checkout.session.completed', {
    id: session,
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 4900,
    currency: 'eur',
    payment_intent: `pi_${run}`,
    metadata: { workspace_id: sql(`select workspace_id from showrooms where id = '${showroomId}'`), showroom_id: showroomId, plan: 'one' },
  })
  await expect(page.getByText('Payment confirmed. You can publish this showroom now.')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByRole('dialog')).toContainText('Your showroom is live')
})

test('cancelling Checkout says nothing was charged', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(merchant.email)
  await page.getByLabel('Password').fill(merchant.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto(`/studio/${showroomId}?checkout=cancelled`)
  await expect(page.getByText('Checkout cancelled. Nothing was charged.')).toBeVisible()
})

test('Studio subscription from the account page, then the billing portal', async ({ page }) => {
  await stubStripe(page)
  await page.goto('/login?next=%2Faccount%3Fplan%3Dstudio')
  await page.getByLabel('Email').fill(merchant.email)
  await page.getByLabel('Password').fill(merchant.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account\?plan=studio/)
  await expect(page.getByText('One Showroom', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /start studio/i }).click()
  await expect(page).toHaveTitle(/Stripe \(test stand-in\)/)

  const ws = sql(`select w.id from workspaces w join auth.users u on u.id = w.owner_id where u.email = '${merchant.email}'`)
  const customer = sql(`select stripe_customer_id from workspaces where id = '${ws}'`)
  await page.goto('/account?checkout=success')
  await expect(page.getByText(/confirming your subscription/i)).toBeVisible()
  await sendWebhook(page, 'customer.subscription.created', {
    id: `sub_${run}`,
    object: 'subscription',
    customer,
    status: 'active',
    cancel_at_period_end: false,
    metadata: { workspace_id: ws, plan: 'studio' },
    items: { object: 'list', data: [{ id: 'si_1', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  })
  await expect(page.getByText('Studio is active. Welcome.')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Renews on')).toBeVisible()
  await expect(page.getByRole('button', { name: /start studio/i })).toHaveCount(0)

  await page.getByRole('button', { name: /invoices, card and cancellation/i }).click()
  await expect(page).toHaveTitle(/Stripe \(test stand-in\)/)
})

test('payment endpoints refuse anonymous and cross-site calls', async ({ request }) => {
  const anon = await request.post('/api/billing/checkout', { data: { plan: 'studio' } })
  expect(anon.status()).toBe(401)
  const cross = await request.post('/api/billing/checkout', { headers: { origin: 'https://evil.example', authorization: 'Bearer x' }, data: { plan: 'studio' } })
  expect(cross.status()).toBe(403)
  const forged = await request.post('/api/stripe/webhook', { headers: { 'stripe-signature': 't=1,v1=deadbeef' }, data: '{}' })
  expect(forged.status()).toBe(400)
})
