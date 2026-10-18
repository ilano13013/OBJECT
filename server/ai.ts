import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiEnv } from './env'
import { HttpError } from './http'
import { adminClient, currentUser, workspaceOf } from './identity'
import { imageType, TripoClient, TripoError, VIEWS, type TripoImage } from './tripo'

const BUCKET = 'showroom-assets'
/** A task Tripo has not finished after this long is abandoned (quota released). */
const TASK_TIMEOUT_MS = 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export interface AiDeps {
  env: AiEnv
  db: SupabaseClient
  tripo: TripoClient
}

export function makeAiDeps(env: AiEnv, f?: typeof fetch): AiDeps {
  return {
    env,
    db: adminClient(env.supabaseUrl, env.supabaseServiceKey),
    tripo: new TripoClient({ apiKey: env.tripoApiKey, base: env.tripoApiBase, modelVersion: env.tripoModelVersion, fetch: f }),
  }
}

export interface Generation {
  id: string
  status: 'reserved' | 'running' | 'succeeded' | 'failed' | 'released'
  mode: 'single' | 'multiview'
  name: string
  progress: number
  error: string | null
  libraryModelId: string | null
  inputPaths: string[]
  createdAt: string
}

interface Row {
  id: string
  workspace_id: string
  status: Generation['status']
  mode: Generation['mode']
  name: string
  progress: number
  error_message: string | null
  library_model_id: string | null
  input_paths: string[]
  tripo_task_id: string | null
  finalizing_until: string | null
  created_at: string
}

const toGeneration = (r: Row): Generation => ({
  id: r.id,
  status: r.status,
  mode: r.mode,
  name: r.name,
  progress: r.progress,
  error: r.error_message,
  libraryModelId: r.library_model_id,
  inputPaths: r.input_paths,
  createdAt: r.created_at,
})

/** Messages shown to the merchant for each refusal from reserve_ai_generation. */
const REFUSALS: Record<string, [number, string]> = {
  not_subscribed: [403, 'AI 3D generation is reserved for OBJECT subscribers. Subscribe to generate up to 5 3D models per month.'],
  period_ended: [403, 'Your subscription period has ended. AI generation resumes once the renewal is paid.'],
  quota_exhausted: [403, 'You have used your 5 AI 3D generations for this period. Your quota renews on your next subscription billing date.'],
  busy: [409, 'A generation is already in progress. Wait for it to finish before starting another.'],
  invalid_inputs: [400, 'These photos cannot be used. Upload them again.'],
  no_workspace: [404, 'No studio found for this account.'],
}

/** User-facing message for a Tripo failure. None of these consume the quota. */
function tripoMessage(e: TripoError): string {
  switch (e.kind) {
    case 'credits':
      return 'AI generation is temporarily unavailable on our side. Your generation was not used — try again later.'
    case 'rate_limited':
      return 'The AI service is busy right now. Your generation was not used — try again in a minute.'
    case 'invalid':
      return 'The AI service could not use these photos. Your generation was not used — try clearer photos.'
    default:
      return 'The AI service did not respond. Your generation was not used — try again.'
  }
}

async function release(deps: AiDeps, id: string, message: string) {
  const { error } = await deps.db.rpc('release_ai_generation', { p_id: id, p_message: message })
  if (error) throw new Error(`release failed: ${error.message}`)
}

export interface StartRequest {
  requestId: string
  name?: string
  /** Storage paths `<workspace>/ai-inputs/<requestId>/<view>.<ext>`, view 0 = front … 3 = right. */
  inputs: string[]
}

/**
 * Starts one generation. Order matters: identity → subscription and quota are
 * checked and one generation reserved atomically in the database → only then
 * is Tripo (a paid call) contacted. Any technical failure releases the quota.
 */
