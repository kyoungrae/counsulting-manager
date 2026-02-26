import * as XLSXStyle from 'xlsx-js-style';
import { COLLEGE_ORDER, sortMonthsDesc } from './reportDataNormalizer';

const TEMPLATE_URL = new URL('../../documents/결과 보고서 메뉴/인재개발원 진로취업컨설팅 진행 결과 보고(2026년 2월)  _ 개발용 결과보고서 예시.xlsx', import.meta.url).href;

const cloneSheet = (ws) => JSON.parse(JSON.stringify(ws));

const DEFAULT_CELL_STYLE = {
  border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
  alignment: { horizontal: 'center', vertical: 'center' }
};

/** 값만 갱신, 기존 셀 스타일(s)은 유지. 없으면 기본 테두리/정렬 적용 */
const setCell = (ws, addr, value) => {
  const existing = ws[addr];
  const cell = existing || {};
  if (value === null || value === undefined || value === '') {
    cell.v = '';
    cell.t = 's';
  } else if (typeof value === 'number') {
    cell.v = value;
    cell.t = 'n';
  } else {
    cell.v = String(value);
    cell.t = 's';
  }
  if (!cell.s) cell.s = (existing && existing.s) ? existing.s : DEFAULT_CELL_STYLE;
  ws[addr] = cell;
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
  // #region agent log
  (()=>{const p={sessionId:'949fb3',location:'reportTemplateExcel.js:fillMonthSheet',message:'fillMonthSheet',data:{month:stat.month,year:stat.year,realtime:stat.realtime,offline:stat.offline,uniqueParticipants:stat.uniqueParticipants},timestamp:Date.now(),hypothesisId:'D,E'};console.log('[DEBUG]',p);fetch('http://127.0.0.1:7445/ingest/084dafbe-c0ce-47f5-88df-ab8474392743',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'949fb3'},body:JSON.stringify(p)}).catch(()=>{})})();
  // #endregion
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

  setCell(ws, 'B28', stat.consultantByType.career.join(', '));
  setCell(ws, 'C28', stat.consultantByType.interviewGeneral.join(', '));
  setCell(ws, 'E28', stat.consultantByType.interviewSpecial.join(', '));
  setCell(ws, 'F28', stat.consultantByType.offlineLinked.join(', '));
  setCell(ws, 'G28', stat.consultantByType.offlineKorEng.join(', '));

  const grades = ['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'];
  const gradeRows = [50, 51, 52, 53, 54, 55];
  grades.forEach((g, i) => {
    setCell(ws, `I${gradeRows[i]}`, stat.gradeCounts[g] || 0);
  });
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
  COLLEGE_ORDER.forEach((c) => {
    const rowNo = collegeRowMap[c];
    if (!rowNo) return;
    setCell(ws, `I${rowNo}`, stat.collegeCounts[c] || 0);
  });
  setCell(ws, 'I78', COLLEGE_ORDER.reduce((sum, c) => sum + (stat.collegeCounts[c] || 0), 0));

  setCell(ws, 'B82', withComma(stat.uniqueParticipants.once));
  setCell(ws, 'C82', withComma(stat.uniqueParticipants.twice));
  setCell(ws, 'D82', withComma(stat.uniqueParticipants.threePlus));
  setCell(ws, 'E82', withComma(stat.uniqueParticipants.totalUnique));
  setCell(ws, 'B83', ratio(stat.uniqueParticipants.once, stat.uniqueParticipants.totalUnique));
  setCell(ws, 'C83', ratio(stat.uniqueParticipants.twice, stat.uniqueParticipants.totalUnique));
  setCell(ws, 'D83', ratio(stat.uniqueParticipants.threePlus, stat.uniqueParticipants.totalUnique));

  // 월별 트렌드 표(행 36/37/38/39)에서 해당 월 컬럼 자동 채움
  const monthCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const labels = monthCols.map((col) => String(ws[`${col}36`]?.v || '').trim());
  const target = getMonthLabel(stat.year, stat.month);
  let monthCol = monthCols[labels.indexOf(target)];
  if (!monthCol) {
    const fallback = labels.findIndex((x) => x.endsWith(`${stat.month}월`));
    monthCol = monthCols[fallback];
  }
  if (monthCol) {
    const trend = trendByMonth.get(stat.month);
    setCell(ws, `${monthCol}37`, trend?.realtimeTotal || 0);
    setCell(ws, `${monthCol}38`, trend?.offlineTotal || 0);
    setCell(ws, `${monthCol}39`, trend?.overallTotal || 0);
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

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const getColLetter = (c) => (c < 26 ? COL_LETTERS[c] : getColLetter(Math.floor(c / 26) - 1) + COL_LETTERS[c % 26]);

const DATA_CELL_STYLE = {
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  font: { sz: 10, name: '맑은 고딕' }
};

const fillParticipantSheet = (ws, rows) => {
  const sorted = [...rows].sort((a, b) => {
    const ad = a.basisDate?.getTime?.() || 0;
    const bd = b.basisDate?.getTime?.() || 0;
    return ad - bd;
  });
  const body = sorted.map((r, idx) => ([
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
  ]));

  const dataStartRow = 5;
  const numCols = 11;
  const colStyles = [];
  for (let c = 0; c < numCols; c += 1) {
    const tc = ws[getColLetter(c) + dataStartRow];
    colStyles[c] = (tc && tc.s) ? tc.s : DATA_CELL_STYLE;
  }

  for (let r = 0; r < body.length; r += 1) {
    const excelRow = dataStartRow + r;
    const rowData = body[r];
    for (let c = 0; c < numCols; c += 1) {
      const addr = getColLetter(c) + excelRow;
      const style = colStyles[c];
      const cell = {
        v: rowData[c] ?? '',
        t: typeof rowData[c] === 'number' ? 'n' : 's',
        s: style
      };
      ws[addr] = cell;
    }
  }

  const lastRow = body.length > 0 ? dataStartRow + body.length - 1 : 4;
  const lastCol = getColLetter(numCols - 1);
  try {
    const range = XLSXStyle.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = lastRow + 1; row <= range.e.r + 1; row += 1) {
      for (let c = 0; c <= range.e.c; c += 1) delete ws[getColLetter(c) + row];
    }
  } catch (_) { /* ignore */ }
  ws['!ref'] = `A1:${lastCol}${lastRow}`;
  if (!ws['!cols']) ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
  return ws;
};

