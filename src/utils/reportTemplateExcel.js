import ExcelJS from 'exceljs';
import { COLLEGE_ORDER, sortMonthsDesc } from './reportDataNormalizer';

const TEMPLATE_URL = new URL('../../documents/결과 보고서 메뉴/인재개발원 진로취업컨설팅 진행 결과 보고(2026년 2월)  _ 개발용 결과보고서 예시.xlsx', import.meta.url).href;

/** 수식 셀은 계산 결과만 복사 (Shared Formula 오류 방지) */
const getCellValueForCopy = (cell) => {
  if (cell.result !== undefined && cell.result !== null) return cell.result;
  return cell.value;
};

/** 셀 스타일 복사 (배경, 테두리, 글꼴 등) */
const copyCellStyle = (src, dst) => {
  if (src.font) dst.font = JSON.parse(JSON.stringify(src.font));
  if (src.fill) dst.fill = JSON.parse(JSON.stringify(src.fill));
  if (src.border) dst.border = JSON.parse(JSON.stringify(src.border));
  if (src.alignment) dst.alignment = JSON.parse(JSON.stringify(src.alignment));
  if (src.numFmt) dst.numFmt = src.numFmt;
};

/** ExcelJS 시트 복제 (스타일·병합·열너비 유지, 수식은 값으로 변환) */
const cloneSheet = (workbook, sourceSheet, newName) => {
  const newSheet = workbook.addWorksheet(newName);
  const maxRow = Math.max(sourceSheet.rowCount || 0, 120);
  for (let r = 1; r <= maxRow; r += 1) {
    const srcRow = sourceSheet.getRow(r);
    const dstRow = newSheet.getRow(r);
    dstRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = getCellValueForCopy(cell);
      copyCellStyle(cell, dstCell);
    });
  }
  sourceSheet.columns?.forEach((col, i) => {
    if (col && col.width) newSheet.getColumn(i + 1).width = col.width;
  });
  Object.values(sourceSheet._merges || {}).forEach((mergeRange) => {
    try {
      const rangeStr = typeof mergeRange?.range === 'string' ? mergeRange.range : mergeRange;
      if (rangeStr) newSheet.mergeCells(rangeStr);
    } catch (_) {
      /* ignore invalid merges */
    }
  });
  return newSheet;
};

/** 구조만 복제 (스타일·병합·열너비 유지, 값은 비움) */
const cloneSheetStructureOnly = (workbook, sourceSheet, newName) => {
  const newSheet = workbook.addWorksheet(newName);
  const maxRow = Math.max(sourceSheet.rowCount || 0, 120);
  for (let r = 1; r <= maxRow; r += 1) {
    const srcRow = sourceSheet.getRow(r);
    const dstRow = newSheet.getRow(r);
    dstRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = '';
      copyCellStyle(cell, dstCell);
    });
  }
  sourceSheet.columns?.forEach((col, i) => {
    if (col && col.width) newSheet.getColumn(i + 1).width = col.width;
  });
  Object.values(sourceSheet._merges || {}).forEach((mergeRange) => {
    try {
      const rangeStr = typeof mergeRange?.range === 'string' ? mergeRange.range : mergeRange;
      if (rangeStr) newSheet.mergeCells(rangeStr);
    } catch (_) {
      /* ignore invalid merges */
    }
  });
  return newSheet;
};

const LIGHT_GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

/** 개요 시트: 제목 행(1행) 회색 배경 채우기 */
const fillTitleBackground = (ws) => {
  for (let c = 1; c <= 2; c += 1) {
    ws.getCell(1, c).fill = JSON.parse(JSON.stringify(LIGHT_GRAY_FILL));
  }
};

/** 개요 시트: 섹션 헤더(1.목표, 2.대상, 3.제공 영역, 4.설문 진행) 회색 배경 채우기 */
const fillSectionHeaderBackground = (ws) => {
  const headerRows = [3, 8, 12, 18];
  headerRows.forEach((row) => {
    for (let c = 1; c <=1; c += 1) {
      ws.getCell(row, c).fill = JSON.parse(JSON.stringify(LIGHT_GRAY_FILL));
    }
  });
};

