import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '@/auth/actions'
import { BillingSection } from '@/billing/BillingSection'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { inputClass } from '@/studio/ui'
import { StudioShell } from './StudioShell'

export default function Account() {
  const { mode, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Account · OBJECT.'
    if (!supabase || !user) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setName(data?.display_name ?? ''))
    supabase
      .from('workspaces')
      .select('name')
      .order('created_at')
      .limit(1)
      .single()
      .then(({ data }) => setWorkspace(data?.name ?? ''))
  }, [user])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !user) return
    setError(null)
    const a = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', user.id)
    const b = await supabase.from('workspaces').update({ name: workspace.trim() || 'My studio' }).eq('owner_id', user.id)
    if (a.error || b.error) setError((a.error ?? b.error)!.message)
    else setStatus('Saved')
  }

  return (
    <StudioShell>
      <main className="gutter grid max-w-3xl gap-14 py-10 md:py-14">
        <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">Account</h1>

        {mode === 'local' ? (
          <p className="text-silver">Accounts aren’t connected on this site yet. Your showrooms are stored in this browser.</p>
        ) : (
          <>
            <section aria-labelledby="profile-h" className="grid gap-5">
              <h2 id="profile-h" className="text-xl font-semibold tracking-tight">
                Profile
              </h2>
              <form onSubmit={save} className="grid gap-4">
                <div className="grid gap-1.5">
                  <label htmlFor="acc-email" className="text-[13px] font-medium text-silver">
                    Email
                  </label>
                  <input id="acc-email" className={`${inputClass} opacity-70`} value={user?.email ?? ''} readOnly />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="acc-name" className="text-[13px] font-medium text-silver">
                    Your name
                  </label>
                  <input id="acc-name" className={inputClass} value={name} maxLength={80} onChange={(e) => (setName(e.target.value), setStatus(null))} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="acc-ws" className="text-[13px] font-medium text-silver">
                    Studio name
                  </label>
                  <input id="acc-ws" className={inputClass} value={workspace} maxLength={80} onChange={(e) => (setWorkspace(e.target.value), setStatus(null))} />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-[#ff9d8f]">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-4">
                  <button type="submit" className="min-h-11 cursor-pointer rounded-full bg-porcelain px-5 text-sm font-semibold text-obsidian">
                    Save changes
                  </button>
                  <span role="status" className="text-sm text-ash">
                    {status}
                  </span>
                </div>
              </form>
            </section>

            <BillingSection />

            <section className="grid gap-4 border-t border-hairline pt-10">
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  navigate('/', { replace: true })
                }}
                className="min-h-11 w-fit cursor-pointer rounded-full px-5 text-sm ring-1 ring-inset ring-silver/30 hover:ring-porcelain"
              >
                Sign out
              </button>
              <p className="text-xs text-ash">To delete your account and all its showrooms, write to us from your account email. Self-service deletion is coming.</p>
            </section>
          </>
        )}
      </main>
    </StudioShell>
  )
}
