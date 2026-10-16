import { cloudEnabled, supabase } from '@/lib/supabase'
import { CloudBackend } from './cloud'
import { LocalBackend } from './local'
import type { StudioBackend } from './types'

/** Supabase when configured (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY), this browser otherwise. */
export const backend: StudioBackend = cloudEnabled && supabase ? new CloudBackend(supabase) : new LocalBackend()

export type { Entitlement, StatsDay, StudioBackend } from './types'