/** 개요 시트: 1. 목표·2. 대상 하위 볼릿 항목에 B:C(2열) 병합 적용 → colspan=2 */
const mergeOverviewBulletItems = (ws) => {
  const ranges = [
    'A4:B4', 'A5:B5', 'A6:B6', 'A7:B7',   // 1. 목표 하위 (행 4~7)
    'A9:B9', 'A10:C10', 'B11:C11',         // 2. 대상 하위 (행 9~11)
    'A19:B19'
  ];
  ranges.forEach((range) => {
    try {
      ws.mergeCells(range);
    } catch (_) {
      /* 이미 병합된 경우 등 무시 */
    }
  });
};

/** 개요 시트: 테이블 영역(B13:C16, B20:D30) 외부 셀의 테두리 제거 (불필요한 선 제거) */
const clearBordersOutsideTables = (ws) => {
  const inTable = (row, col) => {
    if (row >= 13 && row <= 16 && col >= 2 && col <= 3) return true; // 제공 영역 표
    if (row >= 20 && row <= 30 && col >= 2 && col <= 4) return true; // 설문 진행 표
    return false;
  };
  for (let r = 1; r <= 120; r += 1) {
    for (let c = 1; c <= 20; c += 1) {
      if (inTable(r, c)) continue;
      const cell = ws.getCell(r, c);
      if (cell.border) {
        cell.border = undefined;
      }
    }
  }
};

/** 셀 값만 설정, 스타일 유지 (템플릿 스타일 보존) */
const setCell = (ws, addr, value) => {
  const cell = ws.getCell(addr);
  if (value === null || value === undefined || value === '') {
    cell.value = '';
  } else {
    cell.value = value;
  }
};

/** 숫자 셀 설정 (빈 값이면 0) */
const setCellNumeric = (ws, addr, value) => {
  const cell = ws.getCell(addr);
  if (value === null || value === undefined || value === '') {
    cell.value = 0;
  } else {
    cell.value = value;
  }
};

const a1ToRC = (a1) => {
  const m = String(a1).match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i += 1) {
    col = col * 26 + (m[1].toUpperCase().charCodeAt(i) - 64);
  }
  return { row: parseInt(m[2], 10), col };
};

/** 범위 값 비우기 (스타일 유지) */
const clearRange = (ws, rangeA1) => {
  try {
    const [from, to] = rangeA1.includes(':') ? rangeA1.split(':') : [rangeA1, rangeA1];
    const fromRC = a1ToRC(from.trim());
    const toRC = a1ToRC(to.trim());
    if (!fromRC || !toRC) return;
    for (let r = fromRC.row; r <= toRC.row; r += 1) {
      for (let c = fromRC.col; c <= toRC.col; c += 1) {
        ws.getCell(r, c).value = '';
      }
    }
  } catch (_) {
    /* ignore */
  }
};

/** 범위를 숫자로 채우기 (숫자 셀은 0으로) */
const fillRangeWithNumber = (ws, rangeA1, value = 0) => {
  try {
    const [from, to] = rangeA1.includes(':') ? rangeA1.split(':') : [rangeA1, rangeA1];
    const fromRC = a1ToRC(from.trim());
    const toRC = a1ToRC(to.trim());
    if (!fromRC || !toRC) return;
    for (let r = fromRC.row; r <= toRC.row; r += 1) {
      for (let c = fromRC.col; c <= toRC.col; c += 1) {
        ws.getCell(r, c).value = value;
      }
    }
  } catch (_) {
    /* ignore */
  }
};

const getMonthLabel = (year, month) => {
  const yy = String(year).slice(-2);
  return `${yy}.${month}월`;
};

const getMonthSheetName = (month) => `${month}월`;

const withComma = (n) => (Number.isFinite(n) ? n.toLocaleString('ko-KR') : '0');

const ratio = (a, b) => {
  if (!b) return '0.0%';
  return `${((a / b) * 100).toFixed(1)}%`;
};

