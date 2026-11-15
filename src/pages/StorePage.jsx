import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'

export default function StorePage() {
  const { id } = useParams()
  const [s, setS] = useState(undefined)
  const [products, setProducts] = useState([])
  useEffect(() => {
    supabase.from('stores').select('*').eq('id', id).maybeSingle().then(({ data }) => setS(data))
    supabase.from('products').select('*, stores(name)').eq('store_id', id).eq('is_published', true).order('created_at', { ascending: false }).then(({ data }) => setProducts(data || []))
  }, [id])
  if (s === undefined) return <p>Chargement…</p>
  if (!s) return <p className="py-10 text-center">Boutique introuvable.</p>
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-nid-soft">{s.logo_url && <img src={s.logo_url} alt="" className="h-full w-full object-cover" />}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{s.name}</h1>
          <p className="text-sm">{s.description}</p>
          {s.delivery_zones?.length > 0 && <p className="mt-1 text-xs">Livre à : {s.delivery_zones.join(', ')}</p>}
        </div>
        {s.phone && <a className="btn-sun" href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
      </div>
      {products.length === 0 ? <p className="py-6 text-center">Cette boutique n'a pas encore d'articles.</p>
        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{products.map(p => <ProductCard key={p.id} p={p} />)}</div>}
    </div>
  )
}
