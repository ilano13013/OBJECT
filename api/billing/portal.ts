import { createPortal, makeDeps } from '../../server/billing'
import { readEnv } from '../../server/env'
import { assertSameOrigin, bearer, handle, json } from '../../server/http'

/** POST /api/billing/portal — opens the Stripe customer portal (invoices, card, cancel). */
export const POST = handle(async (req) => {
  const env = readEnv()
  assertSameOrigin(req, env.appUrl)
  return json(await createPortal(makeDeps(env), bearer(req)))
})
