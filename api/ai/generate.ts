import { makeAiDeps, startGeneration, type StartRequest } from '../../server/ai'
import { readAiEnv } from '../../server/env'
import { assertSameOrigin, bearer, handle, json, readJson } from '../../server/http'

/** POST /api/ai/generate — checks subscription + quota, reserves one generation, then starts the Tripo task. */
export const POST = handle(async (req) => {
  const env = readAiEnv()
  assertSameOrigin(req, env.appUrl)
  const token = bearer(req)
  const body = await readJson<StartRequest>(req)
  return json(await startGeneration(makeAiDeps(env), token, body))
})
