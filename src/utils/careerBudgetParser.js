import * as XLSX from 'xlsx';
import { getEmploymentRateCatalog } from './employmentRateCatalog.js';
import {
  buildConsultantBlocks,
  cellText,
  colIndex,
  detectYearMonth,
  findHeaderRow,
  parseDateTime,
  parseNumber,
  sheetToMatrix,
} from './attendanceBudgetShared.js';
import {
  displayConsultantName,
  normalizeConsultantKey,
} from './employmentRateCatalog.js';

/**
 * 진로예산 출석부 전용 파서
 * 양식: 4.(혁신)(진로컨설팅) 출석부(26.10).xlsx
 * - 시트: 진로컨설팅(진로개발) 출석부
 * - 좌측: No/대학/학과/학년/학번/이름/상담분류/상담사/컨설팅일자
 * - 우측: 행 레이블 / 개수 / 1세션당 컨설팅비 / 지급액
 */

function isCareerSheetName(name) {
  const n = String(name || '');
  return n.includes('진로') || n.includes('출석');
}

function findCareerHeaderRow(matrix) {
  // No 또는 번호 + 상담사 + 컨설팅일자
  for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
    const row = matrix[i].map(cellText);
    const hasNo = row.some((c) => c === 'No' || c === 'NO' || c === '번호');
    const hasConsultant = row.some((c) => c.includes('상담사'));
    const hasDate = row.some((c) => c.includes('컨설팅일자'));
    if (hasNo && hasConsultant && hasDate) return i;
  }
  return findHeaderRow(matrix, ['상담사', '컨설팅일자']);
}

function extractCareerPayments(matrix) {
  // 헤더: 행 레이블 | 개수 : 컨설팅일자 | 1세션당 컨설팅비 | 지급액(...)
  for (let i = 0; i < Math.min(matrix.length, 15); i += 1) {
    const row = matrix[i].map(cellText);
    const labelIdx = row.findIndex((c) => c.includes('행 레이블') || c === '상담사');
    const rateIdx = row.findIndex((c) => c.includes('1세션당') || c.includes('세션당') || c.includes('컨설팅비'));
    const countIdx = row.findIndex((c) => c.includes('개수'));
    const payIdx = row.findIndex((c) => c.includes('지급액'));
    if (labelIdx < 0 || rateIdx < 0) continue;

    const payments = [];
    for (let r = i + 1; r < matrix.length; r += 1) {
      const name = cellText(matrix[r][labelIdx]);
      if (!name) continue;
      if (name.includes('총합') || name.includes('합계')) break;
      payments.push({
        name,
        displayName: displayConsultantName(name),
        rate: parseNumber(matrix[r][rateIdx]),
        count: countIdx >= 0 ? parseNumber(matrix[r][countIdx]) : 0,
        amount: payIdx >= 0 ? parseNumber(matrix[r][payIdx]) : 0,
      });
    }
    if (payments.length) return payments;
  }
  return [];
}

function parseCareerAttendanceSheet(sheet, sheetName) {
  const matrix = sheetToMatrix(sheet);
  const title = cellText(matrix[0]?.[0]);
  const headerIdx = findCareerHeaderRow(matrix);
  if (headerIdx < 0) {
    throw new Error(`[${sheetName}] 진로 출석부 헤더(No/상담사/컨설팅일자)를 찾지 못했습니다.`);
  }

  const header = matrix[headerIdx].map(cellText);
  const noIdx = colIndex(header, ['No', 'NO', '번호']);
  const consultantIdx = colIndex(header, ['상담사']);
  const dateIdx = colIndex(header, ['컨설팅일자']);
  const typeIdx = colIndex(header, ['상담분류', '상담구분']);
  const studentIdx = colIndex(header, ['이름']);
  const collegeIdx = colIndex(header, ['대학']);
  const deptIdx = colIndex(header, ['학과']);
  const gradeIdx = colIndex(header, ['학년']);
  const studentIdIdx = colIndex(header, ['학번']);

  const sessions = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const no = cellText(row[noIdx >= 0 ? noIdx : 0]);
    if (!/^\d+$/.test(no)) continue;
    const consultant = cellText(row[consultantIdx]);
    const dt = dateIdx >= 0 ? parseDateTime(row[dateIdx]) : null;
    if (!consultant || !dt) continue;
    sessions.push({
      no: Number(no),
      consultant,
      displayName: displayConsultantName(consultant),
      type: typeIdx >= 0 ? cellText(row[typeIdx]) : '진로개발',
      student: studentIdx >= 0 ? cellText(row[studentIdx]) : '',
      college: collegeIdx >= 0 ? cellText(row[collegeIdx]) : '',
      dept: deptIdx >= 0 ? cellText(row[deptIdx]) : '',
      grade: gradeIdx >= 0 ? cellText(row[gradeIdx]) : '',
      studentId: studentIdIdx >= 0 ? cellText(row[studentIdIdx]) : '',
      ...dt,
      rawDate: cellText(row[dateIdx]),
    });
  }

  const payments = extractCareerPayments(matrix);
  return { sheetName, title, sessions, payments, headerIdx, header };
}

