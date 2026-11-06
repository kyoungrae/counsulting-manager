import { createContext, useContext, useState, useEffect } from 'react'
import { apiRequest, ApiError, setSessionToken, clearSessionToken, hasSessionToken } from '../lib/api'

const AuthContext = createContext()

// The provider and its context hook intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

function checkSession(session) {
  const signedOut = session?.user === null && session?.profile === null
  const signedIn = typeof session?.user?.uid === 'string' &&
    session.user.uid === session.profile?.uid
  if (!signedOut && !signedIn) {
    throw new ApiError('사용자 정보를 확인할 수 없습니다. 다시 시도해주세요.', 'api/invalid-session')
  }
  return session
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, profile: null })
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const request = hasSessionToken()
      ? apiRequest('/auth/session', { signal: controller.signal }).then(checkSession)
      : Promise.resolve({ user: null, profile: null })
    request
      .then((result) => {
        if (!controller.signal.aborted) {
          if (!result.user) clearSessionToken()
          setSession({ user: result.user, profile: result.profile })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error.status === 401) {
            clearSessionToken()
            setSession({ user: null, profile: null })
          } else {
            setBootstrapError(error.message)
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])

  async function login(userId, password) {
    const result = checkSession(await apiRequest('/auth/login', {
      method: 'POST',
      body: { userId: String(userId).trim(), password },
    }))
    if (!result.user) throw new ApiError('로그인에 실패했습니다. 다시 시도해주세요.', 'auth/invalid-session')
    setSessionToken(result.token)
    setSession({ user: result.user, profile: result.profile })
    return { user: result.user, profile: result.profile }
  }

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST', body: {} })
    clearSessionToken()
    setSession({ user: null, profile: null })
  }

  function retry() {
    setBootstrapError('')
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  const value = {
    currentUser: session.user,
    userProfile: session.profile,
    login,
    logout,
    isAdmin: session.profile?.role === 'admin',
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="login-loading" role="status">
          <div className="login-spinner" />
          <p>로그인 상태를 확인하는 중...</p>
        </div>
      ) : bootstrapError ? (
        <div className="login-container">
          <div className="login-card" style={{ maxWidth: 420, textAlign: 'center' }}>
            <p className="login-error-text" role="alert">{bootstrapError}</p>
            <button type="button" className="btn btn-primary" onClick={retry}>다시 연결</button>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  )
}
