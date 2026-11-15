// Webhook de la passerelle : confirme un paiement APRÈS vérification auprès de l'API du fournisseur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.headers.get('verif-hash') !== Deno.env.get('FLW_WEBHOOK_HASH')) return new Response('Unauthorized', { status: 401 })
  const body = await req.json()
  const id = body?.data?.id, tx_ref = body?.data?.tx_ref
  if (!id || !tx_ref) return new Response('ignored')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: pay } = await admin.from('payments').select('*').eq('tx_ref', tx_ref).maybeSingle()
  if (!pay) return new Response('unknown', { status: 404 })

  const v = await (await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
    headers: { Authorization: `Bearer ${Deno.env.get('FLW_SECRET_KEY')}` },
  })).json()
  const d = v?.data
  const ok = v?.status === 'success' && d?.status === 'successful' && d?.tx_ref === tx_ref
    && Number(d?.amount) >= Number(pay.amount) && d?.currency === pay.currency

  if (ok) await admin.rpc('confirm_payment', { p_tx_ref: tx_ref, p_provider_ref: String(id) })
  else await admin.from('payments').update({ status: 'failed' }).eq('id', pay.id).eq('status', 'pending')
  return new Response('ok')
})
