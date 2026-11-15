import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) console.warn('Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (voir .env.example)')

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Envoi d'une image vers un bucket public ; chemin = <uid>/<fichier> (exigé par les policies)
export async function uploadImage(bucket, file, uid) {
  const ext = file.name.split('.').pop()
  const path = `${uid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '2592000' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export const CATEGORIES = ['Nouveau-né', '0-3 mois', '3-6 mois', '6-12 mois', 'Poussettes', 'Soins', 'Alimentation', 'Maman', 'Jouets']
export const COMMUNES = ['Gombe', 'Limete', 'Ngaliema', 'Lemba', 'Kintambo', 'Bandalungwa', 'Kalamu', 'Masina', 'Ndjili', 'Kinshasa', 'Lingwala', 'Barumbu', 'Mont-Ngafula', 'Matete']
export const PAYMENTS = [
  { id: 'mpesa', label: 'M-Pesa' }, { id: 'orange_money', label: 'Orange Money' },
  { id: 'airtel_money', label: 'Airtel Money' }, { id: 'afrimoney', label: 'AfriMoney' },
  { id: 'visa', label: 'Visa' }, { id: 'mastercard', label: 'Mastercard' },
  { id: 'cash_livraison', label: 'Paiement à la livraison' }
]
export const money = (n, c = 'USD') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c }).format(n)

export const STATUS_LABEL = {
  en_attente: 'En attente de paiement', payee: 'Payée', confirmee: 'Confirmée',
  en_livraison: 'En livraison', livree: 'Livrée', annulee: 'Annulée'
}
