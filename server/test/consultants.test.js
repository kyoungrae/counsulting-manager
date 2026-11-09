import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importConsultants, normalizeConsultantKey, prepareConsultantImport, publicConsultant } from '../consultants.js'

const input = [{ name: ' 테스트 ', aliases: ['테스트'], code: 'T01', bank: '은행', account: '1234', rates: [{ rate: 50000, remark: '테스트', kinds: ['면접'] }] }]

test('prepares a safe, validated consultant record without losing rates and profiles', () => {
  const [person] = prepareConsultantImport(input)
  assert.equal(normalizeConsultantKey('(신규) 한 나'), '한나')
  assert.equal(person.name, '테스트')
  assert.equal(person.account, '1234')
  assert.equal(person.rates[0].rate, 50000)
  assert.deepEqual(person.aliases, ['테스트'])
  assert.equal(publicConsultant({ ...person, _id: 'private', other: 'private' }).other, undefined)
})

test('rejects empty, duplicate, or malformed records before any writes', () => {
  for (const data of [[], [{ name: '' }], [{ name: '테스트' }, { name: ' 테 스트 ' }], [{ name: '테스트', rates: [{ rate: -1 }] }]]) {
    assert.throws(() => prepareConsultantImport(data))
  }
})

test('initial import does not overwrite an existing collection', async () => {
  let inserts = 0
  const existing = { findOne: async () => ({ name: '기존' }), insertMany: async () => { inserts++ } }
  await assert.rejects(importConsultants(existing, prepareConsultantImport(input)))
  assert.equal(inserts, 0)
  const empty = { findOne: async () => null, insertMany: async (rows) => { inserts += rows.length } }
  assert.equal(await importConsultants(empty, prepareConsultantImport(input)), 1)
  assert.equal(inserts, 1)
})
