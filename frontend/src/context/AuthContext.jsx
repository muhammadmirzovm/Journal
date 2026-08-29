import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'
import { registerPush } from '../utils/push'
import { getTelegramWebApp } from '../utils/telegram'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (token) {
      api.get('/auth/me/').then(r => { setUser(r.data); registerPush() }).catch(() => {
        localStorage.clear()
      }).finally(() => setLoading(false))
      return
    }

    const webApp = getTelegramWebApp()
    if (webApp) {
      api.post('/auth/telegram/miniapp-login/', { init_data: webApp.initData })
        .then(r => { if (r.data.linked) login(r.data.tokens, r.data.user) })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }

    setLoading(false)
  }, [])

  const login = (tokens, userData) => {
    localStorage.setItem('access', tokens.access)
    localStorage.setItem('refresh', tokens.refresh)
    setUser(userData)
    registerPush()
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
