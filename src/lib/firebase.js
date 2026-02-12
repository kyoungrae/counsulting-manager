import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasValidConfig =
  typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.projectId === 'string' &&
  firebaseConfig.projectId.length > 0

if (!hasValidConfig) {
  throw new Error(
    'Firebase 설정이 없습니다. 프로젝트 루트에 .env 파일을 만들고 Firebase 콘솔에서 복사한 값을 넣어주세요.\n\n' +
    '1) 터미널: cp .env.example .env\n' +
    '2) .env 에 VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID 등 입력 (README "Firebase 연결" 참고)'
  )
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const db = getFirestore(app)
export const auth = getAuth(app)
export default app
