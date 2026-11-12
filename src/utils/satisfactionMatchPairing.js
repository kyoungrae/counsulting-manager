/**
 * 동일인 다건 매칭: 상담일자·상담사 가중치를 크게 두고 점수 높은 쌍부터 1:1 배정.
 * (날짜 오름차순 강제 페어링을 쓰지 않음)
 */
export function scoreRefAgainstResponse(refRecord, studResp, checks) {
  const {
    checkNameMatch,
    normalizeName,
    checkTypeMatch,
    checkDateTimeMatch,
    normalizeCounselorName,
    checkDepartmentMatch,
  } = checks

  let score = 0
  if (checkNameMatch(normalizeName(refRecord.name), normalizeName(studResp.name))) {
    score += 1
  }
  if (checkTypeMatch(refRecord.type, studResp.type)) {
    score += 3
  }
  if (checkDateTimeMatch(refRecord.dateTime, studResp.schedule, studResp.time, studResp.type)) {
    score += 6
  }
  const refCounselorNorm = normalizeCounselorName(refRecord.counselor)
  const studCounselorNorm = normalizeCounselorName(studResp.counselor)
  if (refCounselorNorm && studCounselorNorm && refCounselorNorm === studCounselorNorm) {
    score += 5
  }
  if (checkDepartmentMatch(refRecord.department, studResp.department).match) {
    score += 1
  }
  return score
}

export function buildBestPairMap(refRecords, studResponses, scoreFn) {
  const pairMap = new Map()
  if (!refRecords.length || !studResponses.length) return pairMap

  const candidates = []
  studResponses.forEach((stud, studIdx) => {
    refRecords.forEach((ref) => {
      candidates.push({
        studIdx,
        ref,
        score: scoreFn(ref, stud),
      })
    })
  })

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.studIdx - b.studIdx
  })

  const usedStudIdx = new Set()
  const usedRefIds = new Set()
  candidates.forEach((candidate) => {
    if (candidate.score <= 0) return
    if (usedStudIdx.has(candidate.studIdx) || usedRefIds.has(candidate.ref.id)) return
    pairMap.set(candidate.studIdx, candidate.ref)
    usedStudIdx.add(candidate.studIdx)
    usedRefIds.add(candidate.ref.id)
  })
  return pairMap
}
