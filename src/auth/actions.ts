import { supabase, supabasePublic } from '@/lib/supabase'

function client() {
  if (!supabase) throw new Error('Accounts are not connected on this site yet.')
  return supabase
}

/** Only same-site paths are accepted as redirect targets (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/studio') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}

const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`

/** Turns Supabase auth errors into sentences a merchant can act on. */
export function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Check them, or use “Email me a sign-in link”.'
  if (m.includes('email not confirmed')) return 'Confirm your email first: we sent you a link when you created the account.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account already exists for this email. Sign in instead.'
  if (m.includes('password should be') || m.includes('weak password')) return 'Choose a longer password: at least 10 characters.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('fetch') || m.includes('network')) return 'We couldn’t reach the server. Check your connection and try again.'
  return message
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error.message))
}

/** Returns true when the account is ready, false when an email confirmation is pending. */
export async function signUp(email: string, password: string, displayName: string, next: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim().slice(0, 80) }, emailRedirectTo: callback(next) },
  })
  if (error) throw new Error(friendly(error.message))
  return !!data.session
}

export async function sendMagicLink(email: string, next: string) {
  const { error } = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: callback(next), shouldCreateUser: false } })
  if (error) throw new Error(friendly(error.message))
}

export async function sendPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })
  if (error) throw new Error(friendly(error.message))
}

export async function updatePassword(password: string) {
  const { error } = await client().auth.updateUser({ password })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut() {
  await client().auth.signOut()
}

export type OAuthProvider = 'google' | 'apple' | 'github'
export const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple', github: 'GitHub' }

/**
 * Providers switched on in Supabase Auth (Authentication → Sign In / Providers).
 * Null when the settings could not be read: the buttons then simply try.
 */
export async function enabledProviders(): Promise<Record<OAuthProvider, boolean> | null> {
  if (!supabasePublic) return null
  try {
    const res = await fetch(`${supabasePublic.url}/auth/v1/settings`, { headers: { apikey: supabasePublic.anonKey } })
    if (!res.ok) return null
    const { external } = (await res.json()) as { external?: Partial<Record<OAuthProvider, boolean>> }
    return { google: !!external?.google, apple: !!external?.apple, github: !!external?.github }
  } catch {
    return null
  }
}

/** Leaves for the provider's consent screen; Supabase brings the user back to /auth/callback. */
export async function signInWithProvider(provider: OAuthProvider, next: string) {
  const { error } = await client().auth.signInWithOAuth({ provider, options: { redirectTo: callback(next) } })
  if (error) throw new Error(friendly(error.message))
}
