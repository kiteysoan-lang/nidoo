import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase, COMMUNES, PAYMENTS, money } from '../lib/supabase'
import { startPayment } from '../lib/payments'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function Checkout() {
  const { profile } = useAuth()
  const { items, total, clear } = useCart()
  const nav = useNavigate()
  const done = useRef(false)
  const [fee, setFee] = useState(0)
  const [f, setF] = useState({ commune: profile?.commune || 'Gombe', quartier: profile?.quartier || '', address: '', phone: profile?.phone || '', method: 'mpesa' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const isCard = ['visa', 'mastercard'].includes(f.method)

  useEffect(() => { supabase.from('app_settings').select('value').eq('key', 'delivery_fee').maybeSingle().then(({ data }) => setFee(Number(data?.value?.default || 0))) }, [])
  if (!items.length && !done.current) return <Navigate to="/panier" replace />

  const nStores = new Set(items.map(i => i.store_id)).size
  const grand = total + fee * nStores

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    if (!navigator.onLine) { setErr('Connexion requise pour commander.'); return setBusy(false) }
    try {
      // Le serveur recalcule prix, frais et stock, et crée une commande par boutique.
      const { data: orders, error } = await supabase.rpc('place_order', {
        p_items: items.map(i => ({ id: i.id, qty: i.qty, size: i.size || null })),
        p_commune: f.commune, p_quartier: f.quartier, p_address: f.address, p_phone: f.phone, p_method: f.method
      })
      if (error) throw error
      done.current = true; clear()
      try {
        await startPayment({ order_ids: orders.map(o => o.o_id), method: f.method, phone: f.phone })
        nav('/commandes', { state: { notice: 'Commande enregistrée. Merci !' } })
      } catch (ex) {
        nav('/commandes', { state: { notice: `Commande créée mais paiement non finalisé : ${ex.message}. Vous pouvez réessayer ci-dessous.` } })
      }
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Livraison et paiement</h1>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Commune</label><select className="input" value={f.commune} onChange={set('commune')}>{COMMUNES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">Quartier</label><input className="input" required value={f.quartier} onChange={set('quartier')} /></div>
      </div>
      <div><label className="label">Avenue, numéro, repère</label><input className="input" value={f.address} onChange={set('address')} /></div>
      <div><label className="label">Téléphone (livraison et Mobile Money)</label><input className="input" required inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
      <div><label className="label">Moyen de paiement</label>
        <div className="grid grid-cols-2 gap-2">{PAYMENTS.map(m => (
          <label key={m.id} className={`cursor-pointer rounded-xl p-3 text-center text-sm font-bold ring-1 ${f.method === m.id ? 'bg-nid text-white ring-nid' : 'bg-white ring-nid-soft'}`}>
            <input type="radio" className="sr-only" name="pay" checked={f.method === m.id} onChange={() => setF({ ...f, method: m.id })} />{m.label}
          </label>))}</div>
      </div>
      {isCard && <p className="rounded-xl bg-sun/30 p-3 text-sm">Vous serez redirigé vers la page sécurisée de la passerelle pour saisir votre carte.</p>}
      <div className="space-y-1 rounded-2xl bg-nid-soft p-4 text-sm">
        <div className="flex justify-between"><span>Articles</span><span>{money(total)}</span></div>
        <div className="flex justify-between"><span>Livraison ({nStores} boutique{nStores > 1 ? 's' : ''})</span><span>{money(fee * nStores)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>Total estimé</span><span>{money(grand)}</span></div>
      </div>
      {err && <p className="text-sm font-semibold text-berry">{err}</p>}
      <button className="btn-sun w-full" disabled={busy}>{busy ? 'Traitement…' : `Payer ${money(grand)}`}</button>
    </form>
  )
}