export async function startGeneration(deps: AiDeps, token: string, body: StartRequest): Promise<Generation> {
  const user = await currentUser(deps.db, token)
  const ws = await workspaceOf(deps.db, user.id)

  if (!body || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) throw new HttpError(400, 'Invalid request.')
  const inputs = Array.isArray(body.inputs) ? body.inputs.filter((p): p is string => typeof p === 'string') : []
  const prefix = `${ws.id}/ai-inputs/${body.requestId}/`
  const views = inputs.map((p) => (p.startsWith(prefix) ? Number(/^([0-3])\.(jpg|png|webp)$/.exec(p.slice(prefix.length))?.[1] ?? NaN) : NaN))
  if (inputs.length < 1 || inputs.length > 4 || views.some(Number.isNaN) || new Set(views).size !== views.length) {
    throw new HttpError(400, 'Add between 1 and 4 photos.')
  }
  if (!views.includes(0)) throw new HttpError(400, 'A front photo is required.')

  const { data, error } = await deps.db.rpc('reserve_ai_generation', {
    p_workspace: ws.id,
    p_request: body.requestId,
    p_inputs: inputs,
    p_name: typeof body.name === 'string' ? body.name.slice(0, 120) : 'Untitled model',
  })
  if (error) {
    const refusal = REFUSALS[error.message]
    if (refusal) throw new HttpError(refusal[0], refusal[1], error.message)
    throw new Error(`reserve failed: ${error.message}`)
  }
  const reserved = (data as { id: string; status: string; created: boolean }[])[0]!
  // Same click delivered twice: report the existing generation, call Tripo once.
  if (!reserved.created) return getOwned(deps, ws.id, reserved.id)

  try {
    const slots: ({ token: string; type: TripoImage['type'] } | null)[] = VIEWS.map(() => null)
    for (let i = 0; i < inputs.length; i++) {
      const { data: blob, error: dlError } = await deps.db.storage.from(BUCKET).download(inputs[i]!)
      if (dlError || !blob) throw new HttpError(400, 'A photo is missing. Upload it again.', 'invalid_inputs')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const type = imageType(bytes)
      if (!type) throw new HttpError(400, 'Photos must be JPG, PNG or WebP.', 'invalid_inputs')
      slots[views[i]!] = { token: await deps.tripo.upload({ bytes, type }), type }
    }
    const taskId = await deps.tripo.createTask(inputs.length === 1 ? [slots[0] ?? null] : slots)
    const { error: upError } = await deps.db
      .from('ai_generations')
      .update({ status: 'running', tripo_task_id: taskId, progress: 0 })
      .eq('id', reserved.id)
      .eq('status', 'reserved')
    if (upError) throw new Error(`generation update failed: ${upError.message}`)
  } catch (e) {
    if (e instanceof TripoError) {
      console.error('[ai] tripo refused task', e.kind, e.tripoCode, e.message)
      await release(deps, reserved.id, tripoMessage(e))
      throw new HttpError(e.kind === 'rate_limited' ? 429 : 502, tripoMessage(e), `tripo_${e.kind}`)
    }
    await release(deps, reserved.id, e instanceof HttpError ? e.message : 'Generation could not start. Your generation was not used.')
    throw e
  }
  return getOwned(deps, ws.id, reserved.id)
}

async function getOwned(deps: AiDeps, workspace: string, id: string): Promise<Generation> {
  return toGeneration(await rowOwned(deps, workspace, id))
}

async function rowOwned(deps: AiDeps, workspace: string, id: string): Promise<Row> {
  if (!UUID.test(id)) throw new HttpError(404, 'Generation not found.')
  const { data, error } = await deps.db.from('ai_generations').select('*').eq('id', id).eq('workspace_id', workspace).maybeSingle()
  if (error) throw new Error(`generation read failed: ${error.message}`)
  if (!data) throw new HttpError(404, 'Generation not found.')
  return data as Row
}

/**
 * Refreshes one generation from Tripo and, once it succeeded, stores the GLB
 * in the workspace library. Safe to call from several tabs at once: a short
 * lease lets only one caller store the model.
 */
