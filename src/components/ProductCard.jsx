import { Link } from 'react-router-dom'
import { money } from '../lib/supabase'

export default function ProductCard({ p }) {
  return (
    <Link to={`/produit/${p.id}`} className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-nid-soft">
      <div className="aspect-square bg-nid-soft">
        {p.images?.[0] && <img src={p.images[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold">{p.title}</h3>
        <p className="mt-1 font-bold text-nid">{money(p.price, p.currency)}</p>
        <p className="text-xs opacity-70">{p.stores?.name}</p>
        {p.stock === 0 && <p className="text-xs font-bold text-berry">Épuisé</p>}
      </div>
    </Link>
  )
}
