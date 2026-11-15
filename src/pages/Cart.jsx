import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { money } from '../lib/supabase'

export default function Cart() {
  const { items, setQty, remove, total } = useCart()
  const nav = useNavigate()
  if (!items.length) return <div className="py-16 text-center"><p className="mb-4">Votre panier est vide.</p><Link to="/" className="btn-primary">Découvrir les articles</Link></div>

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Mon panier</h1>
      {items.map(i => (
        <div key={i.k} className="flex gap-3 rounded-2xl bg-white p-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-nid-soft">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
          <div className="flex-1">
            <p className="font-bold">{i.title}</p>
            {i.size && <p className="text-sm">Taille : {i.size}</p>}
            <p className="font-bold text-nid">{money(i.price)}</p>
            <div className="mt-1 flex items-center gap-3">
              <button className="btn-ghost !px-3 !py-1" onClick={() => setQty(i.k, i.qty - 1)} aria-label="Moins">−</button>
              <span className="font-bold">{i.qty}</span>
              <button className="btn-ghost !px-3 !py-1" onClick={() => setQty(i.k, i.qty + 1)} aria-label="Plus">+</button>
              <button className="ml-auto text-sm text-berry underline" onClick={() => remove(i.k)}>Retirer</button>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-nid-soft p-4 text-lg font-bold"><span>Sous-total</span><span>{money(total)}</span></div>
      <button className="btn-primary w-full" onClick={() => nav('/commander')}>Passer la commande</button>
    </div>
  )
}
