/**
 * Firebase Auth 사용자 + Firestore 프로필(비밀번호 없음) 추가
 *
 * 사용법:
 *   1. Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
 *   2. 다운로드한 JSON을 프로젝트 루트에 serviceAccountKey.json 으로 저장
 *   3. 환경변수로 계정 정보를 넣고 실행 (비밀번호를 코드/문서에 넣지 마세요)
 *
 *   SEED_USER_ID=myid SEED_USER_PASSWORD='****' SEED_USER_NAME='이름' npm run seed:user
 *
 * 선택: SEED_USER_EMAIL, SEED_USER_ROLE(default: user), SEED_USER_STATUS(default: approved),
 *       SEED_AUTH_EMAIL_DOMAIN(default: y2-consulting.app)
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(projectRoot, 'serviceAccountKey.json')

if (!existsSync(KEY_PATH)) {
  console.error('서비스 계정 키 파일이 없습니다.')
  console.error('  Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"')
  console.error('  다운로드한 JSON을 프로젝트 루트에 serviceAccountKey.json 으로 저장한 뒤 다시 실행하세요.')
  process.exit(1)
}

const userId = String(process.env.SEED_USER_ID || '').trim()
const password = String(process.env.SEED_USER_PASSWORD || '')
const name = String(process.env.SEED_USER_NAME || '').trim() || userId
const role = String(process.env.SEED_USER_ROLE || 'user').trim()
const status = String(process.env.SEED_USER_STATUS || 'approved').trim()
const domain = String(process.env.SEED_AUTH_EMAIL_DOMAIN || 'y2-consulting.app').replace(/^@/, '')
const email = String(process.env.SEED_USER_EMAIL || (userId ? `${userId}@${domain}` : '')).trim()

if (!userId || !password || !email) {
  console.error('필수 환경변수가 없습니다.')
  console.error('  SEED_USER_ID, SEED_USER_PASSWORD 를 설정하세요.')
  console.error('  예: SEED_USER_ID=myid SEED_USER_PASSWORD=\'****\' npm run seed:user')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) })
const auth = getAuth()
const db = getFirestore()

async function seed() {
  try {
    let user
    try {
      user = await auth.getUserByEmail(email)
      await auth.updateUser(user.uid, { password, displayName: name })
      console.log('기존 Auth 사용자 비밀번호/이름 갱신:', email)
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') throw err
      user = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
        disabled: false,
      })
      console.log('Auth 사용자 생성:', email)
    }

    // 문서 ID = Auth UID. password 필드는 저장하지 않음.
    await db.collection('users').doc(user.uid).set(
      {
        uid: user.uid,
        userId,
        email,
        name,
        role,
        status,
      },
      { merge: true }
    )

    console.log('Firestore 프로필 저장 완료: users/' + user.uid)
    console.log('  로그인 아이디:', userId)
    console.log('  (비밀번호는 출력하지 않습니다)')
  } catch (e) {
    console.error('추가 실패:', e.message)
    process.exit(1)
  }
  process.exit(0)
}

seed()
