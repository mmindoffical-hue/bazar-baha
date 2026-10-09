export type Category = { id: number; name_tk: string }
export type Product = { id: string; name_tk: string; unit: string }
export type PriceListing = {
  price_id: string
  store_id: string
  price: number
  in_stock: boolean
  photo_paths: string[]
  updated_at: string
  store_name: string
  product_id: string
  product_name: string
  unit: string
}

export type StoreStatus = 'pending' | 'approved' | 'suspended'
export type StoreRecord = {
  id: string
  owner_id: string
  name: string
  phone: string
  city: string | null
  address: string
  lat: number | null
  lng: number | null
  photo_path: string | null
  status: StoreStatus
}
export type StoreFields = {
  name: string
  phone: string
  city: string
  address: string
  lat: number | null
  lng: number | null
}
export type StoreProduct = Product & { category_id: number }
export type StorePrice = {
  id: string
  product_id: string
  price: number | string
  in_stock: boolean
  photo_paths: string[]
  updated_at: string
}
