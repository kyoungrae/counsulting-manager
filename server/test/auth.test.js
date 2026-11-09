import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createHmac } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../app.js'
import { hashPassword, verifyPassword } from '../password.js'

const origin = 'http://localhost:3080'
const password = 'a-long-test-password-2026'
let passwordHash

before(async () => {
  passwordHash = await hashPassword(password)
})

function fixture(overrides = {}) {
  const users = [{
    uid: 'user_analysis',
    userId: 'analysis',
    passwordHash,
    name: '분석 사용자',
    email: 'analysis@example.test',
    role: 'admin',
    status: 'approved',
    internalNote: 'this must never reach the browser',
  }]
  const consultants = [{ name: '테스트', aliases: ['테스트'], code: 'TEST', bank: '은행', account: '1234', privateField: 'never-return' }]
  const consultantStore = { rows: [...consultants] }
  const db = {
    collection(name) {
      if (name === 'consultants') {
        return {
          find: () => ({ toArray: async () => consultantStore.rows }),
          findOne: async () => consultantStore.rows[0] || null,
          insertMany: async (rows) => {
            consultantStore.rows.push(...rows)
            return { insertedCount: rows.length }
          },
        }
      }
      assert.equal(name, 'users')
      return {
        async findOne(filter) {
          return users.find((user) => Object.entries(filter).every(([key, value]) => user[key] === value)) || null
        },
      }
    },
  }
  const sessions = new Map()
  const sessionStore = {
    async get(key) { return sessions.get(key) || null },
    async set(key, value) { sessions.set(key, value) },
    async destroy(key) { sessions.delete(key) },
  }
  const app = createApp({
    db,
    sessionStore,
    config: {
      appOrigin: origin,
      sessionSecret: 'test-only-session-secret-with-more-than-32-characters',
      cookieSecure: false,
      trustProxy: false,
      sessionMaxAge: 12 * 60 * 60 * 1000,
      loginRateLimit: 10,
      ...overrides,
    },
  })
  return { app, db, users, consultants, consultantStore, sessions, agent: request.agent(app) }
}

function login(agent, credentials = { userId: 'analysis', password }) {
  return agent.post('/api/auth/login').set('Origin', origin).send(credentials)
}

test('consultant data requires an approved live session and excludes internal fields', async () => {
  const { app, agent, users } = fixture()
  await request(app).get('/api/auth/consultants').expect(401)
  const signedIn = await login(agent).expect(200)
  const response = await request(app).get('/api/auth/consultants')
    .set('Authorization', `Bearer ${signedIn.body.token}`).expect(200)
  assert.equal(response.body.consultants[0].name, '테스트')
  assert.equal(response.body.consultants[0].account, '1234')
  assert.equal(response.body.consultants[0].privateField, undefined)
  assert.equal(response.headers['cache-control'], 'no-store')
  users[0].status = 'disabled'
  await request(app).get('/api/auth/consultants')
    .set('Authorization', `Bearer ${signedIn.body.token}`).expect(401)
})

test('only admins can import consultants into an empty collection', async () => {
  const empty = fixture()
  empty.consultantStore.rows = []
  const nonAdmin = fixture()
  nonAdmin.users[0].role = 'user'
  nonAdmin.consultantStore.rows = []

  await request(empty.app).post('/api/auth/consultants/import')
    .send({ consultants: [{ name: '신규', aliases: [], rates: [] }] })
    .expect(401)

  const userLogin = await login(nonAdmin.agent).expect(200)
  await request(nonAdmin.app).post('/api/auth/consultants/import')
    .set('Authorization', `Bearer ${userLogin.body.token}`)
    .set('Origin', origin)
    .send({ consultants: [{ name: '신규', aliases: [], rates: [] }] })
    .expect(403)

  const adminLogin = await login(empty.agent).expect(200)
  const imported = await request(empty.app).post('/api/auth/consultants/import')
    .set('Authorization', `Bearer ${adminLogin.body.token}`)
    .set('Origin', origin)
    .send({ consultants: [{ name: '신규', aliases: ['신규'], code: '', birth: '', phone: '', affiliation: '', bank: '', account: '', accountHolder: '', placeInterview: '', placeCorrection: '', rates: [{ rate: 60000, remark: '진로', kinds: ['진로'] }] }] })
    .expect(201)
  assert.equal(imported.body.imported, 1)

  await request(empty.app).post('/api/auth/consultants/import')
    .set('Authorization', `Bearer ${adminLogin.body.token}`)
    .set('Origin', origin)
    .send({ consultants: [{ name: '다른', aliases: [], rates: [] }] })
    .expect(409)
})

test('passwords are salted hashes and incorrect or malformed hashes cannot authenticate', async () => {
  const anotherHash = await hashPassword(password)
  assert.notEqual(passwordHash, password)
  assert.notEqual(anotherHash, passwordHash)
  assert.equal(await verifyPassword(password, passwordHash), true)
  assert.equal(await verifyPassword('wrong-password', passwordHash), false)
  assert.equal(await verifyPassword(password, 'plain-text-password'), false)
})

