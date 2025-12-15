import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, X } from 'lucide-react';
import './EwhaGrid.css';
import EwhaChart from './EwhaChart';

const Modal = ({ show, title, onClose, children }) => {
    if (!show) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}><X /></button>
                </div>
                {children}
            </div>
        </div>
    );
};

const FooterActions = ({ fileInputRef, onUploadClick, onDownloadClick, onFileChange }) => (
    <div className="button-container" style={{ marginTop: '20px' }}>
        <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
        />
        <button className="ewha-btn outline" onClick={onUploadClick}>
            <Upload size={16} />
            업로드
        </button>
        <button className="ewha-btn" onClick={onDownloadClick}>
            <Download size={16} />
            다운로드
        </button>
    </div>
);

const IntegratedStatsView = ({ careerList, interviewList, correctionList }) => {
    const [activeTab, setActiveTab] = useState('grid');
    const [itemsPerPage, setItemsPerPage] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Stats State
    const [studentFilter, setStudentFilter] = useState('all');
    const [statsSubTab, setStatsSubTab] = useState('name');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [modalConfig, setModalConfig] = useState({ show: false, title: '', data: [] });
    const [uploadedList, setUploadedList] = useState([]);
    const fileInputRef = useRef(null);

    // Combine and Normalize Data
    const combinedData = useMemo(() => {
        const normalize = (item, type) => {
            // Determine Attend status
            let attendVal = item.attend;
            if (type === '서면첨삭') {
                // If answerStatus is '완료', attend is '참석', else use answerStatus
                attendVal = item.answerStatus === '완료' ? '참석' : item.answerStatus;
            }

            return {
                ...item,
                sourceType: type,
                consultDate: item.consultDate || item.date, // Priority to consultDate, else date
                attend: attendVal,
                studentId: String(item.studentId || '').trim(), // Ensure studentId key matches EwhaGrid expectation
                college: item.college || '기타',
                dept: item.dept || '',
                grade: item.grade || '',
                name: item.name || '',
                consultant: item.consultant || '미지정'
            };
        };



        if (uploadedList.length > 0) {
            return uploadedList.map(i => normalize(i, '업로드'));
        }

        return [
            ...careerList.map(i => normalize(i, '진로개발')),
            ...interviewList.map(i => normalize(i, '서류면접')),
            ...correctionList.map(i => normalize(i, '서면첨삭'))
        ];
    }, [careerList, interviewList, correctionList, uploadedList]);

    // File Handlers
    const handleUploadClick = () => fileInputRef.current.click();

    const processFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const mappedData = jsonData.map((item, index) => ({
                id: index,
                consultDate: item['컨설팅일자'] || item['신청일'] || '',
                college: item['대학'] || '',
                dept: item['학과'] || '',
                grade: item['학년'] || '',
                studentId: item['학번'] || '',
                name: item['이름'] || '',
                type: item['상담구분'] || item['상담분류'] || '',
                consultant: item['상담사'] || item['컨설턴트'] || '',
                attend: item['참석여부'] || '',
                answerStatus: item['답변상태'] || '',
                status: item['학적'] || ''
            }));
            setUploadedList(mappedData);
            alert(`업로드 완료 (${mappedData.length}건)`);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
        e.target.value = '';
    };

    const handleDownload = () => {
        const wb = XLSX.utils.book_new();
        let wsData = [];
        let sheetName = 'Sheet1';

        if (activeTab === 'grid') {
            sheetName = 'Integrated_Status';
            wsData = combinedData.map(item => ({
                '상담구분': item.sourceType,
                '컨설팅일자': item.consultDate,
                '대학': item.college,
                '학과': item.dept,
                '학적': item.status,
                '학년': item.grade,
                '학번': item.studentId,
                '이름': item.name,
                '유형': item.type,
                '상담사': item.consultant,
                '참석여부': item.attend
            }));
        } else if (activeTab === 'stats') {
            if (statsSubTab === 'name') {
                sheetName = 'Stats_Name';
                wsData = nameData.map(item => ({
                    '이름': item.name,
                    '학번': item.studentId,
                    '대학': item.college,
                    '학과': item.dept,
                    '학년': item.grade,
                    '횟수': item.count
                }));
            } else if (statsSubTab === 'frequency') {
                sheetName = 'Stats_Frequency';
                wsData = freqData.map(item => ({
                    '월': item.month,
                    '1회': item.count1,
                    '2회': item.count2,
                    '3회 이상': item.count3
                }));
            } else if (statsSubTab === 'monthly') {
                sheetName = 'Stats_Monthly';
                wsData = statsData.map(item => ({
                    '월': item.month,
                    '건수': item.count
                }));
            } else if (statsSubTab === 'actual') {
                sheetName = 'Stats_Actual';
                wsData = actualStatsData.map(item => ({
                    '월': item.month,
                    '실제 진행': item.count,
                    '불참/노쇼': item.noShowCount
                }));
            } else if (statsSubTab === 'college') {
                sheetName = 'Stats_College';
                wsData = collegeStatsData.map(item => ({
                    '대학': item.college,
                    '횟수': item.count
                }));
            } else if (statsSubTab === 'consultant') {
                sheetName = 'Stats_Consultant';
                wsData = consultantStatsData.map(item => ({
                    '상담사': item.consultant,
                    '전체': item.totalCount,
                    '실제': item.actualCount,
                    '불참/노쇼': item.noShowCount
                }));
            }
        }

        if (wsData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
    };

    // Columns
    const columns = [
        { label: '상담구분', key: 'sourceType' },
        { label: '컨설팅일자', key: 'consultDate' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학적', key: 'status' },
        { label: '학년', key: 'grade' },
        { label: '학번', key: 'studentId' },
        { label: '이름', key: 'name' },
        { label: '유형', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '참석여부', key: 'attend' },
    ];

    const sortedCombinedData = useMemo(() => {
        let sortableItems = [...combinedData];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [combinedData, sortConfig]);

    // Pagination Logic for Main Grid
    const paginatedData = useMemo(() => {
        if (itemsPerPage === 'ALL') return sortedCombinedData;
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedCombinedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedCombinedData, currentPage, itemsPerPage]);

    const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(combinedData.length / itemsPerPage);

    const handlePageChange = (p) => {
        if (p >= 1 && p <= totalPages) setCurrentPage(p);
    };

    // --- Stats Logic (Copied & Adapted from EwhaGrid) ---

    const getMonth = (d) => {
        if (!d) return 'Unknown';
        if (typeof d === 'number') {
            const do_ = new Date(Math.round((d - 25569) * 86400 * 1000));
            return `${do_.getFullYear()}-${String(do_.getMonth() + 1).padStart(2, '0')}`;
        } else if (String(d).match(/^\d{4}[-.]\d{2}/)) {
            return String(d).substring(0, 7).replace('.', '-');
        }
        return 'Unknown';
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => sortConfig.key === key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';

    const handleModalDownload = () => {
        if (!modalConfig.data || modalConfig.data.length === 0) return;
        const colsToUse = modalConfig.columns || columns;
        const wb = XLSX.utils.book_new();
        const wsData = modalConfig.data.map(item => {
            const row = {};
            colsToUse.forEach(col => {
                row[col.label] = item[col.key];
            });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wscols = colsToUse.map(() => ({ wch: 15 }));
        ws['!cols'] = wscols;
        XLSX.utils.book_append_sheet(wb, ws, "Details");
        XLSX.writeFile(wb, `${modalConfig.title || 'Detail_Export'}.xlsx`);
    };

    const handleCellClick = (type, key, subKey) => {
        let filteredData = [];
        let title = '';
        let customColumns = null;

        const baseData = combinedData.filter(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return false;
            if (studentFilter === 'grad' && !isGrad) return false;
            return true;
        });

        if (type === 'name') {
            // key is the student info object from nameData
            const targetStudentId = key.studentId;
            filteredData = baseData.filter(i => String(i.studentId) === String(targetStudentId));
            title = `${key.name} (${targetStudentId}) 상담 이력`;
            customColumns = [
                { label: '상담일자', key: 'consultDate' },
                { label: '상담사', key: 'consultant' },
                { label: '상담구분', key: 'sourceType' },
                { label: '참석여부', key: 'attend' },
                { label: '비고', key: 'note' } // Assuming 'note' might exist or empty
            ];
        } else if (type === 'frequency') {
            const targetMonth = key;
            const monthItems = baseData.filter(i => getMonth(i.consultDate) === targetMonth);
            const studentCounts = {};
            monthItems.forEach(i => {
                if (!studentCounts[i.studentId]) studentCounts[i.studentId] = 0;
                studentCounts[i.studentId]++;
            });

            filteredData = monthItems.filter(i => {
                const c = studentCounts[i.studentId];
                if (subKey === '1') return c === 1;
                if (subKey === '2') return c === 2;
                if (subKey === '3') return c >= 3;
                return false;
            });
            title = `${targetMonth} - ${subKey === '3' ? '3회 이상' : subKey + '회'} 방문 학생 내역`;

        } else if (type === 'actual') {
            const targetMonth = key;
            filteredData = baseData.filter(i => {
                if (getMonth(i.consultDate) !== targetMonth) return false;
                const att = String(i.attend || '').trim();
                const isNoShow = (att === '불참' || att === '노쇼' || att === '결석');
                if (subKey === 'noShow') return isNoShow;
                return !isNoShow;
            });
            title = `${targetMonth} - ${subKey === 'noShow' ? '불참/노쇼' : '실제 진행'} 내역`;

        } else if (type === 'consultant') {
            const targetConsultant = key;
            filteredData = baseData.filter(i => {
                if (String(i.consultant || '미지정').trim() !== targetConsultant) return false;
                if (subKey === 'total') return true;
                const att = String(i.attend || '').trim();
                const isNoShow = (att === '불참' || att === '노쇼' || att === '결석');
                if (subKey === 'noShow') return isNoShow;
                return !isNoShow;
            });
            title = `${targetConsultant} - ${subKey === 'noShow' ? '불참/노쇼' : subKey === 'total' ? '전체' : '실제 진행'} 내역`;

        } else if (type === 'month') {
            filteredData = baseData.filter(i => getMonth(i.consultDate) === key);
            title = `${key} 상세 내역`;

        } else if (type === 'college') {
            filteredData = baseData.filter(i => String(i.college || '기타').trim() === key);
            title = `${key} 상세 내역`;
        }

        setModalConfig({ show: true, title, data: filteredData, columns: customColumns });
    };

    // --- Stats Computations ---

    const nameData = useMemo(() => {
        const map = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const n = i.name; if (!n) return;
            if (!map[n]) map[n] = { ...i, count: 0 };
            map[n].count++;
        });
        const res = Object.values(map);
        if (sortConfig.key === 'count') res.sort((a, b) => (sortConfig.direction === 'ascending' ? a.count - b.count : b.count - a.count));
        else if (sortConfig.key) res.sort((a, b) => {
            let av = a[sortConfig.key], bv = b[sortConfig.key];
            if (av < bv) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (av > bv) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        else res.sort((a, b) => b.count - a.count);
        return res;
    }, [combinedData, studentFilter, sortConfig, statsSubTab]);

    const freqData = useMemo(() => {
        const mStudent = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate;
            const m = getMonth(d);

            if (!mStudent[m]) mStudent[m] = {};
            if (!mStudent[m][i.studentId]) mStudent[m][i.studentId] = 0;
            mStudent[m][i.studentId]++;
        });
        return Object.entries(mStudent).map(([month, sMap]) => {
            let c1 = 0, c2 = 0, c3 = 0;
            Object.values(sMap).forEach(c => { if (c === 1) c1++; else if (c === 2) c2++; else if (c >= 3) c3++; });
            return { month, count1: c1, count2: c2, count3: c3 };
        }).sort((a, b) => a.month.localeCompare(b.month));
    }, [combinedData, studentFilter]);

    const statsData = useMemo(() => {
        const counts = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate;
            if (!d) return;
            const m = getMonth(d);
            if (!counts[m]) counts[m] = 0; counts[m]++;
        });
        return Object.entries(counts).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
    }, [combinedData, studentFilter]);

    const actualStatsData = useMemo(() => {
        const counts = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate;
            if (!d) return;
            const m = getMonth(d);
            if (!counts[m]) counts[m] = { actual: 0, noShow: 0 };
            const att = String(i.attend || '').trim();
            if (att === '불참' || att === '노쇼' || att === '결석') counts[m].noShow++; else counts[m].actual++;
        });
        return Object.entries(counts).map(([month, c]) => ({ month, count: c.actual, noShowCount: c.noShow })).sort((a, b) => a.month.localeCompare(b.month));
    }, [combinedData, studentFilter]);

    const collegeStatsData = useMemo(() => {
        const counts = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const c = String(i.college || '기타').trim();
            if (!counts[c]) counts[c] = 0; counts[c]++;
        });
        return Object.entries(counts).map(([college, count]) => ({ college, count })).sort((a, b) => b.count - a.count);
    }, [combinedData, studentFilter]);

    const consultantStatsData = useMemo(() => {
        const counts = {};
        combinedData.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const c = String(i.consultant || '미지정').trim();
            if (!counts[c]) counts[c] = { actual: 0, noShow: 0 };
            const att = String(i.attend || '').trim();
            if (att === '불참' || att === '노쇼' || att === '결석') counts[c].noShow++; else counts[c].actual++;
        });
        return Object.entries(counts).map(([consultant, c]) => ({ consultant, actualCount: c.actual, noShowCount: c.noShow, totalCount: c.actual + c.noShow })).sort((a, b) => b.totalCount - a.totalCount);
    }, [combinedData, studentFilter]);

    return (
        <div className="ewha-container">
            <div className="ewha-header">
                <div>
                    <h1>통합 통계</h1>
                    <p>진로개발 + 서류면접 + 서면첨삭</p>
                </div>

            </div>

            <div className="content-tabs">
                <button className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
                    현황
                </button>
                <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                    통계 (건수)
                </button>
                <button className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
                    통계 (차트)
                </button>
            </div>

            {activeTab === 'grid' ? (
                <>
                    <div className="pagination-controls">
                        <select value={itemsPerPage} onChange={(e) => {
                            const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                            setItemsPerPage(val);
                            setCurrentPage(1);
                        }} className="ewha-select">
                            <option value="ALL">ALL</option>
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}개씩</option>)}
                        </select>
                        <div className="page-navigation">
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>&lt;</button>
                            <span>{currentPage} / {totalPages}</span>
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>&gt;</button>
                        </div>
                    </div>

                    <div className="grid-wrapper">
                        <div className="grid-header" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                            {columns.map(c => (
                                <span key={c.key} onClick={() => requestSort(c.key)} style={{ cursor: 'pointer' }}>
                                    {c.label}{getSortIndicator(c.key)}
                                </span>
                            ))}
                        </div>
                        {paginatedData.length > 0 ? paginatedData.map((item, idx) => (
                            <div key={idx} className="grid-row" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                                {columns.map(col => <div key={col.key} className="col-center">{item[col.key] || '-'}</div>)}
                            </div>
                        )) : <div className="no-data">데이터가 없습니다.</div>}
                    </div>
                    <FooterActions
                        fileInputRef={fileInputRef}
                        onUploadClick={handleUploadClick}
                        onDownloadClick={handleDownload}
                        onFileChange={handleFileChange}
                    />
                </>
            ) : activeTab === 'stats' ? (
                <div className="stats-container">
                    <div className="stats-header-controls">
                        <div className="filter-group">
                            <label><input type="radio" value="all" checked={studentFilter === 'all'} onChange={e => setStudentFilter(e.target.value)} /> 전체</label>
                            <label><input type="radio" value="undergrad" checked={studentFilter === 'undergrad'} onChange={e => setStudentFilter(e.target.value)} /> 학부</label>
                            <label><input type="radio" value="grad" checked={studentFilter === 'grad'} onChange={e => setStudentFilter(e.target.value)} /> 대학원</label>
                        </div>
                    </div>
                    <div className="content-tabs">
                        <button className={`tab-btn ${statsSubTab === 'name' ? 'active' : ''}`} onClick={() => { setStatsSubTab('name'); requestSort(null); }}>이름별</button>
                        <button className={`tab-btn ${statsSubTab === 'frequency' ? 'active' : ''}`} onClick={() => { setStatsSubTab('frequency'); requestSort(null); }}>빈도별</button>
                        <button className={`tab-btn ${statsSubTab === 'monthly' ? 'active' : ''}`} onClick={() => { setStatsSubTab('monthly'); requestSort(null); }}>월별</button>
                        <button className={`tab-btn ${statsSubTab === 'actual' ? 'active' : ''}`} onClick={() => { setStatsSubTab('actual'); requestSort(null); }}>실제진행</button>
                        <button className={`tab-btn ${statsSubTab === 'college' ? 'active' : ''}`} onClick={() => { setStatsSubTab('college'); requestSort(null); }}>단과대별</button>
                        <button className={`tab-btn ${statsSubTab === 'consultant' ? 'active' : ''}`} onClick={() => { setStatsSubTab('consultant'); requestSort(null); }}>상담사별</button>
                    </div>

                    <div className="grid-wrapper">
                        {statsSubTab === 'name' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                    <span onClick={() => requestSort('name')}>이름{getSortIndicator('name')}</span>
                                    <span onClick={() => requestSort('studentId')}>학번{getSortIndicator('studentId')}</span>
                                    <span onClick={() => requestSort('college')}>대학{getSortIndicator('college')}</span>
                                    <span onClick={() => requestSort('dept')}>학과{getSortIndicator('dept')}</span>
                                    <span onClick={() => requestSort('grade')}>학년{getSortIndicator('grade')}</span>
                                    <span onClick={() => requestSort('count')}>횟수{getSortIndicator('count')}</span>
                                </div>
                                {nameData.length > 0 ? nameData.map((r, i) => (
                                    <div key={i} className="grid-row clickable-cell-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }} onClick={() => handleCellClick('name', r)}>
                                        <div className="col-center clickable-cell">{r.name}</div>
                                        <div className="col-center">{r.studentId}</div>
                                        <div className="col-center">{r.college}</div>
                                        <div className="col-center">{r.dept}</div>
                                        <div className="col-center">{r.grade}</div>
                                        <div className="col-center">{r.count}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                        {statsSubTab === 'frequency' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                    <span onClick={() => requestSort('month')}>월{getSortIndicator('month')}</span>
                                    <span onClick={() => requestSort('count1')}>1회{getSortIndicator('count1')}</span>
                                    <span onClick={() => requestSort('count2')}>2회{getSortIndicator('count2')}</span>
                                    <span onClick={() => requestSort('count3')}>3회 이상{getSortIndicator('count3')}</span>
                                </div>
                                {freqData.length > 0 ? freqData.map((r, i) => (
                                    <div key={i} className="grid-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                        <div className="col-center">{r.month}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('frequency', r.month, '1')}>{r.count1}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('frequency', r.month, '2')}>{r.count2}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('frequency', r.month, '3')}>{r.count3}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                        {statsSubTab === 'monthly' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <span onClick={() => requestSort('month')}>월{getSortIndicator('month')}</span>
                                    <span onClick={() => requestSort('count')}>건수{getSortIndicator('count')}</span>
                                </div>
                                {statsData.length > 0 ? statsData.map((r, i) => (
                                    <div key={i} className="grid-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <div className="col-center">{r.month}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('month', r.month)}>{r.count}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                        {statsSubTab === 'actual' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <span onClick={() => requestSort('month')}>월{getSortIndicator('month')}</span>
                                    <span onClick={() => requestSort('count')}>실제 진행{getSortIndicator('count')}</span>
                                    <span onClick={() => requestSort('noShowCount')} style={{ color: '#e74c3c' }}>불참/노쇼{getSortIndicator('noShowCount')}</span>
                                </div>
                                {actualStatsData.length > 0 ? actualStatsData.map((r, i) => (
                                    <div key={i} className="grid-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                        <div className="col-center">{r.month}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('actual', r.month, 'actual')}>{r.count}</div>
                                        <div className="col-center clickable-cell" style={{ color: '#e74c3c' }} onClick={() => handleCellClick('actual', r.month, 'noShow')}>{r.noShowCount}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                        {statsSubTab === 'college' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <span onClick={() => requestSort('college')}>대학{getSortIndicator('college')}</span>
                                    <span onClick={() => requestSort('count')}>횟수{getSortIndicator('count')}</span>
                                </div>
                                {collegeStatsData.length > 0 ? collegeStatsData.map((r, i) => (
                                    <div key={i} className="grid-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <div className="col-center">{r.college}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('college', r.college)}>{r.count}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                        {statsSubTab === 'consultant' && (
                            <>
                                <div className="grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                    <span onClick={() => requestSort('consultant')}>상담사{getSortIndicator('consultant')}</span>
                                    <span onClick={() => requestSort('totalCount')}>전체{getSortIndicator('totalCount')}</span>
                                    <span onClick={() => requestSort('actualCount')}>실제{getSortIndicator('actualCount')}</span>
                                    <span onClick={() => requestSort('noShowCount')} style={{ color: '#e74c3c' }}>불참/노쇼{getSortIndicator('noShowCount')}</span>
                                </div>
                                {consultantStatsData.length > 0 ? consultantStatsData.map((r, i) => (
                                    <div key={i} className="grid-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                        <div className="col-center">{r.consultant}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('consultant', r.consultant, 'total')}>{r.totalCount}</div>
                                        <div className="col-center clickable-cell" onClick={() => handleCellClick('consultant', r.consultant, 'actual')}>{r.actualCount}</div>
                                        <div className="col-center clickable-cell" style={{ color: '#e74c3c' }} onClick={() => handleCellClick('consultant', r.consultant, 'noShow')}>{r.noShowCount}</div>
                                    </div>
                                )) : <div className="no-data">데이터가 없습니다.</div>}
                            </>
                        )}
                    </div>
                    {/* Modal for Detailed Grid */}
                    <Modal show={modalConfig.show} title={modalConfig.title} onClose={() => setModalConfig({ ...modalConfig, show: false })}>
                        <div className="grid-wrapper">
                            <div className="grid-header" style={{ gridTemplateColumns: `repeat(${(modalConfig.columns || columns).length}, 1fr)` }}>
                                {(modalConfig.columns || columns).map(col => (
                                    <span key={col.key}>{col.label}</span>
                                ))}
                            </div>
                            {modalConfig.data.length > 0 ? modalConfig.data.map((item, idx) => (
                                <div key={idx} className="grid-row" style={{ gridTemplateColumns: `repeat(${(modalConfig.columns || columns).length}, 1fr)` }}>
                                    {(modalConfig.columns || columns).map(col => <div key={col.key} className="col-center">{item[col.key] || '-'}</div>)}
                                </div>
                            )) : <div className="no-data">데이터가 없습니다.</div>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="ewha-btn" onClick={handleModalDownload} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                <Download size={16} style={{ marginRight: '0.5rem' }} />
                                다운로드
                            </button>
                        </div>
                    </Modal>
                    <FooterActions
                        fileInputRef={fileInputRef}
                        onUploadClick={handleUploadClick}
                        onDownloadClick={handleDownload}
                        onFileChange={handleFileChange}
                    />
                </div>
            ) : (
                <EwhaChart data={combinedData} />
            )}
        </div>
    );
};

export default IntegratedStatsView;
