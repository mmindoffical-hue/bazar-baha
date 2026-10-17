import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'
import { readBasket, writeBasket, type BasketItem } from './lib/basket'
import type { Category, Product } from './lib/types'
import { BottomNavigation } from './components/BottomNavigation'
import { BasketPage } from './pages/BasketPage'
import { ProductPage } from './pages/ProductPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import type { StoreMapRecord } from './lib/types'
import { registerSW } from 'virtual:pwa-register'

const MapExperience = lazy(() => import('./components/MapExperience').then((module) => ({ default: module.MapExperience })))
const StoreProductsPage = lazy(() => import('./components/MapExperience').then((module) => ({ default: module.StoreProductsPage })))

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('map')
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
      setActivePage('search')
      setMapProductId(null)
    } else if (selectedProduct) setSelectedProduct(null)
    else setSelectedCategory(null)
  }

  const isMapPage = activePage === 'map'
  const pageTitle = selectedStore?.name ?? selectedProduct?.name_tk ?? tk.navigation[activePage]

  return (
    <div className={`mx-auto min-h-dvh bg-white shadow-sm ${isMapPage ? '' : 'max-w-xl pb-24'}`}>
      {!isMapPage && (
        <header className="border-b border-stone-100 px-5 pb-5 pt-7">
          <p className="text-sm font-semibold tracking-wide text-emerald-800">{tk.appName}</p>
          <h1 className="mt-5 text-2xl font-semibold text-stone-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {selectedStore
              ? tk.buyer.storeProductsTitle(selectedStore.name)
              : selectedProduct ? tk.buyer.price : selectedCategory ? tk.buyer.products : tk.pageDescriptions[activePage]}
          </p>
        </header>
      )}

      <main className={isMapPage ? 'map-page' : 'px-5 py-1'}>
        {(selectedProduct || selectedCategory || selectedStore || (isMapPage && mapProductId)) && (
          <button
            type="button"
            onClick={goBack}
            className={isMapPage
              ? 'map-back-button absolute left-3 top-3 z-[1000] inline-flex min-h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-emerald-900 shadow'
              : 'mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900'}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {tk.buyer.back}
          </button>
        )}

        {activePage === 'search' && (
          <SearchPage
            active
            visible={!selectedProduct}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
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
          <Suspense fallback={<div role="status" aria-label={tk.buyer.mapLoading} className="map-load-skeleton" />}>
            {selectedStore ? (
              <div className="map-store-page">
                <StoreProductsPage store={selectedStore} basket={basket} onAddToBasket={addToBasket} />
              </div>
            ) : (
              <MapExperience
                productId={mapProductId}
                onOpenStore={setSelectedStore}
                onOpenSearch={() => openPage('search')}
                onOpenProduct={(product) => {
                  setSelectedProduct(product)
                  setSelectedCategory(null)
                  setSearchTerm(product.name_tk)
                  setActivePage('search')
                }}
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
