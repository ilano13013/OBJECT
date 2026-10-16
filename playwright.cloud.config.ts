import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in cloud mode, against a Supabase-compatible stack
 * (supabase/local-stack/start.sh) or a disposable Supabase project.
 * Requires SUPABASE_URL, SUPABASE_ANON_KEY and TEST_DATABASE_URL (to grant a
 * publishing slot to the test accounts, as an operator would).
 */
const chromiumArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const executablePath = process.env.CHROMIUM_PATH || (process.env.CI ? undefined : '/opt/pw-browsers/chromium')

export default defineConfig({
  testDir: 'e2e-cloud',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4174', launchOptions: { args: chromiumArgs, executablePath } },
  webServer: {
    command: 'npx vite build --outDir dist-cloud && npx vite preview --outDir dist-cloud --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? '', VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '' },
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumArgs, executablePath } } }],
})
