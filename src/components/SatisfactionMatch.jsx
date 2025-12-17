import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import './SatisfactionMatch.css';

const SatisfactionMatch = () => {
    const [referenceFile, setReferenceFile] = useState(null);
    const [studentFile, setStudentFile] = useState(null);
    const [comparisonData, setComparisonData] = useState([]);
    const [isDraggingRef, setIsDraggingRef] = useState(false);
    const [isDraggingStudent, setIsDraggingStudent] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'match', 'mismatch'

    const refInputRef = useRef(null);
    const studentInputRef = useRef(null);

    // Helper to read Excel file
    const readExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
                    resolve({ data: jsonData, columns: Object.keys(jsonData[0] || {}) });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    };

    const validateFileType = (columns, expectedType) => {
        if (expectedType === 'reference') {
            // Reference file should have columns like "번호", "컨설팅일자", etc.
            return columns.some(col => col.includes('번호') || col.includes('컨설팅일자'));
        } else {
            // Student file should have columns like "학번", "전공", etc.
            return columns.some(col => col.includes('학번') || col.includes('전공'));
        }
    };

    // Normalize keys to handle variations in column names
    const normalizeRecord = (record) => {
        const normalized = {};
        Object.keys(record).forEach(key => {
            const cleanKey = key.trim();
            if (cleanKey.includes('이름')) normalized.name = record[key];
            if (cleanKey.includes('학번')) normalized.studentId = String(record[key]);
            if (cleanKey.includes('상담분류') || cleanKey.includes('상담구분')) normalized.type = record[key];
            if (cleanKey.includes('상담일자') || cleanKey.includes('컨설팅일자')) normalized.date = record[key];
            if (cleanKey.includes('상담사')) normalized.counselor = record[key];
        });
        return normalized;
    };

    const normalizeName = (name) => {
        if (!name) return '';
        // Remove all special characters and spaces, keep only Korean and alphanumeric
        return name.replace(/[^\w\uAC00-\uD7A3]/g, '');
    };

    const normalizeCounselorName = (name) => {
        if (!name) return '';
        return name.replace(/\s+/g, '').replace(/선생님/g, '').replace(/상담사/g, '').trim();
    };

    const checkTypeMatch = (type1, type2) => {
        if (!type1 || !type2) return false;

        // Remove spaces and normalize
        const t1 = type1.replace(/\s+/g, '');
        const t2 = type2.replace(/\s+/g, '');

        // Direct match or substring match
        if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) return true;

        // Extract words (split by common delimiters like -, (, ), etc.)
        const extractWords = (str) => {
            return str.split(/[-()]/g)
                .filter(s => s.length > 0)
                .map(s => s.trim())
                .sort()
                .join('');
        };

        // Compare normalized word sets
        const words1 = extractWords(t1);
        const words2 = extractWords(t2);

        return words1 === words2;
    };

    const handleFileDrop = async (e, type) => {
        e.preventDefault();
        if (type === 'reference') setIsDraggingRef(false);
        else setIsDraggingStudent(false);

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            if (type === 'reference') {
                setReferenceFile(file);
                if (studentFile) compareFiles(file, studentFile);
            } else {
                setStudentFile(file);
                if (referenceFile) compareFiles(referenceFile, file);
            }
        }
    };

    const compareFiles = async (refFile, studFile) => {
        try {
            const [refResult, studResult] = await Promise.all([
                readExcel(refFile),
                readExcel(studFile)
            ]);

            // Validate files
            if (!validateFileType(refResult.columns, 'reference')) {
                alert('기준 데이터 파일이 올바르지 않습니다. 실제 컨설팅 데이터 파일을 업로드해주세요.');
                setReferenceFile(null);
                if (refInputRef.current) refInputRef.current.value = '';
                return;
            }

            if (!validateFileType(studResult.columns, 'student')) {
                alert('학생 응답 데이터 파일이 올바르지 않습니다. 만족도 조사 응답 파일을 업로드해주세요.');
                setStudentFile(null);
                if (studentInputRef.current) studentInputRef.current.value = '';
                return;
            }

            const refDataRaw = refResult.data;
            const studDataRaw = studResult.data;

            // Normalize and process comparison
            const refMap = new Map(); // Key: Name+StudentId (if available) or just Name+Date?
            // Strategy: Create a robust key. Name is unreliable alone.
            // Data usually has Name, StudentId. Let's assume Name + StudentId is unique enough for students.
            // Reference data might be the 'master' list of what actually happened.

            refDataRaw.forEach(row => {
                const norm = normalizeRecord(row);
                if (norm.name) {
                    // Use composite key: normalized name + student ID for better matching
                    const nameKey = normalizeName(norm.name);
                    const studentIdKey = normalizeName(norm.studentId || ''); // Also normalize student ID
                    const compositeKey = `${nameKey}|${studentIdKey}`;

                    if (!refMap.has(compositeKey)) refMap.set(compositeKey, []);
                    refMap.get(compositeKey).push(norm);
                }
            });

            const results = studDataRaw.map(row => {
                const studentRecord = normalizeRecord(row);
                if (!studentRecord.name) return null;

                // Try composite key first (name + student ID)
                const nameKey = normalizeName(studentRecord.name);
                const studentIdKey = normalizeName(studentRecord.studentId || ''); // Also normalize student ID
                const compositeKey = `${nameKey}|${studentIdKey}`;

                const potentialMatches = refMap.get(compositeKey) || [];

                // Only proceed if we found a match with the exact name + student ID combination
                if (potentialMatches.length === 0) return null;

                // Find the best match among potential records for this student name
                // Priority: Match Date & Counselor & Type
                let bestMatch = null;
                let matchScore = -1;

                potentialMatches.forEach(refRecord => {
                    let score = 0;
                    if (refRecord.date && studentRecord.date && refRecord.date.includes(studentRecord.date)) score += 3; // Date match

                    const normRefCounselor = normalizeCounselorName(refRecord.counselor);
                    const normStudCounselor = normalizeCounselorName(studentRecord.counselor);

                    if (normRefCounselor && normStudCounselor && normRefCounselor === normStudCounselor) score += 2;
                    if (checkTypeMatch(refRecord.type, studentRecord.type)) score += 1;

                    if (score > matchScore) {
                        matchScore = score;
                        bestMatch = refRecord;
                    }
                });

                // Determine status
                const normRefCounselor = bestMatch ? normalizeCounselorName(bestMatch.counselor) : '';
                const normStudCounselor = normalizeCounselorName(studentRecord.counselor);

                const isMatch = bestMatch &&
                    (bestMatch.date && studentRecord.date && bestMatch.date.includes(studentRecord.date)) &&
                    (normRefCounselor === normStudCounselor) &&
                    checkTypeMatch(bestMatch.type, studentRecord.type);

                return {
                    student: studentRecord,
                    reference: bestMatch || {},
                    status: isMatch ? 'MATCH' : 'MISMATCH',
                    matchDetails: {
                        date: bestMatch && (bestMatch.date && studentRecord.date && bestMatch.date.includes(studentRecord.date)),
                        counselor: bestMatch && normalizeCounselorName(bestMatch.counselor) === normalizeCounselorName(studentRecord.counselor),
                        type: bestMatch && checkTypeMatch(bestMatch.type, studentRecord.type)
                    }
                };
            }).filter(Boolean);

            setComparisonData(results);

        } catch (error) {
            console.error("Error processing files:", error);
            alert("파일 처리 중 오류가 발생했습니다.");
        }
    };

    const handleZoneClick = (type) => {
        if (type === 'reference') {
            refInputRef.current?.click();
        } else {
            studentInputRef.current?.click();
        }
    };

    const handleFileInputChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (type === 'reference') {
                setReferenceFile(file);
                if (studentFile) compareFiles(file, studentFile);
            } else {
                setStudentFile(file);
                if (referenceFile) compareFiles(referenceFile, file);
            }
        }
        // Reset input value so same file can be selected again if needed
        e.target.value = '';
    };

    const handleDownload = () => {
        if (comparisonData.length === 0) return;

        const exportData = comparisonData.map(row => ({
            '상태': row.status === 'MATCH' ? '일치' : '불일치',
            '이름': row.student.name,
            '학번 (응답)': row.student.studentId,
            '상담분류 (응답)': row.student.type,
            '상담분류 (실제)': row.matchDetails.type ? row.student.type : (row.reference.type || '없음'),
            '상담일자 (응답)': row.student.date,
            '상담일자 (실제)': row.matchDetails.date ? row.student.date : (row.reference.date || '없음'),
            '상담사 (응답)': row.student.counselor,
            '상담사 (실제)': row.matchDetails.counselor ? row.student.counselor : (row.reference.counselor || '없음'),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "일치여부 결과");
        XLSX.writeFile(wb, "만족도_일치여부_결과.xlsx");
    };

    const handleReset = () => {
        setReferenceFile(null);
        setStudentFile(null);
        setComparisonData([]);
        setSortConfig({ key: null, direction: 'asc' });
        if (refInputRef.current) refInputRef.current.value = '';
        if (studentInputRef.current) studentInputRef.current.value = '';
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = () => {
        if (!sortConfig.key) return comparisonData;

        return [...comparisonData].sort((a, b) => {
            let aValue, bValue;

            if (sortConfig.key === 'status') {
                aValue = a.status;
                bValue = b.status;
            } else if (sortConfig.key === 'name') {
                aValue = a.student.name;
                bValue = b.student.name;
            } else if (sortConfig.key === 'studentId') {
                aValue = a.student.studentId;
                bValue = b.student.studentId;
            } else if (sortConfig.key === 'type') {
                aValue = a.student.type;
                bValue = b.student.type;
            } else if (sortConfig.key === 'date') {
                aValue = a.student.date;
                bValue = b.student.date;
            } else if (sortConfig.key === 'counselor') {
                aValue = a.student.counselor;
                bValue = b.student.counselor;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleFilterChange = (filterType) => {
        setStatusFilter(filterType);
    };

    const getFilteredData = () => {
        const sortedData = getSortedData();
        if (statusFilter === 'all') return sortedData;
        if (statusFilter === 'match') return sortedData.filter(row => row.status === 'MATCH');
        if (statusFilter === 'mismatch') return sortedData.filter(row => row.status === 'MISMATCH');
        return sortedData;
    };

    return (
        <div className="satisfaction-match-container">
            <div className="upload-section">
                {/* Reference File Zone (Right -> Actually Left in UI request "Left and Right") */}
                <div
                    className={`drop-zone ${isDraggingRef ? 'drag-active' : ''}`}
                    onClick={() => handleZoneClick('reference')}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
                    onDragLeave={() => setIsDraggingRef(false)}
                    onDrop={(e) => handleFileDrop(e, 'reference')}
                >
                    <Upload size={32} className="upload-icon" />
                    <span className="zone-title">기준 데이터 (실제 컨설팅)</span>
                    <span className="zone-desc">엑셀 파일을 드래그하여 업로드하세요</span>
                    {referenceFile && (
                        <div className="file-info">
                            <FileText size={16} />
                            {referenceFile.name}
                        </div>
                    )}
                    <input
                        type="file"
                        ref={refInputRef}
                        onChange={(e) => handleFileInputChange(e, 'reference')}
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                </div>

                {/* Student File Zone */}
                <div
                    className={`drop-zone ${isDraggingStudent ? 'drag-active' : ''}`}
                    onClick={() => handleZoneClick('student')}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingStudent(true); }}
                    onDragLeave={() => setIsDraggingStudent(false)}
                    onDrop={(e) => handleFileDrop(e, 'student')}
                >
                    <Upload size={32} className="upload-icon" />
                    <span className="zone-title">학생 응답 데이터 (만족도 조사)</span>
                    <span className="zone-desc">엑셀 파일을 드래그하여 업로드하세요</span>
                    {studentFile && (
                        <div className="file-info">
                            <FileText size={16} />
                            {studentFile.name}
                        </div>
                    )}
                    <input
                        type="file"
                        ref={studentInputRef}
                        onChange={(e) => handleFileInputChange(e, 'student')}
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

            <div className="comparison-results">
                <div className="results-header">
                    <h2 className="results-title">대조 결과 (기준: 이름 + 학번)</h2>
                    {comparisonData.length > 0 && (
                        <div className="stats-summary">
                            <span className="stat-item">전체: <strong>{comparisonData.length}</strong></span>
                            <span className="stat-item">일치: <strong>{comparisonData.filter(d => d.status === 'MATCH').length}</strong></span>
                            <span className="stat-item">불일치: <strong>{comparisonData.filter(d => d.status === 'MISMATCH').length}</strong></span>
                            <div className="filter-checkboxes">
                                <label className="filter-checkbox">
                                    <input
                                        type="radio"
                                        name="statusFilter"
                                        checked={statusFilter === 'all'}
                                        onChange={() => handleFilterChange('all')}
                                    />
                                    모두
                                </label>
                                <label className="filter-checkbox">
                                    <input
                                        type="radio"
                                        name="statusFilter"
                                        checked={statusFilter === 'match'}
                                        onChange={() => handleFilterChange('match')}
                                    />
                                    일치
                                </label>
                                <label className="filter-checkbox">
                                    <input
                                        type="radio"
                                        name="statusFilter"
                                        checked={statusFilter === 'mismatch'}
                                        onChange={() => handleFilterChange('mismatch')}
                                    />
                                    불일치
                                </label>
                            </div>
                            <button className="reset-btn" onClick={handleReset}>
                                <RotateCcw size={18} />
                                초기화
                            </button>
                            <button className="download-btn" onClick={handleDownload}>
                                <Download size={18} />
                                엑셀 다운로드
                            </button>
                        </div>
                    )}
                </div>

                <div className="table-container">
                    {comparisonData.length > 0 ? (
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th className="sortable" onClick={() => handleSort('status')}>
                                        상태
                                        {sortConfig.key === 'status' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('name')}>
                                        이름
                                        {sortConfig.key === 'name' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('studentId')}>
                                        학번 (응답)
                                        {sortConfig.key === 'studentId' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('type')}>
                                        상담분류 (응답/실제)
                                        {sortConfig.key === 'type' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('date')}>
                                        상담일자 (응답/실제)
                                        {sortConfig.key === 'date' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('counselor')}>
                                        상담사 (응답/실제)
                                        {sortConfig.key === 'counselor' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {getFilteredData().map((row, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className={`status-badge ${row.status === 'MATCH' ? 'status-match' : 'status-mismatch'}`}>
                                                {row.status === 'MATCH' ? '일치' : '불일치'}
                                            </span>
                                        </td>
                                        <td>{row.student.name}</td>
                                        <td>{row.student.studentId}</td>

                                        <td className={!row.matchDetails.type ? 'mismatch-cell' : ''}>
                                            {row.student.type}
                                            {row.reference.type && row.student.type !== row.reference.type && (
                                                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                                    (실제: {row.reference.type})
                                                </div>
                                            )}
                                        </td>

                                        <td className={!row.matchDetails.date ? 'mismatch-cell' : ''}>
                                            {row.student.date}
                                            {row.reference.date && !row.matchDetails.date && (
                                                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                                    (실제: {row.reference.date})
                                                </div>
                                            )}
                                        </td>

                                        <td className={!row.matchDetails.counselor ? 'mismatch-cell' : ''}>
                                            {row.student.counselor}
                                            {row.reference.counselor && row.student.counselor !== row.reference.counselor && (
                                                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                                    (실제: {row.reference.counselor})
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <AlertTriangle size={48} />
                            <p>두 파일을 모두 업로드하면 대조 결과가 여기에 표시됩니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SatisfactionMatch;
