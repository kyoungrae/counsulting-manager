import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchUserProfile(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() }
    }
    return null
  }

  async function login(userIdOrEmail, password) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userIdOrEmail)
    const usersRef = collection(db, 'users')
    const q = isEmail
      ? query(usersRef, where('email', '==', userIdOrEmail))
      : query(usersRef, where('userId', '==', userIdOrEmail))
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      const e = new Error('등록되지 않은 아이디 또는 이메일입니다.')
      e.code = 'auth/user-not-found'
      throw e
    }
    const userDoc = snapshot.docs[0]
    const userData = userDoc.data()
    const email = userData.email

    if (userData.status && userData.status !== 'approved') {
      throw new Error('계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.')
    }

    if (userData.password && userData.password === password) {
      await setPersistence(auth, browserSessionPersistence)
      let authUser = null
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        authUser = cred.user
      } catch (authError) {
        authUser = {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.name,
          isCustomAuth: true,
        }
      }
      sessionStorage.setItem(
        'ewha_analytics_auth_session',
        JSON.stringify({ uid: authUser.uid })
      )
      setCurrentUser(authUser)
      setUserProfile(userData)
      return { user: authUser }
    }

    try {
      await setPersistence(auth, browserSessionPersistence)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const profile = await fetchUserProfile(userCredential.user.uid)
      setCurrentUser(userCredential.user)
      setUserProfile(profile)
      return userCredential
    } catch (error) {
      const msg =
        error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
          ? '아이디 또는 비밀번호가 올바르지 않습니다.'
          : error.message || '로그인에 실패했습니다.'
      const e = new Error(msg)
      e.code = error.code
      throw e
    }
  }

  function logout() {
    sessionStorage.removeItem('ewha_analytics_auth_session')
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
        }
      } else {
        const stored = sessionStorage.getItem('ewha_analytics_auth_session')
        if (stored) {
          try {
            const { uid } = JSON.parse(stored)
            const profile = await fetchUserProfile(uid)
            if (profile) {
              setCurrentUser({
                uid: profile.uid,
                email: profile.email,
                displayName: profile.name,
                isCustomAuth: true,
              })
              setUserProfile(profile)
            } else {
              sessionStorage.removeItem('ewha_analytics_auth_session')
              setCurrentUser(null)
              setUserProfile(null)
            }
          } catch (e) {
            sessionStorage.removeItem('ewha_analytics_auth_session')
            setCurrentUser(null)
            setUserProfile(null)
          }
        } else {
          setCurrentUser(null)
          setUserProfile(null)
        }
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
