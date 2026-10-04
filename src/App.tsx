import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Home, Search, ShoppingBasket, UserRound } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'

const navigation: { key: PageKey; icon: typeof Home }[] = [
  { key: 'home', icon: Home },
  { key: 'search', icon: Search },
  { key: 'basket', icon: ShoppingBasket },
  { key: 'profile', icon: UserRound },
]

type Category = { id: number; name_tk: string }
type Product = { id: string; name_tk: string; unit: string }
type PriceListing = {
  price_id: string
  price: number
  in_stock: boolean
  updated_at: string
  store_name: string
  product_id: string
  product_name: string
  unit: string
}

function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-6 animate-pulse space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-19 rounded-md bg-stone-100" />
      ))}
    </div>
  )
}

function relativeTime(updatedAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000))
  if (elapsedMinutes < 1) return tk.buyer.relativeTime.justNow
  if (elapsedMinutes < 60) return tk.buyer.relativeTime.minutes(elapsedMinutes)
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return tk.buyer.relativeTime.hours(elapsedHours)
  return tk.buyer.relativeTime.days(Math.floor(elapsedHours / 24))
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priceListings, setPriceListings] = useState<PriceListing[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [pricesError, setPricesError] = useState(false)
  const { user, loading, signIn, signUp, signOut } = useAuth()

  useEffect(() => {
    if (!supabase) {
      setCategoriesError(true)
      setCategoriesLoading(false)
      return
    }

    let active = true
    void supabase
      .from('categories')
      .select('id, name_tk')
      .order('name_tk')
      .then(({ data, error: requestError }) => {
        if (!active) return
        setCategories(data ?? [])
        setCategoriesError(Boolean(requestError))
        setCategoriesLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    const isHomeCategory = activePage === 'home' && selectedCategory
    const isSearch = activePage === 'search' && searchTerm.trim()
    if (!isHomeCategory && !isSearch) {
      setProducts([])
      setProductsError(false)
      setProductsLoading(false)
      return
    }
    if (!supabase) {
      setProductsError(true)
      setProductsLoading(false)
      return
    }

    let active = true
    setProductsLoading(true)
    setProductsError(false)
    let request = supabase.from('products').select('id, name_tk, unit')
    if (isHomeCategory) request = request.eq('category_id', selectedCategory.id)
    else request = request.ilike('name_tk', `%${searchTerm.trim()}%`)

    void request.order('name_tk').then(({ data, error: requestError }) => {
      if (!active) return
      setProducts(data ?? [])
      setProductsError(Boolean(requestError))
      setProductsLoading(false)
    })

    return () => { active = false }
  }, [activePage, selectedCategory, searchTerm])

  useEffect(() => {
    if (!selectedProduct) {
      setPriceListings([])
      setPricesError(false)
      setPricesLoading(false)
      return
    }
    if (!supabase) {
      setPricesError(true)
      setPricesLoading(false)
      return
    }

    let active = true
    setPricesLoading(true)
    setPricesError(false)
    void supabase
      .from('price_list')
      .select('price_id, price, in_stock, updated_at, store_name, product_id, product_name, unit')
      .eq('product_id', selectedProduct.id)
      .order('price', { ascending: true })
      .then(({ data, error: requestError }) => {
        if (!active) return
        setPriceListings((data ?? []) as PriceListing[])
        setPricesError(Boolean(requestError))
        setPricesLoading(false)
      })

    return () => { active = false }
  }, [selectedProduct])

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

  const openPage = (page: PageKey) => {
    setActivePage(page)
    setSelectedCategory(null)
    setSelectedProduct(null)
    setSearchTerm('')
  }

  const goBack = () => {
    if (selectedProduct) setSelectedProduct(null)
    else setSelectedCategory(null)
  }

  const pageTitle = selectedProduct?.name_tk ?? selectedCategory?.name_tk ?? tk.navigation[activePage]

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-white pb-24 shadow-sm">
      <header className="border-b border-stone-100 px-5 pb-5 pt-7">
        <p className="text-sm font-semibold tracking-wide text-emerald-800">
          {tk.appName}
        </p>
        <h1 className="mt-5 text-2xl font-semibold text-stone-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {selectedProduct ? tk.buyer.price : selectedCategory ? tk.buyer.products : tk.pageDescriptions[activePage]}
        </p>
      </header>

      <main className="px-5 py-1">
        {(selectedProduct || selectedCategory) && (
          <button
            type="button"
            onClick={goBack}
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {tk.buyer.back}
          </button>
        )}
        {selectedProduct ? (
          <section aria-label={selectedProduct.name_tk} className="mt-5 space-y-3">
            {pricesLoading ? <PageSkeleton /> : pricesError ? (
              <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
            ) : priceListings.length === 0 ? (
              <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
            ) : priceListings.map((listing) => {
              const isOld = Date.now() - new Date(listing.updated_at).getTime() > 24 * 60 * 60 * 1000
              return (
                <article
                  key={listing.price_id}
                  className={`border-b border-stone-200 py-4 ${isOld ? 'bg-stone-50 text-stone-400' : 'text-stone-800'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="min-w-0 wrap-break-word font-semibold">{listing.store_name}</h2>
                    <p className="shrink-0 text-right text-lg font-bold tabular-nums">
                      {Number(listing.price).toFixed(2)} <span className="text-sm font-medium">{tk.buyer.currency}</span>
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{tk.buyer.unit}: {listing.unit}</span>
                    <span>{listing.in_stock ? tk.buyer.inStock : tk.buyer.outOfStock}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span>{tk.buyer.updated}: {relativeTime(listing.updated_at)}</span>
                    {isOld && <span className="font-semibold">{tk.buyer.oldData}</span>}
                  </div>
                </article>
              )
            })}
          </section>
        ) : activePage === 'home' ? (
          <section className="mt-6">
            {selectedCategory ? (
              productsLoading ? <PageSkeleton /> : productsError ? (
                <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
              ) : products.length === 0 ? (
                <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
              ) : (
                <div className="divide-y divide-stone-200">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-medium text-stone-800"
                    >
                      <span>{product.name_tk}</span>
                      <span className="flex items-center gap-2 text-sm text-stone-500">
                        {product.unit}<ChevronRight aria-hidden="true" size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : categoriesLoading ? <PageSkeleton rows={6} /> : categoriesError ? (
              <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
            ) : categories.length === 0 ? (
              <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
            ) : (
              <>
                <h2 className="mb-2 text-sm font-semibold text-stone-500">{tk.buyer.categories}</h2>
                <div className="divide-y divide-stone-200">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-semibold text-stone-800"
                    >
                      {category.name_tk}<ChevronRight aria-hidden="true" size={19} className="text-stone-500" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : activePage === 'search' ? (
          <section className="mt-6">
            <label className="relative block">
              <Search aria-hidden="true" size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={tk.buyer.searchPlaceholder}
                aria-label={tk.buyer.searchLabel}
                className="min-h-12 w-full rounded-md border border-stone-300 bg-white pl-10 pr-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
              />
            </label>
            {!searchTerm.trim() ? (
              <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.searchPrompt}</p>
            ) : productsLoading ? <PageSkeleton /> : productsError ? (
              <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
            ) : products.length === 0 ? (
              <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-200">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-medium text-stone-800"
                  >
                    <span>{product.name_tk}</span>
                    <span className="flex items-center gap-2 text-sm text-stone-500">
                      {product.unit}<ChevronRight aria-hidden="true" size={18} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : activePage === 'profile' ? (
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
        ) : activePage === 'basket' ? (
          <PageSkeleton />
        ) : null}
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
              onClick={() => openPage(key)}
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