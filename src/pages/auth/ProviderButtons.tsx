import { useEffect, useState } from 'react'
import { enabledProviders, PROVIDER_NAMES, signInWithProvider, type OAuthProvider } from '@/auth/actions'

/** Official marks, used as each provider's sign-in guidelines ask. */
const ICONS: Record<OAuthProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M16.37 12.73c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.52.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.14zM13.79 5.1c.71-.87 1.2-2.07 1.06-3.27-1.03.04-2.28.69-3.01 1.55-.66.76-1.24 1.98-1.08 3.16 1.15.09 2.32-.58 3.03-1.44z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3z" />
    </svg>
  ),
}

export function ProviderButtons({ next, onError, verb }: { next: string; onError: (message: string) => void; verb: 'Continue' | 'Sign up' }) {
  const [enabled, setEnabled] = useState<Record<OAuthProvider, boolean> | null>(null)
  const [pending, setPending] = useState<OAuthProvider | null>(null)

  useEffect(() => {
    void enabledProviders().then(setEnabled)
  }, [])

  async function go(p: OAuthProvider) {
    if (enabled && !enabled[p]) {
      onError(`Sign-in with ${PROVIDER_NAMES[p]} isn’t switched on for this site yet. Use your email and a password for now.`)
      return
    }
    setPending(p)
    try {
      await signInWithProvider(p, next) // the browser leaves for the provider
    } catch (e) {
      setPending(null)
      onError(e instanceof Error ? e.message : `Sign-in with ${PROVIDER_NAMES[p]} failed. Try again.`)
    }
  }

  return (
    <div className="grid gap-2.5">
      {(['google', 'apple', 'github'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => void go(p)}
          disabled={!!pending}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-graphite-2 text-sm font-medium text-porcelain ring-1 ring-inset ring-hairline transition-colors hover:ring-silver/40 disabled:cursor-wait disabled:opacity-60"
        >
          {ICONS[p]}
          {pending === p ? `Opening ${PROVIDER_NAMES[p]}…` : `${verb} with ${PROVIDER_NAMES[p]}`}
        </button>
      ))}
    </div>
  )
}
