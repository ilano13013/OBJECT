import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { safeNext } from '@/auth/actions'
import { useAuth } from '@/auth/AuthProvider'
import { AuthShell, Notice } from './AuthShell'

/** Landing page for email links: the session is exchanged from the URL by the Supabase client. */
export default function AuthCallback() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [slow, setSlow] = useState(false)
  const error = params.get('error_description')

  useEffect(() => {
    if (user) navigate(safeNext(params.get('next')), { replace: true })
  }, [user, navigate, params])

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 6000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <AuthShell title="Signing you in">
      {error ? (
        <Notice tone="error">This link didn’t work: {error}. Links expire after one hour and work once.</Notice>
      ) : slow && !loading && !user ? (
        <Notice tone="error">This link has expired or was already used. Ask for a new one from the sign-in page.</Notice>
      ) : (
        <Notice>One moment…</Notice>
      )}
      <Link to="/login" className="text-sm text-silver underline underline-offset-4">
        Back to sign in
      </Link>
    </AuthShell>
  )
}
