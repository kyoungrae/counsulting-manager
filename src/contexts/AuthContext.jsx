import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext()

/** 아이디 → Firebase Auth 이메일. 예: myid → myid@domain */
const AUTH_EMAIL_DOMAIN = (
  import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'y2-consulting.app'
).replace(/^@/, '')

export function useAuth() {
  return useContext(AuthContext)
}

function userIdToEmail(userId) {
  const id = String(userId ?? '').trim()
  if (!id) return ''
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return id
  return `${id}@${AUTH_EMAIL_DOMAIN}`
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchUserProfile(uid) {
    if (!uid) return null
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (userDoc.exists()) {
      const data = userDoc.data() || {}
      // 클라이언트에 password 필드가 남아 있어도 노출하지 않음
      const { password: _omit, ...safe } = data
      return { id: userDoc.id, ...safe }
    }
    return null
  }

  /**
   * 아이디 + 비밀번호 로그인.
   * Firestore에 평문 비밀번호를 두지 않고 Firebase Auth만 사용합니다.
   * 프로필(이름/역할/승인)은 로그인 후 본인 users/{auth.uid} 문서만 읽습니다.
   */
  async function login(userId, password) {
    const email = userIdToEmail(userId)
    if (!email || !password) {
      const e = new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
      e.code = 'auth/invalid-credential'
      throw e
    }

    try {
      await setPersistence(auth, browserSessionPersistence)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const profile = await fetchUserProfile(userCredential.user.uid)

      if (profile?.status && profile.status !== 'approved') {
        await signOut(auth)
        throw new Error('계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.')
      }

      setCurrentUser(userCredential.user)
      setUserProfile(profile)
      return userCredential
    } catch (error) {
      if (error.message?.includes('승인')) throw error
      const msg =
        error.code === 'auth/invalid-credential'
        || error.code === 'auth/wrong-password'
        || error.code === 'auth/user-not-found'
          ? '아이디 또는 비밀번호가 올바르지 않습니다.'
          : error.message || '로그인에 실패했습니다.'
      const e = new Error(msg)
      e.code = error.code || 'auth/invalid-credential'
      throw e
    }
  }

  function logout() {
    setCurrentUser(null)
    setUserProfile(null)
    return signOut(auth)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        try {
          const profile = await fetchUserProfile(user.uid)
          setUserProfile(profile)
        } catch (err) {
          console.error('Failed to fetch user profile:', err)
          setUserProfile(null)
        }
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const value = {
    currentUser,
    userProfile,
    login,
    logout,
    isAdmin: userProfile?.role === 'admin',
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
