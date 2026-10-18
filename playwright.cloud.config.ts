import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in cloud mode, against a Supabase-compatible stack
 * (supabase/local-stack/start.sh) or a disposable Supabase project.
 * Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * TEST_DATABASE_URL (operator actions), stripe-mock on 127.0.0.1:12111 and
 * the Tripo test double (node scripts/tripo-mock.mjs) on 127.0.0.1:12122.
 */
const chromiumArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const executablePath = process.env.CHROMIUM_PATH || (process.env.CI ? undefined : '/opt/pw-browsers/chromium')

export default defineConfig({
  testDir: 'e2e-cloud',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4174', launchOptions: { args: chromiumArgs, executablePath } },
  // Dev server: serves /api (Stripe Checkout, portal, webhook) like Vercel functions.
  webServer: {
    command: 'npx vite --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
      SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      APP_URL: 'http://localhost:4174',
      STRIPE_SECRET_KEY: 'sk_test_e2e',
      STRIPE_WEBHOOK_SECRET: 'whsec_e2e_secret',
      STRIPE_PRICE_ONE: 'price_one_e2e',
      STRIPE_PRICE_STUDIO: 'price_studio_e2e',
      STRIPE_API_HOST: process.env.STRIPE_API_HOST ?? '127.0.0.1',
      STRIPE_API_PORT: process.env.STRIPE_API_PORT ?? '12111',
      STRIPE_API_PROTOCOL: 'http',
      // Tripo TEST DOUBLE (scripts/tripo-mock.mjs): returns a fixture cube, generates nothing.
      TRIPO_API_KEY: 'tsk_test_mock',
      TRIPO_API_BASE: process.env.TRIPO_API_BASE ?? 'http://127.0.0.1:12122/v2/openapi',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumArgs, executablePath } } },
    { name: 'mobile', testMatch: /ai\.spec\.ts/, use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: { args: chromiumArgs, executablePath } } },
  ],
})
