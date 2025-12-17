import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Download, X } from 'lucide-react';
import './EwhaGrid.css';

const RestrictionView = ({ careerList, interviewList, correctionList }) => {
    const activeTabState = useState('limit');
    const activeTab = activeTabState[0];
    const setActiveTab = activeTabState[1];
    const [selectedMonth, setSelectedMonth] = useState('ALL');
    const [modalData, setModalData] = useState(null); // State for detailed modal

    // Helper to parse date string to YYYY-MM
    const getMonthFromDate = (dateVal) => {
        if (!dateVal) return 'Unknown';
        let dateStr = String(dateVal).trim();
        // Handle Excel serial
        if (typeof dateVal === 'number') {
            const dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }
        // Handle YYYY-MM-DD or YYYY.MM.DD
        if (dateStr.match(/^\d{4}[-.]\d{2}/)) {
            return dateStr.substring(0, 7).replace('.', '-');
        }
        // Handle YYYY. MM. DD
        if (dateStr.match(/^\d{4}\.\s\d{2}/)) {
            const parts = dateStr.split('.');
            return `${parts[0].trim()}-${parts[1].trim()}`;
        }
        return 'Unknown';
    };

    // --- Tab 1: Limit Exceeded Logic (Aggregated by Name) ---
    const limitData = useMemo(() => {
        const usageMap = {};

        const processItem = (item, source) => {
            const sid = item.studentId ? String(item.studentId).trim() : '';
            if (!sid) return;

            let dateVal = '';
            if (source === 'correction') {
                dateVal = item.date;
            } else {
                dateVal = item.consultDate || item.date;
            }

            const month = getMonthFromDate(dateVal);
            const key = `${sid}-${month}`;

            if (!usageMap[key]) {
                usageMap[key] = {
                    studentId: sid,
                    month: month,
                    count: 0,
                    name: item.name,
                    college: item.college,
                    dept: item.dept,
                    grade: item.grade,
                    status: item.status || '',
                    items: [] // Store distinct sessions
                };
            }
            usageMap[key].count += 1;
            usageMap[key].items.push(item);
        };

        careerList.forEach(i => processItem(i, 'career'));
        interviewList.forEach(i => processItem(i, 'interview'));
        correctionList.forEach(i => processItem(i, 'correction'));

        // Filter and Flatten to Summary
        const result = [];
        Object.values(usageMap).forEach(usage => {
            // Show if utilized 3 or more times? Or just list usage?
            // "Exceeded" implies > limit. Ewha limit is 2. So > 2?
            // User script: "신청 횟수 초과" (Exceeded)
            // If I show count, I should probably show all high users.
            // Let's filter > 2 as per previous logic.
            if (usage.count > 2) {
                if (selectedMonth !== 'ALL' && usage.month !== selectedMonth) return;

                // Aggregate: Push the STUDENT summary, not the individual sessions
                result.push({
                    name: usage.name,
                    studentId: usage.studentId,
                    college: usage.college,
                    dept: usage.dept,
                    grade: usage.grade,
                    status: usage.status,
                    count: usage.count, // The core metric
                    month: usage.month,
                    note: '',
                    details: usage.items // Include simplified usage items for modal
                });
            }
        });

        return result.sort((a, b) => b.count - a.count); // Sort by highest usage

    }, [careerList, interviewList, correctionList, selectedMonth]);


    // --- Tab 2: Penalty Logic ---
    const penaltyData = useMemo(() => {
        const result = [];

        const processPenalty = (item, source) => {
            if (item.attend !== '불참') return;

            let baseDateVal = item.consultDate || item.date;
            let baseDate = null;

            if (typeof baseDateVal === 'number') {
                baseDate = new Date(Math.round((baseDateVal - 25569) * 86400 * 1000));
            } else {
                const dStr = String(baseDateVal).trim().replace(/[.\s]/g, '-').replace(/--/g, '-');
                if (dStr) baseDate = new Date(dStr);
            }

            let penaltyDays = 30;
            let reason = '불참';

            if (baseDate && !isNaN(baseDate.getTime())) {
                const pEnd = new Date(baseDate);
                pEnd.setDate(pEnd.getDate() + penaltyDays);

                result.push({
                    ...item,
                    penaltyDate: baseDate.toISOString().split('T')[0],
                    penaltyEndDate: pEnd.toISOString().split('T')[0],
                    reason: reason,
                    status: '제한 적용 중',
                    source: source === 'career' ? '진로개발' : '서류면접'
                });
            }
        };

        careerList.forEach(i => processPenalty(i, 'career'));
        interviewList.forEach(i => processPenalty(i, 'interview'));

        return result;
    }, [careerList, interviewList]);

    // Extract all unique months for filter
    const months = useMemo(() => {
        const s = new Set();
        [...careerList, ...interviewList, ...correctionList].forEach(i => {
            s.add(getMonthFromDate(i.date));
            s.add(getMonthFromDate(i.consultDate));
        });
        return Array.from(s).filter(m => m !== 'Unknown').sort().reverse();
    }, [careerList, interviewList, correctionList]);


    // Columns
    const limitColumns = [
        { label: '이름', key: 'name' },
        { label: '학번', key: 'studentId' },
        { label: '단과대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학년', key: 'grade' },
        { label: '학적', key: 'status' },
        { label: '신청 횟수', key: 'count' }, // Added Header
        { label: '비고', key: 'note' }
    ];

    const penaltyColumns = [
        { label: '이름', key: 'name' },
        { label: '학번', key: 'studentId' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '사유', key: 'reason' },
        { label: '컨설팅 구분', key: 'source' },
        { label: '패널티 부과 날짜', key: 'penaltyDate' },
        { label: '패널티 소멸 날짜', key: 'penaltyEndDate' },
        { label: '상태', key: 'status' },
        { label: '비고', key: 'note' }
    ];

    const currentData = activeTab === 'limit' ? limitData : penaltyData;
    const currentColumns = activeTab === 'limit' ? limitColumns : penaltyColumns;

    const handleDownload = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(currentData.map(item => {
            const row = {};
            currentColumns.forEach(c => row[c.label] = item[c.key]);
            return row;
        }));
        XLSX.utils.book_append_sheet(wb, ws, activeTab === 'limit' ? 'Limit_Exceeded' : 'Penalty_Targets');
        XLSX.writeFile(wb, `Restriction_List_${activeTab}.xlsx`);
    };

    const handleNameClick = (item) => {
        if (activeTab === 'limit' && item.details) {
            setModalData(item);
        }
    };

    const handleModalDownload = () => {
        if (!modalData || !modalData.details || modalData.details.length === 0) return;

        const wb = XLSX.utils.book_new();
        const wsData = modalData.details.map(detail => ({
            '일자': detail.consultDate || detail.date || '-',
            '상담구분': detail.type || '-',
            '상담사': detail.consultant || '-',
            '참석여부': detail.attend || detail.answerStatus || '-',
            '비고': detail.note || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Details");
        XLSX.writeFile(wb, `${modalData.name}_${modalData.studentId}_내역.xlsx`);
    };

    const closeModal = () => {
        setModalData(null);
    };

    // Modal Grid Columns
    const modalColumns = [
        { label: '일자', key: 'date' }, // Normalized later
        { label: '상담구분', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '참석여부', key: 'attend' },
        { label: '비고', key: 'note' }
    ];

    return (
        <div className="ewha-container">
            <div className="ewha-header">
                <h1>신청 제한 및 패널티 관리</h1>
            </div>

            <div className="content-tabs">
                <button className={`tab-btn ${activeTab === 'limit' ? 'active' : ''}`} onClick={() => setActiveTab('limit')}>
                    신청 횟수 초과
                </button>
                <button className={`tab-btn ${activeTab === 'penalty' ? 'active' : ''}`} onClick={() => setActiveTab('penalty')}>
                    패널티 대상
                </button>
            </div>

            <div className="controls" style={{ padding: '10px 0', display: 'flex', gap: '10px' }}>
                {activeTab === 'limit' && (
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="ewha-select">
                        <option value="ALL">전체 월</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                )}
                {/* Download button removed from here */}
            </div>

            <div className="grid-wrapper">
                <div className="grid-header" style={{ gridTemplateColumns: `repeat(${currentColumns.length}, 1fr)` }}>
                    {currentColumns.map(col => <span key={col.key}>{col.label}</span>)}
                </div>
                {currentData.length > 0 ? currentData.map((item, idx) => (
                    <div key={idx} className="grid-row" style={{ gridTemplateColumns: `repeat(${currentColumns.length}, 1fr)` }}>
                        {currentColumns.map(col => {
                            const isName = activeTab === 'limit' && col.key === 'name';
                            return (
                                <div
                                    key={col.key}
                                    className={`col-center ${isName ? 'clickable-cell' : ''}`}
                                    onClick={isName ? () => handleNameClick(item) : undefined}
                                    style={isName ? { color: '#00462A', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' } : {}}
                                >
                                    {item[col.key] || '-'}
                                </div>
                            );
                        })}
                    </div>
                )) : (
                    <div className="no-data">데이터가 없습니다.</div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="ewha-btn" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Download size={16} /> 다운로드
                </button>
            </div>

            {/* Modal */}
            {modalData && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>{modalData.name} ({modalData.studentId}) 상세 신청 내역</h3>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: '#666' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="grid-wrapper">
                                <div className="grid-header" style={{ gridTemplateColumns: `repeat(${modalColumns.length}, 1fr)` }}>
                                    {modalColumns.map(c => <span key={c.key}>{c.label}</span>)}
                                </div>
                                {modalData.details && modalData.details.length > 0 ? modalData.details.map((detail, idx) => {
                                    // Normalize fields
                                    const dateStr = detail.consultDate || detail.date || '-';
                                    const typeStr = detail.type || '-';
                                    const consultantStr = detail.consultant || '-';
                                    const attendStr = detail.attend || detail.answerStatus || '-'; // Correction has answerStatus
                                    const noteStr = detail.note || '-';

                                    return (
                                        <div key={idx} className="grid-row" style={{ gridTemplateColumns: `repeat(${modalColumns.length}, 1fr)` }}>
                                            <div className="col-center">{dateStr}</div>
                                            <div className="col-center">{typeStr}</div>
                                            <div className="col-center">{consultantStr}</div>
                                            <div className="col-center">{attendStr}</div>
                                            <div className="col-center">{noteStr}</div>
                                        </div>
                                    );
                                }) : (
                                    <div className="no-data">내역이 없습니다.</div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button className="ewha-btn" onClick={handleModalDownload} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Download size={16} /> 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RestrictionView;
