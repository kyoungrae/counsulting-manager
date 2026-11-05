import * as XLSX from 'xlsx';
import { EMPLOYMENT_RATE_CATALOG } from './employmentRateCatalog.js';
import {
  buildConsultantBlocks,
  detectYearMonth,
  parseAttendanceSheet,
} from './attendanceBudgetShared.js';

function classifyCareerSheet(name) {
  const n = String(name || '');
  if (n.includes('서면첨삭')) return 'correction';
  if (n.includes('진로') || n.includes('웰컴') || n.includes('출석')) return 'career';
  return 'unknown';
}

function isEnglishCorrectionType(type) {
  return String(type || '').includes('영문');
}

function buildCorrectionBlocks(parsed) {
  const koreanSessions = parsed.sessions.filter((s) => !isEnglishCorrectionType(s.type));
  const englishSessions = parsed.sessions.filter((s) => isEnglishCorrectionType(s.type));
  return {
    korean: buildConsultantBlocks({ sessions: koreanSessions, payments: parsed.payments }, '서면첨삭(국문)'),
    english: buildConsultantBlocks({ sessions: englishSessions, payments: parsed.payments }, '서면첨삭(영문)'),
  };
}

/**
 * 진로예산 출석부 엑셀 파서
 * - 진로개발/웰컴 등 출석부 시트 + (있으면) 서면첨삭 시트
 * - 취업예산과 동일한 미리보기/요약 모델 형태
 */
export function parseCareerBudgetWorkbook(arrayBuffer, fileName = '') {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  let careerSheet = null;
  let correctionSheet = null;
  const parsedSheets = [];

  for (const sheetName of workbook.SheetNames) {
    const kind = classifyCareerSheet(sheetName);
    const sheet = workbook.Sheets[sheetName];
    try {
      const parsed = parseAttendanceSheet(sheet, sheetName, {
        remarkHint: kind === 'correction' ? '서면첨삭' : '진로',
        requiredErrorLabel: '진로예산 출석부',
      });
      parsedSheets.push({ kind, parsed });
      if (kind === 'correction' && !correctionSheet) correctionSheet = parsed;
      if (kind === 'career' && !careerSheet) careerSheet = parsed;
    } catch {
      // 시트가 출석부 형태가 아니면 건너뜀
    }
  }

  // 시트명 힌트가 약하면 첫 출석부 시트를 진로로 사용
  if (!careerSheet) {
    const first = parsedSheets.find((s) => s.kind !== 'correction');
    if (first) careerSheet = first.parsed;
  }

  if (!careerSheet && !correctionSheet) {
    throw new Error('진로예산 양식(진로개발 출석부 등)을 찾지 못했습니다. 취업예산과 같은 출석부 형태 엑셀을 업로드해 주세요.');
  }

  const careerBlocks = careerSheet
    ? buildConsultantBlocks(careerSheet, '진로')
    : [];
  const correctionBlocks = correctionSheet
    ? buildCorrectionBlocks(correctionSheet)
    : { korean: [], english: [] };

  const period = detectYearMonth(
    careerSheet?.title || correctionSheet?.title || fileName,
    [...(careerSheet?.sessions || []), ...(correctionSheet?.sessions || [])]
  );

  const totalAmount =
    careerBlocks.reduce((s, b) => s + b.amount, 0)
    + correctionBlocks.korean.reduce((s, b) => s + b.amount, 0)
    + correctionBlocks.english.reduce((s, b) => s + b.amount, 0);

  return {
    kind: 'career',
    fileName,
    period,
    careerSheet,
    correctionSheet,
    // UI 공통 필드: employment의 interviewBlocks에 대응하는 메인 블록
    mainSectionTitle: '[진로개발 컨설팅]',
    interviewBlocks: careerBlocks,
    correctionBlocks,
    rateTable: EMPLOYMENT_RATE_CATALOG
      .filter((r) => r.remark.includes('진로') || r.remark.includes('서면첨삭') || r.remark.includes('서류'))
      .map((row) => ({ name: row.name, rate: row.rate, remark: row.remark })),
    summary: {
      interviewConsultants: careerBlocks.length,
      interviewSessions: careerBlocks.reduce((s, b) => s + b.sessionCount, 0),
      correctionKorean: correctionBlocks.korean.length,
      correctionEnglish: correctionBlocks.english.length,
      correctionSessions:
        correctionBlocks.korean.reduce((s, b) => s + b.sessionCount, 0)
        + correctionBlocks.english.reduce((s, b) => s + b.sessionCount, 0),
      totalAmount,
    },
  };
}

export async function parseCareerBudgetFile(file) {
  const buffer = await file.arrayBuffer();
  return parseCareerBudgetWorkbook(buffer, file.name);
}
