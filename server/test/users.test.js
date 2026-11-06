import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { cliDatabaseConfig, prepareUser, prepareUserImport } from '../users.js'
import { hashPassword, verifyPassword } from '../password.js'

let existingHash
before(async () => {
  existingHash = await hashPassword('legacy-password')
})

test('new accounts use salted hashes and expose only supported account fields', async () => {
  const user = await prepareUser({
    userId: '  analysis  ',
    password: 'new-strong-password-2026',
    name: ' 분석 사용자 ',
    role: 'admin',
    status: 'approved',
    internalNote: 'discard this field',
    isSuperuser: true,
  })
  assert.equal(user.userId, 'analysis')
  assert.equal(user.name, '분석 사용자')
  assert.equal(user.role, 'admin')
  assert.equal(await verifyPassword('new-strong-password-2026', user.passwordHash), true)
  assert.equal(user.password, undefined)
  assert.equal(user.internalNote, undefined)
  assert.equal(user.isSuperuser, undefined)
  assert.equal(typeof user.uid, 'string')
  assert.ok(user.uid.length > 0)
  assert.ok(user.createdAt instanceof Date)
})

test('new-account password requirements do not invalidate existing short passwords during migration', async () => {
  await assert.rejects(prepareUser({ userId: 'analysis', password: 'test42' }), /12/)
  const [imported] = await prepareUserImport([{ uid: 'legacy_uid', userId: 'analysis', password: 'test42' }])
  assert.equal(imported.uid, 'legacy_uid')
  assert.equal(await verifyPassword('test42', imported.passwordHash), true)
  assert.equal(imported.password, undefined)
})

test('supported hashes are reused while unsupported Firebase hashes require a new password', async () => {
  const user = await prepareUser({ userId: 'analysis', passwordHash: existingHash })
  assert.equal(user.passwordHash, existingHash)
  await assert.rejects(prepareUser({ userId: 'analysis', passwordHash: 'firebase-scrypt-export-hash' }), /Firebase Auth/)
  await assert.rejects(prepareUserImport([{ userId: 'analysis' }]), /1번째 사용자/)
})

test('legacy export wrappers and document IDs preserve account identity and approval status', async () => {
  const users = await prepareUserImport({ users: [
    { id: 'firestore_document_id', userId: 'analysis', passwordHash: existingHash, role: 'user', status: 'pending' },
    { uid: 'existing_uid', userId: 'administrator', passwordHash: existingHash, role: 'admin', status: 'approved' },
  ] })
  assert.equal(users[0].uid, 'firestore_document_id')
  assert.equal(users[0].status, 'pending')
  assert.equal(users[1].uid, 'existing_uid')
  assert.equal(users[1].role, 'admin')
})

test('duplicate normalized user IDs and duplicate UIDs stop a migration batch', async () => {
  await assert.rejects(prepareUserImport([
    { uid: 'uid-1', userId: 'analysis', passwordHash: existingHash },
    { uid: 'uid-2', userId: ' analysis ', passwordHash: existingHash },
  ]), /2번째 사용자.*중복/)
  await assert.rejects(prepareUserImport([
    { uid: 'same-uid', userId: 'first', passwordHash: existingHash },
    { uid: 'same-uid', userId: 'second', passwordHash: existingHash },
  ]), /2번째 사용자.*중복/)
})

test('invalid export rows reject the entire preparation without mutating source data', async () => {
  const source = [
    { userId: 'valid', passwordHash: existingHash },
    { userId: 'invalid', passwordHash: existingHash, role: 'super-admin' },
  ]
  const original = structuredClone(source)
  await assert.rejects(prepareUserImport(source), /2번째 사용자.*role/)
  assert.deepEqual(source, original)
  for (const input of [[], {}, null, { users: [] }]) {
    await assert.rejects(prepareUserImport(input), /사용자 목록/)
  }
})

test('invalid identity, role, and approval values cannot create accounts', async () => {
  for (const input of [
    { userId: { $ne: null } },
    { userId: '' },
    { userId: 'x'.repeat(129) },
    { userId: 'analysis', uid: 'x'.repeat(257) },
    { userId: 'analysis', role: 'owner' },
    { userId: 'analysis', status: 'allow-all' },
  ]) {
    await assert.rejects(prepareUser({ passwordHash: existingHash, ...input }))
  }
})

test('account-management scripts require an explicit database URI', () => {
  assert.throws(() => cliDatabaseConfig({}), /MONGODB_URI/)
  assert.deepEqual(cliDatabaseConfig({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'migration_target' }), {
    mongodbUri: 'mongodb://localhost:27017', mongodbDb: 'migration_target',
  })
})
