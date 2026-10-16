import { useState } from 'react'
import { useNavigate } from 'react-router'
import { updatePassword } from '@/auth/actions'
import { useAuth } from '@/auth/AuthProvider'
import { inputClass } from '@/studio/ui'
import { AuthShell, Notice } from './AuthShell'

export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <AuthShell title="Choose a new password">
      {!loading && !user ? (
        <Notice tone="error">Open this page from the reset link in your email. Links expire after one hour.</Notice>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password.length < 10) return setError('Choose a password of at least 10 characters.')
            setPending(true)
            try {
              await updatePassword(password)
              navigate('/studio', { replace: true })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Couldn’t update your password.')
            } finally {
              setPending(false)
            }
          }}
        >
          <label htmlFor="new-password" className="text-[13px] font-medium text-silver">
            New password
          </label>
          <input id="new-password" type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={pending} className="min-h-12 cursor-pointer rounded-full bg-lime text-sm font-semibold text-obsidian disabled:opacity-70">
            {pending ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
