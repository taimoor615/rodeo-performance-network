import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { WP_CONFIG } from '../config/wordpress'

const STORAGE_KEY = 'rpn_auth_token'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const setToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem(STORAGE_KEY, newToken)
      setTokenState(newToken)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      setTokenState(null)
      setUser(null)
    }
  }, [])

  const fetchMe = useCallback(async (authToken) => {
    const t = authToken ?? token
    if (!t) return null
    try {
      const res = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/me`, {
        headers: {
          'X-RPN-Auth': t,
          'Authorization': `Bearer ${t}`,
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data?.user ?? null
    } catch {
      return null
    }
  }, [token])

  const skipVerifyRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    if (skipVerifyRef.current) {
      skipVerifyRef.current = false
      setLoading(false)
      return
    }
    setLoading(true)
    fetchMe(token)
      .then((u) => {
        if (u) {
          setUser(u)
        } else {
          setToken(null)
        }
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [token, fetchMe, setToken])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.message || 'Login failed')
    }
    if (data.token) {
      skipVerifyRef.current = true
      setToken(data.token)
      setUser(data.user ?? null)
      setLoading(false)
    }
    return data
  }, [setToken])

  const logout = useCallback(() => {
    setToken(null)
  }, [setToken])

  const refreshUser = useCallback(() => {
    return fetchMe(token).then(setUser)
  }, [token, fetchMe])

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    refreshUser,
    getAuthHeaders: () => (token ? { 'X-RPN-Auth': token, 'Authorization': `Bearer ${token}` } : {}),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
