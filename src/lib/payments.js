import { supabase } from './supabase'

// Démarre le paiement via l'Edge Function `create-payment`.
// Retourne { status: 'paid' | 'cod' } ou redirige vers la passerelle (status 'redirect').
export async function startPayment({ order_ids, method, phone }) {
  const { data, error } = await supabase.functions.invoke('create-payment', { body: { order_ids, method, phone } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  if (data.status === 'redirect') window.location.href = data.link
  return data
}
