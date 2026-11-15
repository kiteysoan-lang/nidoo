import { useEffect, useState } from 'react'
import { supabase, CATEGORIES } from '../lib/supabase'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [banner, setBanner] = useState(null)
  const [stores, setStores] = useState([])
  const [products, setProducts] = useState([])
  const [cat, setCat] = useState('')
  const [store, setStore] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('ads_banner').select('*').eq('is_active', true).maybeSingle().then(({ data }) => setBanner(data))
    supabase.from('stores').select('id,name,logo_url').eq('is_active', true).then(({ data }) => setStores(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('products').select('*, stores!inner(name, is_active)').eq('is_published', true).eq('stores.is_active', true).order('created_at', { ascending: false }).limit(60)
    if (cat) query = query.eq('category', cat)
    if (store) query = query.eq('store_id', store)
    if (q) query = query.ilike('title', `%${q}%`)
    query.then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [cat, store, q])

  return (
    <div className="space-y-5">
      {banner && (
        <a href={banner.link_url || '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl">
          <img src={banner.image_url} alt={`Partenaire : ${banner.partner_name}`} className="h-36 w-full object-cover sm:h-56" />
        </a>
      )}
      <input className="input" placeholder="Rechercher une layette, une poussette…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {['', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${cat === c ? 'bg-nid text-white' : 'bg-white text-nid ring-1 ring-nid-soft'}`}>{c || 'Tout'}</button>
        ))}
      </div>
      {stores.length > 0 && (
        <select className="input" value={store} onChange={e => setStore(e.target.value)}>
          <option value="">Toutes les boutiques</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {loading ? <p>Chargement…</p> : products.length === 0
        ? <p className="py-10 text-center">Aucun article pour ce filtre. Essayez une autre catégorie.</p>
        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{products.map(p => <ProductCard key={p.id} p={p} />)}</div>}
    </div>
  )
}
