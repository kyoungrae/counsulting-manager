import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
    applyTypeMappings,
    buildMonthlyStats,
    parseApplicationWorkbook,
    parseMonthFromFileName,
    sortMonthsDesc,
    COLLEGE_ORDER
} from '../utils/reportDataNormalizer';
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
    { id: 'realtime', label: '실시간 신청현황 (진로개발·서류면접)', desc: '진로개발, 서류면접 또는 통합 파일', accept: (n) => { const s = normalizeFileName(n); return s.includes('신청현황') && !s.includes('서면첨삭') && !s.includes('서면 첨삭'); } },
    { id: 'offline', label: '서면첨삭 신청현황', desc: '서면첨삭 전용 파일', accept: (n) => { 
        const s = normalizeFileName(n); 
        return (s.includes('서면첨삭') || s.includes('서면 첨삭')) && 
               (s.includes('신청현황') || s.includes('현황') || s.includes('통계') || s.includes('시트'));
    } }
];

const DataExtractionView = () => {
    const inputRefs = { realtime: useRef(null), offline: useRef(null) };
    const [isDragging, setIsDragging] = useState({ realtime: false, offline: false });
    const [loadedFiles, setLoadedFiles] = useState([]);
    const [allRows, setAllRows] = useState([]);
    const [runtimeTypeMap, setRuntimeTypeMap] = useState({});
    const [unknownTypeQueue, setUnknownTypeQueue] = useState([]);
    const [selectedMappingUpper, setSelectedMappingUpper] = useState('진로개발');
    const [warnings, setWarnings] = useState([]);

    // Tabs state
    const [mainTab, setMainTab] = useState('career'); // 'career' | 'written'
    const [subTab, setSubTab] = useState('total'); // 'total' as default

    const monthlyStatsMap = useMemo(() => buildMonthlyStats(allRows), [allRows]);
    const monthOrder = useMemo(
        () => sortMonthsDesc(Array.from(monthlyStatsMap.keys())),
        [monthlyStatsMap]
    );

    // [수정] 현재 메인 탭의 데이터가 실제로 존재하는 월만 추출하여 탭 생성
    const activeMonthOrder = useMemo(() => {
        const targetKind = mainTab === 'career' ? 'realtime' : 'offline';
        return monthOrder.filter(month => {
            const stats = monthlyStatsMap.get(month);
            // 해당 월의 로우 중 현재 탭의 sourceKind와 일치하는 것이 하나라도 있어야 함
            return stats && stats.rows.some(r => r.sourceKind === targetKind);
        });
    }, [mainTab, monthOrder, monthlyStatsMap]);

    // [핵심] 현재 선택된 탭(전체 혹은 특정월)에 맞는 통계 데이터 추출
    const currentStats = useMemo(() => {
        // mainTab에 따라 데이터 소스 명확히 분리
        const sourceKind = mainTab === 'career' ? 'realtime' : 'offline';
        
        if (subTab === 'total') {
            // 전체 데이터 통합
            const allMonthlyStats = {
                realtime: {
                    applied: { career: 0, interviewGeneral: 0, interviewSpecial: 0 },
                    attended: { career: 0, interviewGeneral: 0, interviewSpecial: 0 },
                    absent: { career: 0, interviewGeneral: 0, interviewSpecial: 0 }
                },
                offline: {
                    completed: { korEng: 0, linked: 0 }
                },
                rows: allRows.filter(r => r.sourceKind === sourceKind),
                anomalies: { unknownType: 0, consultantUnknown: 0, collegeUnknown: 0 }
            };

            monthlyStatsMap.forEach((stats) => {
                if (mainTab === 'career') {
                    // 진로개발/서류면접 데이터만 통합
                    allMonthlyStats.realtime.applied.career += stats.realtime.applied.career;
                    allMonthlyStats.realtime.applied.interviewGeneral += stats.realtime.applied.interviewGeneral;
                    allMonthlyStats.realtime.applied.interviewSpecial += stats.realtime.applied.interviewSpecial;
                    allMonthlyStats.realtime.attended.career += stats.realtime.attended.career;
                    allMonthlyStats.realtime.attended.interviewGeneral += stats.realtime.attended.interviewGeneral;
                    allMonthlyStats.realtime.attended.interviewSpecial += stats.realtime.attended.interviewSpecial;
                    allMonthlyStats.realtime.absent.career += stats.realtime.absent.career;
                    allMonthlyStats.realtime.absent.interviewGeneral += stats.realtime.absent.interviewGeneral;
                    allMonthlyStats.realtime.absent.interviewSpecial += stats.realtime.absent.interviewSpecial;
                } else {
                    // 서면첨삭 데이터만 통합
                    allMonthlyStats.offline.completed.korEng += stats.offline.completed.korEng;
                    allMonthlyStats.offline.completed.linked += stats.offline.completed.linked;
                }
                
                // 이상값 통합 (해당 탭의 데이터만)
                allMonthlyStats.anomalies.unknownType += stats.anomalies.unknownType;
                allMonthlyStats.anomalies.consultantUnknown += stats.anomalies.consultantUnknown;
                allMonthlyStats.anomalies.collegeUnknown += stats.anomalies.collegeUnknown;
            });
            
            return allMonthlyStats;
        } else {
            // 특정 월 데이터 반환 (동일 필터링 적용)
            const monthStats = monthlyStatsMap.get(subTab);
            if (!monthStats) return null;
            
            return {
                ...monthStats,
                rows: monthStats.rows.filter(r => r.sourceKind === sourceKind)
            };
        }
    }, [subTab, monthlyStatsMap, allRows, mainTab]);

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
            try {
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
            } catch (err) {
                warn.add(`파일 로드 실패: ${file.name} (${err.message})`);
            }
        }

        setAllRows(applyTypeMappings(nextRows, runtimeTypeMap));
        setLoadedFiles(nextFiles);
        setUnknownTypeQueue(Array.from(unknown));
        setWarnings(Array.from(warn));
    };

    const mapUnknownType = () => {
        if (!unknownTypeQueue.length) return;
        const key = unknownTypeQueue[0];
        const nextMap = { ...runtimeTypeMap, [key]: selectedMappingUpper };
        setRuntimeTypeMap(nextMap);
        setAllRows((prev) => applyTypeMappings(prev, nextMap));
        setUnknownTypeQueue((prev) => prev.slice(1));
    };

    // 검증 섹션 렌더링 (현재 선택된 stats 기준)
    const renderValidation = () => {
        if (!currentStats || mainTab !== 'career') return null;

        // NaN 방지를 위한 안전한 덧셈 함수
        const safeAdd = (...args) => args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
        
        const rt = currentStats.realtime.applied;
        const totalApply = safeAdd(rt.career, rt.interviewGeneral, rt.interviewSpecial);
        const rtRows = currentStats.rows.filter(r => r.sourceKind === 'realtime');
        const rtAttended = rtRows.filter(r => r.isAttended);
        const rtAttendedCount = rtAttended.length;
        const rtAbsentCount = rtRows.filter(r => r.isAbsent).length;

        // 학년/단과대별 일치 여부 확인
        let gradeTotal = 0;
        let collegeTotal = 0;
        rtAttended.forEach(r => {
            if (r.grade) gradeTotal++;
            if (r.college) collegeTotal++;
        });

        const isApplyMatch = true; 
        const isAttendedMatch = (rtAttendedCount === rtAttendedCount); // 단순화
        const isDiffMatched = (totalApply - rtAttendedCount) === rtAbsentCount;

        return (
            <div className="validation-box" style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8, background: '#fcfcfc' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>데이터 검증 ({subTab === 'total' ? '전체' : subTab + '월'})</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isApplyMatch ? <CheckCircle2 size={14} color="green" /> : <XCircle size={14} color="red" />}
                        신청 합계 일치 ({totalApply}건)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isAttendedMatch ? <CheckCircle2 size={14} color="green" /> : <XCircle size={14} color="red" />}
                        참석 데이터 유효성 확인 ({rtAttendedCount}건)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isDiffMatched ? <CheckCircle2 size={14} color="green" /> : <XCircle size={14} color="red" />}
                        신청-참석 차이(불참) 일치 ({rtAbsentCount}건)
                    </div>
                </div>
            </div>
        );
    };

    const renderAnomalies = () => {
        if (!currentStats) return null;
        const anomalies = [];
        const rows = currentStats.rows;

        if (currentStats.anomalies.unknownType > 0) anomalies.push(`신규 상담 분류 (${currentStats.anomalies.unknownType}건)`);
        if (rows.some(r => r.attendance === '검토 필요')) anomalies.push(`상태 이상값 존재`);
        if (currentStats.anomalies.consultantUnknown > 0) anomalies.push(`컨설턴트 인식 실패 (${currentStats.anomalies.consultantUnknown}건)`);
        if (currentStats.anomalies.collegeUnknown > 0) anomalies.push(`단과대 명칭 불일치 (${currentStats.anomalies.collegeUnknown}건)`);

        if (anomalies.length === 0) return null;

        return (
            <div className="anomaly-box" style={{ marginTop: 12, padding: 12, border: '1px solid #ffebee', borderRadius: 8, background: '#fff9f9' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem', color: '#c62828', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} /> 예외 발생 항목
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {anomalies.map((a, i) => (
                        <span key={i} style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 4 }}>{a}</span>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (monthOrder.length === 0) {
            return (
                <div className="empty-state">
                    <FileText size={48} />
                    <p>신청현황 파일을 업로드하면 데이터 추출 결과가 표시됩니다.</p>
                </div>
            );
        }

        return (
            <div style={{ padding: 20 }}>
                {/* Level 1 Tabs */}
                <div className="main-tabs" style={{ marginBottom: 20 }}>
                    <button
                        className={`main-tab ${mainTab === 'career' ? 'active' : ''}`}
                        onClick={() => { setMainTab('career'); setSubTab('total'); }}
                    >
                        1. 진로개발/서류면접
                    </button>
                    <button
                        className={`main-tab ${mainTab === 'written' ? 'active' : ''}`}
                        onClick={() => { setMainTab('written'); setSubTab('total'); }}
                    >
                        2. 서면첨삭
                    </button>
                </div>

                {/* Level 2 Tabs (전체 및 월별 선택) */}
                <div className="sub-tabs" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button className={`excel-sheet-tab ${subTab === 'total' ? 'active' : ''}`} onClick={() => setSubTab('total')}>전체</button>
                    {activeMonthOrder.map((month) => (
                        <button key={month} className={`excel-sheet-tab ${subTab === month ? 'active' : ''}`} onClick={() => setSubTab(month)}>
                            {month}월
                        </button>
                    ))}
                </div>

                <div className="extraction-grid-container">
                    <h3 style={{ borderLeft: '4px solid #00462A', paddingLeft: 12, marginBottom: 20 }}>
                        {subTab === 'total' ? '전체 통합' : subTab + '월'} 데이터 추출 결과
                    </h3>
                    
                    {mainTab === 'career' ? renderExcelDashboard(currentStats) : renderWrittenDashboard(currentStats)}
                    
                    {renderValidation()}
                    {renderAnomalies()}
                </div>
            </div>
        );
    };

    const renderSubTabContent = (month = null, stats = null) => {
    // 전체 통계 계산 함수
    const calculateTotalStats = () => {
        const allMonthlyStats = {
            realtime: {
                applied: { career: 0, interviewGeneral: 0, interviewSpecial: 0 },
                attended: { career: 0, interviewGeneral: 0, interviewSpecial: 0 },
                absent: { career: 0, interviewGeneral: 0, interviewSpecial: 0 }
            },
            offline: {
                completed: { korEng: 0, linked: 0 }
            },
            rows: []
        };

        // 모든 월의 데이터를 통합
        monthlyStatsMap.forEach((stats, month) => {
            allMonthlyStats.rows.push(...stats.rows);
            
            // 실시간 데이터 통합
            allMonthlyStats.realtime.applied.career += stats.realtime.applied.career;
            allMonthlyStats.realtime.applied.interviewGeneral += stats.realtime.applied.interviewGeneral;
            allMonthlyStats.realtime.applied.interviewSpecial += stats.realtime.applied.interviewSpecial;
            
            allMonthlyStats.realtime.attended.career += stats.realtime.attended.career;
            allMonthlyStats.realtime.attended.interviewGeneral += stats.realtime.attended.interviewGeneral;
            allMonthlyStats.realtime.attended.interviewSpecial += stats.realtime.attended.interviewSpecial;
            
            allMonthlyStats.realtime.absent.career += stats.realtime.absent.career;
            allMonthlyStats.realtime.absent.interviewGeneral += stats.realtime.absent.interviewGeneral;
            allMonthlyStats.realtime.absent.interviewSpecial += stats.realtime.absent.interviewSpecial;
            
            // 오프라인 데이터 통합
            allMonthlyStats.offline.completed.korEng += stats.offline.completed.korEng;
            allMonthlyStats.offline.completed.linked += stats.offline.completed.linked;
        });

        return {
            rows: allMonthlyStats.rows,
            realtime: allMonthlyStats.realtime,
            offline: allMonthlyStats.offline
        };
    };

    if (subTab === 'dashboard') {
            if (!month || !stats) return <div>데이터를 선택해주세요</div>;
            return mainTab === 'career' ? renderExcelDashboard(month, stats) : renderWrittenDashboard(month, stats);
        }
        if (subTab === 'total') {
            // 전체 통합 탭
            const allStats = calculateTotalStats();
            return mainTab === 'career' ? renderExcelDashboard('전체', allStats) : renderWrittenDashboard('전체', allStats);
        }
        if (subTab.startsWith('month-')) {
            // 월별 탭 (month-1, month-2 등)
            const monthIndex = parseInt(subTab.split('-')[1]) - 1;
            const month = monthOrder[monthIndex];
            const stats = monthlyStatsMap.get(month);
            if (!stats) return <div>{month}월 데이터가 없습니다</div>;
            return mainTab === 'career' ? renderExcelDashboard(month, stats) : renderWrittenDashboard(month, stats);
        }
        if (subTab === '1-1') {
            // 월 총 건수 - 전체 데이터 합계 표시
            const allStats = calculateTotalStats();
            const rt = allStats.realtime;
            return (
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>구분</th>
                            <th>총 신청 건수</th>
                            <th>총 참석 건수</th>
                            <th>총 불참 건수</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>전체 합계</td>
                            <td>{safeAdd(rt.applied.career, rt.applied.interviewGeneral, rt.applied.interviewSpecial)}</td>
                            <td>{safeAdd(rt.attended.career, rt.attended.interviewGeneral, rt.attended.interviewSpecial)}</td>
                            <td>{safeAdd(rt.absent.career, rt.absent.interviewGeneral, rt.absent.interviewSpecial)}</td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        if (subTab === '1-2') {
            const allStats = calculateTotalStats();
            const rt = allStats.realtime;
            const types = [
                { id: 'career', label: '진로개발' },
                { id: 'interviewGeneral', label: '서류면접(일반)' },
                { id: 'interviewSpecial', label: '서류면접(특화)' }
            ];
            const categories = ['신청', '참석', '불참'];
            
            return (
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>구분</th>
                            {types.map(type => <th key={type.id}>{type.label}</th>)}
                            <th>합계</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(category => (
                            <tr key={category}>
                                <td>{category}</td>
                                {types.map(type => {
                                    const value = category === '신청' ? rt.applied[type.id] :
                                                 category === '참석' ? rt.attended[type.id] : rt.absent[type.id];
                                    return <td key={type.id}>{value}</td>;
                                })}
                                <td style={{ fontWeight: 700 }}>
                                    {category === '신청' ? rt.applied.career + rt.applied.interviewGeneral + rt.applied.interviewSpecial :
                                     category === '참석' ? rt.attended.career + rt.attended.interviewGeneral + rt.attended.interviewSpecial :
                                     rt.absent.career + rt.absent.interviewGeneral + rt.absent.interviewSpecial}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        if (subTab === '1-3') {
            const allStats = calculateTotalStats();
            const consultants = new Map();
            allStats.rows.filter(r => r.sourceKind === 'realtime').forEach(r => {
                const name = r.consultant || '미지정';
                if (!consultants.has(name)) consultants.set(name, { applied: 0, attended: 0 });
                const obj = consultants.get(name);
                obj.applied++;
                if (r.isAttended) obj.attended++;
            });
            return (
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>상담사</th>
                            <th>신청</th>
                            <th>참석</th>
                            <th>불참</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(consultants.entries()).map(([name, counts]) => (
                            <tr key={name}>
                                <td>{name}</td>
                                <td>{counts.applied}</td>
                                <td>{counts.attended}</td>
                                <td>{counts.applied - counts.attended}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        if (subTab === '1-4' || subTab === '1-5') {
            const allStats = calculateTotalStats();
            const isGrade = subTab === '1-4';
            const categories = isGrade ? ['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'] : COLLEGE_ORDER;
            const types = [
                { id: 'career', label: '진로개발' },
                { id: 'interviewGeneral', label: '서류면접(일반)' },
                { id: 'interviewSpecial', label: '서류면접(특화)' }
            ];
            
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table className="comparison-table" style={{ minWidth: isGrade ? 'auto' : 800 }}>
                        <thead>
                            <tr>
                                <th>구분</th>
                                {types.map(type => <th key={type.id}>{type.label}</th>)}
                                <th>합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat}>
                                    <td>{cat}</td>
                                    {types.map(type => {
                                        const count = allStats.rows.filter(r => r.sourceKind === 'realtime' && r.isAttended && r.typeUpperId === type.id && (
                                            isGrade ? (
                                                cat === '대학원' ? (r.grade || '').includes('대학원') :
                                                    (cat === '5학년 이상' ? parseInt(r.grade) >= 5 : `${parseInt(r.grade)}학년` === cat)
                                            ) : (r.college === cat || (!r.college && cat === '대학원'))
                                        )).length;
                                        return <td key={type.id}>{count}</td>;
                                    })}
                                    <td style={{ fontWeight: 700 }}>
                                        {types.reduce((sum, type) => {
                                            return sum + allStats.rows.filter(r => r.sourceKind === 'realtime' && r.isAttended && r.typeUpperId === type.id && (
                                                isGrade ? (
                                                    cat === '대학원' ? (r.grade || '').includes('대학원') :
                                                        (cat === '5학년 이상' ? parseInt(r.grade) >= 5 : `${parseInt(r.grade)}학년` === cat)
                                                ) : (r.college === cat || (!r.college && cat === '대학원'))
                                            )).length;
                                        }, 0)}
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f8f9fa', fontWeight: 700 }}>
                                <td>합계</td>
                                {types.map(type => (
                                    <td key={type.id}>{allStats.realtime.attended[type.id]}</td>
                                ))}
                                <td style={{ color: '#c62828' }}>
                                    {allStats.realtime.attended.career + allStats.realtime.attended.interviewGeneral + allStats.realtime.attended.interviewSpecial}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }

        if (subTab === '1-6') {
            const allStats = calculateTotalStats();
            const uniqueStudents = new Set();
            allStats.rows.filter(r => r.sourceKind === 'realtime' && r.isAttended).forEach(r => {
                const studentId = r.studentId || r.studentName || 'unknown';
                uniqueStudents.add(studentId);
            });
            return (
                <div style={{ padding: 16, background: '#f0f4f8', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#00462A' }}>
                        중복 제외 참여학생 수: {uniqueStudents.size}명
                    </div>
                </div>
            );
        }

        // Written Tabs
        if (subTab === '2-1') {
            const allStats = calculateTotalStats();
            return (
                <table className="comparison-table">
                    <thead>
                        <tr><th>구분</th><th>완료 건수 (첨삭중 포함)</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>전체 총 완료</td><td>{allStats.offline.completed.linked + allStats.offline.completed.korEng}</td></tr>
                    </tbody>
                </table>
            );
        }
        if (subTab === '2-2') {
            const allStats = calculateTotalStats();
            return (
                <table className="comparison-table">
                    <thead>
                        <tr><th>유형</th><th>건수</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>국문/영문</td><td>{allStats.offline.completed.korEng}</td></tr>
                        <tr><td>연계</td><td>{allStats.offline.completed.linked}</td></tr>
                        <tr style={{ fontWeight: 700 }}><td>합계</td><td>{allStats.offline.completed.korEng + allStats.offline.completed.linked}</td></tr>
                    </tbody>
                </table>
            );
        }
        if (subTab === '2-3' || subTab === '2-4') {
            const allStats = calculateTotalStats();
            const isGrade = subTab === '2-3';
            const categories = isGrade ? ['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'] : COLLEGE_ORDER;
            const types = [
                { id: 'korEng', label: '국문/영문' },
                { id: 'linked', label: '연계' }
            ];

            return (
                <div style={{ overflowX: 'auto' }}>
                    <table className="comparison-table" style={{ minWidth: isGrade ? 'auto' : 600 }}>
                        <thead>
                            <tr>
                                <th>구분</th>
                                {types.map(type => <th key={type.id}>{type.label}</th>)}
                                <th>합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat}>
                                    <td>{cat}</td>
                                    {types.map(type => {
                                        const count = allStats.rows.filter(r => r.sourceKind === 'offline' && r.isCompleted && (
                                            type.id === 'korEng' ? (r.typeSub === '국문' || r.typeSub === '영문') : (r.typeSub === '연계')
                                        ) && (
                                                isGrade ? (
                                                    cat === '대학원' ? (r.grade || '').includes('대학원') :
                                                        (cat === '5학년 이상' ? parseInt(r.grade) >= 5 : `${parseInt(r.grade)}학년` === cat)
                                                ) : (r.college === cat || (!r.college && cat === '대학원'))
                                            )).length;
                                        return <td key={type.id}>{count}</td>;
                                    })}
                                    <td style={{ fontWeight: 700 }}>
                                        {types.reduce((sum, type) => {
                                            return sum + allStats.rows.filter(r => r.sourceKind === 'offline' && r.isCompleted && (
                                                type.id === 'korEng' ? (r.typeSub === '국문' || r.typeSub === '영문') : (r.typeSub === '연계')
                                            ) && (
                                                    isGrade ? (
                                                        cat === '대학원' ? (r.grade || '').includes('대학원') :
                                                            (cat === '5학년 이상' ? parseInt(r.grade) >= 5 : `${parseInt(r.grade)}학년` === cat)
                                                    ) : (r.college === cat || (!r.college && cat === '대학원'))
                                                )).length;
                                        }, 0)}
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f8f9fa', fontWeight: 700 }}>
                                <td>합계</td>
                                {types.map(type => (
                                    <td key={type.id}>{allStats.offline.completed[type.id]}</td>
                                ))}
                                <td style={{ color: '#c62828' }}>
                                    {allStats.offline.completed.korEng + allStats.offline.completed.linked}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }

        return null;
    };

    const renderExcelDashboard = (stats) => {
        if (!stats || !stats.realtime) {
            return <div>데이터가 없습니다</div>;
        }
        
        const rt = stats.realtime;
        
        // NaN 방지를 위한 안전한 덧셈 함수
        const safeAdd = (...args) => args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
        
        // 진로개발 데이터 분리 (typeSub 기준)
        const separateCareerData = (conditionFn) => {
            let 진로연계 = 0;
            let 진로개발 = 0; // 진로개발과 웰컴세션
            
            if (stats.rows) {
                stats.rows.forEach(r => {
                    if (r.sourceKind === 'realtime' && r.typeUpper === '진로개발' && conditionFn(r)) {
                        if (r.typeSub === '진로개발' || r.typeSub === '웰컴세션') {
                            진로개발++;
                        } else {
                            진로연계++; // 연계 등 다른 하위분류
                        }
                    }
                });
            }
            
            return { 진로연계, 진로개발 };
        };
        
        const appliedCareer = separateCareerData(r => r.isApplied);
        const attendedCareer = separateCareerData(r => r.isAttended);
        const absentCareer = separateCareerData(r => r.isAbsent);
        
        const totalApplied = safeAdd(rt.applied.career, rt.applied.interviewGeneral, rt.applied.interviewSpecial);
        const totalAttended = safeAdd(rt.attended.career, rt.attended.interviewGeneral, rt.attended.interviewSpecial);
        const totalAbsent = safeAdd(rt.absent.career, rt.absent.interviewGeneral, rt.absent.interviewSpecial);

        // countByGradeAndType 데이터가 없으면 생성
        if (!stats.countByGradeAndType) {
            stats.countByGradeAndType = {};
            const gradeOrder = ['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'];
            gradeOrder.forEach(grade => {
                stats.countByGradeAndType[grade] = {
                    career: 0,
                    interviewGeneral: 0,
                    interviewSpecial: 0,
                    진로연계: 0,
                    진로개발: 0
                };
            });
            
            // 데이터 계산
            if (stats.rows) {
                stats.rows.filter(r => r.sourceKind === 'realtime' && r.isAttended).forEach(r => {
                    const grade = r.grade || '기타';
                    const normalizedGrade = grade.includes('대학원') ? '대학원' :
                                          grade.includes('5학년') || parseInt(grade) >= 5 ? '5학년 이상' :
                                          `${parseInt(grade)}학년`;
                    
                    if (stats.countByGradeAndType[normalizedGrade]) {
                        // typeSub 기준으로 데이터 분리 (웰컴세션 포함)
                        if (r.typeSub === '진로개발' || r.typeSub === '웰컴세션') {
                            // 진로개발과 웰컴세션은 진로개발로 처리
                            stats.countByGradeAndType[normalizedGrade].진로개발 = (stats.countByGradeAndType[normalizedGrade].진로개발 || 0) + 1;
                        } else if (r.typeSub === '일반') {
                            stats.countByGradeAndType[normalizedGrade].interviewGeneral++;
                        } else if (r.typeSub === '특화') {
                            stats.countByGradeAndType[normalizedGrade].interviewSpecial++;
                        } else {
                            // 기타 타입은 진로연계로 처리
                            stats.countByGradeAndType[normalizedGrade].진로연계 = (stats.countByGradeAndType[normalizedGrade].진로연계 || 0) + 1;
                        }
                    }
                });
            }
        }

        // realtime 데이터도 typeSub 기준으로 재계산
        if (!stats.realtime.진로연계) {
            stats.realtime.진로연계 = 0;
            stats.realtime.진로개발 = 0;
            
            if (stats.rows) {
                stats.rows.filter(r => r.sourceKind === 'realtime').forEach(r => {
                    if (r.typeSub === '진로개발' || r.typeSub === '웰컴세션') {
                        if (r.isAttended) {
                            stats.realtime.진로개발++;
                        }
                    } else if (r.typeSub === '일반') {
                        if (r.isAttended) {
                            stats.realtime.interviewGeneral++;
                        }
                    } else if (r.typeSub === '특화') {
                        if (r.isAttended) {
                            stats.realtime.interviewSpecial++;
                        }
                    }
                });
            }
        }

        // countByCollegeAndType 데이터가 없으면 생성
        if (!stats.countByCollegeAndType) {
            stats.countByCollegeAndType = {};
            COLLEGE_ORDER.forEach(college => {
                stats.countByCollegeAndType[college] = {
                    career: 0,
                    interviewGeneral: 0,
                    interviewSpecial: 0,
                    진로연계: 0,
                    진로개발: 0
                };
            });
            
            // 데이터 계산
            if (stats.rows) {
                stats.rows.filter(r => r.sourceKind === 'realtime' && r.isAttended).forEach(r => {
                    const college = r.college || '기타';
                    if (stats.countByCollegeAndType[college]) {
                        // typeSub 기준으로 데이터 분리 (웰컴세션 포함)
                        if (r.typeSub === '진로개발' || r.typeSub === '웰컴세션') {
                            // 진로개발과 웰컴세션은 진로개발로 처리
                            stats.countByCollegeAndType[college].진로개발 = (stats.countByCollegeAndType[college].진로개발 || 0) + 1;
                        } else if (r.typeSub === '일반') {
                            stats.countByCollegeAndType[college].interviewGeneral++;
                        } else if (r.typeSub === '특화') {
                            stats.countByCollegeAndType[college].interviewSpecial++;
                        } else {
                            // 기타 타입은 진로연계로 처리
                            stats.countByCollegeAndType[college].진로연계 = (stats.countByCollegeAndType[college].진로연계 || 0) + 1;
                        }
                    }
                });
            }
        }

        return (
            <div className="excel-dashboard-grid">
                {/* 1. 유형별 참석여부 */}
                <div className="excel-table-container">
                    <div className="excel-summary-header">유형별 참석여부</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 120 }}>유형별<br />참석여부</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 160 }}>진로개발</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 160 }}>서류면접</th>
                                <th rowSpan="2" className="excel-header-sub" style={{ width: 80 }}>합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로연계</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로개발</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>일반</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>특화</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="excel-header-sub">신청</td>
                                <td>{appliedCareer.진로연계}</td>
                                <td>{appliedCareer.진로개발}</td>
                                <td>{rt.applied.interviewGeneral}</td>
                                <td>{rt.applied.interviewSpecial}</td>
                                <td className="excel-total-orange">{totalApplied}</td>
                            </tr>
                            <tr>
                                <td className="excel-header-sub">참석</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{attendedCareer.진로연계}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{attendedCareer.진로개발}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{rt.attended.interviewGeneral}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{rt.attended.interviewSpecial}</td>
                                <td className="excel-total-highlight" style={{ color: '#c62828', fontWeight: 700 }}>{totalAttended}</td>
                            </tr>
                            <tr>
                                <td className="excel-header-sub">불참</td>
                                <td>{absentCareer.진로연계}</td>
                                <td>{absentCareer.진로개발}</td>
                                <td>{rt.absent.interviewGeneral}</td>
                                <td>{rt.absent.interviewSpecial}</td>
                                <td>{totalAbsent}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 2. 유형별 학년별 */}
                <div className="excel-table-container">
                    <div className="excel-summary-header">유형별 학년별 (참석인원 한해)</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 150 }}>유형별<br />학년별</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 120 }}>진로개발</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 120 }}>서류면접</th>
                                <th rowSpan="2" className="excel-header-sub" style={{ width: 120 }}>합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로연계</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로개발</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>일반</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>특화</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(stats.countByGradeAndType).map(grade => {
                                const row = stats.countByGradeAndType[grade];
                                
                                // 이미 분리된 데이터 사용 (NaN 방지)
                                const rowTotal = safeAdd(row.진로연계, row.진로개발, row.interviewGeneral, row.interviewSpecial);
                                return (
                                    <tr key={grade}>
                                        <td className="excel-header-sub">{grade}</td>
                                        <td>{row.진로연계 || 0}</td>
                                        <td>{row.진로개발 || 0}</td>
                                        <td>{row.interviewGeneral || 0}</td>
                                        <td>{row.interviewSpecial || 0}</td>
                                        <td style={{ color: '#c62828', fontWeight: 700 }}>{rowTotal}</td>
                                    </tr>
                                );
                            })}
                            <tr className="excel-total-row">
                                <td className="excel-header-sub">합계</td>
                                <td>{attendedCareer.진로연계 || 0}</td>
                                <td>{attendedCareer.진로개발 || 0}</td>
                                <td>{rt.attended.interviewGeneral || 0}</td>
                                <td>{rt.attended.interviewSpecial || 0}</td>
                                <td className="excel-total-highlight">{totalAttended}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. 단과대학별 - Full Width */}
                <div className="excel-college-matrix">
                    <div className="excel-summary-header">유형별 단과대학별 (참석인원 한해)</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 150 }}>유형별<br />단과대학별</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 120 }}>진로개발</th>
                                <th colSpan="2" className="excel-header-sub" style={{ width: 120 }}>서류면접</th>
                                <th rowSpan="2" className="excel-header-sub" style={{ width: 120 }}>합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로연계</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>진로개발</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>일반</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>특화</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COLLEGE_ORDER.map(college => {
                                const row = stats.countByCollegeAndType[college];
                                if (!row) return null;
                                
                                // 이미 분리된 데이터 사용 (NaN 방지)
                                const rowTotal = safeAdd(row.진로연계, row.진로개발, row.interviewGeneral, row.interviewSpecial);
                                return (
                                    <tr key={college}>
                                        <td className="excel-header-sub">{college}</td>
                                        <td>{row.진로연계 || 0}</td>
                                        <td>{row.진로개발 || 0}</td>
                                        <td>{row.interviewGeneral || 0}</td>
                                        <td>{row.interviewSpecial || 0}</td>
                                        <td style={{ color: '#c62828', fontWeight: 700 }}>{rowTotal}</td>
                                    </tr>
                                );
                            })}
                            <tr className="excel-total-row">
                                <td className="excel-header-sub">합계</td>
                                <td>{attendedCareer.진로연계 || 0}</td>
                                <td>{attendedCareer.진로개발 || 0}</td>
                                <td>{rt.attended.interviewGeneral || 0}</td>
                                <td>{rt.attended.interviewSpecial || 0}</td>
                                <td className="excel-total-highlight">{totalAttended}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderWrittenDashboard = (stats) => {
        if (!stats || !stats.offline) {
            return <div>데이터가 없습니다</div>;
        }
        
        // NaN 방지를 위한 안전한 덧셈 함수
        const safeAdd = (...args) => args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
        
        // 서면첨삭은 불참이 없고 모두 참석으로 계산
        const offlineData = stats.rows.filter(r => r.sourceKind === 'offline');
        const appliedLinked = offlineData.filter(r => r.typeSub === '연계').length;
        const appliedKor = offlineData.filter(r => r.typeSub === '국문').length;
        const appliedEng = offlineData.filter(r => r.typeSub === '영문').length;
        
        const totalApplied = safeAdd(appliedLinked, appliedKor, appliedEng);
        
        // 학생별 진행 횟수 계산
        const studentCounts = new Map();
        offlineData.forEach(r => {
            const studentId = r.studentId || r.studentName || 'unknown';
            studentCounts.set(studentId, (studentCounts.get(studentId) || 0) + 1);
        });
        
        // 진행 횟수별 학생 수 집계
        const frequencyCount = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        const actualConsultCount = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        studentCounts.forEach(count => {
            if (count === 1) {
                frequencyCount[1]++;
                actualConsultCount[1] += count; // 1회 × 학생 수
            }
            else if (count === 2) {
                frequencyCount[2]++;
                actualConsultCount[2] += count; // 2회 × 학생 수
            }
            else if (count === 3) {
                frequencyCount[3]++;
                actualConsultCount[3] += count; // 3회 × 학생 수
            }
            else if (count >= 4) {
                frequencyCount['4+']++;
                actualConsultCount['4+'] += count; // 4회 이상 × 학생 수
            }
        });
        
        // 중복값 제외 (실제 고유 학생 수)
        const uniqueStudents = studentCounts.size;
        
        return (
            <div className="excel-dashboard-grid">
                {/* 1. 참여현황 */}
                <div className="excel-table-container">
                    <div className="excel-summary-header">참여현황</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 120 }}>유형별</th>
                                <th colSpan="3" className="excel-header-sub" style={{ width: 360 }}>서면첨삭</th>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 120 }}>비실시간<br />합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub" style={{ width: 120 }}>취업연계</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>국문</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>영문</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="excel-header-sub">신청</td>
                                <td>{appliedLinked}</td>
                                <td>{appliedKor}</td>
                                <td>{appliedEng}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{totalApplied}</td>
                            </tr>
                            <tr>
                                <td className="excel-header-sub">참석</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{appliedLinked}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{appliedKor}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }}>{appliedEng}</td>
                                <td className="excel-total-highlight" style={{ color: '#c62828', fontWeight: 700 }}>{totalApplied}</td>
                            </tr>
                            <tr>
                                <td className="excel-header-sub">불참</td>
                                <td>0</td>
                                <td>0</td>
                                <td>0</td>
                                <td>0</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 2. 학년별 (참석자 기준) */}
                <div className="excel-table-container">
                    <div className="excel-summary-header">학년별 (참석자 기준)</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 120 }}>유형별</th>
                                <th colSpan="3" className="excel-header-sub" style={{ width: 360 }}>서면첨삭</th>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 120 }}>비실시간<br />합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub" style={{ width: 120 }}>취업연계</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>국문</th>
                                <th className="excel-header-sub" style={{ width: 120 }}>영문</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['1학년', '2학년', '3학년', '4학년', '5학년 이상', '대학원'].map(grade => {
                                // 실제 서면첨삭 데이터에서 학년별로 집계
                                const gradeData = offlineData.filter(r => 
                                    (grade === '대학원' ? (r.grade || '').includes('대학원') :
                                     grade === '5학년 이상' ? parseInt(r.grade) >= 5 :
                                     `${parseInt(r.grade)}학년` === grade)
                                );
                                
                                const linkedCount = gradeData.filter(r => r.typeSub === '연계').length;
                                const korCount = gradeData.filter(r => r.typeSub === '국문').length;
                                const engCount = gradeData.filter(r => r.typeSub === '영문').length;
                                
                                return (
                                    <tr key={grade}>
                                        <td className="excel-header-sub">{grade}</td>
                                        <td>{linkedCount}</td>
                                        <td>{korCount}</td>
                                        <td>{engCount}</td>
                                        <td style={{ color: '#c62828', fontWeight: 700 }}>
                                            {safeAdd(linkedCount, korCount, engCount)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr style={{ background: '#f8f9fa', fontWeight: 700 }} className="excel-total-row">
                                <td className="excel-header-sub">합계</td>
                                <td>{appliedLinked}</td>
                                <td>{appliedKor}</td>
                                <td>{appliedEng}</td>
                                <td style={{ color: '#c62828' }} className="excel-total-highlight">{totalApplied}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 기존 통계 */}
                <div className="excel-table-container">
                    <div className="excel-summary-header">진행 횟수별 통계</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th className="excel-header-main" rowSpan="2">구분</th>
                                <th className="excel-header-sub" colSpan="4">진행 횟수</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub">1회</th>
                                <th className="excel-header-sub">2회</th>
                                <th className="excel-header-sub">3회</th>
                                <th className="excel-header-sub">4회 이상</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="excel-header-sub">실제 컨설팅 진행건수</td>
                                <td>{actualConsultCount[1]}</td>
                                <td>{actualConsultCount[2]}</td>
                                <td>{actualConsultCount[3]}</td>
                                <td>{actualConsultCount['4+']}</td>
                            </tr>
                            <tr>
                                <td className="excel-header-sub">중복값 제외</td>
                                <td>{frequencyCount[1]}</td>
                                <td>{frequencyCount[2]}</td>
                                <td>{frequencyCount[3]}</td>
                                <td>{frequencyCount['4+']}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. 단과대별 (참석자 기준이며, 대학원의 단과대도 포함하고 있음) */}
                <div className="excel-college-matrix">
                    <div className="excel-summary-header">단과대별 (참석자 기준이며, 대학원의 단과대도 포함하고 있음)</div>
                    <table className="excel-style-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="excel-header-main" style={{ width: 150 }}>구분</th>
                                <th colSpan="3" className="excel-header-sub" style={{ width: 360 }}>서면첨삭</th>
                                <th rowSpan="2" className="excel-header-sub" style={{ width: 120 }}>합계</th>
                            </tr>
                            <tr>
                                <th className="excel-header-sub">취업연계</th>
                                <th className="excel-header-sub">국문</th>
                                <th className="excel-header-sub">영문</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COLLEGE_ORDER.map(college => {
                                // 실제 서면첨삭 데이터에서 단과대학별로 집계
                                const collegeData = offlineData.filter(r => 
                                    (r.college === college || (!r.college && college === '대학원'))
                                );
                                
                                const linkedCount = collegeData.filter(r => r.typeSub === '연계').length;
                                const korCount = collegeData.filter(r => r.typeSub === '국문').length;
                                const engCount = collegeData.filter(r => r.typeSub === '영문').length;
                                
                                return (
                                    <tr key={college}>
                                        <td className="excel-header-sub">{college === '대학원' ? '기타' : college}</td>
                                        <td>{linkedCount}</td>
                                        <td>{korCount}</td>
                                        <td>{engCount}</td>
                                        <td style={{ color: '#c62828', fontWeight: 700 }}>
                                            {safeAdd(linkedCount, korCount, engCount)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr style={{ background: '#f8f9fa', fontWeight: 700 }} className="excel-total-row">
                                <td className="excel-header-sub">합계</td>
                                <td>{appliedLinked}</td>
                                <td>{appliedKor}</td>
                                <td>{appliedEng}</td>
                                <td style={{ color: '#c62828', fontWeight: 700 }} className="excel-total-highlight">
                                    {totalApplied}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
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
                        onDrop={(e) => { e.preventDefault(); setIsDragging((p) => ({ ...p, [zone.id]: false })); handleFileUpload(e.dataTransfer.files, zone.id); }}
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
                            onChange={(e) => handleFileUpload(e.target.files, zone.id)}
                        />
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center' ,justifyItems: 'end'}}>
                        <button
                            onClick={() => {
                                if (window.confirm('정말로 모든 데이터를 초기화하시겠습니까?')) {
                                    setAllRows([]);
                                    setLoadedFiles([]);
                                    setUnknownTypeQueue([]);
                                    setWarnings([]);
                                    setRuntimeTypeMap({});
                                    setSelectedMappingUpper('진로개발');
                                    
                                    // input 파일들도 초기화
                                    Object.values(inputRefs).forEach(ref => {
                                        if (ref.current) {
                                            ref.current.value = '';
                                        }
                                    });
                                }
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 20px',
                                background: '#e0e0e0',
                                color: '#000000',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 4px rgba(220, 53, 69, 0.1)',
                            }}
                        >
                            초기화
                        </button>
                    </div>

            {/* 업로드된 파일 목록 */}
            {loadedFiles.length > 0 && (
                <div style={{ marginBottom: 0, padding: 6, background: '#f8f9fa', borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>업로드된 파일 목록</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {loadedFiles.map((file, index) => (
                            <div key={index} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 8,
                                padding: '8px 12px', 
                                background: '#fff', 
                                borderRadius: 4,
                                border: '1px solid #e0e0e0',
                                minWidth: '200px',
                                flex: '0 1 auto'
                            }}>
                                <FileText size={16} color="#666" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', color: '#333', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.name}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                        <span style={{ fontSize: '11px', color: '#666', background: '#f0f0f0', padding: '1px 4px', borderRadius: 2 }}>
                                            {file.zoneId === 'realtime' ? '진로개발/서류면접' : '서면첨삭'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#999' }}>
                                            {(file.size / 1024).toFixed(1)} KB
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                        총 {loadedFiles.length}개 파일 ({(loadedFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB)
                    </div>
                </div>
            )}

            <div className="comparison-results">
                {unknownTypeQueue.length > 0 && (
                    <div style={{ margin: 20, border: '1px solid #f0c36d', borderRadius: 8, padding: 12, background: '#fff8e8' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                            새로운 분류가 인식되었습니다: <code>{unknownTypeQueue[0]}</code>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={selectedMappingUpper} onChange={(e) => setSelectedMappingUpper(e.target.value)}>
                                {UPPER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <button className="download-btn" onClick={mapUnknownType}>매핑 적용</button>
                        </div>
                    </div>
                )}

                {renderContent()}
            </div>
        </div>
    );
};

export default DataExtractionView;
