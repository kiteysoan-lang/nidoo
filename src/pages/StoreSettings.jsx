import { useState } from 'react'
import { supabase, uploadImage, COMMUNES } from '../lib/supabase'

export default function StoreSettings({ store, uid, reload }) {
  const [f, setF] = useState({ name: store.name, description: store.description || '', phone: store.phone || '', delivery_zones: store.delivery_zones || [] })
  const [logo, setLogo] = useState(null); const [msg, setMsg] = useState('')
  const toggle = c => setF(s => ({ ...s, delivery_zones: s.delivery_zones.includes(c) ? s.delivery_zones.filter(x => x !== c) : [...s.delivery_zones, c] }))
  async function submit(e) {
    e.preventDefault()
    try {
      const patch = { ...f }
      if (logo) patch.logo_url = await uploadImage('store-logos', logo, uid)
      const { error } = await supabase.from('stores').update(patch).eq('id', store.id)
      if (error) throw error
      setMsg('Boutique mise à jour.'); reload()
    } catch (ex) { setMsg(ex.message) }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4">
      <div><label className="label">Nom</label><input className="input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Description</label><textarea className="input" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">Contact / WhatsApp</label><input className="input" required value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className="label">Nouveau logo</label><input type="file" accept="image/*" onChange={e => setLogo(e.target.files[0])} /></div>
      <div><label className="label">Communes desservies</label><div className="flex flex-wrap gap-2">{COMMUNES.map(c => <button type="button" key={c} onClick={() => toggle(c)} className={`rounded-full px-3 py-1 text-sm font-bold ${f.delivery_zones.includes(c) ? 'bg-nid text-white' : 'bg-mist'}`}>{c}</button>)}</div></div>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
      <button className="btn-primary w-full">Enregistrer</button>
    </form>
  )
}
