import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Cloud mode turns on when both public Supabase settings are present.
 * The anon key is designed to be public: row-level security in the database
 * decides what it can reach. The service-role key never ships to the browser.
 */
export const cloudEnabled = !!url && !!anonKey && !import.meta.env.VITE_MEMORY_ROUTER

/** Public project settings (URL + anon key), for endpoints supabase-js does not wrap. */
export const supabasePublic = cloudEnabled ? { url: url!.replace(/\/+$/, ''), anonKey: anonKey! } : null

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null
