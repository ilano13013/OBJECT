import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from '@/lib/supabase'

interface AuthState {
  /** 'local' when no Supabase project is configured: no accounts, studio stored in this browser. */
  mode: 'local' | 'cloud'
  loading: boolean
  session: Session | null
  user: User | null
}

const AuthContext = createContext<AuthState>({ mode: 'local', loading: false, session: null, user: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabase ? { mode: 'cloud', loading: true, session: null, user: null } : { mode: 'local', loading: false, session: null, user: null },
  )

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ mode: 'cloud', loading: false, session: data.session, user: data.session?.user ?? null })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ mode: 'cloud', loading: false, session, user: session?.user ?? null })
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Studio routes: in cloud mode, signed-out visitors are sent to sign in and brought back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { mode, loading, user } = useAuth()
  const location = useLocation()
  if (mode === 'local') return <>{children}</>
  if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-obsidian text-sm text-ash" aria-busy="true">Checking your session…</div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
