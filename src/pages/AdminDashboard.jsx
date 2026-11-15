import { useEffect, useState, useCallback } from 'react'
import { supabase, uploadImage, money } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AdminExtras from './AdminExtras'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stores, setStores] = useState([]); const [pays, setPays] = useState([]); const [banner, setBanner] = useState(null)
  const [b, setB] = useState({ partner_name: '', link_url: '' }); const [file, setFile] = useState(null); const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    supabase.from('stores').select('*').order('created_at', { ascending: false }).then(({ data }) => setStores(data || []))
    supabase.from('subscription_payments').select('*, stores(name)').eq('validated', false).order('created_at').then(({ data }) => setPays(data || []))
    supabase.from('ads_banner').select('*').eq('is_active', true).maybeSingle().then(({ data }) => setBanner(data))
  }, [])
  useEffect(() => { load() }, [load])

  const validate = async id => { const { error } = await supabase.rpc('validate_subscription_payment', { pid: id }); if (error) alert(error.message); load() }
  const toggleStore = async s => { await supabase.from('stores').update({ is_active: !s.is_active }).eq('id', s.id); load() }

  async function saveBanner(e) {
    e.preventDefault(); setMsg('')
    try {
      if (!file) throw new Error('Choisissez une image')
      const image_url = await uploadImage('ads', file, user.id)
      if (banner) await supabase.from('ads_banner').update({ is_active: false }).eq('id', banner.id)
      const { error } = await supabase.from('ads_banner').insert({ ...b, image_url, is_active: true })
      if (error) throw error
      setMsg('Bannière publiée.'); setFile(null); load()
    } catch (ex) { setMsg(ex.message) }
  }
  const daysLeft = s => Math.ceil((new Date(s.trial_ends_at) - new Date()) / 864e5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <AdminExtras />

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Paiements à valider ({pays.length})</h2>
        {pays.length === 0 && <p className="text-sm">Aucun paiement en attente.</p>}
        {pays.map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white p-3">
            <div><p className="font-bold">{p.stores?.name} – {p.plan}</p><p className="text-sm">{money(p.amount_usd)} · {p.method} · réf. {p.reference}</p></div>
            <button className="btn-primary" onClick={() => validate(p.id)}>Valider</button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Boutiques ({stores.length})</h2>
        {stores.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-2xl bg-white p-3">
            <div><p className="font-bold">{s.name}</p>
              <p className="text-sm">{s.subscription_status === 'essai' ? `Essai : ${daysLeft(s) > 0 ? daysLeft(s) + ' j restants' : 'terminé'}` : s.subscription_status === 'actif' ? `Actif jusqu'au ${new Date(s.subscription_ends_at).toLocaleDateString('fr-FR')}` : 'Expiré'}</p></div>
            <button className="btn-ghost" onClick={() => toggleStore(s)}>{s.is_active ? 'Suspendre' : 'Réactiver'}</button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Bannière du partenaire exclusif</h2>
        {banner && <img src={banner.image_url} alt={banner.partner_name} className="h-28 w-full rounded-2xl object-cover" />}
        <form onSubmit={saveBanner} className="space-y-2 rounded-2xl bg-white p-4">
          <input className="input" required placeholder="Nom du partenaire" value={b.partner_name} onChange={e => setB({ ...b, partner_name: e.target.value })} />
          <input className="input" type="url" placeholder="Lien de destination (https://…)" value={b.link_url} onChange={e => setB({ ...b, link_url: e.target.value })} />
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
          <button className="btn-primary w-full">Publier (remplace la bannière actuelle)</button>
          {msg && <p className="text-sm font-semibold">{msg}</p>}
        </form>
      </section>
    </div>
  )
}
