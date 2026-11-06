import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false
  const [algorithm, salt, hash, extra] = encoded.split(':')
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash) || extra) return false
  const key = await scrypt(password, salt, 64)
  return timingSafeEqual(key, Buffer.from(hash, 'hex'))
}
