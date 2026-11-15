import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfile(data.session?.user.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); loadProfile(s?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signUp = ({ email, password, full_name, phone, role }) =>
    supabase.auth.signUp({ email, password, options: { data: { full_name, phone, role } } })
  const signIn = ({ email, password }) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthCtx.Provider value={{ user: session?.user ?? null, profile, loading, signUp, signIn, signOut, refresh: () => loadProfile(session?.user.id) }}>
      {children}
    </AuthCtx.Provider>
  )
}
