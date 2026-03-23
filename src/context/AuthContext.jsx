import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { disconnectEcho } from '../services/echo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // boot check

  // On mount — restore session from token
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setLoading(false); return }

    api.get('/me')
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/login', { email, password })
      localStorage.setItem('auth_token', res.data.token)
      setUser(res.data.user)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid credentials'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try { await api.post('/logout') } catch (_) {}
    localStorage.removeItem('auth_token')
    disconnectEcho()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
