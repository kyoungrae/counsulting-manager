/**
 * Firestore users 컬렉션에 로그인 가능한 사용자 1명 추가
 * 사용법:
 *   1. Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
 *   2. 다운로드한 JSON을 프로젝트 루트에 serviceAccountKey.json 으로 저장
 *   3. node scripts/seed-user.js
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(projectRoot, 'serviceAccountKey.json')

if (!existsSync(KEY_PATH)) {
  console.error('서비스 계정 키 파일이 없습니다.')
  console.error('  Firebase 콘솔 > y2-consulting > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"')
  console.error('  다운로드한 JSON을 프로젝트 루트에 serviceAccountKey.json 으로 저장한 뒤 다시 실행하세요.')
  process.exit(1)
}

initializeApp({ credential: cert(KEY_PATH) })
const db = getFirestore()

const USER = {
  uid: 'user_805246',
  userId: '805246',
  email: '805246@y2-consulting.app',
  password: '930902',
  name: '분석 사용자',
  role: 'admin',
  status: 'approved',
}

async function seed() {
  try {
    await db.collection('users').doc(USER.uid).set(USER)
    console.log('사용자 추가 완료:', USER.userId)
    console.log('  로그인: 아이디 805246 / 비밀번호 930902')
  } catch (e) {
    console.error('추가 실패:', e.message)
    process.exit(1)
  }
  process.exit(0)
}

seed()
