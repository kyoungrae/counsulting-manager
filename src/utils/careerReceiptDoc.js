/**
 * 진로컨설팅 강사비 영수증
 * 양식: 3.[혁신][진로컨설팅] 강사비 영수증 (26.10).doc
 */
import { findConsultantProfile } from './consultantProfiles.js';
import {
  buildConsultantReceiptDocument,
  downloadReceiptBlob,
  formatAccount,
  formatAffiliation,
  formatAmount,
  formatDayLines,
} from './employmentReceiptDoc.js';

/**
 * 진로 출석 집계 → 영수증 미리보기 항목
 * 내용: 진로컨설팅(진로개발), 장소: 온라인 ZOOM
 */
export function buildCareerReceiptItems(model) {
  const period = model?.period;
  return (model?.interviewBlocks || []).map((block) => {
    const profile = findConsultantProfile(block.consultant || block.displayName);
    const displayName = block.displayName || block.consultant;
    return {
      id: `career-${block.consultant}`,
      kind: '진로개발',
      contentLabel: '진로컨설팅(진로개발)',
      kicker: '[진로컨설팅]',
      displayName,
      sessionCount: block.sessionCount,
      rate: block.rate,
      amount: block.amount,
      amountText: formatAmount({
        sessionCount: block.sessionCount,
        rate: block.rate,
        amount: block.amount,
      }),
      days: block.days || [],
      dayText: formatDayLines(block.days),
      place: profile?.placeInterview || '온라인 ZOOM',
      affiliationText: formatAffiliation(profile?.affiliation),
      accountText: formatAccount(profile, displayName),
      profile,
      period,
      missingProfile: !profile || !profile.code,
    };
  });
}

export async function buildCareerReceiptDocument(model) {
  return buildConsultantReceiptDocument(buildCareerReceiptItems(model), {
    kicker: '[진로컨설팅]',
  });
}

export async function downloadCareerReceiptWord(model) {
  const doc = await buildCareerReceiptDocument(model);
  const stamp = `${String(model.period.year).slice(2)}.${String(model.period.month).padStart(2, '0')}`;
  return downloadReceiptBlob(doc, `[혁신][진로컨설팅] 강사비 영수증 (${stamp}).docx`);
}
