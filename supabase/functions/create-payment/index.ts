// Edge Function : démarre le paiement des commandes d'un client.
// PAYMENT_MODE=sandbox (défaut) : confirme tout de suite (tests).
// PAYMENT_MODE=flutterwave : renvoie un lien de paiement hébergé (Mobile Money / cartes).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// À vérifier dans votre dashboard Flutterwave selon les moyens activés pour la RDC.
const OPTIONS: Record<string, string> = {
  mpesa: 'mpesa', orange_money: 'mobilemoneyfrancophone', airtel_money: 'mobilemoneyfrancophone',
  afrimoney: 'mobilemoneyfrancophone', visa: 'card', mastercard: 'card',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Non authentifié' }, 401)

    const { order_ids, method, phone } = await req.json()
    if (!Array.isArray(order_ids) || !order_ids.length) return json({ error: 'Commandes manquantes' }, 400)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: orders } = await admin.from('orders').select('id,total,status,customer_id').in('id', order_ids)
    if (!orders?.length || orders.length !== order_ids.length) return json({ error: 'Commande introuvable' }, 404)
    if (orders.some((o) => o.customer_id !== user.id || o.status !== 'en_attente'))
      return json({ error: 'Commande non payable' }, 400)

    if (method === 'cash_livraison') {
      await admin.from('orders').update({ status: 'confirmee', payment_method: method }).in('id', order_ids)
      return json({ status: 'cod' })
    }

    const amount = orders.reduce((s, o) => s + Number(o.total), 0)
    const mode = Deno.env.get('PAYMENT_MODE') ?? 'sandbox'
    const tx_ref = `NIDOO-${crypto.randomUUID()}`
    const { error: insErr } = await admin.from('payments').insert({
      user_id: user.id, order_ids, provider: mode, method, amount, tx_ref,
    })
    if (insErr) throw insErr
    await admin.from('orders').update({ payment_method: method }).in('id', order_ids)

    if (mode === 'sandbox') {
      await admin.rpc('confirm_payment', { p_tx_ref: tx_ref, p_provider_ref: 'SANDBOX' })
      return json({ status: 'paid' })
    }

    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('FLW_SECRET_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref, amount, currency: 'USD',
        redirect_url: `${Deno.env.get('SITE_URL')}/commandes`,
        payment_options: OPTIONS[method] ?? 'card',
        customer: { email: user.email, phonenumber: phone },
        customizations: { title: 'Nidoo', description: 'Commande Nidoo' },
      }),
    })
    const out = await res.json()
    if (out.status !== 'success') return json({ error: out.message ?? 'Passerelle indisponible' }, 502)
    return json({ status: 'redirect', link: out.data.link })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