test('an unauthenticated session cannot be created by supplying a UID', async () => {
  const { agent } = fixture()
  const response = await agent.get('/api/auth/session')
    .set('Cookie', 'ewha_analytics_auth_session={"uid":"user_analysis"}')
    .set('X-User-Id', 'user_analysis')
    .query({ uid: 'user_analysis' })
    .expect(200)
  assert.deepEqual(response.body, { user: null, profile: null })
})

test('approved users can log in, restore their server session, and log out', async () => {
  const { app, agent } = fixture()
  const signedIn = await login(agent).expect(200)
  assert.equal(signedIn.body.user.uid, 'user_analysis')
  assert.equal(signedIn.body.user.displayName, '분석 사용자')
  assert.equal(signedIn.body.profile.userId, 'analysis')
  assert.equal(signedIn.body.profile.role, 'admin')
  assert.equal(signedIn.body.profile.status, 'approved')
  assert.doesNotMatch(JSON.stringify(signedIn.body), /password|internalNote|this must never/)
  assert.ok(signedIn.headers['set-cookie']?.some((cookie) => /HttpOnly/i.test(cookie)))
  assert.ok(signedIn.headers['set-cookie']?.some((cookie) => /SameSite=Lax/i.test(cookie)))
  const originalCookie = signedIn.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ')

  const restored = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(restored.body, { user: signedIn.body.user, profile: signedIn.body.profile })
  await agent.post('/api/auth/logout').set('Origin', origin).send({}).expect(204)
  const signedOut = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(signedOut.body, { user: null, profile: null })
  const replay = await request(app).get('/api/auth/session').set('Cookie', originalCookie).expect(200)
  assert.deepEqual(replay.body, { user: null, profile: null })
})

test('separate-domain clients can restore and invalidate an opaque bearer session', async () => {
  const { app, sessions } = fixture()
  const signedIn = await login(request(app)).expect(200)
  const token = signedIn.body.token
  assert.equal(typeof token, 'string')
  assert.ok(token.length >= 32)
  assert.equal(signedIn.headers['access-control-allow-origin'], origin)
  assert.ok(sessions.size > 0)
  for (const [key, value] of sessions) {
    assert.notEqual(key, token)
    assert.doesNotMatch(JSON.stringify(value), new RegExp(token))
  }

  const restored = await request(app).get('/api/auth/session')
    .set('Origin', origin).set('Authorization', `Bearer ${token}`).expect(200)
  assert.equal(restored.body.user.uid, 'user_analysis')
  assert.equal(restored.body.token, undefined)
  await request(app).post('/api/auth/logout').set('Origin', origin)
    .set('Authorization', `Bearer ${token}`).send({}).expect(204)
  const replay = await request(app).get('/api/auth/session')
    .set('Origin', origin).set('Authorization', `Bearer ${token}`).expect(200)
  assert.deepEqual(replay.body, { user: null, profile: null })
})

test('approved web origins can preflight bearer authorization requests', async () => {
  const { app } = fixture()
  const response = await request(app).options('/api/auth/session')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204)
  assert.equal(response.headers['access-control-allow-origin'], origin)
  assert.match(response.headers['access-control-allow-headers'], /authorization/i)
})

test('expired bearer sessions cannot be used even before database TTL cleanup', async () => {
  const { app, sessions } = fixture()
  const signedIn = await login(request(app)).expect(200)
  for (const session of sessions.values()) session.expiresAt = new Date(Date.now() - 1000)
  const response = await request(app).get('/api/auth/session')
    .set('Authorization', `Bearer ${signedIn.body.token}`).expect(200)
  assert.deepEqual(response.body, { user: null, profile: null })
})

test('reauthentication rotates the session and invalidates the old bearer token', async () => {
  const { app, agent } = fixture()
  const first = await login(agent).expect(200)
  const second = await login(agent).expect(200)
  assert.notEqual(first.body.token, second.body.token)
  const oldSession = await request(app).get('/api/auth/session')
    .set('Authorization', `Bearer ${first.body.token}`).expect(200)
  assert.deepEqual(oldSession.body, { user: null, profile: null })
  const current = await agent.get('/api/auth/session').expect(200)
  assert.equal(current.body.user.uid, 'user_analysis')
})

test('production cookies are secure and authentication responses cannot be cached', async () => {
  const { app } = fixture({ cookieSecure: true })
  const response = await login(request(app)).expect(200)
  assert.ok(response.headers['set-cookie']?.some((cookie) => /; Secure(?:;|$)/.test(cookie)))
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.equal(response.headers['x-powered-by'], undefined)
})

test('database errors produce a retryable response without leaking connection details', async () => {
  const { agent, db } = fixture()
  db.collection = () => {
    throw new Error('mongodb://private-user:private-password@internal-db:27017')
  }
  const response = await login(agent).expect(503)
  assert.match(response.headers['content-type'], /application\/json/)
  assert.doesNotMatch(JSON.stringify(response.body), /private-user|private-password|internal-db|stack/)
})