export const buildResultReportWorkbook = async ({ rows, monthlyStatsMap }) => {
  // #region agent log
  (()=>{const p={sessionId:'949fb3',location:'reportTemplateExcel.js:buildResultReportWorkbook',message:'buildResultReportWorkbook entry',data:{templateUrl:TEMPLATE_URL,rowsCount:rows?.length,monthKeys:Array.from(monthlyStatsMap?.keys()||[])},timestamp:Date.now(),hypothesisId:'A'};console.log('[DEBUG]',p);fetch('http://127.0.0.1:7445/ingest/084dafbe-c0ce-47f5-88df-ab8474392743',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'949fb3'},body:JSON.stringify(p)}).catch(()=>{})})();
  // #endregion
  const res = await fetch(TEMPLATE_URL);
  // #region agent log
  (()=>{const p={sessionId:'949fb3',location:'reportTemplateExcel.js:fetch',message:'template fetch result',data:{ok:res.ok,status:res.status,url:TEMPLATE_URL},timestamp:Date.now(),hypothesisId:'A'};console.log('[DEBUG]',p);fetch('http://127.0.0.1:7445/ingest/084dafbe-c0ce-47f5-88df-ab8474392743',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'949fb3'},body:JSON.stringify(p)}).catch(()=>{})})();
  // #endregion
  if (!res.ok) throw new Error('결과보고서 템플릿 파일을 불러오지 못했습니다.');
  const buffer = await res.arrayBuffer();
  const wb = XLSXStyle.read(buffer, { type: 'array', cellStyles: true });

  const summarySheetName = '개요';
  const rosterSheetName = '참여명단';
  const summaryIdx = wb.SheetNames.indexOf(summarySheetName);
  const rosterIdx = wb.SheetNames.indexOf(rosterSheetName);
  if (summaryIdx < 0 || rosterIdx < 0) {
    throw new Error('템플릿의 필수 시트(개요/참여명단)가 없습니다.');
  }

  // 기존 월별 시트 제거 전 템플릿 시트 클론
  const monthTemplateName = wb.SheetNames.find((n, idx) => idx > summaryIdx && idx < rosterIdx) || wb.SheetNames.find((n) => /^\d+월$/.test(n));
  if (!monthTemplateName || !wb.Sheets[monthTemplateName]) {
    throw new Error('월별 시트 템플릿을 찾지 못했습니다.');
  }
  const monthTemplateSheet = cloneSheet(wb.Sheets[monthTemplateName]);

  // 기존 월별 시트 제거 후 다시 생성
  const oldMonthSheets = wb.SheetNames.filter((n, idx) => idx > summaryIdx && idx < rosterIdx);
  oldMonthSheets.forEach((name) => {
    delete wb.Sheets[name];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== name);
  });

  const monthOrder = sortMonthsDesc(Array.from(monthlyStatsMap.keys()));
  const trendByMonth = buildTrendByMonth(monthlyStatsMap);
  const rosterInsertIdx = wb.SheetNames.indexOf(rosterSheetName);
  monthOrder.forEach((month, i) => {
    const stat = monthlyStatsMap.get(month);
    const newSheet = cloneSheet(monthTemplateSheet);
    fillMonthSheet(newSheet, stat, trendByMonth);
    const newName = getMonthSheetName(month);
    wb.Sheets[newName] = newSheet;
    wb.SheetNames.splice(rosterInsertIdx + i, 0, newName);
  });

  wb.Sheets[rosterSheetName] = fillParticipantSheet(wb.Sheets[rosterSheetName], rows);

  return wb;
};

