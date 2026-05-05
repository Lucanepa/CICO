import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authConfigured, getValidAccessToken } from '../lib/auth'

type AuthState = 'checking' | 'authenticated' | 'unauthenticated'

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(authConfigured ? 'checking' : 'authenticated')
  const location = useLocation()

  useEffect(() => {
    if (!authConfigured) return
    let cancelled = false
    void (async () => {
      const token = await getValidAccessToken()
      if (cancelled) return
      setState(token ? 'authenticated' : 'unauthenticated')
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (state === 'checking') return null
  if (state === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
