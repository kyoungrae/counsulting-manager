/** 취업컨설팅 강사비/세션 기준표. 엑셀 지급표의 단가가 우선합니다. */
import { getConsultantMaster, normalizeConsultantKey } from './consultantMasterData.js';

export { normalizeConsultantKey };

export function getEmploymentRateCatalog() {
  return getConsultantMaster().flatMap((person) =>
    (person.rates || []).map((rateRow) => ({
      name: person.name,
      aliases: person.aliases || [person.name],
      rate: rateRow.rate,
      remark: rateRow.remark,
    }))
  );
}

export function findCatalogEntries(name) {
  const key = normalizeConsultantKey(name);
  return getEmploymentRateCatalog().filter((row) =>
    row.aliases.some((alias) => normalizeConsultantKey(alias) === key)
    || normalizeConsultantKey(row.name) === key
  );
}

export function displayConsultantName(name) {
  const entries = findCatalogEntries(name);
  if (entries.length) return entries[0].name.replace(/^\(신규\)/, '');
  return String(name ?? '').trim();
}

export function formatWon(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('ko-KR');
}