const fillMonthSheet = (ws, stat, trendByMonth) => {
  const mName = getMonthSheetName(stat.month);
  setCell(ws, 'A1', `2025학년도 하반기 진로·취업컨설팅 프로그램 운영 및 평가(${mName})`);
  setCell(ws, 'A4', `    ${stat.year}.${stat.month}.1. ~ ${stat.year}.${stat.month}.31.`);

  const rtApp = stat.realtime.applied;
  const rtAttend = stat.realtime.attended;
  const rtAbsent = stat.realtime.absent;
  const offComp = stat.offline.completed;

  const rtAppTotal = rtApp.career + rtApp.interviewGeneral + rtApp.interviewSpecial;
  const rtAttendTotal = rtAttend.career + rtAttend.interviewGeneral + rtAttend.interviewSpecial;
  const rtAbsentTotal = rtAbsent.career + rtAbsent.interviewGeneral + rtAbsent.interviewSpecial;
  const offTotal = offComp.linked + offComp.korEng;
  const totalApp = rtAppTotal + offTotal;
  const totalAttend = rtAttendTotal + offTotal;
  const totalAbsent = rtAbsentTotal;

  clearRange(ws, 'A10:F10');
  fillRangeWithNumber(ws, 'B18:I22', 0);
  clearRange(ws, 'B28:I28');
  fillRangeWithNumber(ws, 'C27:G29', 0);
  fillRangeWithNumber(ws, 'B37:I39', 0);
  fillRangeWithNumber(ws, 'B43:I45', 0);
  fillRangeWithNumber(ws, 'B50:I56', 0);
  fillRangeWithNumber(ws, 'B61:I78', 0);
  fillRangeWithNumber(ws, 'B82:E83', 0);
  clearRange(ws, 'B88:I88');
  clearRange(ws, 'B94:I94');
  clearRange(ws, 'B95:I95');
  clearRange(ws, 'B96:I96');
  clearRange(ws, 'A100:I106');
  fillRangeWithNumber(ws, 'B89:I93', 0);
  fillRangeWithNumber(ws, 'B97:I99', 0);
  clearRange(ws, 'B93');
  clearRange(ws, 'B98');
  clearRange(ws, 'D98');
  clearRange(ws, 'H98');
  clearRange(ws, 'B99');
  clearRange(ws, 'D99');

  setCell(ws, 'A15', `(1) 진행별 운영: 총 신청 ${totalApp}건(실시간 ${rtAppTotal}건/서면첨삭 ${offTotal}건), 참석 ${totalAttend}건, 불참 ${totalAbsent}건`);

  setCell(ws, 'B18', rtApp.career);
  setCell(ws, 'C18', rtApp.interviewGeneral);
  setCell(ws, 'D18', rtApp.interviewSpecial);
  setCell(ws, 'E18', rtAppTotal);
  setCell(ws, 'F18', offComp.linked);
  setCell(ws, 'G18', offComp.korEng);
  setCell(ws, 'H18', offTotal);
  setCell(ws, 'I18', totalApp);

  setCell(ws, 'B19', rtAttend.career);
  setCell(ws, 'C19', rtAttend.interviewGeneral);
  setCell(ws, 'D19', rtAttend.interviewSpecial);
  setCell(ws, 'E19', rtAttendTotal);
  setCell(ws, 'F19', offComp.linked);
  setCell(ws, 'G19', offComp.korEng);
  setCell(ws, 'H19', offTotal);
  setCell(ws, 'I19', totalAttend);

  setCell(ws, 'B20', ratio(rtAttend.career, rtApp.career));
  setCell(ws, 'C20', ratio(rtAttend.interviewGeneral, rtApp.interviewGeneral));
  setCell(ws, 'D20', ratio(rtAttend.interviewSpecial, rtApp.interviewSpecial));
  setCell(ws, 'E20', ratio(rtAttendTotal, rtAppTotal));
  setCell(ws, 'F20', ratio(offComp.linked, offComp.linked));
  setCell(ws, 'G20', ratio(offComp.korEng, offComp.korEng));
  setCell(ws, 'H20', ratio(offTotal, offTotal));
  setCell(ws, 'I20', ratio(totalAttend, totalApp));

  setCell(ws, 'B21', rtAbsent.career);
  setCell(ws, 'C21', rtAbsent.interviewGeneral);
  setCell(ws, 'D21', rtAbsent.interviewSpecial);
  setCell(ws, 'E21', rtAbsentTotal);
  setCell(ws, 'F21', 0);
  setCell(ws, 'G21', 0);
  setCell(ws, 'H21', 0);
  setCell(ws, 'I21', totalAbsent);

  setCell(ws, 'B22', ratio(rtAbsent.career, rtApp.career));
  setCell(ws, 'C22', ratio(rtAbsent.interviewGeneral, rtApp.interviewGeneral));
  setCell(ws, 'D22', ratio(rtAbsent.interviewSpecial, rtApp.interviewSpecial));
  setCell(ws, 'E22', ratio(rtAbsentTotal, rtAppTotal));
  setCell(ws, 'F22', '0.0%');
  setCell(ws, 'G22', '0.0%');
  setCell(ws, 'H22', '0.0%');
  setCell(ws, 'I22', ratio(totalAbsent, totalApp));

  setCell(ws, 'C27', '일반');
  setCell(ws, 'E27', '특화');
  setCell(ws, 'F27', '연계(국문)');
  setCell(ws, 'G27', '국문/영문');
  setCell(ws, 'C29', '-');
  setCell(ws, 'E29', '-');
  setCell(ws, 'F29', '-');
  setCell(ws, 'G29', '-');
  setCell(ws, 'B28', (stat.consultantByType.career || []).join(', '));
  setCell(ws, 'C28', (stat.consultantByType.interviewGeneral || []).join(', '));
  setCell(ws, 'D28', '');
  setCell(ws, 'E28', (stat.consultantByType.interviewSpecial || []).join(', '));
  setCell(ws, 'F28', (stat.consultantByType.offlineLinked || []).join(', '));
  setCell(ws, 'G28', (stat.consultantByType.offlineKorEng || []).join(', '));
  setCell(ws, 'H28', '');
  setCell(ws, 'I28', '');

  const grades = ['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'];
  const gradeRows = [50, 51, 52, 53, 54, 55];
  const byGrade = stat.countByGradeAndType || {};
  grades.forEach((g, i) => {
    const row = gradeRows[i];
    const t = byGrade[g] || {};
    const career = t.career || 0;
    const interviewGeneral = t.interviewGeneral || 0;
    const interviewSpecial = t.interviewSpecial || 0;
    const offlineLinked = t.offlineLinked || 0;
    const offlineKorEng = t.offlineKorEng || 0;
    const interviewSub = interviewGeneral + interviewSpecial;
    const offlineSub = offlineLinked + offlineKorEng;
    setCell(ws, `B${row}`, career);
    setCell(ws, `C${row}`, interviewGeneral);
    setCell(ws, `D${row}`, interviewSpecial);
    setCell(ws, `E${row}`, interviewSub);
    setCell(ws, `F${row}`, offlineLinked);
    setCell(ws, `G${row}`, offlineKorEng);
    setCell(ws, `H${row}`, offlineSub);
    setCell(ws, `I${row}`, stat.gradeCounts[g] || 0);
  });
  const totalCareer = grades.reduce((s, g) => s + ((byGrade[g] || {}).career || 0), 0);
  const totalInterviewGeneral = grades.reduce((s, g) => s + ((byGrade[g] || {}).interviewGeneral || 0), 0);
  const totalInterviewSpecial = grades.reduce((s, g) => s + ((byGrade[g] || {}).interviewSpecial || 0), 0);
  const totalOfflineLinked = grades.reduce((s, g) => s + ((byGrade[g] || {}).offlineLinked || 0), 0);
  const totalOfflineKorEng = grades.reduce((s, g) => s + ((byGrade[g] || {}).offlineKorEng || 0), 0);
  setCell(ws, 'B56', totalCareer);
  setCell(ws, 'C56', totalInterviewGeneral);
  setCell(ws, 'D56', totalInterviewSpecial);
  setCell(ws, 'E56', totalInterviewGeneral + totalInterviewSpecial);
  setCell(ws, 'F56', totalOfflineLinked);
  setCell(ws, 'G56', totalOfflineKorEng);
  setCell(ws, 'H56', totalOfflineLinked + totalOfflineKorEng);
  setCell(ws, 'I56', grades.reduce((sum, g) => sum + (stat.gradeCounts[g] || 0), 0));

  const collegeRowMap = {
    인문과학대학: 61,
    사회과학대학: 62,
    자연과학대학: 63,
    공과대학: 64,
    엘텍공과대학: 65,
    음악대학: 66,
    조형예술대학: 67,
    사범대학: 68,
    경영대학: 69,
    신산업융합대학: 70,
    의과대학: 71,
    간호대학: 72,
    약학대학: 73,
    스크랜튼대학: 74,
    인공지능대학: 75,
    호크마교양대학: 76,
    대학원: 77
  };
  const byCollege = stat.countByCollegeAndType || {};
  COLLEGE_ORDER.forEach((c) => {
    const rowNo = collegeRowMap[c];
    if (!rowNo) return;
    const t = byCollege[c] || {};
    const career = t.career || 0;
    const interviewGeneral = t.interviewGeneral || 0;
    const interviewSpecial = t.interviewSpecial || 0;
    const offlineLinked = t.offlineLinked || 0;
    const offlineKorEng = t.offlineKorEng || 0;
    const interviewSub = interviewGeneral + interviewSpecial;
    const offlineSub = offlineLinked + offlineKorEng;
    setCell(ws, `B${rowNo}`, career);
    setCell(ws, `C${rowNo}`, interviewGeneral);
    setCell(ws, `D${rowNo}`, interviewSpecial);
    setCell(ws, `E${rowNo}`, interviewSub);
    setCell(ws, `F${rowNo}`, offlineLinked);
    setCell(ws, `G${rowNo}`, offlineKorEng);
    setCell(ws, `H${rowNo}`, offlineSub);
    setCell(ws, `I${rowNo}`, stat.collegeCounts[c] || 0);
  });
  const totalCollegeCareer = COLLEGE_ORDER.reduce((s, c) => s + ((byCollege[c] || {}).career || 0), 0);
  const totalCollegeInterviewGeneral = COLLEGE_ORDER.reduce((s, c) => s + ((byCollege[c] || {}).interviewGeneral || 0), 0);
  const totalCollegeInterviewSpecial = COLLEGE_ORDER.reduce((s, c) => s + ((byCollege[c] || {}).interviewSpecial || 0), 0);
  const totalCollegeOfflineLinked = COLLEGE_ORDER.reduce((s, c) => s + ((byCollege[c] || {}).offlineLinked || 0), 0);
  const totalCollegeOfflineKorEng = COLLEGE_ORDER.reduce((s, c) => s + ((byCollege[c] || {}).offlineKorEng || 0), 0);
  setCell(ws, 'B78', totalCollegeCareer);
  setCell(ws, 'C78', totalCollegeInterviewGeneral);
  setCell(ws, 'D78', totalCollegeInterviewSpecial);
  setCell(ws, 'E78', totalCollegeInterviewGeneral + totalCollegeInterviewSpecial);
  setCell(ws, 'F78', totalCollegeOfflineLinked);
  setCell(ws, 'G78', totalCollegeOfflineKorEng);
  setCell(ws, 'H78', totalCollegeOfflineLinked + totalCollegeOfflineKorEng);
  setCell(ws, 'I78', COLLEGE_ORDER.reduce((sum, c) => sum + (stat.collegeCounts[c] || 0), 0));

  setCell(ws, 'B82', withComma(stat.uniqueParticipants.once));
  setCell(ws, 'C82', withComma(stat.uniqueParticipants.twice));
  setCell(ws, 'D82', withComma(stat.uniqueParticipants.threePlus));
  setCell(ws, 'E82', withComma(stat.uniqueParticipants.totalUnique));
  setCell(ws, 'B83', ratio(stat.uniqueParticipants.once, stat.uniqueParticipants.totalUnique));
  setCell(ws, 'C83', ratio(stat.uniqueParticipants.twice, stat.uniqueParticipants.totalUnique));
  setCell(ws, 'D83', ratio(stat.uniqueParticipants.threePlus, stat.uniqueParticipants.totalUnique));

  const monthCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const target = getMonthLabel(stat.year, stat.month);
  let monthCol = monthCols.find((col) => String(ws.getCell(`${col}36`).value || '').trim() === target);
  if (!monthCol) {
    const idx = monthCols.findIndex((_, i) => String(ws.getCell(`${monthCols[i]}36`).value || '').endsWith(`${stat.month}월`));
    monthCol = monthCols[idx];
  }
  if (monthCol) {
    const trend = trendByMonth.get(stat.month);
    setCell(ws, `${monthCol}37`, trend?.realtimeTotal || 0);
    setCell(ws, `${monthCol}38`, trend?.offlineTotal || 0);
    setCell(ws, `${monthCol}39`, trend?.overallTotal || 0);
  }

  setCell(ws, 'B89', '실시간 컨설팅');
  setCell(ws, 'B90', '진로개발(A)');
  setCell(ws, 'C90', '서류면접 (B)');
  setCell(ws, 'B91', '진로개발');
  setCell(ws, 'C91', '일반');
  setCell(ws, 'D91', '특화**');
  setCell(ws, 'E89', '소계 (A+B 평균)');
  setCell(ws, 'F89', '비실시간 컨설팅');
  setCell(ws, 'F90', '서면첨삭 (C)');
  setCell(ws, 'F91', '연계(국문)');
  setCell(ws, 'G91', '국문/영문');
  setCell(ws, 'H89', '소계 (C평균)');
  setCell(ws, 'I89', '누계평균 (A+B+C 평균)');
  setCell(ws, 'A97', '평가 기준');
  setCell(ws, 'D97', '평가 내용');
  setCell(ws, 'H97', '환류 계획');
  try {
    ws.mergeCells('H97:I97');
  } catch (_) {
    /* 이미 병합된 경우 무시 */
  }
};

