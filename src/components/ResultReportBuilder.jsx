import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertTriangle, FileText, Eye } from 'lucide-react';
import {
  applyTypeMappings,
  buildMonthlyStats,
  parseApplicationWorkbook,
  parseMonthFromFileName,
  sortMonthsDesc
} from '../utils/reportDataNormalizer';
import { buildResultReportWorkbook } from '../utils/reportTemplateExcel';
import './SatisfactionMatch.css';

const UPPER_OPTIONS = ['진로개발', '서류면접', '서면첨삭'];

const readExcel = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = e.target.result;
      const wb = XLSX.read(data, { type: 'binary', cellStyles: true });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      resolve({ rows, sheet });
    } catch (err) {
      reject(err);
    }
  };
  reader.onerror = reject;
  reader.readAsBinaryString(file);
});

const normalizeFileName = (n) => String(n ?? '').normalize('NFC').trim();

const UPLOAD_ZONES = [
  { id: 'realtime', label: '실시간 신청현황 (진로개발·서류면접)', desc: '진로개발, 서류면접, 또는 진로개발·서류면접 통합 파일', accept: (n) => { const s = normalizeFileName(n); return s.includes('신청현황') && !s.includes('서면첨삭') && (s.includes('진로개발') || s.includes('서류면접')); } },
  { id: 'offline', label: '서면첨삭 신청현황', desc: '서면첨삭 신청현황', accept: (n) => { const s = normalizeFileName(n); return s.includes('신청현황') && s.includes('서면첨삭'); } }
];

