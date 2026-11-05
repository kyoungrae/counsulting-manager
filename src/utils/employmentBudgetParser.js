import * as XLSX from 'xlsx';
import {
  EMPLOYMENT_RATE_CATALOG,
  displayConsultantName,
  findCatalogEntries,
  normalizeConsultantKey,
} from './employmentRateCatalog.js';

const INTERVIEW_SHEET_HINTS = ['서류면접', '출석부'];
const CORRECTION_SHEET_HINTS = ['서면첨삭', '출석부'];

function sheetToMatrix(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  }).map((row) => (Array.isArray(row) ? row : []));
}

function cellText(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
  return String(value).trim();
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function detectYearMonth(titleText, sessions) {
  const title = String(titleText || '');
  const m = title.match(/\(?\s*(\d{2})\.(\d{1,2})\s*\)?/) || title.match(/(\d{2})년\s*(\d{1,2})월/);
  if (m) {
    const yy = Number(m[1]);
    const month = Number(m[2]);
    return { year: 2000 + yy, month, label: `${yy}년 ${month}월` };
  }
  for (const s of sessions) {
    if (s.year && s.month) return { year: s.year, month: s.month, label: `${String(s.year).slice(2)}년 ${s.month}월` };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, label: `${String(now.getFullYear()).slice(2)}년 ${now.getMonth() + 1}월` };
}

function parseDateTime(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return {
      year: raw.getFullYear(),
      month: raw.getMonth() + 1,
      day: raw.getDate(),
      hour: raw.getHours(),
      minute: raw.getMinutes(),
      dayKey: `${raw.getMonth() + 1}/${raw.getDate()}`,
      timeLabel: `${raw.getHours()}:${String(raw.getMinutes()).padStart(2, '0')}`,
    };
  }
  const text = cellText(raw);
  let m = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+|T)(\d{1,2}):(\d{2})/);
  if (!m) m = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = m[4] != null ? Number(m[4]) : 0;
  const minute = m[5] != null ? Number(m[5]) : 0;
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayKey: `${month}/${day}`,
    timeLabel: `${hour}:${String(minute).padStart(2, '0')}`,
  };
}

function findHeaderRow(matrix, required) {
  for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
    const row = matrix[i].map(cellText);
    const ok = required.every((h) => row.some((c) => c.includes(h)));
    if (ok) return i;
  }
  return -1;
}

