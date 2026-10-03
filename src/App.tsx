import { useState } from 'react'
import { Home, Search, ShoppingBasket, UserRound } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'

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
        <PageSkeleton />
      </main>

      <nav
        aria-label="Esasy nawigasiýa"
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