const buildTrendByMonth = (monthlyStatsMap) => {
  const m = new Map();
  monthlyStatsMap.forEach((s, month) => {
    const rt = s.realtime.attended.career + s.realtime.attended.interviewGeneral + s.realtime.attended.interviewSpecial;
    const off = s.offline.completed.linked + s.offline.completed.korEng;
    m.set(month, { realtimeTotal: rt, offlineTotal: off, overallTotal: rt + off });
  });
  return m;
};

const fillParticipantSheet = (ws, rows) => {
  ws.autoFilter = null;
  const sorted = [...rows].sort((a, b) => {
    const ad = a.basisDate?.getTime?.() || 0;
    const bd = b.basisDate?.getTime?.() || 0;
    return ad - bd;
  });
  const body = sorted.map((r, idx) => [
    `${r.year || ''}.${r.month || ''}.`,
    idx + 1,
    r.displayDate || '',
    r.studentId || '',
    r.name || '',
    r.college || '',
    r.dept || '',
    r.grade || '',
    r.attendance || '',
    r.typeCanonical || r.rawType || '',
    r.consultant || ''
  ]);
  const dataStartRow = 5;
  const colCount = 11;
  const lastRow = Math.max(4, body.length + 4);

  const styleRow = ws.getRow(5);
  for (let r = 0; r < body.length; r += 1) {
    const excelRow = dataStartRow + r;
    const rowData = body[r];
    const row = ws.getRow(excelRow);
    for (let c = 0; c < colCount; c += 1) {
      const cell = row.getCell(c + 1);
      cell.value = rowData[c] ?? '';
      const styleCell = styleRow.getCell(c + 1);
      if (styleCell.font) cell.font = { ...styleCell.font };
      if (styleCell.fill) cell.fill = JSON.parse(JSON.stringify(styleCell.fill));
      if (styleCell.border) cell.border = JSON.parse(JSON.stringify(styleCell.border));
      if (styleCell.alignment) cell.alignment = { ...styleCell.alignment };
    }
  }
  for (let r = dataStartRow + body.length; r <= 2171; r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c += 1) {
      row.getCell(c).value = '';
    }
  }
  return ws;
};