test('unknown users and incorrect passwords receive the same authentication error', async () => {
  const { agent } = fixture()
  const unknown = await login(agent, { userId: 'missing-user', password }).expect(401)
  const incorrect = await login(agent, { userId: 'analysis', password: 'wrong-password' }).expect(401)
  assert.deepEqual(unknown.body, incorrect.body)
  const response = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(response.body, { user: null, profile: null })
})

test('unapproved accounts cannot create a session', async () => {
  const { agent, users } = fixture()
  users[0].status = 'pending'
  await login(agent).expect(403)
  const response = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(response.body, { user: null, profile: null })
})

test('a revoked account loses an existing session', async () => {
  const { agent, users } = fixture()
  await login(agent).expect(200)
  users[0].status = 'blocked'
  const response = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(response.body, { user: null, profile: null })
  users[0].status = 'approved'
  const afterReapproval = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(afterReapproval.body, { user: null, profile: null })
})

test('session profiles reflect current server-side roles and account deletion', async () => {
  const { agent, users } = fixture()
  await login(agent).expect(200)
  users[0].role = 'user'
  const updated = await agent.get('/api/auth/session').expect(200)
  assert.equal(updated.body.profile.role, 'user')
  users.splice(0)
  const deleted = await agent.get('/api/auth/session').expect(200)
  assert.deepEqual(deleted.body, { user: null, profile: null })
})

test('credentials must be bounded strings rather than query objects or arrays', async () => {
  const invalid = [
    {},
    { userId: { $ne: null }, password },
    { userId: 'analysis', password: { $ne: null } },
    { userId: ['analysis'], password },
    { userId: '', password },
    { userId: 'analysis', password: '' },
    { userId: 'x'.repeat(1000), password },
    { userId: 'analysis', password: 'x'.repeat(10000) },
  ]
  for (const credentials of invalid) {
    const { agent } = fixture()
    await login(agent, credentials).expect(400)
  }
})

test('malformed JSON fails cleanly without exposing server internals', async () => {
  const { agent } = fixture()
  const response = await agent.post('/api/auth/login')
    .set('Origin', origin)
    .set('Content-Type', 'application/json')
    .send('{"userId":')
    .expect(400)
  assert.match(response.headers['content-type'], /application\/json/)
  assert.doesNotMatch(JSON.stringify(response.body), /SyntaxError|node_modules|server\/app|stack/)
})

test('cross-origin requests cannot log in or log out a user', async () => {
  const { agent } = fixture()
  await agent.post('/api/auth/login').set('Origin', 'https://attacker.example')
    .send({ userId: 'analysis', password }).expect(403)
  await login(agent).expect(200)
  await agent.post('/api/auth/logout').set('Origin', 'https://attacker.example').send({}).expect(403)
  const response = await agent.get('/api/auth/session').expect(200)
  assert.equal(response.body.user.uid, 'user_analysis')
})

test('login attempts are rate limited', async () => {
  const { agent } = fixture({ loginRateLimit: 2 })
  await login(agent, { userId: 'analysis', password: 'wrong-password' }).expect(401)
  await login(agent, { userId: 'analysis', password: 'wrong-password' }).expect(401)
  await login(agent, { userId: 'analysis', password: 'wrong-password' }).expect(429)
})


test('authenticated gateway clients have independent login limits', async () => {
  const secret = 'gateway-integration-test-secret-at-least-32-bytes'
  const { app } = fixture({ loginRateLimit: 2, gatewayHmacSecret: secret })
  const sign = (ip) => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', secret).update(`ewh-gateway-v1\n${timestamp}\n${ip}`).digest('hex')
    return { 'x-ewh-gateway-ip': ip, 'x-ewh-gateway-time': timestamp, 'x-ewh-gateway-signature': signature }
  }
  const attempt = (headers) => request(app).post('/api/auth/login').set('Origin', origin).set(headers).send({ userId: 'analysis', password: 'wrong-password' })
  const first = sign('192.0.2.10')
  await attempt(first).expect(401)
  await attempt(first).expect(401)
  await attempt(first).expect(429)
  await attempt(sign('192.0.2.11')).expect(401)
})


test('login fails closed for invalid or unconfigured gateway signatures', async () => {
  const secret = 'gateway-integration-test-secret-at-least-32-bytes'
  const timestamp = String(Math.floor(Date.now() / 1000))
  const ip = '192.0.2.12'
  const signature = createHmac('sha256', secret).update(`ewh-gateway-v1\n${timestamp}\n${ip}`).digest('hex')
  const fields = { 'x-ewh-gateway-ip': ip, 'x-ewh-gateway-time': timestamp, 'x-ewh-gateway-signature': signature }
  const configured = fixture({ gatewayHmacSecret: secret })
  const missing = fixture()
  const attempt = (app, headers) => request(app).post('/api/auth/login').set('Origin', origin).set(headers).send({ userId: 'analysis', password: 'wrong-password' })
  await attempt(configured.app, { ...fields, 'x-ewh-gateway-signature': '0'.repeat(64) }).expect(503)
  await attempt(configured.app, { 'x-ewh-gateway-ip': ip }).expect(503)
  await attempt(missing.app, fields).expect(503)
  await attempt(missing.app, {}).expect(401)
})
