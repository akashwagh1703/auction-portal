import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { disconnectEcho } from '../services/echo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated by calling /me
    // Cookies are sent automatically with withCredentials: true
    api.get('/me')
      .then(res => setUser(res.data))
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/login', { email, password })
      // Token is now set as httpOnly cookie by the server
      setUser(res.data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Invalid credentials' }
    }
  }

  const logout = async () => {
    try { await api.post('/logout') } catch (_) {}
    // Cookie is cleared by the server
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
