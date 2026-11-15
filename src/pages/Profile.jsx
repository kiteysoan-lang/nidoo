import { useState } from 'react'
import { supabase, COMMUNES } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { profile, refresh } = useAuth()
  const [f, setF] = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '', commune: profile?.commune || '', quartier: profile?.quartier || '' })
  const [msg, setMsg] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update(f).eq('id', profile.id)
    setMsg(error ? error.message : 'Profil enregistré.'); if (!error) refresh()
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-2xl bg-white p-5">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <div><label className="label">Nom complet</label><input className="input" required value={f.full_name} onChange={set('full_name')} /></div>
      <div><label className="label">Téléphone</label><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
      <div><label className="label">Commune</label><select className="input" value={f.commune} onChange={set('commune')}><option value="">—</option>{COMMUNES.map(c => <option key={c}>{c}</option>)}</select></div>
      <div><label className="label">Quartier</label><input className="input" value={f.quartier} onChange={set('quartier')} /></div>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
      <button className="btn-primary w-full">Enregistrer</button>
    </form>
  )
}
