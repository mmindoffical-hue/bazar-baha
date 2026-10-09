export type BasketItem = { productId: string; qty: number }

const basketKey = 'bazar_basket'

export function readBasket(): BasketItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(basketKey) ?? '[]')
    if (!Array.isArray(value)) return []
    const productIds = new Set<string>()
    const isValid = value.every((item) => {
      const valid =
        item !== null &&
        typeof item === 'object' &&
        typeof item.productId === 'string' &&
        item.productId.length > 0 &&
        typeof item.qty === 'number' &&
        Number.isFinite(item.qty) &&
        item.qty >= 0.5 &&
        item.qty <= 99 &&
        Number.isInteger(item.qty * 2) &&
        !productIds.has(item.productId)
      if (valid) productIds.add(item.productId)
      return valid
    })
    return isValid ? value as BasketItem[] : []
  } catch {
    return []
  }
}

export function writeBasket(basket: BasketItem[]) {
  try {
    localStorage.setItem(basketKey, JSON.stringify(basket))
  } catch {
  }
}