import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [off, setOff] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOff(false), offf = () => setOff(true)
    window.addEventListener('online', on); window.addEventListener('offline', offf)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', offf) }
  }, [])
  return off ? <p className="bg-sun px-4 py-2 text-center text-sm font-bold text-nid-dark">Hors-ligne : vous voyez les derniers articles consultés. Les commandes sont désactivées.</p> : null
}

export function InstallPrompt() {
  const [evt, setEvt] = useState(null)
  useEffect(() => {
    const h = e => { e.preventDefault(); setEvt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (!evt) return null
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-nid-soft p-3 text-sm font-semibold">
      <span>Ajoutez Nidoo à votre écran d'accueil.</span>
      <button className="btn-primary !py-1.5" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null) }}>Installer</button>
    </div>
  )
}
