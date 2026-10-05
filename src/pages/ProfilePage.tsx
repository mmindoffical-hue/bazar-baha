import { useState, type FormEvent } from 'react'
import { tk } from '../i18n/tk'
import { useAuth } from '../lib/AuthContext'
import { StoreProfile } from '../components/StoreProfile'

export function ProfilePage({ visible }: { visible: boolean }) {
  const { user, role, loading, signIn, signUp, signOut } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError(tk.form.emailRequired)
      return
    }
    if (!password) {
      setError(tk.form.passwordRequired)
      return
    }

    setSubmitting(true)
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password)
    setSubmitting(false)

    if (result) {
      if (isSignUp && result === tk.auth.emailConfirmation) setNotice(result)
      else setError(result)
    } else if (isSignUp) {
      setNotice(tk.auth.signedUp)
      setPassword('')
    }
  }

  const handleSignOut = async () => {
    setError('')
    const result = await signOut()
    if (result) setError(result)
  }

  return (
    <div hidden={!visible}>
      {!visible ? null : loading ? (
        <p className="mt-8 text-sm text-stone-500">{tk.auth.loading}</p>
      ) : user ? (
      <section className="mt-8 space-y-5">
        <div className="border-b border-stone-200 pb-5">
          <p className="text-sm text-stone-500">{tk.auth.email}</p>
          <p className="mt-1 break-all font-medium text-stone-900">{user.email}</p>
        </div>
        <StoreProfile userId={user.id} role={role} />
        <button
          type="button"
          onClick={handleSignOut}
          className="min-h-12 w-full rounded-md bg-stone-900 px-4 font-semibold text-white transition-colors hover:bg-stone-700"
        >
          {tk.auth.signOut}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>
      ) : (
      <section className="mt-8">
      <form onSubmit={(event) => void handleAuth(event)} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium text-stone-700">
          <span>{tk.auth.email}</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-stone-700">
          <span>{tk.auth.password}</span>
          <input
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-md bg-emerald-800 px-4 font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting
            ? isSignUp ? tk.auth.signingUp : tk.auth.signingIn
            : isSignUp ? tk.auth.createAccount : tk.auth.signIn}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp)
          setError('')
          setNotice('')
        }}
        className="mt-4 min-h-11 w-full text-sm font-medium text-emerald-900 underline underline-offset-4"
      >
        {isSignUp ? tk.auth.haveAccount : tk.auth.needAccount}
      </button>
      </section>
      )}
    </div>
  )
}
