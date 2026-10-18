import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './http'

/** Service-role client: bypasses RLS, so every query below filters by the caller's workspace. */
export function adminClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Resolves the signed-in user from their Supabase access token (verified by Supabase Auth). */
export async function currentUser(db: SupabaseClient, token: string) {
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Sign in again.')
  return data.user
}

export interface Workspace {
  id: string
  stripe_customer_id: string | null
}

export async function workspaceOf(db: SupabaseClient, userId: string): Promise<Workspace> {
  const { data, error } = await db.from('workspaces').select('id, stripe_customer_id').eq('owner_id', userId).order('created_at').limit(1).single()
  if (error || !data) throw new HttpError(404, 'No studio found for this account.')
  return data as Workspace
}
