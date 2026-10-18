import { applyEvent, makeDeps, verifyEvent } from '../../server/billing'
import { readEnv } from '../../server/env'
import { handle, HttpError, json } from '../../server/http'

/**
 * POST /api/stripe/webhook — the ONLY place payments are recorded.
 * The raw body is verified against STRIPE_WEBHOOK_SECRET before anything runs.
 */
export const POST = handle(async (req) => {
  const env = readEnv()
  const raw = await req.text()
  if (raw.length > 512 * 1024) throw new HttpError(413, 'Payload too large.')
  const deps = makeDeps(env)
  const event = verifyEvent(deps, raw, req.headers.get('stripe-signature'))
  const processed = await applyEvent(deps, event)
  return json({ received: true, duplicate: !processed })
})
