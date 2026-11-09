const stringFields = ['name', 'code', 'birth', 'phone', 'affiliation', 'bank', 'account', 'accountHolder', 'placeInterview', 'placeCorrection']

export function normalizeConsultantKey(name) {
  return String(name ?? '').replace(/\(신규\)/g, '').replace(/\s+/g, '').trim()
}

export function prepareConsultantImport(input) {
  const entries = Array.isArray(input) ? input : input?.consultants
  if (!Array.isArray(entries) || !entries.length || entries.length > 10000) {
    throw new Error('상담사 JSON 배열이 필요합니다.')
  }
  const names = new Set()
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('상담사 정보 형식이 올바르지 않습니다.')
    const person = {}
    for (const field of stringFields) {
      const value = entry[field] ?? ''
      if (typeof value !== 'string' || value.length > 1000) throw new Error('상담사 정보 형식이 올바르지 않습니다.')
      person[field] = value.trim()
    }
    const key = normalizeConsultantKey(person.name)
    if (!key || names.has(key)) throw new Error('상담사 이름이 비어 있거나 중복됩니다.')
    names.add(key)
    const aliases = entry.aliases ?? []
    if (!Array.isArray(aliases) || aliases.length > 100 || aliases.some((alias) => typeof alias !== 'string' || alias.length > 200)) {
      throw new Error('상담사 별칭 형식이 올바르지 않습니다.')
    }
    person.aliases = aliases.map((alias) => alias.trim())
    const rates = entry.rates ?? []
    if (!Array.isArray(rates) || rates.length > 100) throw new Error('상담사 단가 형식이 올바르지 않습니다.')
    person.rates = rates.map((rate) => {
      if (!rate || typeof rate !== 'object' || Array.isArray(rate) || !Number.isFinite(rate.rate) || rate.rate < 0 || rate.rate > 100000000) {
        throw new Error('상담사 단가 형식이 올바르지 않습니다.')
      }
      const remark = rate.remark ?? ''
      const kinds = rate.kinds ?? []
      if (typeof remark !== 'string' || remark.length > 1000 || !Array.isArray(kinds) || kinds.length > 100 || kinds.some((kind) => typeof kind !== 'string' || kind.length > 200)) {
        throw new Error('상담사 단가 형식이 올바르지 않습니다.')
      }
      return { rate: rate.rate, remark, kinds }
    })
    return person
  })
}

// Explicit allowlist prevents internal database fields from reaching clients.
export function publicConsultant(person) {
  return Object.fromEntries([...stringFields, 'aliases', 'rates'].filter((field) => person[field] !== undefined).map((field) => [field, person[field]]))
}

export async function importConsultants(collection, consultants) {
  // Initial import only: no implicit update, replacement, or bulk clearing.
  if (await collection.findOne({})) throw new Error('상담사 데이터가 이미 있어 초기 가져오기를 중단했습니다.')
  await collection.insertMany(consultants, { ordered: true })
  return consultants.length
}
