import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBestPairMap, scoreRefAgainstResponse } from '../src/utils/satisfactionMatchPairing.js'

const checks = {
  checkNameMatch: (a, b) => a && b && a === b,
  normalizeName: (name) => String(name || '').replace(/\s+/g, ''),
  checkTypeMatch: (a, b) => a === b,
  checkDateTimeMatch: (refDateTime, schedule, time) => {
    const resp = `${schedule}${time ? ` ${time}` : ''}`.trim()
    return refDateTime === resp
  },
  normalizeCounselorName: (name) => String(name || '').replace(/\s+/g, ''),
  checkDepartmentMatch: (a, b) => ({ match: !a || !b || a === b }),
}

test('same person with different teachers pairs by date+counselor even if response order differs', () => {
  const refs = [
    { id: 'r1', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D1 10:00', counselor: 'X' },
    { id: 'r2', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D2 10:00', counselor: 'Y' },
  ]
  const studs = [
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D2 10:00', time: '', dateTime: 'D2 10:00', counselor: 'Y' },
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D1 10:00', time: '', dateTime: 'D1 10:00', counselor: 'X' },
  ]
  const pairs = buildBestPairMap(refs, studs, (ref, stud) => scoreRefAgainstResponse(ref, stud, checks))
  assert.equal(pairs.get(0).id, 'r2')
  assert.equal(pairs.get(1).id, 'r1')
})

test('same person with same teacher on different dates pairs by date', () => {
  const refs = [
    { id: 'r1', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D1 10:00', counselor: 'X' },
    { id: 'r2', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D2 10:00', counselor: 'X' },
  ]
  const studs = [
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D2 10:00', time: '', counselor: 'X' },
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D1 10:00', time: '', counselor: 'X' },
  ]
  const pairs = buildBestPairMap(refs, studs, (ref, stud) => scoreRefAgainstResponse(ref, stud, checks))
  assert.equal(pairs.get(0).id, 'r2')
  assert.equal(pairs.get(1).id, 'r1')
})

test('same day different teachers prefers counselor when dates tie', () => {
  const refs = [
    { id: 'r1', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D1 10:00', counselor: 'X' },
    { id: 'r2', name: '홍길동', department: '경영', type: '서류면접', dateTime: 'D1 10:00', counselor: 'Y' },
  ]
  const studs = [
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D1 10:00', time: '', counselor: 'Y' },
    { name: '홍길동', department: '경영', type: '서류면접', schedule: 'D1 10:00', time: '', counselor: 'X' },
  ]
  const pairs = buildBestPairMap(refs, studs, (ref, stud) => scoreRefAgainstResponse(ref, stud, checks))
  assert.equal(pairs.get(0).id, 'r2')
  assert.equal(pairs.get(1).id, 'r1')
})
