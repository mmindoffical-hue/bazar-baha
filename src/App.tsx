import { useState, type FormEvent } from 'react'
import { ArrowRight, Home, Search, ShoppingBasket, UserRound } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'
import { useAuth } from './lib/AuthContext'

const navigation: { key: PageKey; icon: typeof Home }[] = [
  { key: 'home', icon: Home },
  { key: 'search', icon: Search },
  { key: 'basket', icon: ShoppingBasket },
  { key: 'profile', icon: UserRound },
]

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8 space-y-5">
      <div className="h-32 rounded-md bg-stone-100" />
      <div className="space-y-3">
        <div className="h-4 w-2/5 rounded bg-stone-100" />
        <div className="h-16 rounded-md bg-stone-100" />
        <div className="h-16 rounded-md bg-stone-100" />
        <div className="h-16 rounded-md bg-stone-100" />
      </div>
    </div>
  )
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, loading, signIn, signUp, signOut } = useAuth()

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
    <div className="mx-auto min-h-dvh max-w-xl bg-white pb-24 shadow-sm">
      <header className="border-b border-stone-100 px-5 pb-5 pt-7">
        <p className="text-sm font-semibold tracking-wide text-emerald-800">
          {tk.appName}
        </p>
        <h1 className="mt-5 text-2xl font-semibold text-stone-900">
          {tk.navigation[activePage]}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {tk.pageDescriptions[activePage]}
        </p>
      </header>

      <main className="px-5 py-1">
        {activePage === 'profile' ? (
          loading ? (
            <p className="mt-8 text-sm text-stone-500">{tk.auth.loading}</p>
          ) : user ? (
            <section className="mt-8 space-y-5">
              <div className="border-b border-stone-200 pb-5">
                <p className="text-sm text-stone-500">{tk.auth.email}</p>
                <p className="mt-1 break-all font-medium text-stone-900">{user.email}</p>
              </div>
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
              <form onSubmit={handleAuth} className="space-y-4">
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
          )
        ) : activePage === 'basket' && !loading && !user ? (
          <section className="mt-8 border-l-4 border-emerald-800 py-2 pl-4">
            <h2 className="text-lg font-semibold text-stone-900">{tk.basketAuth.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{tk.basketAuth.description}</p>
            <button
              type="button"
              onClick={() => setActivePage('profile')}
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-900"
            >
              {tk.basketAuth.goToProfile}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </section>
        ) : (
          <PageSkeleton />
        )}
      </main>

      <nav
        aria-label={tk.navigationLabel}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-xl grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {navigation.map(({ key, icon: Icon }) => {
          const isActive = activePage === key

          return (
            <button
              key={key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActivePage(key)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-800' : 'text-stone-500'
              }`}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{tk.navigation[key]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}