/**
 * 진로예산 출석부 엑셀 → 지출결의 미리보기/워드용 모델
 */
export function parseCareerBudgetWorkbook(arrayBuffer, fileName = '') {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  let careerSheet = null;
  const errors = [];

  for (const sheetName of workbook.SheetNames) {
    if (!isCareerSheetName(sheetName) && workbook.SheetNames.length > 1) continue;
    try {
      const parsed = parseCareerAttendanceSheet(workbook.Sheets[sheetName], sheetName);
      if (parsed.sessions.length) {
        careerSheet = parsed;
        break;
      }
    } catch (err) {
      errors.push(`${sheetName}: ${err.message || err}`);
    }
  }

  // 시트명 힌트가 약해도 전 시트 재시도
  if (!careerSheet) {
    for (const sheetName of workbook.SheetNames) {
      try {
        const parsed = parseCareerAttendanceSheet(workbook.Sheets[sheetName], sheetName);
        if (parsed.sessions.length) {
          careerSheet = parsed;
          break;
        }
      } catch (err) {
        errors.push(`${sheetName}: ${err.message || err}`);
      }
    }
  }

  if (!careerSheet) {
    throw new Error(
      '진로예산 출석부 양식을 읽지 못했습니다. '
      + '시트에 No(또는 번호), 상담사, 컨설팅일자 열이 있는지 확인해 주세요.'
      + (errors.length ? `\n(${errors[0]})` : '')
    );
  }

  const careerBlocks = buildConsultantBlocks(careerSheet, '진로');
  // 지급표 단가가 있으면 그 값 우선(이미 pickRate가 처리). 0원인 경우 지급표 재적용
  const byPay = new Map(
    careerSheet.payments.map((p) => [normalizeConsultantKey(p.name), p])
  );
  for (const block of careerBlocks) {
    const pay = byPay.get(normalizeConsultantKey(block.consultant));
    if (pay?.rate) {
      block.rate = pay.rate;
      block.amount = block.sessionCount * pay.rate;
    }
  }

  const period = detectYearMonth(careerSheet.title || fileName, careerSheet.sessions);
  const totalAmount = careerBlocks.reduce((s, b) => s + b.amount, 0);

  // 기준표: 실제 등장 강사 + 진로 관련 카탈로그
  const rateTableMap = new Map();
  for (const b of careerBlocks) {
    const key = `${normalizeConsultantKey(b.displayName)}|${b.rate}`;
    if (!rateTableMap.has(key)) {
      rateTableMap.set(key, {
        name: b.displayName,
        rate: b.rate,
        remark: b.remark || '진로개발',
      });
    }
  }
  for (const row of getEmploymentRateCatalog().filter((r) => r.remark.includes('진로'))) {
    const key = `${normalizeConsultantKey(row.name)}|${row.rate}`;
    if (!rateTableMap.has(key)) {
      rateTableMap.set(key, { name: row.name, rate: row.rate, remark: row.remark });
    }
  }

  return {
    kind: 'career',
    fileName,
    period,
    careerSheet,
    mainSectionTitle: '[진로개발 컨설팅]',
    interviewBlocks: careerBlocks,
    correctionBlocks: { korean: [], english: [] },
    rateTable: [...rateTableMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    summary: {
      interviewConsultants: careerBlocks.length,
      interviewSessions: careerBlocks.reduce((s, b) => s + b.sessionCount, 0),
      correctionKorean: 0,
      correctionEnglish: 0,
      correctionSessions: 0,
      totalAmount,
    },
  };
}

export async function parseCareerBudgetFile(file) {
  const buffer = await file.arrayBuffer();
  return parseCareerBudgetWorkbook(buffer, file.name);
}
