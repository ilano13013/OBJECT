import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { safeNext, sendMagicLink, sendPasswordReset, signIn, signUp } from '@/auth/actions'
import { useAuth } from '@/auth/AuthProvider'
import { inputClass } from '@/studio/ui'
import { AuthShell, Notice } from './AuthShell'

type Tab = 'signin' | 'signup'

export default function Login() {
  const { mode, user, loading } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${tab === 'signin' ? 'Sign in' : 'Create your account'} · OBJECT.`
  }, [tab])

  if (mode === 'local') {
    return (
      <AuthShell title="Accounts open soon">
        <Notice>This version of OBJECT. runs without accounts: your showrooms are saved in this browser.</Notice>
        <Link to="/studio" className="inline-flex min-h-12 items-center justify-center rounded-full bg-lime px-6 text-sm font-semibold text-obsidian">
          Open the studio
        </Link>
      </AuthShell>
    )
  }
  if (!loading && user) return <Navigate to={next} replace />

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    setInfo(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setError('Enter the email address you use for OBJECT.')
    if (tab === 'signup' && password.length < 10) return setError('Choose a password of at least 10 characters.')
    void run(async () => {
      if (tab === 'signin') {
        await signIn(email.trim(), password)
        navigate(next, { replace: true })
      } else {
        const ready = await signUp(email.trim(), password, name, next)
        if (ready) navigate(next, { replace: true })
        else setInfo(`We sent a confirmation link to ${email.trim()}. Open it to activate your account.`)
      }
    })
  }

  return (
    <AuthShell title={tab === 'signin' ? 'Welcome back' : 'Create your studio'}>
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-lg bg-graphite-2 p-1 ring-1 ring-inset ring-hairline">
        {(['signin', 'signup'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
              setError(null)
              setInfo(null)
            }}
            className={`min-h-10 cursor-pointer rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-porcelain text-obsidian' : 'text-silver hover:text-porcelain'}`}
          >
            {t === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-4" noValidate>
        {tab === 'signup' && (
          <div className="grid gap-1.5">
            <label htmlFor="name" className="text-[13px] font-medium text-silver">
              Your name or brand
            </label>
            <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="organization" />
          </div>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-[13px] font-medium text-silver">
            Email
          </label>
          <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-[13px] font-medium text-silver">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            minLength={tab === 'signup' ? 10 : undefined}
            required
            aria-describedby={tab === 'signup' ? 'password-hint' : undefined}
          />
          {tab === 'signup' && (
            <p id="password-hint" className="text-[13px] text-ash">
              At least 10 characters.
            </p>
          )}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {info && <Notice tone="success">{info}</Notice>}
        <button type="submit" disabled={pending} className="min-h-12 cursor-pointer rounded-full bg-lime text-sm font-semibold text-obsidian disabled:cursor-wait disabled:opacity-70">
          {pending ? 'One moment…' : tab === 'signin' ? 'Sign in' : 'Create my account'}
        </button>
      </form>

      {tab === 'signin' && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <button
            type="button"
            className="min-h-11 cursor-pointer text-silver underline decoration-hairline underline-offset-4 hover:text-porcelain"
            onClick={() => {
              if (!email.includes('@')) return setError('Enter your email first, then ask for a link.')
              void run(async () => {
                await sendMagicLink(email.trim(), next)
                setInfo(`If an account exists for ${email.trim()}, a sign-in link is on its way.`)
              })
            }}
          >
            Email me a sign-in link
          </button>
          <button
            type="button"
            className="min-h-11 cursor-pointer text-silver underline decoration-hairline underline-offset-4 hover:text-porcelain"
            onClick={() => {
              if (!email.includes('@')) return setError('Enter your email first, then reset your password.')
              void run(async () => {
                await sendPasswordReset(email.trim())
                setInfo(`If an account exists for ${email.trim()}, a reset link is on its way.`)
              })
            }}
          >
            Forgot password?
          </button>
        </div>
      )}
      <p className="text-xs leading-relaxed text-ash">
        No tracking cookies. We only use your email to sign you in and send account messages.
      </p>
    </AuthShell>
  )
}
