import * as XLSX from 'xlsx';
import {
  displayConsultantName,
  findCatalogEntries,
  normalizeConsultantKey,
} from './employmentRateCatalog.js';

export function sheetToMatrix(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  }).map((row) => (Array.isArray(row) ? row : []));
}

export function cellText(value) {
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

export function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function detectYearMonth(titleText, sessions) {
  const title = String(titleText || '');
  const m = title.match(/\(?\s*(\d{2})\.(\d{1,2})\s*\)?/) || title.match(/(\d{2})년\s*(\d{1,2})월/);
  if (m) {
    const yy = Number(m[1]);
    const month = Number(m[2]);
    return { year: 2000 + yy, month, label: `${yy}년 ${month}월` };
  }
  for (const s of sessions || []) {
    if (s.year && s.month) {
      return { year: s.year, month: s.month, label: `${String(s.year).slice(2)}년 ${s.month}월` };
    }
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    label: `${String(now.getFullYear()).slice(2)}년 ${now.getMonth() + 1}월`,
  };
}

export function parseDateTime(raw) {
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

export function findHeaderRow(matrix, required) {
  for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
    const row = matrix[i].map(cellText);
    const ok = required.every((h) => row.some((c) => c.includes(h)));
    if (ok) return i;
  }
  return -1;
}

export function colIndex(headerRow, candidates) {
  for (const name of candidates) {
    const idx = headerRow.findIndex((c) => cellText(c) === name || cellText(c).includes(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function extractPaymentRows(matrix, headerHints) {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i].map(cellText);
    const rateIdx = row.findIndex((c) => headerHints.rate.some((h) => c.includes(h)));
    if (rateIdx < 0) continue;

    // 지급표의 '이름'은 단가 열 근처(왼쪽)에 있음. 출석부 학생 '이름'열과 구분.
    let nameIdx = -1;
    for (let c = rateIdx - 1; c >= Math.max(0, rateIdx - 4); c -= 1) {
      if (row[c] === '이름') {
        nameIdx = c;
        break;
      }
    }
    if (nameIdx < 0) {
      // fallback: 단가 열보다 오른쪽에 있지 않은 마지막 '이름'
      for (let c = 0; c < rateIdx; c += 1) {
        if (row[c] === '이름') nameIdx = c;
      }
    }
    if (nameIdx < 0) continue;

    const countIdx = row.findIndex((c, idx) => idx > nameIdx && headerHints.count.some((h) => c.includes(h)));
    const payIdx = row.findIndex((c, idx) => idx > nameIdx && c.includes('지급액'));

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
        amount: payIdx >= 0 ? parseNumber(matrix[r][payIdx]) : 0,
      });
    }
    return payments.filter((p) => normalizeConsultantKey(p.name));
  }
  return [];
}

export function pickRate(consultant, payments, preferRemarkIncludes) {
  const pay = payments.find(
    (p) => normalizeConsultantKey(p.name) === normalizeConsultantKey(consultant)
  );
  const catalog = findCatalogEntries(consultant);
  const preferred = preferRemarkIncludes
    ? (catalog.find((e) => e.remark.includes(preferRemarkIncludes)) || catalog[0])
    : catalog[0];

  if (pay?.rate) {
    return {
      rate: pay.rate,
      amountFromSheet: pay.amount,
      remark: preferred?.remark || '',
    };
  }
  return {
    rate: preferred?.rate || 0,
    amountFromSheet: 0,
    remark: preferred?.remark || '',
  };
}

/**
 * 출석부형 시트 공통 파서 (번호/상담사/컨설팅일자 + 우측 지급표)
 */
export function parseAttendanceSheet(sheet, sheetName, options = {}) {
  const {
    dateHeaderCandidates = ['컨설팅일자', '신청일'],
    paymentRateHints = ['1세션당', '세션당', '건당 첨삭비', '첨삭비'],
    paymentCountHints = ['서류면접 (건)', '특화 (건)', '첨삭 횟수', '횟수 (건)'],
    remarkHint = '',
    requiredErrorLabel = '출석부',
  } = options;

  const matrix = sheetToMatrix(sheet);
  const title = cellText(matrix[0]?.[0]);
  const headerIdx = findHeaderRow(matrix, ['번호', '상담사']);
  if (headerIdx < 0) {
    throw new Error(`[${sheetName}] ${requiredErrorLabel} 헤더(번호/상담사)를 찾지 못했습니다.`);
  }

  const header = matrix[headerIdx].map(cellText);
  const consultantIdx = colIndex(header, ['상담사']);
  const dateIdx = colIndex(header, dateHeaderCandidates);
  const typeIdx = colIndex(header, ['상담분류', '상담구분']);
  const studentIdx = colIndex(header, ['이름']);
  const noIdx = colIndex(header, ['번호']);

  const sessions = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const no = cellText(row[noIdx]);
    if (!/^\d+$/.test(no)) continue;
    const consultant = cellText(row[consultantIdx]);
    if (!consultant) continue;
    const dt = dateIdx >= 0 ? parseDateTime(row[dateIdx]) : null;
    sessions.push({
      no: Number(no),
      consultant,
      displayName: displayConsultantName(consultant),
      type: typeIdx >= 0 ? cellText(row[typeIdx]) : '',
      student: studentIdx >= 0 ? cellText(row[studentIdx]) : '',
      ...(dt || {}),
      rawDate: dateIdx >= 0 ? cellText(row[dateIdx]) : '',
    });
  }

  const payments = extractPaymentRows(matrix, {
    rate: paymentRateHints,
    count: paymentCountHints,
  });

  return {
    sheetName,
    title,
    sessions,
    payments,
    remarkHint,
  };
}

export function buildConsultantBlocks(parsedSheet, remarkHint = '') {
  const byKey = new Map();
  for (const s of parsedSheet.sessions) {
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
    const { rate, remark } = pickRate(group.consultant, parsedSheet.payments, remarkHint);
    const dayMap = new Map();
    for (const s of group.sessions) {
      if (!s.dayKey) continue;
      if (!dayMap.has(s.dayKey)) dayMap.set(s.dayKey, []);
      dayMap.get(s.dayKey).push(s);
    }
    const days = [...dayMap.entries()]
      .map(([dayKey, list]) => {
        const sorted = [...list].sort((a, b) => (a.hour - b.hour) || (a.minute - b.minute));
        const first = sorted[0];
        return {
          dayKey,
          sortKey: (first.year || 0) * 10000 + (first.month || 0) * 100 + (first.day || 0),
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
