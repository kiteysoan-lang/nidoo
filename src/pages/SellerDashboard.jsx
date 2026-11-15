import { useCallback, useEffect, useState } from 'react'
import { supabase, uploadImage, CATEGORIES, COMMUNES, money, STATUS_LABEL } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StoreSettings from './StoreSettings'

const STATUSES = ['en_attente', 'payee', 'confirmee', 'en_livraison', 'livree', 'annulee']

export default function SellerDashboard() {
  const { user } = useAuth()
  const [store, setStore] = useState(undefined)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('produits')

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('stores').select('*').eq('owner_id', user.id).maybeSingle()
    setStore(s)
    if (s) {
      supabase.from('products').select('*').eq('store_id', s.id).order('created_at', { ascending: false }).then(({ data }) => setProducts(data || []))
      supabase.from('orders').select('*, order_items(*)').eq('store_id', s.id).order('created_at', { ascending: false }).then(({ data }) => setOrders(data || []))
    }
  }, [user.id])
  useEffect(() => { load() }, [load])

  if (store === undefined) return <p>Chargement…</p>
  if (!store) return <CreateStore uid={user.id} onDone={load} />

  const now = new Date()
  const canEdit = store.is_active && ((store.subscription_status === 'essai' && new Date(store.trial_ends_at) > now) || (store.subscription_status === 'actif' && new Date(store.subscription_ends_at) > now))
  const daysLeft = Math.max(0, Math.ceil((new Date(store.trial_ends_at) - now) / 864e5))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {store.logo_url && <img src={store.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
        <h1 className="text-2xl font-bold">{store.name}</h1>
      </div>
      {store.subscription_status === 'essai' && canEdit && <p className="rounded-xl bg-sun/40 p-3 text-sm font-semibold">Essai gratuit : il vous reste {daysLeft} jour{daysLeft > 1 ? 's' : ''}.</p>}
      {!canEdit && <SubscribeBox store={store} onDone={load} />}
      <div className="flex flex-wrap gap-2">{['produits', 'commandes', 'boutique'].map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-bold ${tab === t ? 'bg-nid text-white' : 'bg-white'}`}>{t === 'produits' ? `Produits (${products.length})` : t === 'commandes' ? `Commandes (${orders.length})` : 'Ma boutique'}</button>)}</div>
      {tab === 'produits' && <Products store={store} products={products} canEdit={canEdit} uid={user.id} reload={load} />}
      {tab === 'commandes' && <Orders orders={orders} reload={load} />}
      {tab === 'boutique' && <StoreSettings store={store} uid={user.id} reload={load} />}
    </div>
  )
}

function CreateStore({ uid, onDone }) {
  const [f, setF] = useState({ name: '', description: '', phone: '', delivery_zones: [] })
  const [logo, setLogo] = useState(null)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const toggle = c => setF(s => ({ ...s, delivery_zones: s.delivery_zones.includes(c) ? s.delivery_zones.filter(x => x !== c) : [...s.delivery_zones, c] }))
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const logo_url = logo ? await uploadImage('store-logos', logo, uid) : null
      const { error } = await supabase.from('stores').insert({ ...f, logo_url, owner_id: uid })
      if (error) throw error
      onDone()
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-3 rounded-2xl bg-white p-5">
      <h1 className="text-2xl font-bold">Créer ma boutique</h1>
      <p className="text-sm">Gratuit pendant 45 jours, sans carte bancaire.</p>
      <div><label className="label">Nom de la boutique</label><input className="input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Description</label><textarea className="input" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">Contact (téléphone / WhatsApp)</label><input className="input" required value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className="label">Logo</label><input type="file" accept="image/*" onChange={e => setLogo(e.target.files[0])} /></div>
      <div><label className="label">Communes desservies</label><div className="flex flex-wrap gap-2">{COMMUNES.map(c => <button type="button" key={c} onClick={() => toggle(c)} className={`rounded-full px-3 py-1 text-sm font-bold ${f.delivery_zones.includes(c) ? 'bg-nid text-white' : 'bg-mist'}`}>{c}</button>)}</div></div>
      {err && <p className="text-sm font-semibold text-berry">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Création…' : 'Ouvrir ma boutique'}</button>
    </form>
  )
}

function SubscribeBox({ store, onDone }) {
  const [prices, setPrices] = useState({ mensuel: 10, annuel: 100 })
  const [plan, setPlan] = useState('mensuel'); const [method, setMethod] = useState('mpesa'); const [ref, setRef] = useState(''); const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('app_settings').select('value').eq('key', 'prices').maybeSingle().then(({ data }) => data && setPrices(data.value)) }, [])
  async function submit(e) {
    e.preventDefault()
    // Le montant est fixé côté serveur (trigger) à partir des tarifs de l'admin.
    const { error } = await supabase.from('subscription_payments').insert({ store_id: store.id, plan, amount_usd: 0, method, reference: ref })
    setMsg(error ? error.message : "Paiement déclaré. L'administrateur le validera sous peu."); if (!error) { setRef(''); onDone() }
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-berry/10 p-4">
      <p className="font-bold">Votre essai ou abonnement est terminé : l'ajout et la modification de produits sont bloqués.</p>
      <p className="text-sm">Envoyez le montant par Mobile Money au numéro Nidoo, puis saisissez la référence de la transaction.</p>
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={plan} onChange={e => setPlan(e.target.value)}><option value="mensuel">Mensuel – {prices.mensuel} $</option><option value="annuel">Annuel – {prices.annuel} $</option></select>
        <select className="input !w-auto" value={method} onChange={e => setMethod(e.target.value)}><option value="mpesa">M-Pesa</option><option value="orange_money">Orange Money</option><option value="airtel_money">Airtel Money</option><option value="afrimoney">AfriMoney</option></select>
        <input className="input !w-auto" required placeholder="Référence de la transaction" value={ref} onChange={e => setRef(e.target.value)} />
        <button className="btn-primary">Déclarer mon paiement</button>
      </div>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
    </form>
  )
}

function Products({ store, products, canEdit, uid, reload }) {
  const empty = { title: '', description: '', price: '', category: CATEGORIES[0], sizes: '', stock: 1, is_published: true }
  const [f, setF] = useState(empty); const [files, setFiles] = useState([]); const [open, setOpen] = useState(false); const [err, setErr] = useState(''); const [editing, setEditing] = useState(null)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const startEdit = p => { setEditing(p); setF({ title: p.title, description: p.description || '', price: p.price, category: p.category, sizes: (p.sizes || []).join(', '), stock: p.stock, is_published: p.is_published }); setFiles([]); setOpen(true) }
  const close = () => { setOpen(false); setEditing(null); setF(empty); setFiles([]); setErr('') }
  async function submit(e) {
    e.preventDefault(); setErr('')
    try {
      const newImgs = await Promise.all([...files].map(file => uploadImage('product-images', file, uid)))
      const row = { title: f.title, description: f.description, price: Number(f.price), category: f.category, stock: Number(f.stock), is_published: f.is_published, sizes: f.sizes.split(',').map(s => s.trim()).filter(Boolean) }
      const { error } = editing
        ? await supabase.from('products').update({ ...row, images: [...(editing.images || []), ...newImgs] }).eq('id', editing.id)
        : await supabase.from('products').insert({ ...row, store_id: store.id, images: newImgs })
      if (error) throw error
      close(); reload()
    } catch (ex) { setErr(ex.message) }
  }
  const removeImage = async (p, url) => { await supabase.from('products').update({ images: p.images.filter(u => u !== url) }).eq('id', p.id); setEditing({ ...p, images: p.images.filter(u => u !== url) }); reload() }
  const updateStock = async (p, stock) => { const { error } = await supabase.from('products').update({ stock }).eq('id', p.id); if (error) alert(error.message); reload() }
  const del = async p => { if (confirm(`Supprimer « ${p.title} » ?`)) { await supabase.from('products').delete().eq('id', p.id); reload() } }

  return (
    <div className="space-y-3">
      <button className="btn-sun" disabled={!canEdit} onClick={() => (open ? close() : setOpen(true))}>{open ? 'Fermer' : 'Ajouter un produit'}</button>
      {open && (
        <form onSubmit={submit} className="space-y-2 rounded-2xl bg-white p-4">
          <h3 className="font-bold">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h3>
          <input className="input" required placeholder="Titre" value={f.title} onChange={set('title')} />
          <textarea className="input" rows={2} placeholder="Description" value={f.description} onChange={set('description')} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" required type="number" step="0.01" min="0" placeholder="Prix (USD)" value={f.price} onChange={set('price')} />
            <input className="input" required type="number" min="0" placeholder="Stock" value={f.stock} onChange={set('stock')} />
          </div>
          <select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <input className="input" placeholder="Tailles séparées par des virgules : 0-3m, 3-6m" value={f.sizes} onChange={set('sizes')} />
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.is_published} onChange={e => setF({ ...f, is_published: e.target.checked })} />Visible dans la boutique</label>
          {editing?.images?.length > 0 && <div className="flex flex-wrap gap-2">{editing.images.map(u => <div key={u} className="relative"><img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" /><button type="button" aria-label="Retirer la photo" onClick={() => removeImage(editing, u)} className="absolute -right-1 -top-1 rounded-full bg-berry px-1.5 text-xs text-white">×</button></div>)}</div>}
          <input type="file" accept="image/*" multiple onChange={e => setFiles(e.target.files)} />
          {err && <p className="text-sm font-semibold text-berry">{err}</p>}
          <button className="btn-primary w-full">{editing ? 'Enregistrer les modifications' : 'Enregistrer le produit'}</button>
        </form>
      )}
      {products.length === 0 && <p className="py-6 text-center">Aucun produit. Ajoutez votre premier article.</p>}
      {products.map(p => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-nid-soft">{p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</div>
          <div className="flex-1"><p className="font-bold">{p.title}{!p.is_published && <span className="ml-2 text-xs text-berry">masqué</span>}</p><p className="text-sm">{money(p.price)} · {p.category}</p></div>
          <input type="number" min="0" className="input !w-20" defaultValue={p.stock} key={p.stock} disabled={!canEdit} onBlur={e => Number(e.target.value) !== p.stock && updateStock(p, Number(e.target.value))} aria-label="Stock" />
          <button className="text-sm text-nid underline disabled:opacity-40" disabled={!canEdit} onClick={() => startEdit(p)}>Modifier</button>
          <button className="text-sm text-berry underline disabled:opacity-40" disabled={!canEdit} onClick={() => del(p)}>Suppr.</button>
        </div>
      ))}
    </div>
  )
}

function Orders({ orders, reload }) {
  const setStatus = async (id, status) => { await supabase.from('orders').update({ status }).eq('id', id); reload() }
  if (!orders.length) return <p className="py-6 text-center">Aucune commande reçue pour l'instant.</p>
  return orders.map(o => (
    <div key={o.id} className="space-y-1 rounded-2xl bg-white p-4">
      <div className="flex justify-between font-bold"><span>{new Date(o.created_at).toLocaleString('fr-FR')}</span><span>{money(o.total)}</span></div>
      <ul className="text-sm">{o.order_items.map(i => <li key={i.id}>{i.quantity} × {i.title}{i.size ? ` (${i.size})` : ''}</li>)}</ul>
      <p className="text-sm">Livrer à : {o.delivery_quartier}, {o.delivery_commune} {o.delivery_address && `– ${o.delivery_address}`} · <a className="underline" href={`tel:${o.contact_phone}`}>{o.contact_phone}</a></p>
      <select className="input" value={o.status} onChange={e => setStatus(o.id, e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
    </div>
  ))
}
