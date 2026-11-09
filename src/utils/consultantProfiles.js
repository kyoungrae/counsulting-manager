/**
 * 강사 영수증용 인적/계좌 정보
 * 원본: consultantMasterData.js (강사비 영수증 DOC 기준)
 */
import {
  findConsultantMaster,
  normalizeConsultantKey,
} from './consultantMasterData.js';

export { findConsultantMaster, normalizeConsultantKey };

export function findConsultantProfile(name) {
  return findConsultantMaster(name);
}

export function formatAccountLine(profile) {
  if (!profile) return '';
  const bank = String(profile.bank || '').trim();
  const account = String(profile.account || '').trim();
  const holder = String(profile.accountHolder || profile.name || '').trim();
  if (!bank && !account) return holder || '';
  if (!account) return `${bank} ${holder}`.trim();
  return `${bank} ${account} ${holder}`.replace(/\s+/g, ' ').trim();
}

export function pickSessionPlace(profile, consultingType = '') {
  const type = String(consultingType || '');
  if (/서면|첨삭/.test(type)) {
    return profile?.placeCorrection || '온라인 접수';
  }
  return profile?.placeInterview || '온라인 ZOOM';
}
