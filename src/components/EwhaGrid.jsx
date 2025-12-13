import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, X } from 'lucide-react';
import './EwhaGrid.css';
import EwhaChart from './EwhaChart';

const EwhaGrid = ({ title }) => {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // State for data
    const [jinroList, setJinroList] = useState([]);
    const [jobList, setJobList] = useState([]);

    // State for Pagination
    const [itemsPerPage, setItemsPerPage] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // State for Sorting
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    const isJob = title === '취업';
    const currentData = isJob ? jobList : jinroList;

    // Sort Logic
    const sortedData = React.useMemo(() => {
        let sortableItems = [...currentData];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Check for numeric strings and convert for proper sorting if both are numbers
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                if (!isNaN(aNum) && !isNaN(bNum) && String(aValue).trim() === String(aNum) && String(bValue).trim() === String(bNum)) {
                    aValue = aNum;
                    bValue = bNum;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [currentData, sortConfig]);

    // Handle items per page change
    const handleItemsPerPageChange = (e) => {
        const value = e.target.value;
        setItemsPerPage(value === 'ALL' ? 'ALL' : Number(value));
        setCurrentPage(1); // Reset to first page
    };

    // Calculate pagination
    const paginatedData = React.useMemo(() => {
        if (itemsPerPage === 'ALL') return sortedData;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return sortedData.slice(startIndex, endIndex);
    }, [sortedData, currentPage, itemsPerPage]);

    const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(sortedData.length / itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    // Columns Configuration
    // Columns Configuration
    const jobColumns = [
        { label: 'No', key: 'no' },
        { label: '컨설팅일자', key: 'date' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학년', key: 'grade' },
        { label: '학번', key: 'studentId' },
        { label: '이름', key: 'name' },
        { label: '상담구분', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '답변상태', key: 'status' }
    ];

    const jinroColumns = [
        { label: 'No', key: 'no' },
        { label: '신청일', key: 'date' },
        { label: '대학', key: 'college' },
        { label: '학과', key: 'dept' },
        { label: '학적', key: 'status' },
        { label: '학년', key: 'grade' },
        { label: '학번', key: 'studentId' },
        { label: '이름', key: 'name' },
        { label: '연락처', key: 'phone' },
        { label: '상담분류', key: 'type' },
        { label: '상담사', key: 'consultant' },
        { label: '컨설팅일자', key: 'consultDate' },
        { label: '참석여부', key: 'attend' },
        { label: '상담상태', key: 'state' }
    ];

    const currentColumns = isJob ? jobColumns : jinroColumns;

    const handleDownload = () => {
        let excelData = [];
        let wscols = [];

        if (isJob) {
            excelData = sortedData.map(item => ({
                'No': item.no,
                '신청일': item.date,
                '대학': item.college,
                '학과': item.dept,
                '전공': item.major,
                '학년': item.grade,
                '학번': item.studentId,
                '이름': item.name,
                '연락처': item.phone,
                '상담구분': item.type,
                '요청내용': item.request,
                '컨설턴트': item.consultant,
                '완료일자': item.completeDate,
                '답변상태': item.status
            }));
            wscols = [
                { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 10 },
                { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 10 },
                { wch: 12 }, { wch: 10 }
            ];
        } else {
            // Jinro Data Export
            excelData = sortedData.map(item => ({
                'No': item.no,
                '신청일': item.date,
                '대학': item.college,
                '학과': item.dept,
                '학적': item.status,
                '학년': item.grade,
                '학번': item.studentId,
                '이름': item.name,
                '연락처': item.phone,
                '상담분류': item.type,
                '상담사': item.consultant,
                '컨설팅일자': item.consultDate,
                '참석여부': item.attend,
                '상담상태': item.state
            }));
            wscols = [
                { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                { wch: 10 }, { wch: 5 }, { wch: 10 }, { wch: 10 },
                { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
                { wch: 8 }, { wch: 10 }
            ];
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, title || '이화 소식');
        XLSX.writeFile(wb, `${title || 'Ewha_News'}_List.xlsx`);
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const processFile = (file) => {
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assume first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // Validate Columns - Read headers directly from sheet to handle empty columns
            const range = XLSX.utils.decode_range(sheet['!ref']);
            const excelHeaders = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
                const cell = sheet[cellAddress];
                if (cell && cell.v) {
                    excelHeaders.push(String(cell.v).trim());
                }
            }

            if (excelHeaders.length > 0) {
                let requiredHeaders = [];
                if (isJob) {
                    // Excel Headers for Job
                    requiredHeaders = ['No', '신청일', '대학', '학과', '학년', '학번', '이름', '상담구분', '컨설턴트', '답변상태'];
                } else {
                    // Excel Headers for Jinro (Career)
                    requiredHeaders = ['No', '신청일', '대학', '학과', '학적', '학년', '학번', '이름', '연락처', '상담분류', '상담사', '컨설팅일자', '참석여부', '상담상태'];
                }

                const headersToValidate = requiredHeaders.filter(h => h !== 'No');
                const missingHeaders = headersToValidate.filter(required => !excelHeaders.includes(required));

                if (missingHeaders.length > 0) {
                    alert(`업로드 실패: 엑셀 파일의 컬럼이 일치하지 않습니다.\n누락된 컬럼: ${missingHeaders.join(', ')}\n\n현재 ${isJob ? '취업' : '진로'} 탭에 맞는 파일을 업로드해주세요.`);
                    return;
                }
            }

            // Map data based on current view (Jinro vs Job)
            // Assuming Excel headers match the Korean labels
            // Map data based on current view (Jinro vs Job)
            // Assuming Excel headers match the Korean labels
            if (isJob) {
                const mappedData = jsonData
                    .map((item, index) => {
                        let row = {
                            id: index,
                            no: item['No'] || item['no'] || index + 1,
                            date: item['신청일'] || '',
                            college: item['대학'] || '',
                            dept: item['학과'] || '',
                            major: item['전공'] || '',
                            grade: item['학년'] || '',
                            studentId: item['학번'] || '',
                            name: item['이름'] || '',
                            phone: item['연락처'] || '',
                            type: item['상담구분'] || '',
                            request: item['요청내용'] || '',
                            consultant: item['컨설턴트'] || '',
                            completeDate: item['완료일자'] || '',
                            status: item['답변상태'] || ''
                        };

                        // Heuristic Fix for Shifted Data (Missing Grade/Type columns)
                        // If grade has Student ID format AND name has Phone format
                        const studentIdPattern = /^[A-Za-z0-9]{5,}$/; // At least 5 chars alphanumeric
                        const phonePattern = /^010[-.]?\d{4}[-.]?\d{4}$/; // 010 phone format

                        // Check if grade holds StudentID and name holds Phone (Column shift)
                        // Case: Grade is missing, so StudentID shifted to Grade. Name shifted to StudentID. Phone shifted to Name.
                        if (row.grade && String(row.grade).match(studentIdPattern) && String(row.grade).length > 1 &&
                            row.name && String(row.name).match(phonePattern)) {

                            const realStudentId = row.grade;
                            const realName = row.studentId;
                            const realPhone = row.name;
                            const realRequest = row.phone;

                            row.grade = ''; // Missing grade
                            row.studentId = realStudentId;
                            row.name = realName;
                            row.phone = realPhone;

                            // Simple fix for the main columns first
                            row.request = realRequest;
                            row.type = ''; // Missing type
                        } else if (row.grade && String(row.grade).match(studentIdPattern) && String(row.grade).length > 1 &&
                            row.studentId && !String(row.studentId).match(/^[0-9]+$/) &&
                            (!row.phone || !String(row.phone).match(phonePattern))) {

                            const realStudentId = row.grade;
                            const realName = row.studentId;
                            const realPhone = row.name;

                            row.grade = '';
                            row.studentId = realStudentId;
                            row.name = realName;
                            row.phone = realPhone;
                            // Shift others if necessary
                            if (!row.type && row.phone) {
                                row.request = row.phone;
                            }
                        }

                        return row;
                    })
                    .filter(item => item.studentId && item.name); // Filter out empty rows
                setJobList(mappedData);
            } else {
                const mappedData = jsonData
                    .map((item, index) => {
                        let row = {
                            id: index,
                            no: item['No'] || item['no'] || index + 1,
                            date: item['신청일'] || '',
                            college: item['대학'] || '',
                            dept: item['학과'] || '',
                            status: item['학적'] || '',
                            grade: item['학년'] || '',
                            studentId: item['학번'] || '',
                            name: item['이름'] || '',
                            phone: item['연락처'] || '',
                            type: item['상담분류'] || '',
                            consultant: item['상담사'] || '',
                            consultDate: item['컨설팅일자'] || '',
                            attend: item['참석여부'] || '',
                            state: item['상담상태'] || ''
                        };

                        // Heuristic Fix for Shifted Data (Similar logic for Jinro)
                        const studentIdPattern = /^[A-Za-z0-9]{5,}$/;
                        const phonePattern = /^010[-.]?\d{4}[-.]?\d{4}$/;

                        if (row.grade && String(row.grade).match(studentIdPattern) && String(row.grade).length > 1 &&
                            row.name && String(row.name).match(phonePattern)) {

                            const realStudentId = row.grade;
                            const realName = row.studentId;
                            const realPhone = row.name;
                            // const realConsultant = row.type; // Col 11 shifted to 10?

                            row.grade = '';
                            row.studentId = realStudentId;
                            row.name = realName;
                            row.phone = realPhone;

                            // Fix subsequent shifts if possible (heuristics tricky here)
                            // Standard: Type(10), Consultant(11)
                            // Shifted: Name(8) has Phone(9). Phone(9) has Type(10). Type(10) has Consultant(11).
                            const realType = row.phone; // Phone field held Type?
                            row.type = realType;
                        }

                        return row;
                    })
                    .filter(item => item.studentId && item.name); // Filter out empty rows
                setJinroList(mappedData);
            }

            alert(`${file.name} 파일 업로드가 완료되었습니다.`);
        };

        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (event) => {
        processFile(event.target.files[0]);
        event.target.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };

    // Tab State
    const [activeTab, setActiveTab] = useState('grid');

    // ... (rest of the hooks)

    // ... (rest of functions)

    return (
        <div
            className="ewha-container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ position: 'relative' }}
        >
            {isDragging && (
                <div className="drag-overlay">
                    <div className="drag-content">
                        <Upload size={48} />
                        <p>엑셀 파일을 이곳에 놓아주세요</p>
                    </div>
                </div>
            )}

            <div className="ewha-header">
                <h1>{title || '이화 소식'}</h1>
                <p>EWHA WOMANS UNIVERSITY {title === '진로' ? 'CAREER' : title === '취업' ? 'EMPLOYMENT' : 'NEWS & NOTICE'}</p>
            </div>

            {/* Content Tabs */}
            <div className="content-tabs">
                <button
                    className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`}
                    onClick={() => setActiveTab('grid')}
                >
                    현황
                </button>
                <button
                    className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    컨설팅 횟수
                </button>
                <button
                    className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chart')}
                >
                    차트 (Chart)
                </button>
            </div>

            {activeTab === 'grid' ? (
                <>
                    {/* Pagination Controls */}
                    <div className="pagination-controls">
                        <div className="select-wrapper">
                            <label>표시 개수:</label>
                            <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="ewha-select">
                                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => (
                                    <option key={num} value={num}>{num}개씩</option>
                                ))}
                                <option value="ALL">ALL</option>
                            </select>
                        </div>
                        {itemsPerPage !== 'ALL' && sortedData.length > 0 && (
                            <div className="page-navigation">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="page-btn"
                                >
                                    &lt;
                                </button>
                                <span>{currentPage} / {totalPages}</span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="page-btn"
                                >
                                    &gt;
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={`grid-wrapper ${isJob ? 'job-grid' : 'jinro-grid'}`}>
                        {/* Grid Header and Rows */}
                        <div className="grid-header">
                            {currentColumns.map((col) => (
                                <span
                                    key={col.key}
                                    onClick={() => requestSort(col.key)}
                                    title={`${col.label} 정렬`}
                                >
                                    {col.label} {getSortIndicator(col.key)}
                                </span>
                            ))}
                        </div>

                        {paginatedData.length > 0 ? paginatedData.map((item) => (
                            <div key={item.id} className="grid-row">
                                {isJob ? (
                                    <>
                                        <div className="col-center">{item.no}</div>
                                        <div className="col-center">{item.date}</div>
                                        <div className="col-center">{item.college}</div>
                                        <div className="col-center">{item.dept}</div>
                                        <div className="col-center">{item.grade}</div>
                                        <div className="col-center">{item.studentId}</div>
                                        <div className="col-center">{item.name}</div>
                                        <div className="col-center">{item.type}</div>
                                        <div className="col-center">{item.consultant}</div>
                                        <div className="col-center">{item.status}</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-center">{item.no}</div>
                                        <div className="col-center">{item.date}</div>
                                        <div className="col-center">{item.college}</div>
                                        <div className="col-center">{item.dept}</div>
                                        <div className="col-center">{item.status}</div>
                                        <div className="col-center">{item.grade}</div>
                                        <div className="col-center">{item.studentId}</div>
                                        <div className="col-center">{item.name}</div>
                                        <div className="col-center">{item.phone}</div>
                                        <div className="col-center">{item.type}</div>
                                        <div className="col-center">{item.consultant}</div>
                                        <div className="col-center">{item.consultDate}</div>
                                        <div className="col-center">{item.attend}</div>
                                        <div className="col-center">{item.state}</div>
                                    </>
                                )}
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없습니다. 엑셀 파일을 업로드해주세요.</p>
                            </div>
                        )}
                    </div>
                </>
            ) : activeTab === 'stats' ? (
                <MonthlyStatsView data={currentData} />
            ) : (
                <EwhaChart data={currentData} />
            )}

            {activeTab === 'grid' && (
                <div className="button-container">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <button className="ewha-btn outline" onClick={handleUploadClick}>
                        <Upload size={18} />
                        엑셀 업로드
                    </button>
                    <button className="ewha-btn" onClick={handleDownload} disabled={currentData.length === 0}>
                        <Download size={18} />
                        엑셀 다운로드
                    </button>
                </div>
            )}
        </div>
    );
};

// Sub-component for Monthly Stats
const MonthlyStatsView = ({ data }) => {
    const [studentFilter, setStudentFilter] = useState('all'); // 'all', 'undergrad', 'grad'
    const [statsSubTab, setStatsSubTab] = useState('name');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [modalConfig, setModalConfig] = useState({ show: false, title: '', data: [] });

    // Sort Handlers
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (name) => {
        if (sortConfig.key === name) {
            return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
        }
        return '';
    };

    // Modal Handlers
    const closeModal = () => setModalConfig({ ...modalConfig, show: false });

    const handleFreqCellClick = (month, countType) => {
        if (!data || data.length === 0) return;

        const monthlyStudentCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            // Date processing
            let dateStr = item.date;
            let itemMonth = 'Unknown';
            if (dateStr) {
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    itemMonth = dateStr.substring(0, 7);
                } else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    itemMonth = `${y}-${m}`;
                }
            }

            if (itemMonth !== month) return;

            if (!monthlyStudentCounts[studentIdStr]) {
                monthlyStudentCounts[studentIdStr] = {
                    count: 0,
                    info: item
                };
            }
            monthlyStudentCounts[studentIdStr].count++;
        });

        const targetStudents = [];
        Object.values(monthlyStudentCounts).forEach(({ count, info }) => {
            if (countType === 1 && count === 1) targetStudents.push({ ...info, count });
            else if (countType === 2 && count === 2) targetStudents.push({ ...info, count });
            else if (countType === 3 && count >= 3) targetStudents.push({ ...info, count });
        });

        setModalConfig({
            show: true,
            title: `${month} - ${countType >= 3 ? '3회 이상' : countType + '회'} 이용자 상세`,
            data: targetStudents,
            type: 'frequency'
        });
    };

    const handleActualStatsClick = (month, type) => {
        if (!data || data.length === 0) return;

        const targetStudents = [];

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            let dateStr = item.consultDate || item.date;
            let itemMonth = 'Unknown';

            if (dateStr) {
                const dateString = String(dateStr).trim();
                // Check if YYYY-MM
                if (dateString.match(/^\d{4}-\d{2}/)) {
                    itemMonth = dateString.substring(0, 7);
                }
                // Check if YYYY.MM.DD
                else if (dateString.match(/^\d{4}\.\d{2}\.\d{2}/)) {
                    itemMonth = dateString.substring(0, 7).replace('.', '-');
                }
                // Check if YYYY. MM. DD (spaces)
                else if (dateString.match(/^\d{4}\.\s\d{2}\.\s\d{2}/)) {
                    const parts = dateString.split('.');
                    const y = parts[0].trim();
                    const m = parts[1].trim();
                    itemMonth = `${y}-${m}`;
                }
                // Excel serial date
                else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    itemMonth = `${y}-${m}`;
                }
            }

            if (itemMonth !== month) return;

            const attendStatus = String(item.attend || '').trim();
            const isNoShow = attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석';

            if (type === 'noShow' && isNoShow) {
                targetStudents.push({ ...item, count: '-' }); // 횟수는 개별 건이므로 의미 없음, '-' 표시
            } else if (type === 'actual' && !isNoShow) {
                targetStudents.push({ ...item, count: '1' }); // 실제 진행 1회로 간주
            }
        });



        // Calculate penalty if noShow
        if (type === 'noShow') {
            targetStudents.forEach(student => {
                let consultDateStr = student.consultDate || student.date;
                let penaltyEnd = '';

                if (consultDateStr) {
                    let consultDate;
                    const dateString = String(consultDateStr).trim();

                    if (typeof consultDateStr === 'number') {
                        consultDate = new Date(Math.round((consultDateStr - 25569) * 86400 * 1000));
                    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                        consultDate = new Date(dateString);
                    } else if (dateString.match(/^\d{4}\.\d{2}\.\d{2}/)) {
                        consultDate = new Date(dateString.replace(/\./g, '-'));
                    } else if (dateString.match(/^\d{4}\.\s\d{2}\.\s\d{2}/)) {
                        const cleanDate = dateString.replace(/\s/g, '').replace(/\./g, '-');
                        consultDate = new Date(cleanDate.substring(0, 10)); // Take YYYY-MM-DD
                    }

                    if (consultDate && !isNaN(consultDate.getTime())) {
                        const penaltyDate = new Date(consultDate);
                        penaltyDate.setMonth(penaltyDate.getMonth() + 1);
                        const py = penaltyDate.getFullYear();
                        const pm = String(penaltyDate.getMonth() + 1).padStart(2, '0');
                        const pd = String(penaltyDate.getDate()).padStart(2, '0');
                        penaltyEnd = `${py}-${pm}-${pd} 까지`;
                    }
                }
                student.penalty = penaltyEnd || '날짜 확인 불가';
            });
        }

        setModalConfig({
            show: true,
            title: `${month} - ${type === 'actual' ? '실제 진행' : '불참/노쇼'} 상세 내역 (컨설팅일자 기준)`,
            data: targetStudents,
            type: type
        });
    };



    const handleConsultantStatsClick = (consultant, type) => {
        if (!data || data.length === 0) return;

        const targetStudents = [];

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            const itemConsultant = String(item.consultant || '미지정').trim();
            if (itemConsultant !== consultant) return;

            const attendStatus = String(item.attend || '').trim();
            const isNoShow = attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석';

            if (type === 'total') {
                targetStudents.push({ ...item, count: '-' });
            } else if (type === 'actual' && !isNoShow) {
                targetStudents.push({ ...item, count: '1' });
            } else if (type === 'noShow' && isNoShow) {
                targetStudents.push({ ...item, count: '-' });
            }
        });

        // Calculate penalty if noShow
        if (type === 'noShow') {
            targetStudents.forEach(student => {
                let consultDateStr = student.consultDate || student.date;
                let penaltyEnd = '';

                if (consultDateStr) {
                    let consultDate;
                    const dateString = String(consultDateStr).trim();

                    if (typeof consultDateStr === 'number') {
                        consultDate = new Date(Math.round((consultDateStr - 25569) * 86400 * 1000));
                    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                        consultDate = new Date(dateString);
                    } else if (dateString.match(/^\d{4}\.\d{2}\.\d{2}/)) {
                        consultDate = new Date(dateString.replace(/\./g, '-'));
                    } else if (dateString.match(/^\d{4}\.\s\d{2}\.\s\d{2}/)) {
                        const cleanDate = dateString.replace(/\s/g, '').replace(/\./g, '-');
                        consultDate = new Date(cleanDate.substring(0, 10)); // Take YYYY-MM-DD
                    }

                    if (consultDate && !isNaN(consultDate.getTime())) {
                        const penaltyDate = new Date(consultDate);
                        penaltyDate.setMonth(penaltyDate.getMonth() + 1);
                        const py = penaltyDate.getFullYear();
                        const pm = String(penaltyDate.getMonth() + 1).padStart(2, '0');
                        const pd = String(penaltyDate.getDate()).padStart(2, '0');
                        penaltyEnd = `${py}-${pm}-${pd} 까지`;
                    }
                }
                student.penalty = penaltyEnd || '날짜 확인 불가';
            });
        }

        const titleMap = {
            total: '전체 배정',
            actual: '실제 진행',
            noShow: '불참/노쇼'
        };

        setModalConfig({
            show: true,
            title: `${consultant} - ${titleMap[type]} 상세 내역`,
            data: targetStudents,
            type: type
        });
    };

    const handleDownloadModalData = () => {
        const ws = XLSX.utils.json_to_sheet(modalConfig.data.map(item => {
            const row = {
                '이름': item.name,
                '학번': item.studentId,
                '대학': item.college,
                '학과': item.dept,
                '학년': item.grade,
                '이용 횟수': item.count
            };
            if (modalConfig.type === 'noShow' || modalConfig.type === 'actual' || modalConfig.type === 'total') {
                row['신청일'] = item.date;
            }
            if (modalConfig.type === 'noShow') {
                row['신청제한 기간'] = item.penalty;
            }
            return row;
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '상세 내역');
        XLSX.writeFile(wb, `${modalConfig.title.replace(/[:\\/?*[\]]/g, '_')}.xlsx`);
    };



    const statsData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const monthlyCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            let dateStr = item.date;
            let monthKey = 'Unknown';

            if (dateStr) {
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    monthKey = dateStr.substring(0, 7);
                } else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                }
            }

            if (!monthlyCounts[monthKey]) {
                monthlyCounts[monthKey] = 0;
            }
            monthlyCounts[monthKey]++;
        });

        let result = Object.entries(monthlyCounts).map(([month, count]) => ({
            month, count
        }));

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'monthly') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }

                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => a.month.localeCompare(b.month));
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);

    const frequencyData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const monthlyStudentCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            let dateStr = item.date;
            let monthKey = 'Unknown';
            if (dateStr) {
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    monthKey = dateStr.substring(0, 7);
                } else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                }
            }

            if (!monthlyStudentCounts[monthKey]) {
                monthlyStudentCounts[monthKey] = {};
            }
            if (!monthlyStudentCounts[monthKey][studentIdStr]) {
                monthlyStudentCounts[monthKey][studentIdStr] = 0;
            }
            monthlyStudentCounts[monthKey][studentIdStr]++;
        });

        let result = Object.entries(monthlyStudentCounts).map(([month, studentMap]) => {
            let count1 = 0;
            let count2 = 0;
            let count3 = 0;

            Object.values(studentMap).forEach(freq => {
                if (freq === 1) count1++;
                else if (freq === 2) count2++;
                else if (freq >= 3) count3++;
            });

            return { month, count1, count2, count3 };
        });

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'frequency') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }

                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => a.month.localeCompare(b.month));
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);

    const nameFrequencyData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const nameMap = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            const name = String(item.name || '').trim();
            if (!name) return;

            if (!nameMap[name]) {
                nameMap[name] = {
                    name,
                    studentId: item.studentId,
                    college: item.college,
                    dept: item.dept,
                    grade: item.grade,
                    count: 0
                };
            }
            nameMap[name].count++;
        });

        let result = Object.values(nameMap);

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'name') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Handle numeric values
                const aNum = parseFloat(aVal);
                const bNum = parseFloat(bVal);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortConfig.direction === 'ascending' ? aNum - bNum : bNum - aNum;
                }

                // String comparison
                aVal = String(aVal || '');
                bVal = String(bVal || '');
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => b.count - a.count); // Default: highest count first
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);

    // Actual conducted sessions (excluding no-shows)
    const actualStatsData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const monthlyCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            let dateStr = item.consultDate || item.date; // Use consultDate if available, otherwise date
            let monthKey = 'Unknown';

            if (dateStr) {
                const dateString = String(dateStr).trim();
                // Check if YYYY-MM format
                if (dateString.match(/^\d{4}-\d{2}/)) {
                    monthKey = dateString.substring(0, 7);
                }
                // Check if YYYY.MM.DD format (without spaces)
                else if (dateString.match(/^\d{4}\.\d{2}\.\d{2}/)) {
                    monthKey = dateString.substring(0, 7).replace('.', '-');
                }
                // Check if YYYY. MM. DD format (with spaces)
                else if (dateString.match(/^\d{4}\.\s+\d{2}\.\s+\d{2}/)) {
                    const parts = dateString.split('.');
                    const y = parts[0].trim();
                    const m = parts[1].trim();
                    monthKey = `${y}-${m}`;
                }
                // Excel serial date
                else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                } else {
                    // Debug: Log unrecognized date formats
                    console.log('Unrecognized date format:', dateString, 'Type:', typeof dateStr);
                }
            }

            if (!monthlyCounts[monthKey]) {
                monthlyCounts[monthKey] = { actual: 0, noShow: 0 };
            }

            const attendStatus = String(item.attend || '').trim();
            if (attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석') {
                monthlyCounts[monthKey].noShow++;
            } else {
                monthlyCounts[monthKey].actual++;
            }
        });

        // Filter out Unknown if it's junk, but keep if relevant 
        // For now, keep all

        let result = Object.entries(monthlyCounts).map(([month, counts]) => ({
            month,
            count: counts.actual,
            noShowCount: counts.noShow
        }));

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'actual') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }

                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => a.month.localeCompare(b.month));
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);




    const collegeStatsData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const collegeCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            // Logic: Just Count consulting sessions per college
            // Assuming each row is a consulting session.
            // If we need unique students per college, we'd use a Set.
            // Based on "Consulting Frequency", typically means session count.
            const college = String(item.college || '기타/미기재').trim();

            if (!collegeCounts[college]) {
                collegeCounts[college] = 0;
            }
            collegeCounts[college]++;
        });

        let result = Object.entries(collegeCounts).map(([college, count]) => ({
            college, count
        }));

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'college') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => b.count - a.count); // Default desc count
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);

    const consultantStatsData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const consultantCounts = {};

        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            const isGrad = studentIdStr.length > 7;

            // Apply filter
            if (studentFilter === 'undergrad' && isGrad) return;
            if (studentFilter === 'grad' && !isGrad) return;

            const consultant = String(item.consultant || '미지정').trim();

            if (!consultantCounts[consultant]) {
                consultantCounts[consultant] = { actual: 0, noShow: 0 };
            }

            const attendStatus = String(item.attend || '').trim();
            if (attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석') {
                consultantCounts[consultant].noShow++;
            } else {
                consultantCounts[consultant].actual++;
            }
        });

        let result = Object.entries(consultantCounts).map(([consultant, counts]) => ({
            consultant,
            actualCount: counts.actual,
            noShowCount: counts.noShow,
            totalCount: counts.actual + counts.noShow
        }));

        // Apply sorting
        if (sortConfig.key && statsSubTab === 'consultant') {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
                }
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => b.totalCount - a.totalCount); // Default desc total count
        }

        return result;
    }, [data, studentFilter, sortConfig, statsSubTab]);

    // Download handlers
    const handleDownloadMonthly = () => {
        if (statsData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(statsData.map(row => ({
            '년-월': row.month,
            '신청 횟수': row.count
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '월별 신청 건수');
        XLSX.writeFile(wb, `월별_컨설팅_신청_건수_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadFrequency = () => {
        if (frequencyData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(frequencyData.map(row => ({
            '년-월': row.month,
            '1회 이용자': row.count1,
            '2회 이용자': row.count2,
            '3회 이상 이용자': row.count3
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '학생별 월간 분포');
        XLSX.writeFile(wb, `학생별_월간_이용_분포_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadName = () => {
        if (nameFrequencyData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(nameFrequencyData.map(row => ({
            '이름': row.name,
            '학번': row.studentId,
            '대학': row.college,
            '학과': row.dept,
            '학년': row.grade,
            '이용 횟수': row.count
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '이름별 이용 횟수');
        XLSX.writeFile(wb, `이름별_컨설팅_이용_횟수_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadActual = () => {
        if (actualStatsData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(actualStatsData.map(row => ({
            '년-월': row.month,
            '실제 진행 건수': row.count,
            '불참/노쇼 건수': row.noShowCount
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '실제 진행 및 불참 건수');

        XLSX.writeFile(wb, `실제_진행_및_불참_건수_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadCollege = () => {
        if (collegeStatsData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(collegeStatsData.map(row => ({
            '단과대학': row.college,
            '컨설팅 횟수': row.count
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '단과대별 컨설팅 횟수');
        XLSX.writeFile(wb, `단과대별_컨설팅_횟수_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadConsultant = () => {
        if (consultantStatsData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(consultantStatsData.map(row => ({
            '컨설턴트': row.consultant,
            '전체 배정 건수': row.totalCount,
            '실제 진행 건수': row.actualCount,
            '불참/노쇼 건수': row.noShowCount
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '컨설턴트별 현황');
        XLSX.writeFile(wb, `컨설턴트별_현황_${new Date().toISOString().split('T')[0]}.xlsx`);
    };



    return (
        <div className="stats-container">
            <div className="stats-header-controls">
                <h3>컨설팅 통계</h3>
                <div className="filter-group">
                    <label className="radio-label">
                        <input
                            type="radio"
                            name="studentFilter"
                            value="all"
                            checked={studentFilter === 'all'}
                            onChange={(e) => setStudentFilter(e.target.value)}
                        />
                        모두
                    </label>
                    <label className="radio-label">
                        <input
                            type="radio"
                            name="studentFilter"
                            value="undergrad"
                            checked={studentFilter === 'undergrad'}
                            onChange={(e) => setStudentFilter(e.target.value)}
                        />
                        대학생
                    </label>
                    <label className="radio-label">
                        <input
                            type="radio"
                            name="studentFilter"
                            value="grad"
                            checked={studentFilter === 'grad'}
                            onChange={(e) => setStudentFilter(e.target.value)}
                        />
                        대학원생
                    </label>
                </div>
            </div>

            {/* Sub-tabs for Stats */}
            <div className="content-tabs" style={{ marginTop: '1rem' }}>
                <button
                    className={`tab-btn ${statsSubTab === 'name' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('name'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    이름별 이용 횟수
                </button>
                <button
                    className={`tab-btn ${statsSubTab === 'frequency' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('frequency'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    학생별 월간 분포
                </button>
                <button
                    className={`tab-btn ${statsSubTab === 'monthly' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('monthly'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    월별 총 신청 건수
                </button>
                <button
                    className={`tab-btn ${statsSubTab === 'actual' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('actual'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    실제 진행 건수
                </button>
                <button
                    className={`tab-btn ${statsSubTab === 'college' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('college'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    단과대학교 컨설팅 횟수
                </button>
                <button
                    className={`tab-btn ${statsSubTab === 'consultant' ? 'active' : ''}`}
                    onClick={() => { setStatsSubTab('consultant'); setSortConfig({ key: null, direction: 'ascending' }); }}
                >
                    컨설턴트 내역
                </button>
            </div>

            {statsSubTab === 'name' && (
                <>
                    <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>이름별 컨설팅 이용 횟수</h4>
                    <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                        <div className="stats-name-grid-header">
                            <span onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>이름{getSortIndicator('name')}</span>
                            <span onClick={() => requestSort('studentId')} style={{ cursor: 'pointer' }}>학번{getSortIndicator('studentId')}</span>
                            <span onClick={() => requestSort('college')} style={{ cursor: 'pointer' }}>대학{getSortIndicator('college')}</span>
                            <span onClick={() => requestSort('dept')} style={{ cursor: 'pointer' }}>학과{getSortIndicator('dept')}</span>
                            <span onClick={() => requestSort('grade')} style={{ cursor: 'pointer' }}>학년{getSortIndicator('grade')}</span>
                            <span onClick={() => requestSort('count')} style={{ cursor: 'pointer' }}>이용 횟수{getSortIndicator('count')}</span>
                        </div>
                        {nameFrequencyData.length > 0 ? nameFrequencyData.map((row, idx) => (
                            <div key={`${row.name}-${idx}`} className="stats-name-grid-row">
                                <div className="col-center">{row.name}</div>
                                <div className="col-center">{row.studentId}</div>
                                <div className="col-center">{row.college}</div>
                                <div className="col-center">{row.dept}</div>
                                <div className="col-center">{row.grade}</div>
                                <div className="col-center">{row.count}회</div>
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없습니다.</p>
                            </div>
                        )}
                        {nameFrequencyData.length > 0 && (
                            <div className="stats-name-grid-footer">
                                <span>총 학생 수</span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span>{nameFrequencyData.length}명</span>
                            </div>
                        )}
                    </div>
                    <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="ewha-btn" onClick={handleDownloadName} disabled={nameFrequencyData.length === 0}>
                            <Download size={18} />
                            엑셀 다운로드
                        </button>
                    </div>
                </>
            )}

            {statsSubTab === 'frequency' && (
                <>
                    <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>학생별 월간 이용 횟수 분포 (중복 제외 학생 수)</h4>
                    <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                        <div className="stats-freq-grid-header">
                            <span onClick={() => requestSort('month')} style={{ cursor: 'pointer' }}>년-월{getSortIndicator('month')}</span>
                            <span onClick={() => requestSort('count1')} style={{ cursor: 'pointer' }}>1회 이용자{getSortIndicator('count1')}</span>
                            <span onClick={() => requestSort('count2')} style={{ cursor: 'pointer' }}>2회 이용자{getSortIndicator('count2')}</span>
                            <span onClick={() => requestSort('count3')} style={{ cursor: 'pointer' }}>3회 이상{getSortIndicator('count3')}</span>
                        </div>
                        {frequencyData.length > 0 ? frequencyData.map((row) => (
                            <div key={row.month} className="stats-freq-grid-row">
                                <div className="col-center">{row.month}</div>
                                <div className="col-center clickable-cell" onClick={() => handleFreqCellClick(row.month, 1)}>{row.count1}명</div>
                                <div className="col-center clickable-cell" onClick={() => handleFreqCellClick(row.month, 2)}>{row.count2}명</div>
                                <div className="col-center clickable-cell" onClick={() => handleFreqCellClick(row.month, 3)}>{row.count3}명</div>
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없습니다.</p>
                            </div>
                        )}
                        {frequencyData.length > 0 && (
                            <div className="stats-freq-grid-footer">
                                <span>합계</span>
                                <span>{frequencyData.reduce((sum, row) => sum + row.count1, 0)}명</span>
                                <span>{frequencyData.reduce((sum, row) => sum + row.count2, 0)}명</span>
                                <span>{frequencyData.reduce((sum, row) => sum + row.count3, 0)}명</span>
                            </div>
                        )}
                    </div>
                    <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="ewha-btn" onClick={handleDownloadFrequency} disabled={frequencyData.length === 0}>
                            <Download size={18} />
                            엑셀 다운로드
                        </button>
                    </div>
                </>
            )}

            {statsSubTab === 'monthly' && (
                <>
                    <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>월별 총 신청 건수</h4>
                    <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                        <div className="stats-grid-header">
                            <span onClick={() => requestSort('month')} style={{ cursor: 'pointer' }}>년-월{getSortIndicator('month')}</span>
                            <span onClick={() => requestSort('count')} style={{ cursor: 'pointer' }}>신청 횟수{getSortIndicator('count')}</span>
                        </div>
                        {statsData.length > 0 ? statsData.map((row) => (
                            <div key={row.month} className="stats-grid-row">
                                <div className="col-center">{row.month}</div>
                                <div className="col-center">{row.count}건</div>
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없거나 조건에 맞는 내역이 없습니다.</p>
                            </div>
                        )}
                        {statsData.length > 0 && (
                            <div className="stats-grid-footer">
                                <span>합계</span>
                                <span>{statsData.reduce((sum, row) => sum + row.count, 0)}건</span>
                            </div>
                        )}
                    </div>
                    <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="ewha-btn" onClick={handleDownloadMonthly} disabled={statsData.length === 0}>
                            <Download size={18} />
                            엑셀 다운로드
                        </button>
                    </div>
                </>
            )}

            {
                statsSubTab === 'actual' && (
                    <>
                        <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>실제 진행 및 불참/노쇼 현황 (컨설팅일자 기준)</h4>
                        <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                            <div className="stats-freq-grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                <span onClick={() => requestSort('month')} style={{ cursor: 'pointer' }}>년-월{getSortIndicator('month')}</span>
                                <span onClick={() => requestSort('count')} style={{ cursor: 'pointer' }}>실제 진행 건수{getSortIndicator('count')}</span>
                                <span onClick={() => requestSort('noShowCount')} style={{ cursor: 'pointer' }}>불참/노쇼 건수{getSortIndicator('noShowCount')}</span>
                            </div>
                            {actualStatsData.length > 0 ? actualStatsData.map((row) => (
                                <div key={row.month} className="stats-freq-grid-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div className="col-center">{row.month}</div>
                                    <div className="col-center clickable-cell" onClick={() => handleActualStatsClick(row.month, 'actual')}>{row.count}건</div>
                                    <div className="col-center clickable-cell" style={{ color: '#e74c3c' }} onClick={() => handleActualStatsClick(row.month, 'noShow')}>{row.noShowCount}건</div>
                                </div>
                            )) : (
                                <div className="no-data">
                                    <p>데이터가 없습니다.</p>
                                </div>
                            )}
                            {actualStatsData.length > 0 && (
                                <div className="stats-freq-grid-footer" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <span>합계</span>
                                    <span>{actualStatsData.reduce((sum, row) => sum + row.count, 0)}건</span>
                                    <span>{actualStatsData.reduce((sum, row) => sum + row.noShowCount, 0)}건</span>
                                </div>
                            )}
                        </div>
                        <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="ewha-btn" onClick={handleDownloadActual} disabled={actualStatsData.length === 0}>
                                <Download size={18} />
                                컨설팅일자 기준 엑셀 다운로드
                            </button>
                        </div>


                    </>
                )
            }

            {statsSubTab === 'college' && (
                <>
                    <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>단과대학교 컨설팅 횟수</h4>
                    <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                        <div className="stats-grid-header">
                            <span onClick={() => requestSort('college')} style={{ cursor: 'pointer' }}>단과대학{getSortIndicator('college')}</span>
                            <span onClick={() => requestSort('count')} style={{ cursor: 'pointer' }}>컨설팅 횟수{getSortIndicator('count')}</span>
                        </div>
                        {collegeStatsData.length > 0 ? collegeStatsData.map((row, idx) => (
                            <div key={idx} className="stats-grid-row">
                                <div className="col-center">{row.college}</div>
                                <div className="col-center">{row.count}회</div>
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없습니다.</p>
                            </div>
                        )}
                        {collegeStatsData.length > 0 && (
                            <div className="stats-grid-footer">
                                <span>합계</span>
                                <span>{collegeStatsData.reduce((sum, row) => sum + row.count, 0)}회</span>
                            </div>
                        )}
                    </div>
                    <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="ewha-btn" onClick={handleDownloadCollege} disabled={collegeStatsData.length === 0}>
                            <Download size={18} />
                            엑셀 다운로드
                        </button>
                    </div>
                </>
            )}

            {statsSubTab === 'consultant' && (
                <>
                    <h4 style={{ padding: '0 1rem', marginTop: '1.5rem', color: '#666' }}>컨설턴트별 진행 내역</h4>
                    <div className="grid-wrapper" style={{ overflowX: 'auto' }}>
                        <div className="stats-grid-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                            <span onClick={() => requestSort('consultant')} style={{ cursor: 'pointer' }}>컨설턴트{getSortIndicator('consultant')}</span>
                            <span onClick={() => requestSort('totalCount')} style={{ cursor: 'pointer' }}>전체 배정{getSortIndicator('totalCount')}</span>
                            <span onClick={() => requestSort('actualCount')} style={{ cursor: 'pointer' }}>실제 진행{getSortIndicator('actualCount')}</span>
                            <span onClick={() => requestSort('noShowCount')} style={{ cursor: 'pointer' }}>불참/노쇼{getSortIndicator('noShowCount')}</span>
                        </div>
                        {consultantStatsData.length > 0 ? consultantStatsData.map((row, idx) => (
                            <div key={idx} className="stats-grid-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                <div className="col-center">{row.consultant}</div>
                                <div className="col-center clickable-cell" onClick={() => handleConsultantStatsClick(row.consultant, 'total')}>{row.totalCount}건</div>
                                <div className="col-center clickable-cell" onClick={() => handleConsultantStatsClick(row.consultant, 'actual')}>{row.actualCount}건</div>
                                <div className="col-center clickable-cell" style={{ color: row.noShowCount > 0 ? '#e74c3c' : 'inherit' }} onClick={() => handleConsultantStatsClick(row.consultant, 'noShow')}>{row.noShowCount}건</div>
                            </div>
                        )) : (
                            <div className="no-data">
                                <p>데이터가 없습니다.</p>
                            </div>
                        )}
                        {consultantStatsData.length > 0 && (
                            <div className="stats-grid-footer" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                <span>합계</span>
                                <span>{consultantStatsData.reduce((sum, row) => sum + row.totalCount, 0)}건</span>
                                <span>{consultantStatsData.reduce((sum, row) => sum + row.actualCount, 0)}건</span>
                                <span>{consultantStatsData.reduce((sum, row) => sum + row.noShowCount, 0)}건</span>
                            </div>
                        )}
                    </div>
                    <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="ewha-btn" onClick={handleDownloadConsultant} disabled={consultantStatsData.length === 0}>
                            <Download size={18} />
                            엑셀 다운로드
                        </button>
                    </div>
                </>
            )}

            {
                modalConfig.show && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{modalConfig.title}</h3>
                                <button className="modal-close" onClick={closeModal}><X size={24} /></button>
                            </div>
                            <div className="grid-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <div className={`stats-name-grid-header ${modalConfig.type === 'noShow' ? 'stats-penalty-grid-header' : ''}`}
                                    style={
                                        modalConfig.type === 'noShow' ? { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.5fr 2fr' } :
                                            (modalConfig.type === 'actual' || modalConfig.type === 'total' || modalConfig.type === 'frequency') ? { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.5fr' } :
                                                { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }
                                    }>
                                    <span>이름</span>
                                    <span>학번</span>
                                    <span>대학</span>
                                    <span>학과</span>
                                    <span>학년</span>
                                    <span>이용 횟수</span>
                                    {(modalConfig.type === 'noShow' || modalConfig.type === 'actual' || modalConfig.type === 'total' || modalConfig.type === 'frequency') && <span>신청일</span>}
                                    {modalConfig.type === 'noShow' && <span>신청제한 기간</span>}
                                </div>
                                {modalConfig.data.length > 0 ? modalConfig.data.map((row, idx) => (
                                    <div key={idx} className={`stats-name-grid-row ${modalConfig.type === 'noShow' ? 'stats-penalty-grid-row' : ''}`}
                                        style={
                                            modalConfig.type === 'noShow' ? { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.5fr 2fr' } :
                                                (modalConfig.type === 'actual' || modalConfig.type === 'total' || modalConfig.type === 'frequency') ? { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.5fr' } :
                                                    { gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }
                                        }>
                                        <div className="col-center">{row.name}</div>
                                        <div className="col-center">{row.studentId}</div>
                                        <div className="col-center">{row.college}</div>
                                        <div className="col-center">{row.dept}</div>
                                        <div className="col-center">{row.grade}</div>
                                        <div className="col-center">{row.count}회</div>
                                        {(modalConfig.type === 'noShow' || modalConfig.type === 'actual' || modalConfig.type === 'total' || modalConfig.type === 'frequency') && <div className="col-center">{row.date}</div>}
                                        {modalConfig.type === 'noShow' && <div className="col-center" style={{ color: '#e74c3c', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{row.penalty}</div>}
                                    </div>
                                )) : (
                                    <div className="no-data"><p>데이터가 없습니다.</p></div>
                                )}
                            </div>
                            <div className="button-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="ewha-btn" onClick={handleDownloadModalData}>
                                    <Download size={18} />
                                    엑셀 다운로드
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};



export default EwhaGrid;
