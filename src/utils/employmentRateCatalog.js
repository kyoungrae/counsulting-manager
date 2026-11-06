/**
 * 취업컨설팅 강사비/세션 기준표
 * 원본: consultantMasterData.js (HWP 지출결의 상세내용 기준)
 * 엑셀 지급표에 단가가 있으면 엑셀 값을 우선하고, 비고는 이 목록에서 보완합니다.
 */
import {
  CONSULTANT_MASTER,
  normalizeConsultantKey,
} from './consultantMasterData.js';

export { normalizeConsultantKey };

export const EMPLOYMENT_RATE_CATALOG = CONSULTANT_MASTER.flatMap((person) =>
  (person.rates || []).map((rateRow) => ({
    name: person.name,
    aliases: person.aliases || [person.name],
    rate: rateRow.rate,
    remark: rateRow.remark,
  }))
);

export function findCatalogEntries(name) {
  const key = normalizeConsultantKey(name);
  return EMPLOYMENT_RATE_CATALOG.filter(
    (row) =>
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
