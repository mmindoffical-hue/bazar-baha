import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'
import { readBasket, writeBasket, type BasketItem } from './lib/basket'
import type { Category, Product } from './lib/types'
import { BottomNavigation } from './components/BottomNavigation'
import { BasketPage } from './pages/BasketPage'
import { HomePage } from './pages/HomePage'
import { ProductPage } from './pages/ProductPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import type { StoreMapRecord } from './lib/types'
import { registerSW } from 'virtual:pwa-register'

const MapExperience = lazy(() => import('./components/MapExperience').then((module) => ({ default: module.MapExperience })))
const StoreProductsPage = lazy(() => import('./components/MapExperience').then((module) => ({ default: module.StoreProductsPage })))

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedStore, setSelectedStore] = useState<StoreMapRecord | null>(null)
  const [mapProductId, setMapProductId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [basket, setBasket] = useState<BasketItem[]>(readBasket)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    writeBasket(basket)
  }, [basket])

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => setUpdateAvailable(true),
      onRegisterError: (error) => console.error('Service worker registration failed.', error),
    })
    setUpdateServiceWorker(() => update)
  }, [])

  const updateBasket = (nextBasket: BasketItem[]) => {
    setBasket(nextBasket)
  }

  const addToBasket = (productId: string) => {
    if (basket.some((item) => item.productId === productId)) return
    updateBasket([...basket, { productId, qty: 1 }])
  }

  const openPage = (page: PageKey) => {
    setActivePage(page)
    setSelectedCategory(null)
    setSelectedProduct(null)
    setSelectedStore(null)
    setMapProductId(null)
    setSearchTerm('')
  }

  const goBack = () => {
    if (selectedStore) setSelectedStore(null)
    else if (activePage === 'map' && mapProductId) {
      setActivePage('home')
      setMapProductId(null)
    } else if (selectedProduct) setSelectedProduct(null)
    else setSelectedCategory(null)
  }

  const pageTitle = selectedStore?.name ?? selectedProduct?.name_tk ?? selectedCategory?.name_tk ?? tk.navigation[activePage]

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-white pb-24 shadow-sm">
      <header className="border-b border-stone-100 px-5 pb-5 pt-7">
        <p className="text-sm font-semibold tracking-wide text-emerald-800">{tk.appName}</p>
        <h1 className="mt-5 text-2xl font-semibold text-stone-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {selectedStore
            ? tk.buyer.storeProductsTitle(selectedStore.name)
            : activePage === 'map' ? tk.pageDescriptions.map
              : selectedProduct ? tk.buyer.price : selectedCategory ? tk.buyer.products : tk.pageDescriptions[activePage]}
        </p>
      </header>

      <main className="px-5 py-1">
        {(selectedProduct || selectedCategory || selectedStore || (activePage === 'map' && mapProductId)) && (
          <button
            type="button"
            onClick={goBack}
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {tk.buyer.back}
          </button>
        )}

        {activePage === 'home' && (
          <HomePage
            active
            visible={!selectedProduct}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSelectProduct={setSelectedProduct}
          />
        )}
        {activePage === 'search' && (
          <SearchPage
            active
            visible={!selectedProduct}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelectProduct={setSelectedProduct}
          />
        )}
        {selectedProduct && activePage !== 'map' && <ProductPage
          product={selectedProduct}
          basket={basket}
          onAddToBasket={addToBasket}
          onOpenProfile={() => openPage('profile')}
          onShowOnMap={() => {
            setMapProductId(selectedProduct.id)
            setSelectedStore(null)
            setActivePage('map')
          }}
        />}
        {activePage === 'map' && (
          <Suspense fallback={<p className="mt-8 text-sm text-stone-500">{tk.buyer.mapLoading}</p>}>
            {selectedStore ? (
              <StoreProductsPage store={selectedStore} basket={basket} onAddToBasket={addToBasket} />
            ) : (
              <MapExperience
                productId={mapProductId}
                onOpenStore={setSelectedStore}
              />
            )}
          </Suspense>
        )}
        <ProfilePage visible={activePage === 'profile'} />
        {activePage === 'basket' && (
          <BasketPage basket={basket} onBasketChange={updateBasket} />
        )}
      </main>

      <BottomNavigation activePage={activePage} onNavigate={openPage} />
      {updateAvailable && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-[1000] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg bg-stone-900 px-4 py-3 text-white shadow-lg">
          <p className="text-sm font-medium">{tk.buyer.appUpdateAvailable}</p>
          <button
            type="button"
            onClick={() => {
              if (updateServiceWorker) {
                void updateServiceWorker(true).catch((error: unknown) => {
                  console.error('Service worker update failed.', error)
                })
              }
            }}
            className="min-h-10 shrink-0 rounded-md bg-white px-3 text-sm font-semibold text-stone-900"
          >
            {tk.buyer.updateApp}
          </button>
        </div>
      )}
    </div>
  )
}
