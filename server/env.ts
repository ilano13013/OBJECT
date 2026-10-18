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

/** Configuration of the AI generation endpoints (Tripo). Independent of Stripe. */
export interface AiEnv {
  tripoApiKey: string
  /** Tripo OpenAPI base (v2 task API). Overridable for tests. */
  tripoApiBase: string
  /** Model version sent to Tripo. Default H3.1. */
  tripoModelVersion: string
  supabaseUrl: string
  supabaseServiceKey: string
  appUrl: string
}

export function readAiEnv(source: Record<string, string | undefined> = process.env): AiEnv {
  const need = (k: string, what = 'AI generation is not configured') => {
    const v = source[k]
    if (!v) throw new ConfigError(`${what}: missing ${k}.`)
    return v
  }
  const env: AiEnv = {
    tripoApiKey: need('TRIPO_API_KEY'),
    tripoApiBase: (source.TRIPO_API_BASE || 'https://api.tripo3d.ai/v2/openapi').replace(/\/+$/, ''),
    tripoModelVersion: source.TRIPO_MODEL_VERSION || 'v3.1-20260211',
    supabaseUrl: source.SUPABASE_URL || need('VITE_SUPABASE_URL'),
    supabaseServiceKey: need('SUPABASE_SERVICE_ROLE_KEY'),
    appUrl: need('APP_URL').replace(/\/+$/, ''),
  }
  if (!/^https?:\/\//.test(env.tripoApiBase)) throw new ConfigError('TRIPO_API_BASE must be a full URL.')
  return env
}
