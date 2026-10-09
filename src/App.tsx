import { useEffect, useState } from 'react'
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

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [basket, setBasket] = useState<BasketItem[]>(readBasket)

  useEffect(() => {
    writeBasket(basket)
  }, [basket])

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
        <p className="text-sm font-semibold tracking-wide text-emerald-800">{tk.appName}</p>
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
        {selectedProduct && <ProductPage product={selectedProduct} basket={basket} onAddToBasket={addToBasket} onOpenProfile={() => openPage('profile')} />}
        <ProfilePage visible={activePage === 'profile'} />
        {activePage === 'basket' && (
          <BasketPage basket={basket} onBasketChange={updateBasket} />
        )}
      </main>

      <BottomNavigation activePage={activePage} onNavigate={openPage} />
    </div>
  )
}
