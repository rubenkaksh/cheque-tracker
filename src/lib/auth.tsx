import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export type Role = 'admin' | 'agent'

interface AuthState {
  session: Session | null
  role: Role | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabase()
    let alive = true
    void sb.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        setRole(null)
        setLoading(false)
      }
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    let alive = true
    setLoading(true)
    void getSupabase()
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setRole((data?.role as Role | undefined) ?? null)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [uid])

  const value: AuthState = {
    session,
    role,
    loading,
    signOut: async () => {
      await getSupabase().auth.signOut()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  return useContext(Ctx)
}