/** ExcelJS 워크북 생성 (removeWorksheet 미사용 → XML 손상 방지) */
export const buildResultReportWorkbook = async ({ rows, monthlyStatsMap }) => {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('결과보고서 템플릿 파일을 불러오지 못했습니다.');
  const buffer = await res.arrayBuffer();
  const template = new ExcelJS.Workbook();
  await template.xlsx.load(buffer);

  const summarySheetName = '개요';
  const rosterSheetName = '참여명단';
  const surveySheetName = '설문조사';
  const summarySheet = template.getWorksheet(summarySheetName);
  const rosterSheet = template.getWorksheet(rosterSheetName);
  const surveySheet = template.getWorksheet(surveySheetName);
  if (!summarySheet || !rosterSheet) {
    throw new Error('템플릿의 필수 시트(개요/참여명단)가 없습니다.');
  }

  const monthTemplateName = template.worksheets.find(
    (ws) => ws.name !== summarySheetName && ws.name !== rosterSheetName && /^\d+월$/.test(ws.name)
  )?.name;
  if (!monthTemplateName) {
    throw new Error('월별 시트 템플릿을 찾지 못했습니다.');
  }
  const monthTemplateSheet = template.getWorksheet(monthTemplateName);

  const workbook = new ExcelJS.Workbook();
  const summaryClone = cloneSheet(workbook, summarySheet, summarySheetName);
  fillTitleBackground(summaryClone);
  fillSectionHeaderBackground(summaryClone);
  mergeOverviewBulletItems(summaryClone);
  clearBordersOutsideTables(summaryClone);
  let effectiveStatsMap = monthlyStatsMap;
  if (!monthlyStatsMap.size) {
    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const emptyGradeType = { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 };
    const emptyStat = {
      month: defaultMonth,
      year: now.getFullYear(),
      realtime: { applied: { career: 0, interviewGeneral: 0, interviewSpecial: 0 }, attended: { career: 0, interviewGeneral: 0, interviewSpecial: 0 }, absent: { career: 0, interviewGeneral: 0, interviewSpecial: 0 } },
      offline: { completed: { linked: 0, korEng: 0 } },
      consultantByType: { career: [], interviewGeneral: [], interviewSpecial: [], offlineLinked: [], offlineKorEng: [] },
      gradeCounts: { '1학년': 0, '2학년': 0, '3학년': 0, '4학년': 0, '5학년 이상': 0, 대학원: 0 },
      countByGradeAndType: {
        '1학년': { ...emptyGradeType },
        '2학년': { ...emptyGradeType },
        '3학년': { ...emptyGradeType },
        '4학년': { ...emptyGradeType },
        '5학년 이상': { ...emptyGradeType },
        대학원: { ...emptyGradeType }
      },
      collegeCounts: Object.fromEntries(COLLEGE_ORDER.map((c) => [c, 0])),
      countByCollegeAndType: Object.fromEntries(
        COLLEGE_ORDER.map((c) => [c, { ...emptyGradeType }])
      ),
      uniqueParticipants: { once: 0, twice: 0, threePlus: 0, totalUnique: 0 }
    };
    effectiveStatsMap = new Map([[defaultMonth, emptyStat]]);
  }
  const monthOrder = sortMonthsDesc(Array.from(effectiveStatsMap.keys()));
  const trendByMonth = buildTrendByMonth(effectiveStatsMap);
  monthOrder.forEach((month) => {
    const stat = effectiveStatsMap.get(month);
    const newName = getMonthSheetName(month);
    const newSheet = cloneSheet(workbook, monthTemplateSheet, newName);
    fillMonthSheet(newSheet, stat, trendByMonth);
  });
  const rosterClone = cloneSheet(workbook, rosterSheet, rosterSheetName);
  fillParticipantSheet(rosterClone, rows);
  if (surveySheet) {
    cloneSheetStructureOnly(workbook, surveySheet, surveySheetName);
  }

  return workbook;
};
