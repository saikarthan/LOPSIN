import { createContext, useContext, useEffect, useState } from 'react'
import { login as loginApi, registerOrganization as registerApi } from '../api'
import { clearApiCache } from '../api/axiosClient'

const AuthContext = createContext(null)

function persist(data) {
  const user = {
    id: data.userId,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    orgId: data.orgId,
    orgName: data.orgName,
  }
  localStorage.setItem('lopsin_token', data.token)
  localStorage.setItem('lopsin_user', JSON.stringify(user))
  return user
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('lopsin_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('lopsin_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const user = persist(await loginApi(email, password))
    setUser(user)
    return user
  }

  const register = async (payload) => {
    const user = persist(await registerApi(payload))
    setUser(user)
    return user
  }

  const logout = () => {
    clearApiCache()
    localStorage.removeItem('lopsin_token')
    localStorage.removeItem('lopsin_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