function colIndex(headerRow, candidates) {
  for (const name of candidates) {
    const idx = headerRow.findIndex((c) => cellText(c) === name || cellText(c).includes(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractPaymentRows(matrix, headerHints) {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i].map(cellText);
    const nameIdx = row.findIndex((c) => c === '이름');
    if (nameIdx < 0) continue;
    const hasRate = headerHints.rate.some((h) => row.some((c) => c.includes(h)));
    if (!hasRate) continue;

    const rateIdx = row.findIndex((c) => headerHints.rate.some((h) => c.includes(h)));
    const countIdx = row.findIndex((c) => headerHints.count.some((h) => c.includes(h)));
    const payIdx = row.findIndex((c) => c.includes('지급액'));
    const docsIdx = row.findIndex((c) => c.includes('서류면접') && c.includes('건'));
    const specialIdx = row.findIndex((c) => c.includes('특화') && c.includes('건'));

    const payments = [];
    for (let r = i + 1; r < matrix.length; r += 1) {
      const name = cellText(matrix[r][nameIdx]);
      if (!name) continue;
      if (name.includes('합계')) break;
      payments.push({
        name,
        displayName: displayConsultantName(name),
        rate: parseNumber(matrix[r][rateIdx]),
        count: countIdx >= 0 ? parseNumber(matrix[r][countIdx]) : 0,
        interviewCount: docsIdx >= 0 ? parseNumber(matrix[r][docsIdx]) : 0,
        specialCount: specialIdx >= 0 ? parseNumber(matrix[r][specialIdx]) : 0,
        amount: payIdx >= 0 ? parseNumber(matrix[r][payIdx]) : 0,
      });
    }
    return payments.filter((p) => normalizeConsultantKey(p.name));
  }
  return [];
}

function parseInterviewSheet(sheet, sheetName) {
  const matrix = sheetToMatrix(sheet);
  const title = cellText(matrix[0]?.[0]);
  const headerIdx = findHeaderRow(matrix, ['번호', '상담사', '컨설팅일자']);
  if (headerIdx < 0) throw new Error(`[${sheetName}] 출석부 헤더(번호/상담사/컨설팅일자)를 찾지 못했습니다.`);

  const header = matrix[headerIdx].map(cellText);
  const consultantIdx = colIndex(header, ['상담사']);
  const dateIdx = colIndex(header, ['컨설팅일자']);
  const typeIdx = colIndex(header, ['상담분류']);
  const studentIdx = colIndex(header, ['이름']);
  const noIdx = colIndex(header, ['번호']);

  const sessions = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const no = cellText(row[noIdx]);
    if (!/^\d+$/.test(no)) continue;
    const consultant = cellText(row[consultantIdx]);
    const dt = parseDateTime(row[dateIdx]);
    if (!consultant || !dt) continue;
    sessions.push({
      no: Number(no),
      consultant,
      displayName: displayConsultantName(consultant),
      type: cellText(row[typeIdx]),
      student: cellText(row[studentIdx]),
      ...dt,
      rawDate: cellText(row[dateIdx]),
    });
  }

  const payments = extractPaymentRows(matrix, {
    rate: ['1세션당', '세션당'],
    count: ['서류면접 (건)', '특화 (건)'],
  });

  return { kind: 'interview', sheetName, title, sessions, payments };
}

function isEnglishCorrectionType(type) {
  return String(type || '').includes('영문');
}

function parseCorrectionSheet(sheet, sheetName) {
  const matrix = sheetToMatrix(sheet);
  const title = cellText(matrix[0]?.[0]);
  const headerIdx = findHeaderRow(matrix, ['번호', '상담사']);
  if (headerIdx < 0) throw new Error(`[${sheetName}] 서면첨삭 헤더를 찾지 못했습니다.`);

  const header = matrix[headerIdx].map(cellText);
  const consultantIdx = colIndex(header, ['상담사']);
  const dateIdx = colIndex(header, ['컨설팅일자', '신청일']);
  const typeIdx = colIndex(header, ['상담분류']);
  const studentIdx = colIndex(header, ['이름']);
  const noIdx = colIndex(header, ['번호']);

  const sessions = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const no = cellText(row[noIdx]);
    if (!/^\d+$/.test(no)) continue;
    const consultant = cellText(row[consultantIdx]);
    if (!consultant) continue;
    const dt = parseDateTime(row[dateIdx]) || {};
    sessions.push({
      no: Number(no),
      consultant,
      displayName: displayConsultantName(consultant),
      type: cellText(row[typeIdx]),
      lang: isEnglishCorrectionType(cellText(row[typeIdx])) ? 'english' : 'korean',
      student: cellText(row[studentIdx]),
      ...dt,
      rawDate: cellText(row[dateIdx]),
    });
  }

  const payments = extractPaymentRows(matrix, {
    rate: ['건당 첨삭비', '첨삭비'],
    count: ['첨삭 횟수', '횟수'],
  });

  return { kind: 'correction', sheetName, title, sessions, payments };
}

function pickRate(consultant, payments, preferRemarkIncludes) {
  const pay = payments.find((p) => normalizeConsultantKey(p.name) === normalizeConsultantKey(consultant));
  if (pay?.rate) {
    return {
      rate: pay.rate,
      amountFromSheet: pay.amount,
      remark: findCatalogEntries(consultant).find((e) => !preferRemarkIncludes || e.remark.includes(preferRemarkIncludes))?.remark || '',
    };
  }
  const catalog = findCatalogEntries(consultant);
  const preferred = preferRemarkIncludes
    ? catalog.find((e) => e.remark.includes(preferRemarkIncludes))
    : catalog[0];
  return {
    rate: preferred?.rate || 0,
    amountFromSheet: 0,
    remark: preferred?.remark || '',
  };
}

