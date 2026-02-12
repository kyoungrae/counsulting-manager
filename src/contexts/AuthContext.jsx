import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db, firebaseConfig } from '../lib/firebase'

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

  // 아이디로만 로그인. Firestore users 문서에는 반드시 필드명 "userId" (문자열) 로 저장되어 있어야 함.
  async function login(userId, password) {
    const usersRef = collection(db, 'users')
    const id = String(userId).trim()
    const q = query(usersRef, where('userId', '==', id))
    let snapshot
    try {
      snapshot = await getDocs(q)
    } catch (err) {
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        throw new Error('Firestore 읽기 권한이 없습니다. Firebase 콘솔에서 Firestore 규칙을 게시했는지 확인하세요.')
      }
      throw err
    }
    let userData = null
    if (!snapshot.empty) {
      userData = snapshot.docs[0].data()
    } else {
      // 쿼리 결과가 없으면 문서 ID로 직접 조회 시도 (문서 ID가 user_805246 형태인 경우)
      const docId = `user_${id}`
      const docRef = doc(db, 'users', docId)
      try {
        const directDoc = await getDoc(docRef)
        if (directDoc.exists()) {
          const data = directDoc.data()
          // 문서 ID가 user_805246 이면 이미 아이디 805246 에 해당하므로 userId 필드 비교 생략
          userData = data
        } else {
          console.warn('[Auth] 문서 없음:', 'users/' + docId)
        }
      } catch (err) {
        console.error('[Auth] 문서 직접 조회 실패 (권한 또는 네트워크):', err?.code || err?.message)
      }
    }
    if (!userData) {
      const e = new Error('등록되지 않은 아이디입니다.')
      e.code = 'auth/user-not-found'
      throw e
    }
    const email = (userData.email && String(userData.email).trim()) || ''

    if (userData.status && userData.status !== 'approved') {
      throw new Error('계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.')
    }

    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    if (userData.password && userData.password === password) {
      await setPersistence(auth, browserSessionPersistence)
      let authUser = null
      if (hasValidEmail) {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password)
          authUser = cred.user
        } catch (_) {
          authUser = {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.name,
            isCustomAuth: true,
          }
        }
      } else {
        authUser = {
          uid: userData.uid,
          email: userData.email || '',
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

    if (!hasValidEmail) {
      const e = new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
      e.code = 'auth/invalid-credential'
      throw e
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
