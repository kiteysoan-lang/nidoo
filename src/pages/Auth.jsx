import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', full_name: '', phone: '', role: 'client' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    const { data, error } = mode === 'login' ? await signIn(f) : await signUp(f)
    setBusy(false)
    if (error) return setErr(error.message)
    if (mode === 'signup' && !data.session) return setErr('Compte créé. Confirmez votre email puis connectez-vous.')
    nav(f.role === 'vendeur' && mode === 'signup' ? '/vendeur' : '/')
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h1>
      {mode === 'signup' && <>
        <div><label className="label">Nom complet</label><input className="input" required value={f.full_name} onChange={set('full_name')} /></div>
        <div><label className="label">Téléphone</label><input className="input" required inputMode="tel" placeholder="+243…" value={f.phone} onChange={set('phone')} /></div>
        <div><label className="label">Je suis</label>
          <select className="input" value={f.role} onChange={set('role')}>
            <option value="client">Une maman / une famille</option>
            <option value="vendeur">Un vendeur (boutique)</option>
          </select></div>
      </>}
      <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={set('email')} /></div>
      <div><label className="label">Mot de passe</label><input className="input" type="password" minLength={6} required value={f.password} onChange={set('password')} /></div>
      {err && <p className="text-sm font-semibold text-berry">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
      <button type="button" className="w-full text-sm font-semibold text-nid underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
      </button>
    </form>
  )
}
