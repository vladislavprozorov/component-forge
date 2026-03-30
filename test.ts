interface Product {
  id: number
  name: string
  price: number
  category: Category
  description?: string
}

type Category = 'electronics' | 'clothing' | 'food'

interface Cart {
  products: Product[]
  userId: number
}

function getTotalPrice(cart: Cart): number {
  let total = 0
  for (const product of cart.products) {
    total += product.price
  }
  return total
}
