import { randomUUID } from 'node:crypto'
import { hashPassword } from './password.js'

const text = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback

export async function prepareUser(input, { minimumPasswordLength = 12 } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('사용자 정보 형식이 올바르지 않습니다.')
  const userId = text(input.userId)
  if (!userId || userId.length > 128) throw new Error('userId는 1~128자의 문자열이어야 합니다.')
  const role = text(input.role, 'user')
  const status = text(input.status, 'approved')
  if (!['admin', 'user'].includes(role)) throw new Error('role은 admin 또는 user여야 합니다.')
  if (!['approved', 'pending', 'disabled'].includes(status)) throw new Error('status는 approved, pending, disabled 중 하나여야 합니다.')
  let passwordHash
  if (typeof input.password === 'string') {
    if (input.password.length < minimumPasswordLength || input.password.length > 1024) {
      throw new Error(`비밀번호는 ${minimumPasswordLength}~1024자여야 합니다.`)
    }
    passwordHash = await hashPassword(input.password)
  } else if (/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(input.passwordHash || '')) {
    passwordHash = input.passwordHash
  } else {
    throw new Error('비밀번호가 없습니다. Firebase Auth 비밀번호는 이 형식으로 이전할 수 없으므로 새 비밀번호를 지정하세요.')
  }
  const uid = text(input.uid) || text(input.id) || randomUUID()
  if (uid.length > 256) throw new Error('uid는 256자 이하여야 합니다.')
  return {
    uid, userId, name: text(input.name, userId), email: text(input.email),
    role, status, passwordHash, createdAt: new Date(), updatedAt: new Date(),
  }
}

export async function prepareUserImport(input) {
  const entries = Array.isArray(input) ? input : input?.users
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('JSON 배열 또는 { "users": [...] } 형식의 사용자 목록이 필요합니다.')
  const users = []
  const userIds = new Set()
  const uids = new Set()
  for (let i = 0; i < entries.length; i++) {
    let user
    try {
      // 기존 Firestore 평문 비밀번호를 그대로 사용할 수 있게 해시로 변환한다.
      user = await prepareUser(entries[i], { minimumPasswordLength: 1 })
    } catch (error) {
      throw new Error(`${i + 1}번째 사용자: ${error.message}`)
    }
    if (userIds.has(user.userId) || uids.has(user.uid)) throw new Error(`${i + 1}번째 사용자: userId 또는 uid가 중복됩니다.`)
    userIds.add(user.userId)
    uids.add(user.uid)
    users.push(user)
  }
  return users
}

export function cliDatabaseConfig(env = process.env) {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI가 필요합니다.')
  return { mongodbUri: env.MONGODB_URI, mongodbDb: env.MONGODB_DB || 'consulting_manager' }
}
