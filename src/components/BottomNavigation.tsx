import { Home, Search, ShoppingBasket, UserRound } from 'lucide-react'
import { tk, type PageKey } from '../i18n/tk'

const navigation: { key: PageKey; icon: typeof Home }[] = [
  { key: 'home', icon: Home },
  { key: 'search', icon: Search },
  { key: 'basket', icon: ShoppingBasket },
  { key: 'profile', icon: UserRound },
]

export function BottomNavigation({ activePage, onNavigate }: {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
}) {
  return (
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
            onClick={() => onNavigate(key)}
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
  )
}
