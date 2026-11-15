import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartCtx = createContext(null)
export const useCart = () => useContext(CartCtx)

// Le panier est conservé dans localStorage (fonctionne hors-ligne dans la PWA)
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nidoo_cart')) || [] } catch { return [] }
  })
  useEffect(() => { try { localStorage.setItem('nidoo_cart', JSON.stringify(items)) } catch {} }, [items])

  const key = (id, size) => `${id}|${size || ''}`
  const add = (p, size, qty = 1) => setItems(prev => {
    const k = key(p.id, size), found = prev.find(i => i.k === k)
    if (found) return prev.map(i => i.k === k ? { ...i, qty: Math.min(i.qty + qty, p.stock) } : i)
    return [...prev, { k, id: p.id, store_id: p.store_id, title: p.title, price: Number(p.price), image: p.images?.[0], size, stock: p.stock, qty }]
  })
  const setQty = (k, qty) => setItems(prev => prev.map(i => i.k === k ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i))
  const remove = (k) => setItems(prev => prev.filter(i => i.k !== k))
  const clear = () => setItems([])

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items])
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])

  return <CartCtx.Provider value={{ items, add, setQty, remove, clear, total, count }}>{children}</CartCtx.Provider>
}
