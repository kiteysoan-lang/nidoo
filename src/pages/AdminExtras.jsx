import { useEffect, useState } from 'react'
import { supabase, money } from '../lib/supabase'

export default function AdminExtras() {
  const [st, setSt] = useState(null)
  const [p, setP] = useState({ mensuel: 10, annuel: 100, fee: 2 })
  const [msg, setMsg] = useState('')
  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data }) => setSt(data))
    supabase.from('app_settings').select('*').then(({ data }) => {
      const m = Object.fromEntries((data || []).map(r => [r.key, r.value]))
      if (m.prices) setP({ mensuel: m.prices.mensuel, annuel: m.prices.annuel, fee: m.delivery_fee?.default ?? 2 })
    })
  }, [])
  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'prices', value: { mensuel: Number(p.mensuel), annuel: Number(p.annuel) } },
      { key: 'delivery_fee', value: { default: Number(p.fee) } }])
    setMsg(error ? error.message : 'Tarifs enregistrés.')
  }
  const Box = ({ l, v }) => <div className="rounded-2xl bg-white p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs">{l}</p></div>
  return (
    <>
      {st && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box l="Boutiques" v={st.stores_total} /><Box l="En essai" v={st.stores_essai} /><Box l="Abonnées" v={st.stores_actif} /><Box l="Expirées" v={st.stores_expire} />
        <Box l="Clients" v={st.clients} /><Box l="Commandes" v={st.orders_total} /><Box l="Ventes payées" v={money(st.sales_paid)} />
      </div>}
      <form onSubmit={save} className="space-y-2 rounded-2xl bg-white p-4">
        <h2 className="text-lg font-bold">Tarifs (USD)</h2>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label">Mensuel</label><input className="input" type="number" min="0" value={p.mensuel} onChange={e => setP({ ...p, mensuel: e.target.value })} /></div>
          <div><label className="label">Annuel</label><input className="input" type="number" min="0" value={p.annuel} onChange={e => setP({ ...p, annuel: e.target.value })} /></div>
          <div><label className="label">Livraison / boutique</label><input className="input" type="number" min="0" step="0.5" value={p.fee} onChange={e => setP({ ...p, fee: e.target.value })} /></div>
        </div>
        {msg && <p className="text-sm font-semibold">{msg}</p>}
        <button className="btn-primary w-full">Enregistrer les tarifs</button>
      </form>
    </>
  )
}
