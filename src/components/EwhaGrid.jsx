import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './EwhaGrid.css';
import EwhaChart from './EwhaChart';
import RestrictionView from './RestrictionView';
import IntegratedStatsView from './IntegratedStatsView';
import PreSurvey from './PreSurvey';

const EwhaGrid = ({ title }) => {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // --- Data State ---
    const [careerList, setCareerList] = useState([]); // 진로개발
    const [interviewList, setInterviewList] = useState([]); // 서류면접
    const [correctionList, setCorrectionList] = useState([]); // 서면첨삭

    // --- View State ---
    const [activeTab, setActiveTab] = useState('grid');
    const [itemsPerPage, setItemsPerPage] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    // --- Stats State (Lifted) ---
    const [studentFilter, setStudentFilter] = useState('all');
    const [statsSubTab, setStatsSubTab] = useState('name');
    const [statsSortConfig, setStatsSortConfig] = useState({ key: null, direction: 'ascending' });

    // --- Logic Helpers ---
    const isCorrection = title === '서면첨삭' || title === '취업';
    const isCareer = title === '진로개발';
    const isInterview = title === '서류면접';

    let currentData = [];
    if (isCorrection) currentData = correctionList;
    else if (isCareer) currentData = careerList;
    else if (isInterview) currentData = interviewList;

    // --- Columns ---
    const correctionColumns = [
        { label: 'No', key: 'no' },
        { label: '컨설팅일자', key: 'date' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학년', key: 'grade' },
        { label: '학번', key: 'studentId' },
        { label: '이름', key: 'name' },
        { label: '상담구분', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '답변상태', key: 'answerStatus' }
    ];

    const jinroColumns = [
        { label: 'No', key: 'no' },
        { label: '컨설팅일자', key: 'consultDate' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학적', key: 'status' },
        { label: '학년', key: 'grade' },
        { label: '학번', key: 'studentId' },
        { label: '이름', key: 'name' },
        { label: '상담구분', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '참석여부', key: 'attend' },
    ];

    const currentColumns = isCorrection ? correctionColumns : jinroColumns;

    // --- Data Processing Hook ---
    const sortedData = useMemo(() => {
        let sortableItems = [...currentData];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Numeric sort
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                if (!isNaN(aNum) && !isNaN(bNum) && String(aValue).trim() === String(aNum) && String(bValue).trim() === String(bNum)) {
                    aValue = aNum;
                    bValue = bNum;
                }

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [currentData, sortConfig]);

    const paginatedData = useMemo(() => {
        if (itemsPerPage === 'ALL') return sortedData;
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(sortedData.length / itemsPerPage);

    // --- Handlers ---
    const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
    const handleItemsPerPageChange = (e) => { setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };
    const getSortIndicator = (key) => sortConfig.key === key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';

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

            // --- Validation Logic ---
            if (isCorrection) {
                if (jsonData.length > 0) {
                    // Check headers (keys of first item)
                    const headers = Object.keys(jsonData[0]);
                    if (!headers.includes('상담구분')) {
                        alert('서면첨삭 업로드 파일에는 "상담구분" 헤더가 필수입니다.');
                        return;
                    }
                }
            } else if (isCareer || isInterview) {
                if (jsonData.length > 0) {
                    const headers = Object.keys(jsonData[0]);
                    if (headers.includes('상담구분')) {
                        alert('해당 메뉴에서는 "상담구분" 헤더가 있는 파일을 업로드할 수 없습니다.');
                        return;
                    }
                }
            }

            const mappedData = jsonData.map((item, index) => {
                const getVal = (k) => String(item[k] || '').trim();

                let row = {
                    id: index,
                    no: item['No'] || item['no'] || index + 1,
                    date: getVal('신청일'),
                    college: getVal('대학'),
                    dept: getVal('학과'),
                    grade: getVal('학년'),
                    studentId: getVal('학번'),
                    name: getVal('이름')
                };

                if (isCorrection) {
                    row = {
                        ...row,
                        major: getVal('전공'),
                        status: getVal('학적'),
                        type: getVal('상담구분'),
                        request: getVal('요청내용'),
                        consultant: getVal('컨설턴트'),
                        completeDate: getVal('완료일자'),
                        answerStatus: getVal('답변상태')
                    };
                } else {
                    row = {
                        ...row,
                        status: getVal('학적'),
                        type: getVal('상담분류'),
                        consultant: getVal('상담사'),
                        consultDate: getVal('컨설팅일자'),
                        attend: getVal('참석여부'),
                        state: getVal('상담상태')
                    };
                }

                // Heuristic for column shift
                const studentIdPattern = /^[A-Za-z0-9]{5,}$/;
                const phonePattern = /^010[-.]?\d{4}[-.]?\d{4}$/;
                const checkGrade = String(item['학년'] || '');
                const checkName = String(item['이름'] || '');

                if (checkGrade && checkGrade.match(studentIdPattern) && checkName && checkName.match(phonePattern)) {
                    row.studentId = checkGrade.trim();
                    row.name = item['학번'] ? String(item['학번']).trim() : '';
                    row.grade = '';
                }
                return row;
            }).filter(item => item.studentId && item.name);

            // --- Content Validation ---
            if (isCareer) {
                // 진로개발: Only allow if Type is '진로개발'
                // Check if any item is NOT '진로개발'
                const invalidItem = mappedData.find(item => item.type && item.type.trim() !== '진로개발');
                if (invalidItem) {
                    alert('진로개발 업로드는 상담분류가 "진로개발"인 파일만 가능합니다.');
                    return;
                }
            } else if (isInterview) {
                // 서류면접: Only allow if Type is NOT '진로개발'
                const invalidItem = mappedData.find(item => item.type && item.type.trim() === '진로개발');
                if (invalidItem) {
                    alert('서류면접 업로드는 상담분류가 "진로개발"을 제외한 파일만 가능합니다.');
                    return;
                }
            }

            if (isCorrection) setCorrectionList(mappedData);
            else if (isCareer) setCareerList(mappedData);
            else if (isInterview) setInterviewList(mappedData);

            alert(`${file.name} 업로드 완료 (${mappedData.length}건)`);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (e) => { processFile(e.target.files[0]); e.target.value = ''; };
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); };

    // --- Main Download Handler (Consolidated) ---
    const handleDownload = () => {
        const wb = XLSX.utils.book_new();

        // 1. Grid (List) Download
        if (activeTab === 'grid') {
            let excelData = [];
            let wscols = [];
            if (isCorrection) {
                excelData = sortedData.map(item => ({
                    'No': item.no,
                    '컨설팅일자': item.date,
                    '대학': item.college,
                    '학과': item.dept,
                    '학년': item.grade,
                    '학번': item.studentId,
                    '이름': item.name,
                    '상담구분': item.type,
                    '상담사': item.consultant,
                    '답변상태': item.answerStatus
                }));
                wscols = [{ wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
            } else {
                excelData = sortedData.map(item => ({
                    'No': item.no,
                    '대학': item.college,
                    '학과': item.dept,
                    '학적': item.status,
                    '학년': item.grade,
                    '학번': item.studentId,
                    '이름': item.name,
                    '상담구분': item.type,
                    '상담사': item.consultant,
                    '컨설팅일자': item.consultDate,
                    '참석여부': item.attend
                }));
                wscols = [{ wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 }];
            }
            const ws = XLSX.utils.json_to_sheet(excelData);
            ws['!cols'] = wscols;
            XLSX.utils.book_append_sheet(wb, ws, title || 'Data');
            XLSX.writeFile(wb, `${title || 'Export'}_List.xlsx`);
            return;
        }

        // 2. Stats Download
        if (activeTab === 'stats') {
            if (currentData.length === 0) return;

            let wsData = [];
            let sheetName = 'Stats';
            const filterData = (data) => data.filter(i => {
                const isGrad = String(i.studentId).length > 7;
                if (studentFilter === 'undergrad' && isGrad) return false;
                if (studentFilter === 'grad' && !isGrad) return false;
                return true;
            });

            const dataToUse = filterData(currentData);

            // Helper for Month
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

            if (statsSubTab === 'name') {
                const map = {};
                dataToUse.forEach(i => {
                    const n = i.name; if (!n) return;
                    if (!map[n]) map[n] = { ...i, count: 0 };
                    map[n].count++;
                });
                wsData = Object.values(map).sort((a, b) => b.count - a.count).map(r => ({
                    '이름': r.name, '학번': r.studentId, '대학': r.college, '학과': r.dept, '학년': r.grade, '횟수': r.count
                }));
                sheetName = '이름별';
            } else if (statsSubTab === 'frequency') {
                const mStudent = {};
                dataToUse.forEach(i => {
                    const m = getMonth(i.consultDate || i.date);
                    const sid = i.studentId;
                    if (!mStudent[m]) mStudent[m] = {};
                    if (!mStudent[m][sid]) mStudent[m][sid] = 0;
                    mStudent[m][sid]++;
                });
                wsData = Object.entries(mStudent).map(([month, sMap]) => {
                    let c1 = 0, c2 = 0, c3 = 0;
                    Object.values(sMap).forEach(c => { if (c === 1) c1++; else if (c === 2) c2++; else if (c >= 3) c3++; });
                    return { '월': month, '1회': c1, '2회': c2, '3회이상': c3 };
                }).sort((a, b) => a['월'].localeCompare(b['월']));
                sheetName = '빈도별';
            } else if (statsSubTab === 'monthly') {
                const counts = {};
                dataToUse.forEach(i => {
                    const m = getMonth(i.consultDate || i.date);
                    if (!counts[m]) counts[m] = 0;
                    counts[m]++;
                });
                wsData = Object.entries(counts).map(([month, count]) => ({ '월': month, '건수': count })).sort((a, b) => a['월'].localeCompare(b['월']));
                sheetName = '월별';
            } else if (statsSubTab === 'actual') {
                const counts = {};
                dataToUse.forEach(i => {
                    const m = getMonth(i.consultDate || i.date);
                    if (!counts[m]) counts[m] = { actual: 0, noShow: 0 };
                    const att = String(i.attend || '').trim();
                    if (att === '불참' || att === '노쇼' || att === '결석') counts[m].noShow++; else counts[m].actual++;
                });
                wsData = Object.entries(counts).map(([month, c]) => ({ '월': month, '실제': c.actual, '불참': c.noShow })).sort((a, b) => a['월'].localeCompare(b['월']));
                sheetName = '실제진행';
            } else if (statsSubTab === 'college') {
                const counts = {};
                dataToUse.forEach(i => { const c = i.college || '기타'; if (!counts[c]) counts[c] = 0; counts[c]++; });
                wsData = Object.entries(counts).map(([college, count]) => ({ '대학': college, '횟수': count })).sort((a, b) => b['횟수'] - a['횟수']);
                sheetName = '단과대별';
            } else if (statsSubTab === 'consultant') {
                const counts = {};
                dataToUse.forEach(i => {
                    const c = i.consultant || '미지정';
                    if (!counts[c]) counts[c] = { actual: 0, noShow: 0 };
                    const att = String(i.attend || '').trim();
                    if (att === '불참' || att === '노쇼' || att === '결석') counts[c].noShow++; else counts[c].actual++;
                });
                wsData = Object.entries(counts).map(([consultant, c]) => ({ '상담사': consultant, '전체': c.actual + c.noShow, '실제': c.actual, '불참': c.noShow })).sort((a, b) => b['전체'] - a['전체']);
                sheetName = '상담사별';
            }

            if (wsData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
                XLSX.writeFile(wb, `Stats_${title}_${statsSubTab}.xlsx`);
            }
        }
    };

    // --- Dispatch Types ---
    if (title === '통합통계') {
        return <IntegratedStatsView careerList={careerList} interviewList={interviewList} correctionList={correctionList} />;
    }
    if (title === '신청 제한') {
        return <RestrictionView careerList={careerList} interviewList={interviewList} correctionList={correctionList} />;
    }
    if (title === '사전 설문') {
        return <PreSurvey />;
    }

    return (
        <div className="ewha-container" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDragging && <div className="drag-overlay"><Upload size={48} /><p>파일을 놓아주세요</p></div>}

            <div className="ewha-header">
                <h1>{title}</h1>
            </div>

            <div className="content-tabs">
                <button className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>현황</button>
                <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>통계(건수)</button>
                <button className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>차트</button>
            </div>

            {activeTab === 'grid' ? (
                <>
                    <div className="pagination-controls">
                        <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="ewha-select">
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}개씩</option>)}
                            <option value="ALL">ALL</option>
                        </select>
                        {itemsPerPage !== 'ALL' && (
                            <div className="page-navigation">
                                <button
                                    className="page-btn"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    title="이전 페이지"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="page-info">
                                    <span className="current-page">{currentPage}</span>
                                    <span className="divider">/</span>
                                    <span className="total-pages">{totalPages}</span>
                                </div>
                                <button
                                    className="page-btn"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    title="다음 페이지"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={`grid-wrapper ${isCorrection ? 'job-grid' : 'jinro-grid'}`}>
                        <div className="grid-header" style={{ gridTemplateColumns: `repeat(${currentColumns.length}, minmax(0, 1fr))` }}>
                            {currentColumns.map(col => (
                                <span key={col.key} onClick={() => requestSort(col.key)}>
                                    {col.label}{getSortIndicator(col.key)}
                                </span>
                            ))}
                        </div>
                        {paginatedData.length > 0 ? paginatedData.map(item => (
                            <div key={item.id} className="grid-row" style={{ gridTemplateColumns: `repeat(${currentColumns.length}, minmax(0, 1fr))` }}>
                                {currentColumns.map(col => (
                                    <div key={col.key} className="col-center text-truncate">{item[col.key]}</div>
                                ))}
                            </div>
                        )) : <div className="no-data">데이터가 없습니다.</div>}
                    </div>
                </>
            ) : activeTab === 'stats' ? (
                <MonthlyStatsView
                    data={currentData}
                    studentFilter={studentFilter}
                    setStudentFilter={setStudentFilter}
                    statsSubTab={statsSubTab}
                    setStatsSubTab={setStatsSubTab}
                    sortConfig={statsSortConfig}
                    setSortConfig={setStatsSortConfig}
                    columns={currentColumns}
                />
            ) : (
                <EwhaChart data={currentData} />
            )}

            {activeTab !== 'chart' && (
                <div className="button-container">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" style={{ display: 'none' }} />
                    <button className="ewha-btn outline" onClick={handleUploadClick}>업로드</button>
                    <button className="ewha-btn" onClick={handleDownload} disabled={currentData.length === 0}>다운로드</button>
                </div>
            )}
        </div>
    );
};

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

const MonthlyStatsView = ({ data, studentFilter, setStudentFilter, statsSubTab, setStatsSubTab, sortConfig, setSortConfig, columns }) => {
    // Note: Modal state handles are not used in this simplified grid view, but can be added if interaction needed
    const [modalConfig, setModalConfig] = useState({ show: false, title: '', data: [] });

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
        const wscols = colsToUse.map(() => ({ wch: 15 })); // Default width
        ws['!cols'] = wscols;
        XLSX.utils.book_append_sheet(wb, ws, "Details");
        XLSX.writeFile(wb, `${modalConfig.title || 'Detail_Export'}.xlsx`);
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };
    const getSortIndicator = (key) => sortConfig.key === key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';

    // Date Helper (reused)
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

    // Filter Logic for Modal
    const handleCellClick = (type, key, subKey) => {
        let filteredData = [];
        let title = '';
        let customColumns = null;

        // Pre-filter by student type (grad/undergrad)
        const baseData = data.filter(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return false;
            if (studentFilter === 'grad' && !isGrad) return false;
            return true;
        });

        if (type === 'name') {
            const targetStudentId = key.studentId;
            filteredData = baseData.filter(i => String(i.studentId) === String(targetStudentId));
            title = `${key.name} (${targetStudentId}) 상담 이력`;

            // Detect Date Key from existing columns or default to 'date'
            const dateKey = columns.find(c => c.label.includes('일자') || c.key.includes('date'))?.key || 'date';

            // Check if this is Correction view (has answerStatus)
            const isCorrectionView = columns.some(c => c.key === 'answerStatus');
            const statusLabel = isCorrectionView ? '답변여부' : '참석여부';
            const statusKey = isCorrectionView ? 'answerStatus' : 'attend';

            customColumns = [
                { label: '상담일자', key: dateKey },
                { label: '상담사', key: 'consultant' },
                { label: '상담구분', key: 'type' },
                { label: statusLabel, key: statusKey },
                { label: '비고', key: 'note' }
            ];
        } else if (type === 'frequency') {
            // subKey: '1', '2', '3'
            const targetMonth = key;

            // 1. Get all items for this month
            const monthItems = baseData.filter(i => getMonth(i.consultDate || i.date) === targetMonth);

            // 2. Count per student
            const studentCounts = {};
            monthItems.forEach(i => {
                if (!studentCounts[i.studentId]) studentCounts[i.studentId] = 0;
                studentCounts[i.studentId]++;
            });

            // 3. Filter items for students matching count
            filteredData = monthItems.filter(i => {
                const c = studentCounts[i.studentId];
                if (subKey === '1') return c === 1;
                if (subKey === '2') return c === 2;
                if (subKey === '3') return c >= 3;
                return false;
            });
            title = `${targetMonth} - ${subKey === '3' ? '3회 이상' : subKey + '회'} 방문 학생 내역`;
        } else if (type === 'actual') {
            // subKey: 'actual', 'noShow'
            const targetMonth = key;
            filteredData = baseData.filter(i => {
                if (getMonth(i.consultDate || i.date) !== targetMonth) return false;
                const att = String(i.attend || '').trim();
                const isNoShow = (att === '불참' || att === '노쇼' || att === '결석');
                if (subKey === 'noShow') return isNoShow;
                return !isNoShow;
            });
            title = `${targetMonth} - ${subKey === 'noShow' ? '불참/노쇼' : '실제 진행'} 내역`;
        } else if (type === 'consultant') {
            // subKey: 'actual', 'noShow', 'total'
            const targetConsultant = key;
            filteredData = baseData.filter(i => {
                if (String(i.consultant || '미지정').trim() !== targetConsultant) return false;
                if (subKey === 'total') return true;
                const att = String(i.attend || '').trim();
                const isNoShow = (att === '불참' || att === '노쇼' || att === '결석');
                if (subKey === 'noShow') return isNoShow;
                return !isNoShow; // actual
            });
            title = `${targetConsultant} - ${subKey === 'noShow' ? '불참/노쇼' : subKey === 'total' ? '전체' : '실제 진행'} 내역`;
        } else if (type === 'month') {
            filteredData = baseData.filter(i => getMonth(i.consultDate || i.date) === key);
            title = `${key} 상세 내역`;
        } else if (type === 'college') {
            filteredData = baseData.filter(i => String(i.college || '기타').trim() === key);
            title = `${key} 상세 내역`;
        }

        setModalConfig({ show: true, title, data: filteredData, columns: customColumns });
    };

    // Name Data
    const nameData = useMemo(() => {
        const map = {};
        data.forEach(i => {
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
    }, [data, studentFilter, sortConfig, statsSubTab]);

    // Frequency
    const freqData = useMemo(() => {
        const mStudent = {};
        data.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate || i.date;
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
    }, [data, studentFilter]);

    // Monthly
    const statsData = useMemo(() => {
        const counts = {};
        data.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate || i.date;
            if (!d) return;
            const m = getMonth(d);
            if (!counts[m]) counts[m] = 0; counts[m]++;
        });
        return Object.entries(counts).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
    }, [data, studentFilter]);

    // Actual
    const actualStatsData = useMemo(() => {
        const counts = {};
        data.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const d = i.consultDate || i.date;
            if (!d) return;
            const m = getMonth(d);
            if (!counts[m]) counts[m] = { actual: 0, noShow: 0 };
            const att = String(i.attend || '').trim();
            if (att === '불참' || att === '노쇼' || att === '결석') counts[m].noShow++; else counts[m].actual++;
        });
        return Object.entries(counts).map(([month, c]) => ({ month, count: c.actual, noShowCount: c.noShow })).sort((a, b) => a.month.localeCompare(b.month));
    }, [data, studentFilter]);

    // College
    const collegeStatsData = useMemo(() => {
        const counts = {};
        data.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const c = String(i.college || '기타').trim();
            if (!counts[c]) counts[c] = 0; counts[c]++;
        });
        return Object.entries(counts).map(([college, count]) => ({ college, count })).sort((a, b) => b.count - a.count);
    }, [data, studentFilter]);

    // Consultant
    const consultantStatsData = useMemo(() => {
        const counts = {};
        data.forEach(i => {
            const isGrad = String(i.studentId).length > 7;
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;
            const c = String(i.consultant || '미지정').trim();
            if (!counts[c]) counts[c] = { actual: 0, noShow: 0 };
            const att = String(i.attend || '').trim();
            if (att === '불참' || att === '노쇼' || att === '결석') counts[c].noShow++; else counts[c].actual++;
        });
        return Object.entries(counts).map(([consultant, c]) => ({ consultant, actualCount: c.actual, noShowCount: c.noShow, totalCount: c.actual + c.noShow })).sort((a, b) => b.totalCount - a.totalCount);
    }, [data, studentFilter]);

    return (
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
                {/* Name Stats Grid */}
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

                {/* Frequency Stats Grid */}
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

                {/* Monthly Stats Grid */}
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

                {/* Actual Stats Grid */}
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

                {/* College Stats Grid */}
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

                {/* Consultant Stats Grid */}
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
        </div>
    );
};

export default EwhaGrid;
