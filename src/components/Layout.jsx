import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { OfflineBanner, InstallPrompt } from './PwaBits'

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const { count } = useCart()
  const nav = useNavigate()
  const dash = profile?.role === 'admin' ? '/admin' : profile?.role === 'vendeur' ? '/vendeur' : null

  return (
    <div className="mx-auto min-h-screen max-w-5xl">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-nid px-4 py-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <Link to="/" className="text-2xl font-bold tracking-tight">Nidoo</Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          {dash && <NavLink to={dash}>Mon espace</NavLink>}
          {user && !dash && <NavLink to="/commandes">Commandes</NavLink>}
          {user && <NavLink to="/profil">Profil</NavLink>}
          <NavLink to="/panier" className="relative">Panier
            {count > 0 && <span className="absolute -right-4 -top-2 rounded-full bg-sun px-1.5 text-xs text-nid-dark">{count}</span>}
          </NavLink>
          {user
            ? <button onClick={async () => { await signOut(); nav('/') }}>Sortir</button>
            : <NavLink to="/connexion">Connexion</NavLink>}
        </nav>
      </header>
      <OfflineBanner />
      <main className="px-4 py-5"><InstallPrompt /><Outlet /></main>
    </div>
  )
}
