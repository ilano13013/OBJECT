import { generationStatus, makeAiDeps } from '../../server/ai'
import { readAiEnv } from '../../server/env'
import { assertSameOrigin, bearer, handle, json, readJson } from '../../server/http'

/** POST /api/ai/status — refreshes a generation from Tripo; stores the GLB in the library once ready. */
export const POST = handle(async (req) => {
  const env = readAiEnv()
  assertSameOrigin(req, env.appUrl)
  const token = bearer(req)
  const { id } = await readJson<{ id?: string }>(req)
  return json(await generationStatus(makeAiDeps(env), token, String(id ?? '')))
})
