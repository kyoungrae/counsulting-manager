// Loaded in memory only after the authenticated API responds.
let consultantMaster = [];

export function setConsultantMaster(consultants) {
  if (!Array.isArray(consultants) || consultants.some((person) =>
    !person || typeof person.name !== 'string' || !person.name.trim()
    || (person.aliases != null && (!Array.isArray(person.aliases) || person.aliases.some((value) => typeof value !== 'string')))
    || (person.rates != null && (!Array.isArray(person.rates) || person.rates.some((row) =>
      !row || typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate < 0
      || typeof row.remark !== 'string'
      || (row.kinds != null && (!Array.isArray(row.kinds) || row.kinds.some((value) => typeof value !== 'string')))
    )))
  )) {
    throw new Error('상담사 정보 응답이 올바르지 않습니다.');
  }
  consultantMaster = consultants;
}

export function clearConsultantMaster() {
  consultantMaster = [];
}

export function getConsultantMaster() {
  return consultantMaster;
}

export function normalizeConsultantKey(name) {
  return String(name ?? '').replace(/\(신규\)/g, '').replace(/\s+/g, '').trim();
}

export function findConsultantMaster(name) {
  const key = normalizeConsultantKey(name);
  if (!key) return null;
  return consultantMaster.find((person) =>
    normalizeConsultantKey(person.name) === key
    || (person.aliases || []).some((alias) => normalizeConsultantKey(alias) === key)
  ) || null;
}

export function findMasterRates(name, preferRemarkIncludes = '') {
  const rates = findConsultantMaster(name)?.rates || [];
  if (!preferRemarkIncludes) return rates;
  const preferred = rates.filter((row) => row.remark.includes(preferRemarkIncludes)
    || (row.kinds || []).some((kind) => kind.includes(preferRemarkIncludes)));
  return preferred.length ? preferred : rates;
}
