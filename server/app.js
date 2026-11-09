import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashPassword, verifyPassword } from './password.js'
import { createSessionStore } from './db.js'
import { loginRateKey } from './gateway-rate.js'

const cookieName = 'ewha_session'
const dummyPasswordHash = await hashPassword(randomBytes(32).toString('hex'))

function publicIdentity(account) {
  return {
    user: { uid: account.uid, email: account.email || '', displayName: account.name || account.userId },
    profile: {
      uid: account.uid, userId: account.userId, email: account.email || '',
      name: account.name || account.userId, role: account.role || 'user', status: account.status,
    },
  }
}

export function createApp({ db, sessionStore = createSessionStore(db), config }) {
  const app = express()
  const origins = new Set(config.allowedOrigins || [config.appOrigin])
  const sessionKey = (token) => createHmac('sha256', config.sessionSecret).update(token).digest('hex')
  const cookieOptions = {
    httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/api',
  }
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy ?? false)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }))
  if (config.logRequests) {
    app.use('/api', (req, res, next) => {
      res.on('finish', () => console.log(JSON.stringify({
        method: req.method, path: req.path, status: res.statusCode,
        origin: req.get('Origin') || null,
        preflightHeaders: req.get('Access-Control-Request-Headers') || null,
      })))
      next()
    })
  }
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    const origin = req.get('Origin')
    if (origin && !origins.has(origin)) {
      return res.status(403).json({ error: { code: 'origin/forbidden', message: '허용되지 않은 접속 주소입니다.' } })
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin)
      res.vary('Origin')
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: { code: 'request/content-type', message: 'JSON 요청이 필요합니다.' } })
    }
    next()
  })
  app.use('/api', express.json({ limit: '16kb' }))
  app.use('/api/auth', async (req, res, next) => {
    const authorization = req.get('Authorization')
    const cookieValue = req.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookieValue
    if (token && /^[a-zA-Z0-9_-]{43}$/.test(token)) {
      req.sessionKey = sessionKey(token)
      const session = await sessionStore.get(req.sessionKey)
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        const account = await db.collection('users').findOne({ uid: session.uid })
        if (account?.status === 'approved') req.account = account
        else await sessionStore.destroy(req.sessionKey)
      } else if (session) await sessionStore.destroy(req.sessionKey)
    }
    next()
  })
  app.get('/api/health', async (req, res) => {
    await db.command({ ping: 1 })
    res.json({ status: 'ok' })
  })
  app.get('/api/auth/session', (req, res) => {
    res.json(req.account ? publicIdentity(req.account) : { user: null, profile: null })
  })
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.loginRateLimit ?? 10,
    standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: req => loginRateKey(req, config.gatewayHmacSecret),
    handler: (req, res) => res.status(429).json({ error: { code: 'auth/too-many-requests', message: '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.' } }),
  })
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { userId, password } = req.body || {}
    if (typeof userId !== 'string' || !userId.trim() || userId.length > 128 || typeof password !== 'string' || !password || password.length > 1024) {
      return res.status(400).json({ error: { code: 'auth/invalid-input', message: '아이디와 비밀번호를 올바르게 입력해주세요.' } })
    }
    const account = await db.collection('users').findOne({ userId: userId.trim() })
    const valid = await verifyPassword(password, account?.passwordHash || dummyPasswordHash)
    if (!account || !valid) {
      return res.status(401).json({ error: { code: 'auth/invalid-credential', message: '아이디 또는 비밀번호가 올바르지 않습니다.' } })
    }
    if (account.status !== 'approved') {
      return res.status(403).json({ error: { code: 'auth/not-approved', message: '계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.' } })
    }
    if (req.sessionKey) await sessionStore.destroy(req.sessionKey)
    const token = randomBytes(32).toString('base64url')
    await sessionStore.set(sessionKey(token), { uid: account.uid, expiresAt: new Date(Date.now() + config.sessionMaxAge) })
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: config.sessionMaxAge })
    res.json({ ...publicIdentity(account), token })
  })
  app.post('/api/auth/logout', async (req, res) => {
    if (req.sessionKey) await sessionStore.destroy(req.sessionKey)
    res.clearCookie(cookieName, cookieOptions)
    res.sendStatus(204)
  })
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'request/not-found', message: 'API를 찾을 수 없습니다.' } }))
  const dist = fileURLToPath(new URL('../dist/', import.meta.url))
  if (existsSync(`${dist}/index.html`)) {
    app.use(express.static(dist, { index: false }))
    app.get('/{*path}', (req, res, next) => {
      if (req.path !== '/' && /\.[^/]+$/.test(req.path)) return next()
      res.sendFile(`${dist}/index.html`)
    })
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 503
    if (status === 503) console.error('API 요청 처리 실패:', error.name)
    res.status(status).json({ error: { code: 'request/failed', message: status === 400 ? '요청 형식이 올바르지 않습니다.' : status === 413 ? '요청 크기가 너무 큽니다.' : '서버 연결을 확인한 뒤 다시 시도해주세요.' } })
  })
  return app
}
