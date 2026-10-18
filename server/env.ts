/**
 * Server-only configuration. Nothing here is ever bundled into the browser:
 * these modules are imported only by /api functions.
 */
export interface ServerEnv {
  stripeSecretKey: string
  stripeWebhookSecret: string
  priceOne: string
  priceStudio: string
  supabaseUrl: string
  supabaseServiceKey: string
  appUrl: string
  /** Stripe API host override (stripe-mock in tests). */
  stripeApiHost?: string
  stripeApiPort?: number
  stripeApiProtocol?: 'http' | 'https'
}

export class ConfigError extends Error {
  name = 'ConfigError'
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const need = (k: string) => {
    const v = source[k]
    if (!v) throw new ConfigError(`Payments are not configured: missing ${k}.`)
    return v
  }
  const env: ServerEnv = {
    stripeSecretKey: need('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: need('STRIPE_WEBHOOK_SECRET'),
    priceOne: need('STRIPE_PRICE_ONE'),
    priceStudio: need('STRIPE_PRICE_STUDIO'),
    supabaseUrl: source.SUPABASE_URL || need('VITE_SUPABASE_URL'),
    supabaseServiceKey: need('SUPABASE_SERVICE_ROLE_KEY'),
    appUrl: need('APP_URL').replace(/\/+$/, ''),
    stripeApiHost: source.STRIPE_API_HOST,
    stripeApiPort: source.STRIPE_API_PORT ? Number(source.STRIPE_API_PORT) : undefined,
    stripeApiProtocol: source.STRIPE_API_PROTOCOL === 'http' ? 'http' : undefined,
  }
  // Test mode until launch is explicitly authorised.
  if (!env.stripeSecretKey.startsWith('sk_test_') && !env.stripeSecretKey.startsWith('rk_test_') && source.ALLOW_LIVE_PAYMENTS !== 'true') {
    throw new ConfigError('Live Stripe keys are refused. Use test keys, or set ALLOW_LIVE_PAYMENTS=true when launch is authorised.')
  }
  if (!/^https?:\/\//.test(env.appUrl)) throw new ConfigError('APP_URL must be the full site address.')
  return env
}