export async function generationStatus(deps: AiDeps, token: string, id: string): Promise<Generation> {
  const user = await currentUser(deps.db, token)
  const ws = await workspaceOf(deps.db, user.id)
  const row = await rowOwned(deps, ws.id, id)
  if (row.status !== 'running' || !row.tripo_task_id) return toGeneration(row)

  const age = Date.now() - new Date(row.created_at).getTime()
  let task
  try {
    task = await deps.tripo.getTask(row.tripo_task_id)
  } catch (e) {
    if (!(e instanceof TripoError)) throw e
    if (age > TASK_TIMEOUT_MS) {
      await release(deps, row.id, 'The AI service did not finish in time. Your generation was not used.')
      return getOwned(deps, ws.id, row.id)
    }
    return toGeneration(row) // transient: the client polls again
  }

  switch (task.status) {
    case 'queued':
    case 'running':
      if (age > TASK_TIMEOUT_MS) {
        await release(deps, row.id, 'The AI service did not finish in time. Your generation was not used.')
        return getOwned(deps, ws.id, row.id)
      }
      if (task.progress !== row.progress) await deps.db.from('ai_generations').update({ progress: task.progress }).eq('id', row.id).eq('status', 'running')
      return { ...toGeneration(row), progress: task.progress }
    case 'banned':
      // Refused for its content: counts, like any result the merchant asked for.
      await deps.db
        .from('ai_generations')
        .update({ status: 'failed', error_message: 'The AI service refused these photos under its content rules.', finished_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'running')
      return getOwned(deps, ws.id, row.id)
    case 'success':
      return finalize(deps, ws.id, row, task.modelUrl)
    default:
      await release(deps, row.id, 'The AI service could not generate this model. Your generation was not used.')
      return getOwned(deps, ws.id, row.id)
  }
}

async function finalize(deps: AiDeps, workspace: string, row: Row, modelUrl: string | null): Promise<Generation> {
  const { data: claimed, error: claimError } = await deps.db.rpc('claim_ai_finalize', { p_id: row.id })
  if (claimError) throw new Error(`finalize claim failed: ${claimError.message}`)
  if (!claimed) return { ...toGeneration(row), progress: 99 } // another request is storing it

  const modelId = crypto.randomUUID()
  const path = `${workspace}/library/${modelId}.glb`
  try {
    if (!modelUrl) throw new TripoError('upstream', 'Tripo reported success without a model.')
    const bytes = await deps.tripo.downloadModel(modelUrl)
    const { error: upError } = await deps.db.storage
      .from(BUCKET)
      .upload(path, new Blob([bytes as BlobPart], { type: 'model/gltf-binary' }), { contentType: 'model/gltf-binary', upsert: false, cacheControl: '31536000' })
    if (upError) throw new Error(`model upload failed: ${upError.message}`)
    const { error: insError } = await deps.db.from('library_models').insert({
      id: modelId,
      workspace_id: workspace,
      name: row.name,
      storage_path: path,
      file_size: bytes.byteLength,
      source: 'ai',
      generation_id: row.id,
      preview_path: row.input_paths.find((p) => /\/0\.(jpg|png|webp)$/.test(p)) ?? row.input_paths[0] ?? null,
    })
    if (insError) {
      await deps.db.storage.from(BUCKET).remove([path])
      throw new Error(`library insert failed: ${insError.message}`)
    }
    const { error: doneError } = await deps.db
      .from('ai_generations')
      .update({ status: 'succeeded', progress: 100, library_model_id: modelId, finished_at: new Date().toISOString(), finalizing_until: null, error_message: null })
      .eq('id', row.id)
    if (doneError) throw new Error(`generation update failed: ${doneError.message}`)
  } catch (e) {
    console.error('[ai] storing model failed', (e as Error).message)
    if (Date.now() - new Date(row.created_at).getTime() > TASK_TIMEOUT_MS) {
      await release(deps, row.id, 'The generated model could not be retrieved. Your generation was not used.')
    } else {
      // Retry on the next status check (Tripo keeps the result for a while).
      await deps.db.from('ai_generations').update({ finalizing_until: null, error_message: 'Retrieving the model…' }).eq('id', row.id).eq('status', 'running')
    }
  }
  return getOwned(deps, workspace, row.id)
}
