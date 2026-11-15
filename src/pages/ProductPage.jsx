import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, money } from '../lib/supabase'
import { useCart } from '../context/CartContext'

export default function ProductPage() {
  const { id } = useParams()
  const { add } = useCart()
  const nav = useNavigate()
  const [p, setP] = useState(null)
  const [size, setSize] = useState('')
  const [img, setImg] = useState(0)

  useEffect(() => { supabase.from('products').select('*, stores(name, phone)').eq('id', id).single().then(({ data }) => { setP(data); setSize(data?.sizes?.[0] || '') }) }, [id])
  if (!p) return <p>Chargement…</p>

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-2xl bg-nid-soft">{p.images?.[img] && <img src={p.images[img]} alt={p.title} className="h-full w-full object-cover" />}</div>
        <div className="mt-2 flex gap-2">{p.images?.map((u, i) => <button key={u} onClick={() => setImg(i)}><img src={u} alt="" className={`h-14 w-14 rounded-lg object-cover ${i === img ? 'ring-2 ring-nid' : ''}`} /></button>)}</div>
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{p.title}</h1>
        <p className="text-2xl font-bold text-nid">{money(p.price, p.currency)}</p>
        <p className="text-sm">Vendu par <Link className="underline" to={`/boutique/${p.store_id}`}><b>{p.stores?.name}</b></Link> · {p.category}</p>
        <p>{p.description}</p>
        {p.sizes?.length > 0 && <div className="flex flex-wrap gap-2">{p.sizes.map(s => <button key={s} onClick={() => setSize(s)} className={`rounded-lg px-3 py-1.5 font-bold ${size === s ? 'bg-nid text-white' : 'bg-white ring-1 ring-nid-soft'}`}>{s}</button>)}</div>}
        <p className="text-sm">{p.stock > 0 ? `${p.stock} en stock` : 'Épuisé'}</p>
        <button className="btn-primary w-full" disabled={p.stock === 0} onClick={() => { add(p, size); nav('/panier') }}>Ajouter au panier</button>
        {p.stores?.phone && <a className="btn-ghost w-full" target="_blank" rel="noreferrer" href={`https://wa.me/${p.stores.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, une question sur : ' + p.title)}`}>Poser une question sur WhatsApp</a>}
      </div>
    </div>
  )
}
