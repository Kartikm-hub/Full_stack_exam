import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { AuthContext } from '@/features/auth/AuthContext'

const TOKEN_KEY = 'focus-mode-token'

function unwrapAuthResult(result) {
  const token = result.accessToken || result.token
  const user = result.user || result
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  return { token, user }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) return
    let active = true
    api.get('/auth/me')
      .then((result) => {
        if (active) setUser(result.user || result)
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function authenticate(endpoint, credentials) {
    const result = await api.post(endpoint, credentials)
    const auth = unwrapAuthResult(result)
    if (!auth.token) throw new Error('The server did not return an access token.')
    setUser(auth.user)
    await queryClient.invalidateQueries()
    return auth.user
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      sessionStorage.removeItem(TOKEN_KEY)
      setUser(null)
      queryClient.clear()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login: (values) => authenticate('/auth/login', values), register: (values) => authenticate('/auth/register', values), logout }}>
      {children}
    </AuthContext.Provider>
  )
}

