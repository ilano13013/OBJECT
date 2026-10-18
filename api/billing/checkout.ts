import { createCheckout, makeDeps, type CheckoutRequest } from '../../server/billing'
import { readEnv } from '../../server/env'
import { assertSameOrigin, bearer, handle, json, readJson } from '../../server/http'

/** POST /api/billing/checkout — starts a Stripe Checkout for One Showroom or Studio. */
export const POST = handle(async (req) => {
  const env = readEnv()
  assertSameOrigin(req, env.appUrl)
  const token = bearer(req)
  const body = await readJson<CheckoutRequest>(req)
  return json(await createCheckout(makeDeps(env), token, body))
})