const ResultReportBuilder = () => {
  const inputRefs = { realtime: useRef(null), offline: useRef(null) };
  const [isDragging, setIsDragging] = useState({ realtime: false, offline: false });
  const [loadedFiles, setLoadedFiles] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [runtimeTypeMap, setRuntimeTypeMap] = useState({});
  const [unknownTypeQueue, setUnknownTypeQueue] = useState([]);
  const [selectedUpper, setSelectedUpper] = useState('진로개발');
  const [warnings, setWarnings] = useState([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [upperFilter, setUpperFilter] = useState('전체');
  const [subFilter, setSubFilter] = useState('전체');
  const [mainTab, setMainTab] = useState('monthly');
  const [previewWorkbook, setPreviewWorkbook] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSheetTab, setPreviewSheetTab] = useState(0);

  const recalcRows = (rows, map) => applyTypeMappings(rows, map);

  const monthlyStatsMap = useMemo(() => buildMonthlyStats(allRows), [allRows]);
  const monthOrder = useMemo(
    () => sortMonthsDesc(Array.from(monthlyStatsMap.keys())),
    [monthlyStatsMap]
  );

  const loadPreview = useCallback(async () => {
    if (!allRows.length || unknownTypeQueue.length) return;
    setPreviewLoading(true);
    try {
      const wb = await buildResultReportWorkbook({ rows: allRows, monthlyStatsMap });
      setPreviewWorkbook(wb);
      setPreviewSheetTab(0);
    } catch (err) {
      setPreviewWorkbook(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [allRows, monthlyStatsMap, unknownTypeQueue.length]);

  const previewDataKey = `${allRows.length}-${monthOrder.join(',')}`;
  useEffect(() => {
    setPreviewWorkbook(null);
  }, [previewDataKey]);

  useEffect(() => {
    if (mainTab === 'preview' && allRows.length > 0 && !unknownTypeQueue.length && !previewWorkbook && !previewLoading) {
      loadPreview();
    }
  }, [mainTab, allRows.length, unknownTypeQueue.length, previewWorkbook, previewLoading, loadPreview]);

  const previewSheetContent = useMemo(() => {
    if (!previewWorkbook || !previewWorkbook.worksheets?.length) return { type: 'none' };
    const ws = previewWorkbook.worksheets[previewSheetTab];
    if (!ws) return { type: 'none' };
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const vals = row.values ? [...row.values] : [];
      rows.push(vals.map((v) => (v == null ? '' : String(v))));
    });
    return { type: 'rows', rows };
  }, [previewWorkbook, previewSheetTab]);

  const handleFileUpload = async (files, zoneId) => {
    const zone = UPLOAD_ZONES.find((z) => z.id === zoneId);
    const nextRows = [...allRows];
    const nextFiles = [...loadedFiles];
    const unknown = new Set(unknownTypeQueue);
    const warn = new Set(warnings);

    for (const file of files) {
      const targetZone = zone.accept(file.name) ? zone : UPLOAD_ZONES.find((z) => z.accept(file.name));
      if (!targetZone) {
        warn.add(`[${zone.label}] 해당 영역에 맞지 않는 파일 제외: ${file.name}`);
        continue;
      }
      const { rows, sheet } = await readExcel(file);
      const parsed = parseApplicationWorkbook(rows, sheet, file.name, runtimeTypeMap);
      parsed.rows.forEach((r) => nextRows.push(r));
      parsed.unknownTypeKeys.forEach((k) => unknown.add(k));
      parsed.warnings.forEach((w) => warn.add(w));
      nextFiles.push({
        name: file.name,
        zoneId: targetZone.id,
        kind: parsed.kind,
        month: parsed.month || parseMonthFromFileName(file.name),
        count: parsed.rows.length
      });
    }

    setAllRows(recalcRows(nextRows, runtimeTypeMap));
    setLoadedFiles(nextFiles);
    setUnknownTypeQueue(Array.from(unknown));
    setWarnings(Array.from(warn));
  };

  const onInputChange = async (e, zoneId) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await handleFileUpload(files, zoneId);
    e.target.value = '';
  };

  const onDrop = async (e, zoneId) => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [zoneId]: false }));
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    await handleFileUpload(files, zoneId);
  };

  const mapUnknownType = () => {
    if (!unknownTypeQueue.length) return;
    const key = unknownTypeQueue[0];
    const next = { ...runtimeTypeMap, [key]: selectedUpper };
    setRuntimeTypeMap(next);
    setAllRows((prev) => recalcRows(prev, next));
    setUnknownTypeQueue((prev) => prev.slice(1));
  };

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (upperFilter !== '전체' && r.typeUpper !== upperFilter) return false;
      if (subFilter !== '전체' && r.typeSub !== subFilter) return false;
      return true;
    });
  }, [allRows, upperFilter, subFilter]);

  const availableSubs = useMemo(() => {
    const set = new Set(filteredRows.map((r) => r.typeSub).filter(Boolean));
    return ['전체', ...Array.from(set)];
  }, [filteredRows]);

  const buildWorkbook = async () => {
    if (unknownTypeQueue.length) {
      alert('신규 상담분류 매핑을 먼저 완료해주세요.');
      return;
    }
    try {
      setIsBuilding(true);
      const workbook = await buildResultReportWorkbook({ rows: allRows, monthlyStatsMap });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '인재개발원_진로취업컨설팅_결과보고서.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`결과보고서 생성 중 오류: ${err.message}`);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="satisfaction-match-container">
      <div className="upload-section">
        {UPLOAD_ZONES.map((zone) => (
          <div
            key={zone.id}
            className={`drop-zone ${isDragging[zone.id] ? 'drag-active' : ''}`}
            onClick={() => inputRefs[zone.id]?.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging((p) => ({ ...p, [zone.id]: true })); }}
            onDragLeave={() => setIsDragging((p) => ({ ...p, [zone.id]: false }))}
            onDrop={(e) => onDrop(e, zone.id)}
          >
            <Upload size={32} className="upload-icon" />
            <span className="zone-title">{zone.label}</span>
            <span className="zone-desc">{zone.desc}</span>
            {loadedFiles.filter((f) => f.zoneId === zone.id).length > 0 && (
              <div className="file-info">
                <FileText size={16} />
                {loadedFiles.filter((f) => f.zoneId === zone.id).length}개 파일
              </div>
            )}
            <input
              ref={inputRefs[zone.id]}
              type="file"
              accept=".xlsx,.xls"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => onInputChange(e, zone.id)}
            />
          </div>
        ))}
      </div>

      <div className="comparison-results">
        <div className="results-header">
          <div className="results-header-left">
            <div className="main-tabs">
              <button
                type="button"
                className={`main-tab ${mainTab === 'monthly' ? 'active' : ''}`}
                onClick={() => setMainTab('monthly')}
              >
                월별 집계 현황
              </button>
              <button
                type="button"
                className={`main-tab ${mainTab === 'preview' ? 'active' : ''}`}
                onClick={() => setMainTab('preview')}
              >
                <Eye size={16} />
                엑셀 미리보기
              </button>
            </div>
          </div>
          <div className="stats-summary">
            <span className="stat-item">업로드 파일: <strong>{loadedFiles.length}</strong></span>
            <span className="stat-item">데이터 행: <strong>{allRows.length}</strong></span>
            <span className="stat-item">월 시트: <strong>{monthOrder.length}</strong></span>
            <button className="download-btn" onClick={buildWorkbook} disabled={isBuilding}>
              <Download size={18} />
              {isBuilding ? '생성중...' : '결과보고서 엑셀 다운로드'}
            </button>
          </div>
        </div>

        <div className="table-container" style={{ padding: 16 }}>
          {mainTab === 'preview' && (
            <>
              {previewLoading ? (
                <div className="empty-state">
                  <p>엑셀 미리보기 생성 중...</p>
                </div>
              ) : !allRows.length || unknownTypeQueue.length ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <p>
                    {!allRows.length
                      ? '신청현황 파일을 업로드하면 미리보기가 표시됩니다.'
                      : '신규 상담분류 매핑을 먼저 완료해주세요.'}
                  </p>
                </div>
              ) : previewWorkbook ? (
                <div className="excel-preview-panel">
                  <div className="excel-preview-sheet-tabs">
                    {previewWorkbook.worksheets.map((ws, i) => (
                      <button
                        key={ws.name}
                        type="button"
                        className={`excel-sheet-tab ${previewSheetTab === i ? 'active' : ''}`}
                        onClick={() => setPreviewSheetTab(i)}
                      >
                        {ws.name}
                      </button>
                    ))}
                  </div>
                  <div className="excel-preview-content">
                    {previewSheetContent.type === 'rows' && (
                      <table className="excel-preview-table">
                        <tbody>
                          {previewSheetContent.rows.map((row, ri) => (
                            <tr key={ri}>
                              {(Array.isArray(row) ? row : []).map((cell, ci) => (
                                <td key={ci}>{String(cell ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
          {mainTab === 'monthly' && (
            <>
          {unknownTypeQueue.length > 0 && (
            <div style={{ marginBottom: 16, border: '1px solid #f0c36d', borderRadius: 8, padding: 12, background: '#fff8e8' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                새로운 분류가 인식되었습니다: <code>{unknownTypeQueue[0]}</code>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={selectedUpper} onChange={(e) => setSelectedUpper(e.target.value)}>
                  {UPPER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <button className="download-btn" onClick={mapUnknownType}>매핑 적용</button>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} />
                <strong>검토 필요 항목</strong>
              </div>
              <ul>
                {warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <label>
              상위유형:&nbsp;
              <select value={upperFilter} onChange={(e) => setUpperFilter(e.target.value)}>
                <option value="전체">전체</option>
                {UPPER_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label>
              하위유형:&nbsp;
              <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                {availableSubs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {monthOrder.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <p>신청현황 파일을 업로드하면 월별 집계가 표시됩니다.</p>
            </div>
          ) : (
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>월</th>
                  <th>실시간 신청(진로/일반/특화)</th>
                  <th>실시간 참석(진로/일반/특화)</th>
                  <th>실시간 불참(진로/일반/특화)</th>
                  <th>서면첨삭 완료(연계/국문영문)</th>
                  <th>중복제외 참여학생</th>
                </tr>
              </thead>
              <tbody>
                {monthOrder.map((m) => {
                  const s = monthlyStatsMap.get(m);
                  return (
                    <tr key={m}>
                      <td>{m}월</td>
                      <td>{s.realtime.applied.career}/{s.realtime.applied.interviewGeneral}/{s.realtime.applied.interviewSpecial}</td>
                      <td>{s.realtime.attended.career}/{s.realtime.attended.interviewGeneral}/{s.realtime.attended.interviewSpecial}</td>
                      <td>{s.realtime.absent.career}/{s.realtime.absent.interviewGeneral}/{s.realtime.absent.interviewSpecial}</td>
                      <td>{s.offline.completed.linked}/{s.offline.completed.korEng}</td>
                      <td>{s.uniqueParticipants.totalUnique}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultReportBuilder;

