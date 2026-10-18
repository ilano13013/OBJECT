// @vitest-environment node
import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { makeDeps, verifyEvent } from './billing'
import { ConfigError, readEnv } from './env'
import { assertSameOrigin, HttpError } from './http'

const base = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PRICE_ONE: 'price_one',
  STRIPE_PRICE_STUDIO: 'price_studio',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  APP_URL: 'https://object.example/',
}

describe('server env', () => {
  it('accepts test keys and normalises the app URL', () => {
    expect(readEnv(base).appUrl).toBe('https://object.example')
  })
  it('refuses live keys unless launch is explicitly allowed', () => {
    expect(() => readEnv({ ...base, STRIPE_SECRET_KEY: 'sk_live_123' })).toThrow(ConfigError)
    expect(readEnv({ ...base, STRIPE_SECRET_KEY: 'sk_live_123', ALLOW_LIVE_PAYMENTS: 'true' }).stripeSecretKey).toBe('sk_live_123')
  })
  it('names the missing variable', () => {
    expect(() => readEnv({ ...base, STRIPE_WEBHOOK_SECRET: undefined })).toThrow(/STRIPE_WEBHOOK_SECRET/)
  })
})

describe('webhook signature', () => {
  const deps = makeDeps(readEnv(base))
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: {} } })

  it('accepts a correctly signed payload', () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: base.STRIPE_WEBHOOK_SECRET })
    expect(verifyEvent(deps, payload, header).id).toBe('evt_1')
  })
  it('rejects a wrong secret, a tampered body, or no signature', () => {
    const forged = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_attacker' })
    expect(() => verifyEvent(deps, payload, forged)).toThrow(HttpError)
    const good = Stripe.webhooks.generateTestHeaderString({ payload, secret: base.STRIPE_WEBHOOK_SECRET })
    expect(() => verifyEvent(deps, payload.replace('evt_1', 'evt_2'), good)).toThrow(HttpError)
    expect(() => verifyEvent(deps, payload, null)).toThrow(HttpError)
  })
  it('rejects replayed signatures outside the tolerance window', () => {
    const old = Stripe.webhooks.generateTestHeaderString({ payload, secret: base.STRIPE_WEBHOOK_SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 })
    expect(() => verifyEvent(deps, payload, old)).toThrow(HttpError)
  })
})

describe('same-origin guard', () => {
  it('blocks cross-site browser posts', () => {
    const req = new Request('https://object.example/api/billing/checkout', { method: 'POST', headers: { origin: 'https://evil.example' } })
    expect(() => assertSameOrigin(req, 'https://object.example')).toThrow(HttpError)
  })
})