function buildInterviewBlocks(interview) {
  const byKey = new Map();
  for (const s of interview.sessions) {
    const key = normalizeConsultantKey(s.consultant);
    if (!byKey.has(key)) {
      byKey.set(key, {
        consultant: s.consultant,
        displayName: s.displayName,
        sessions: [],
      });
    }
    byKey.get(key).sessions.push(s);
  }

  const blocks = [...byKey.values()].map((group) => {
    const { rate, remark } = pickRate(group.consultant, interview.payments, '서류면접');
    const dayMap = new Map();
    for (const s of group.sessions) {
      if (!dayMap.has(s.dayKey)) dayMap.set(s.dayKey, []);
      dayMap.get(s.dayKey).push(s);
    }
    const days = [...dayMap.entries()]
      .map(([dayKey, list]) => {
        const sorted = [...list].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
        return {
          dayKey,
          sortKey: sorted[0].year * 10000 + sorted[0].month * 100 + sorted[0].day,
          times: sorted.map((x) => x.timeLabel),
          count: sorted.length,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);

    const sessionCount = group.sessions.length;
    return {
      consultant: group.consultant,
      displayName: group.displayName,
      sessionCount,
      rate,
      amount: sessionCount * rate,
      remark,
      days,
    };
  });

  return blocks.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

function buildCorrectionBlocks(correction) {
  const groups = { korean: new Map(), english: new Map() };
  for (const s of correction.sessions) {
    const bucket = s.lang === 'english' ? groups.english : groups.korean;
    const key = normalizeConsultantKey(s.consultant);
    if (!bucket.has(key)) {
      bucket.set(key, {
        consultant: s.consultant,
        displayName: s.displayName,
        sessions: [],
      });
    }
    bucket.get(key).sessions.push(s);
  }

  const toBlocks = (map, remarkHint) => [...map.values()]
    .map((group) => {
      const { rate, remark } = pickRate(group.consultant, correction.payments, remarkHint);
      const sessionCount = group.sessions.length;
      return {
        consultant: group.consultant,
        displayName: group.displayName,
        sessionCount,
        rate,
        amount: sessionCount * rate,
        remark,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));

  return {
    korean: toBlocks(groups.korean, '서면첨삭(국문)'),
    english: toBlocks(groups.english, '서면첨삭(영문)'),
  };
}

function buildRateTable(interviewBlocks, correctionBlocks) {
  const rows = [];
  const pushUnique = (name, rate, remark) => {
    const key = `${normalizeConsultantKey(name)}|${rate}|${remark}`;
    if (rows.some((r) => r.key === key)) return;
    rows.push({ key, name: displayConsultantName(name), rate, remark });
  };

  for (const b of interviewBlocks) pushUnique(b.displayName, b.rate, b.remark || '서류면접');
  for (const b of correctionBlocks.korean) pushUnique(b.displayName, b.rate, b.remark || '서면첨삭(국문)');
  for (const b of correctionBlocks.english) pushUnique(b.displayName, b.rate, b.remark || '서면첨삭(영문)');

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function buildReferenceRateTable() {
  return EMPLOYMENT_RATE_CATALOG.map((row) => ({
    name: row.name,
    rate: row.rate,
    remark: row.remark,
  }));
}

function classifySheet(name) {
  const n = String(name || '');
  if (CORRECTION_SHEET_HINTS.every((h) => n.includes(h)) || (n.includes('서면첨삭') && n.includes('출석'))) {
    return 'correction';
  }
  if (n.includes('서류면접') || (INTERVIEW_SHEET_HINTS.every((h) => n.includes(h)) && !n.includes('서면'))) {
    return 'interview';
  }
  if (n.includes('서면첨삭')) return 'correction';
  if (n.includes('서류면접')) return 'interview';
  return 'unknown';
}

/**
 * 취업예산 출석부 엑셀 → 지출결의 상세내용 생성용 데이터
 */
export function parseEmploymentBudgetWorkbook(arrayBuffer, fileName = '') {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  let interview = null;
  let correction = null;

  for (const sheetName of workbook.SheetNames) {
    const kind = classifySheet(sheetName);
    const sheet = workbook.Sheets[sheetName];
    if (kind === 'interview') interview = parseInterviewSheet(sheet, sheetName);
    if (kind === 'correction') correction = parseCorrectionSheet(sheet, sheetName);
  }

  if (!interview && !correction) {
    throw new Error('취업예산 양식(서류면접/서면첨삭 출석부 시트)을 찾지 못했습니다.');
  }

  const interviewBlocks = interview ? buildInterviewBlocks(interview) : [];
  const correctionBlocks = correction
    ? buildCorrectionBlocks(correction)
    : { korean: [], english: [] };

  const period = detectYearMonth(
    interview?.title || correction?.title || fileName,
    [...(interview?.sessions || []), ...(correction?.sessions || [])]
  );

  const totalAmount =
    interviewBlocks.reduce((s, b) => s + b.amount, 0)
    + correctionBlocks.korean.reduce((s, b) => s + b.amount, 0)
    + correctionBlocks.english.reduce((s, b) => s + b.amount, 0);

  return {
    kind: 'employment',
    fileName,
    period,
    interview,
    correction,
    interviewBlocks,
    correctionBlocks,
    rateTable: buildReferenceRateTable(),
    paymentRateTable: buildRateTable(interviewBlocks, correctionBlocks),
    totalAmount,
    summary: {
      interviewConsultants: interviewBlocks.length,
      interviewSessions: interviewBlocks.reduce((s, b) => s + b.sessionCount, 0),
      correctionKorean: correctionBlocks.korean.length,
      correctionEnglish: correctionBlocks.english.length,
      correctionSessions:
        correctionBlocks.korean.reduce((s, b) => s + b.sessionCount, 0)
        + correctionBlocks.english.reduce((s, b) => s + b.sessionCount, 0),
      totalAmount,
    },
  };
}

export async function parseEmploymentBudgetFile(file) {
  const buffer = await file.arrayBuffer();
  return parseEmploymentBudgetWorkbook(buffer, file.name);
}
