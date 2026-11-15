import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'

const Auth = lazy(() => import('./pages/Auth'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const StorePage = lazy(() => import('./pages/StorePage'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const Profile = lazy(() => import('./pages/Profile'))
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

const NotFound = () => <div className="py-16 text-center"><p className="mb-4">Cette page n'existe pas.</p><Link to="/" className="btn-primary">Retour à l'accueil</Link></div>

export default function App() {
  return (
    <Suspense fallback={<p className="p-6">Chargement…</p>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="connexion" element={<Auth />} />
          <Route path="produit/:id" element={<ProductPage />} />
          <Route path="boutique/:id" element={<StorePage />} />
          <Route path="panier" element={<Cart />} />
          <Route path="commander" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="commandes" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
          <Route path="profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="vendeur" element={<ProtectedRoute roles={['vendeur']}><SellerDashboard /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
