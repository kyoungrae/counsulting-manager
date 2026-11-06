import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from '../config.js'

const base = {
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
}

test('a hosting origin and separate API deployment have explicit secure settings', () => {
  const config = loadConfig({
    ...base,
    APP_ORIGIN: 'https://analysis.example.com',
    ALLOWED_ORIGINS: 'http://localhost:5173,https://preview.example.com',
    COOKIE_SECURE: 'true',
    TRUST_PROXY: '1',
    MONGODB_DB: 'isolated_analysis',
    PORT: '3081',
  })
  assert.equal(config.appOrigin, 'https://analysis.example.com')
  assert.deepEqual(config.allowedOrigins, [
    'https://analysis.example.com', 'http://localhost:5173', 'https://preview.example.com',
  ])
  assert.equal(config.cookieSecure, true)
  assert.equal(config.trustProxy, 1)
  assert.equal(config.mongodbDb, 'isolated_analysis')
  assert.equal(config.port, 3081)
})

test('origin configuration rejects paths, wildcards, credentials, and non-web schemes', () => {
  for (const APP_ORIGIN of [
    'https://analysis.example.com/path',
    'https://analysis.example.com/',
    '*',
    'https://user:password@analysis.example.com',
    'file:///local-app/index.html',
  ]) {
    assert.throws(() => loadConfig({ ...base, APP_ORIGIN }))
  }
  assert.throws(() => loadConfig({ ...base, ALLOWED_ORIGINS: 'https://preview.example.com/path' }))
})

test('missing database configuration and short session secrets stop startup', () => {
  assert.throws(() => loadConfig({ SESSION_SECRET: base.SESSION_SECRET }), /MONGODB_URI/)
  assert.throws(() => loadConfig({ MONGODB_URI: base.MONGODB_URI }), /SESSION_SECRET/)
  assert.throws(() => loadConfig({ ...base, SESSION_SECRET: 'short' }), /SESSION_SECRET/)
})

test('invalid listening ports stop startup', () => {
  for (const PORT of ['0', '-1', '65536', '3080.5', 'not-a-port']) {
    assert.throws(() => loadConfig({ ...base, PORT }), /PORT/)
  }
})

test('local defaults avoid trusting arbitrary forwarded headers', () => {
  const config = loadConfig(base)
  assert.equal(config.appOrigin, 'http://localhost:3080')
  assert.equal(config.cookieSecure, false)
  assert.equal(config.trustProxy, false)
  assert.equal(config.mongodbDb, 'consulting_manager')
})
