import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, money, STATUS_LABEL } from '../lib/supabase'
import { startPayment } from '../lib/payments'

export default function MyOrders() {
  const notice = useLocation().state?.notice
  const [orders, setOrders] = useState(null)
  const [msg, setMsg] = useState(notice || '')

  const load = useCallback(() => supabase.from('orders').select('*, stores(name), order_items(*)').order('created_at', { ascending: false }).then(({ data }) => setOrders(data || [])), [])
  useEffect(() => {
    load()
    const ch = supabase.channel('my-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function retry(o) {
    setMsg('')
    try { await startPayment({ order_ids: [o.id], method: o.payment_method, phone: o.contact_phone }); load() } catch (e) { setMsg(e.message) }
  }
  async function cancel(o) {
    if (!confirm('Annuler cette commande ?')) return
    const { error } = await supabase.rpc('cancel_order', { oid: o.id })
    if (error) setMsg(error.message); load()
  }

  if (!orders) return <p>Chargement…</p>
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Mes commandes</h1>
      {msg && <p className="rounded-xl bg-sun/40 p-3 text-sm font-semibold">{msg}</p>}
      {!orders.length && <p className="py-10 text-center">Aucune commande pour le moment.</p>}
      {orders.map(o => (
        <div key={o.id} className="rounded-2xl bg-white p-4">
          <div className="flex justify-between font-bold"><span>{o.stores?.name}</span><span>{money(o.total)}</span></div>
          <p className="text-sm">{STATUS_LABEL[o.status]} · {new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
          <ul className="mt-2 text-sm">{o.order_items.map(i => <li key={i.id}>{i.quantity} × {i.title}{i.size ? ` (${i.size})` : ''}</li>)}</ul>
          <p className="mt-1 text-xs opacity-70">Livraison : {o.delivery_quartier}, {o.delivery_commune} · frais {money(o.delivery_fee)}</p>
          {o.status === 'en_attente' && <div className="mt-2 flex gap-2"><button className="btn-primary !py-1.5" onClick={() => retry(o)}>Payer</button><button className="btn-ghost !py-1.5" onClick={() => cancel(o)}>Annuler</button></div>}
        </div>
      ))}
    </div>
  )
}
