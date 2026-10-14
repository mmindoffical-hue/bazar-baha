import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { tk } from '../i18n/tk'
import { withRequestTimeout } from './publicCache'

type UserRole = 'user' | 'admin'

type AuthContextValue = {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const roleCachePrefix = 'bazar-baha:profile-role:'

function readCachedRole(userId: string): UserRole | null {
  try {
    const role = localStorage.getItem(`${roleCachePrefix}${userId}`)
    return role === 'admin' || role === 'user' ? role : null
  } catch (error) {
    console.warn('Cached profile role read failed.', error)
    return null
  }
}

function writeCachedRole(userId: string, role: UserRole) {
  try {
    localStorage.setItem(`${roleCachePrefix}${userId}`, role)
  } catch (error) {
    console.warn('Cached profile role write failed.', error)
  }
}

function getAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return tk.auth.errors.invalidCredentials
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return tk.auth.errors.emailRegistered
  }
  if (normalized.includes('password should be at least') || normalized.includes('weak password')) {
    return tk.auth.errors.weakPassword
  }
  if (normalized.includes('invalid email')) {
    return tk.auth.errors.invalidEmail
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return tk.auth.errors.network
  }

  return tk.auth.errors.generic
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const client = supabase

    let active = true
    let requestId = 0

    const applySession = async (session: Session | null) => {
      const currentRequest = ++requestId
      const currentUser = session?.user ?? null
      setUser(currentUser)
      const cachedRole = currentUser ? readCachedRole(currentUser.id) : null
      setRole(cachedRole)
      if (cachedRole) setLoading(false)
      else setLoading(Boolean(currentUser))

      if (currentUser) {
        try {
          const { data, error } = await withRequestTimeout(() => client
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .maybeSingle())
          if (error) throw error
          if (!active || currentRequest !== requestId) return
          const verifiedRole: UserRole = data?.role === 'admin' ? 'admin' : 'user'
          writeCachedRole(currentUser.id, verifiedRole)
          setRole(verifiedRole)
        } catch (error) {
          console.warn('Profile role verification failed.', error)
        }
      }

      if (active && currentRequest === requestId) setLoading(false)
    }

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void applySession(session))
    })

    void client.auth.getSession().then(({ data }) => applySession(data.session))

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return tk.auth.errors.notConfigured
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? getAuthError(error.message) : null
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) return tk.auth.errors.notConfigured
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return getAuthError(error.message)
    return data.session ? null : tk.auth.emailConfirmation
  }

  const signOut = async () => {
    if (!supabase) return tk.auth.errors.notConfigured
    const { error } = await supabase.auth.signOut()
    return error ? getAuthError(error.message) : null
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error(tk.auth.providerMissing)
  return context
}