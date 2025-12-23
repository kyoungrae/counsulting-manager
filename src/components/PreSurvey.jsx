import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { Upload, Download, FileText, Trash2, List } from 'lucide-react';
import './EwhaGrid.css';

const PreSurvey = () => {
    const [surveyData, setSurveyData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'preview'
    const fileInputRef = useRef(null);

    // --- Parsing Logic ---
    const parseDocx = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value;
            // Basic HTML parsing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            const extracted = {
                fileName: file.name,
                originalHtml: html, // Store original HTML for preview
                consultDate: '', // Heuristic extraction if possible
                college: '',
                dept: '',
                studentId: '',
                name: '',
                // Q1
                q1_1: '', q1_2: '', q1_3: '', q1_4: '', q1_5: '',
                // Q2
                q2_1_1: '', q2_1_2: '', q2_1_3: '', q2_1_4: '',
                q2_2_1: '', q2_2_2: '',
                q2_3_1: '', q2_3_2: '',
                q2_4_1: '', q2_4_2: '', q2_4_3: '',
                q2_5_1: '', q2_5_2: '', q2_5_3: '',
                q2_6_1: '', q2_6_2: '', q2_6_3: '', q2_6_4: '',
                q2_7_1: '', q2_7_3: '', // q2_7_2 removed
                q2_8: '', // Other
                // Q3 (1-26 mapped)
                // Q4 (1-14 mapped)
                // Q5 (1-4 text)
                q5_1: '', q5_2: '', q5_3: '', q5_4: '',
                // Q6
                q6: ''
            };

            // Initialize Q3 and Q4 dynamic keys
            for (let i = 1; i <= 26; i++) extracted[`q3_${i}`] = '';
            for (let i = 1; i <= 14; i++) extracted[`q4_${i}`] = '';

            // Enhanced check detection
            const isChecked = (text) => {
                if (!text) return false;
                const t = text.trim(); // Case sensitive might be needed for 'V' vs 'v'
                return t.includes('V') || t.includes('v') || t.includes('☑') || t.includes('■') || (t.toLowerCase().includes('check'));
            };
            // Strategy: Iterate over ALL potential content blocks (rows, paragraphs, list items)
            // This handles Q1 (Table) and Q2 (Likely Text/List in Docx)
            const contentNodes = tempDiv.querySelectorAll('tr, p, li');

            contentNodes.forEach(node => {
                let cells = [];
                let fullText = '';

                if (node.tagName.toLowerCase() === 'tr') {
                    cells = Array.from(node.querySelectorAll('td')).map(td => td.innerText.trim());
                    fullText = cells.join(' ');
                } else {
                    // Paragraph or List Item
                    const text = node.innerText.trim();
                    cells = [text]; // Treat as single cell
                    fullText = text;
                }

                if (!fullText) return;

                // --- Helper: Check row for mark (Q1 specfic table structure: Mark in separate column) ---
                const checkRowForMark = () => {
                    return cells.some(cell => {
                        const t = cell.trim();
                        // Strict separate checkmark
                        return /^(V|v|■|☑|check)$/i.test(t) || t.includes('■') || t.includes('☑');
                    });
                };

                // --- Helper: Check keyword (Negative Logic - "Exclude Unchecked") ---
                // The document format ALWAYS has a box next to these keywords.
                // 1. If keyword is NOT present -> irrelevant.
                // 2. If keyword IS present:
                //    - Scan for an adjacent "Empty Box" (□).
                //    - If Found -> It is UNCHECKED (do nothing).
                //    - If NOT Found -> It implies the box is filled (■) or changed (V) -> CHECKED (1).
                const checkKeyword = (keyword, targetField) => {
                    if (!fullText.includes(keyword)) return;

                    // Find the position of the keyword in the text
                    const keywordIndex = fullText.indexOf(keyword);
                    if (keywordIndex === -1) return;

                    // Extract surrounding text (20 chars before and after the keyword)
                    const start = Math.max(0, keywordIndex - 20);
                    const end = Math.min(fullText.length, keywordIndex + keyword.length + 20);
                    const surroundingText = fullText.substring(start, end);

                    // Check for unchecked box symbols in the surrounding text
                    const hasUncheckedBox = /[□\u25A1\u2610]/.test(surroundingText);

                    // Check for checked box symbols in the surrounding text
                    const hasCheckedBox = /[▣■☑\u25A3\u25A0\u2611]/.test(surroundingText);

                    if (hasUncheckedBox && !hasCheckedBox) {
                        // Only unchecked box found -> Unchecked
                        return;
                    } else if (hasCheckedBox) {
                        // Checked box found -> Checked
                        extracted[targetField] = '1';
                    } else if (!hasUncheckedBox && !hasCheckedBox) {
                        // No box found at all - might be a different format
                        // Don't mark as checked to be safe
                        return;
                    }
                };

                // --- Student Info ---
                if (node.tagName.toLowerCase() === 'tr') { // Usually Info is in a table
                    cells.forEach((cell, idx) => {
                        if (cell.includes('일시') || cell.includes('일자')) extracted.consultDate = cells[idx + 1] || extracted.consultDate;
                        if (cell.includes('단과대학')) extracted.college = cells[idx + 1] || extracted.college;
                        if (cell.includes('학과') || cell.includes('전공')) extracted.dept = cells[idx + 1] || extracted.dept;
                        if (cell.includes('학번')) extracted.studentId = cells[idx + 1] || extracted.studentId;
                        if (cell.includes('이름') || cell.includes('성명')) extracted.name = cells[idx + 1] || extracted.name;
                    });
                } else if (fullText.includes('단과대학') && fullText.includes('이름')) {
                    // Fallback for text-based header info? unlikely but possible
                }

                // --- Q1 Reasons (Using Row Check logic primarily, but fallback to keyword check if inline) ---
                if (fullText.includes('자기탐색용')) {
                    if (checkRowForMark()) extracted.q1_1 = '1';
                }
                if (fullText.includes('진로선택용')) {
                    if (checkRowForMark()) extracted.q1_2 = '1';
                }
                if (fullText.includes('취업정보 수집용')) {
                    if (checkRowForMark()) extracted.q1_3 = '1';
                }
                if (fullText.includes('취업준비 전략용')) {
                    if (checkRowForMark()) extracted.q1_4 = '1';
                }

                // --- Q2 Experiences (Using Keyword/adjacency Check) ---
                // (1) College Life
                checkKeyword('학점 관리', 'q2_1_1');
                checkKeyword('인/적성검사', 'q2_1_2');
                checkKeyword('진로상담', 'q2_1_3');
                checkKeyword('선배 및 현직자 등 멘토링 참여', 'q2_1_4'); // Exact match

                // (2) Language
                checkKeyword('공인어학성적 취득 노력', 'q2_2_1');
                checkKeyword('어학 회화 능력 향상(제2외국어, 한자 등 포함)', 'q2_2_2');

                // (3) Certificates
                checkKeyword('컴퓨터 관련 자격증 취득 or 노력', 'q2_3_1');
                checkKeyword('업무(직무) 관련 자격증 취득 or 노력', 'q2_3_2');

                // (4) Work Experience
                checkKeyword('현장실습 및 인턴', 'q2_4_1');
                checkKeyword('아르바이트', 'q2_4_2');
                checkKeyword('봉사활동', 'q2_4_3');

                // (5) Global
                checkKeyword('어학연수', 'q2_5_1');
                checkKeyword('교환학생', 'q2_5_2');
                checkKeyword('해외인턴십', 'q2_5_3');

                // (6) Autonomous
                checkKeyword('교내.외 동아리', 'q2_6_1');
                checkKeyword('봉사활동', 'q2_6_2');
                checkKeyword('학생회 활동', 'q2_6_3');
                checkKeyword('학회 활동', 'q2_6_4');

                // (7) Challenge
                // Note: Image shows "공모전 - 연구 및 학회참석, 포스터로 학회참석", "경진대회"
                // User previously requested to remove Research/Thesis column, so we map "공모전..." to just Contest (q2_7_1)? 
                // Or "공모전" is q2_7_1 and "경진대회" is q2_7_3. 
                // Let's assume broad match for now.
                checkKeyword('공모전', 'q2_7_1');
                checkKeyword('경진대회', 'q2_7_3');

                // (8) Other Text
                // Logic: Find row starting with (8) and extract text below it or in it.
                // The image shows text listed below as "1. ... 2. ..."
                // Heuristic: If we are in the Q2 section, and see text that doesn't look like headers.
                if (fullText.includes('(8) 기타')) {
                    const idx = cells.findIndex(c => c.includes('(8) 기타'));
                    if (idx !== -1 && idx < cells.length - 1) {
                        // If the text is in the next cell
                        extracted.q2_8 = cells[idx + 1];
                    } else if (idx !== -1) {
                        // If the text is in the same cell after "(8) 기타"
                        const remainingText = cells[idx].substring(cells[idx].indexOf('(8) 기타') + '(8) 기타'.length).trim();
                        if (remainingText) extracted.q2_8 = remainingText;
                    }
                }

                // Q4 Work Values (1-14)
                checkKeyword('급여', 'q4_1');
                checkKeyword('승진기회', 'q4_2');
                checkKeyword('근무환경', 'q4_3');
                checkKeyword('근무시간', 'q4_4');
                checkKeyword('업무량', 'q4_5');
                checkKeyword('업무 난이도', 'q4_6');
                checkKeyword('적은 스트레스', 'q4_7');
                checkKeyword('전공과의 연관성', 'q4_8');
                checkKeyword('나의 비전 및 가치관과의 부합성', 'q4_9'); // Vision/Values
                checkKeyword('적성과 흥미', 'q4_10');
                checkKeyword('기업브랜드', 'q4_11');
                checkKeyword('미래전망', 'q4_12');
                checkKeyword('취업 및 이직 용이성', 'q4_13'); // Charm?
                checkKeyword('매력적인 느낌', 'q4_14');

                // Q5 & Q6 Text Extraction
                // Heuristic: Look for cell content after the label.
                const findTextAfter = (label) => {
                    const idx = cells.findIndex(c => c.includes(label));
                    if (idx !== -1 && idx < cells.length - 1) return cells[idx + 1]; // Next cell
                    // Or string split if in same cell? Hard with simple text.
                    return '';
                };

                if (fullText.includes('언제')) extracted.q5_1 = findTextAfter('언제') || extracted.q5_1;
                if (fullText.includes('어디서')) extracted.q5_2 = findTextAfter('어디서') || extracted.q5_2;
                if (fullText.includes('역할')) extracted.q5_3 = findTextAfter('역할') || extracted.q5_3;
                if (fullText.includes('무엇을')) extracted.q5_4 = findTextAfter('무엇을') || extracted.q5_4; // '무엇을/어떻게'

                if (fullText.includes('기대하는 점')) extracted.q6 = findTextAfter('기대하는 점') || extracted.q6;
            });

            // --- Q3 Parsing: Category-based approach ---
            // Find all <p> tags that contain Q3 categories
            const allParagraphs = tempDiv.querySelectorAll('p');

            // Helper function to check items within a specific paragraph
            const checkItemsInParagraph = (paragraph, categoryPattern, itemsMap) => {
                const pText = paragraph.innerText || paragraph.textContent || '';

                // Check if this paragraph belongs to the target category
                if (!categoryPattern.test(pText)) return;

                // For each item in the map, check if it's checked in this paragraph
                Object.entries(itemsMap).forEach(([keyword, fieldName]) => {
                    // Check if keyword exists in this paragraph
                    if (!pText.includes(keyword)) return;

                    // Create regex to find the checkbox symbol before the keyword
                    const escaped = keyword.replace(/\s+/g, '\\s*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    // Look for unchecked box (□) adjacent to keyword
                    const uncheckedRegex = new RegExp(`[□\\u25A1\\u2610]\\s*${escaped}|${escaped}\\s*[□\\u25A1\\u2610]`, 'i');

                    // Look for checked box (▣, ■, ☑) adjacent to keyword
                    const checkedRegex = new RegExp(`[▣■☑\\u25A3\\u25A0\\u2611]\\s*${escaped}|${escaped}\\s*[▣■☑\\u25A3\\u25A0\\u2611]`, 'i');

                    if (checkedRegex.test(pText)) {
                        // Explicitly checked
                        extracted[fieldName] = '1';
                    } else if (!uncheckedRegex.test(pText)) {
                        // Keyword exists but no explicit checkbox found - assume checked
                        // This handles cases where the checkbox might be rendered differently
                        extracted[fieldName] = '1';
                    }
                    // If uncheckedRegex matches, we leave it as '' (unchecked)
                });
            };

            allParagraphs.forEach(p => {
                // 3-(1) Management Support (경영지원)
                checkItemsInParagraph(p, /\(1\)\s*경영지원/i, {
                    '인사': 'q3_1',
                    '교육': 'q3_2',
                    '재무/회계': 'q3_3',
                    '법무': 'q3_4',
                    '미디어/홍보': 'q3_5',
                    '비즈니스전략': 'q3_6',
                    '비즈니스 전략': 'q3_6' // Alternative spacing
                });

                // 3-(2) Marketing/Sales (마케팅/영업)
                checkItemsInParagraph(p, /\(2\)\s*마케팅.*영업/i, {
                    '마케팅': 'q3_7',
                    '영업': 'q3_8',
                    '데이터': 'q3_9'
                });

                // 3-(3) Logistics (물류)
                checkItemsInParagraph(p, /\(3\)\s*물류/i, {
                    '구매': 'q3_10',
                    '물류': 'q3_11',
                    'SCM': 'q3_12'
                });

                // 3-(4) Data (데이터) - Original category
                checkItemsInParagraph(p, /\(4\)\s*데이터/i, {
                    '기획 및 분석': 'q3_13',
                    '빅데이터': 'q3_14'
                });

                // 3-(5) Production/Quality (생산/품질)
                checkItemsInParagraph(p, /\(5\)\s*생산.*품질/i, {
                    '생산': 'q3_15',
                    '품질': 'q3_16'
                });

                // 3-(6) Research (연구)
                checkItemsInParagraph(p, /\(6\)\s*연구/i, {
                    '연구개발': 'q3_17',
                    '엔지니어링': 'q3_18',
                    '리서치': 'q3_19'
                });

                // 3-(7) IT
                checkItemsInParagraph(p, /\(7\)\s*IT/i, {
                    '서비스기획': 'q3_20',
                    '프론트/백앤드 개발': 'q3_21',
                    '정보보안': 'q3_22'
                });

                // 3-(8) Other (기타)
                checkItemsInParagraph(p, /\(8\)\s*기타/i, {
                    '디자인': 'q3_23',
                    '사업개발': 'q3_24',
                    '투자': 'q3_25'
                });
            });

            return extracted;
        } catch (error) {
            console.error(error);
            return null;
        }
    };

    const processFiles = async (files) => {
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        const newResults = [];

        for (const file of files) {
            if (file.name.endsWith('.docx')) {
                const data = await parseDocx(file);
                if (data) newResults.push(data);
            } else if (file.name.endsWith('.hwp')) {
                // Placeholder for HWP
                alert(`HWP parsing not fully supported yet in browser: ${file.name}`);
            }
        }

        setSurveyData(prev => [...prev, ...newResults]);
        setIsProcessing(false);
    }

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        processFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); };

    const handleClear = () => setSurveyData([]);

    // --- Excel Download ---
    const handleDownload = () => {
        if (surveyData.length === 0) return;

        // Map data to Excel structure
        const excelRows = surveyData.map((item, idx) => ({
            'No': idx + 1,
            '단과대학': item.college,
            '전공': item.dept,
            '학번': item.studentId,
            '이름': item.name,
            '1-(1) 자기탐색': item.q1_1,
            '1-(2) 진로선택': item.q1_2,
            '1-(3) 취업정보 수집용': item.q1_3,
            '1-(4) 취업준비 전략용': item.q1_4,
            '1-(5) 기타': item.q1_5,
            '2-(1) 학점관리': item.q2_1_1,
            '2-(1) 인/적성검사': item.q2_1_2,
            '2-(1) 진로상담': item.q2_1_3,
            '2-(1) 선배/현직자': item.q2_1_4,
            '2-(2) 공인어학성적': item.q2_2_1,
            '2-(2) 어학 회화': item.q2_2_2,
            '2-(3) 컴퓨터 자격증': item.q2_3_1,
            '2-(3) 직무 관련 자격증': item.q2_3_2,
            '2-(4) 현장실습/인턴': item.q2_4_1,
            '2-(4) 아르바이트': item.q2_4_2,
            '2-(4) 봉사활동': item.q2_4_3,
            '2-(5) 어학연수': item.q2_5_1,
            '2-(5) 교환학생': item.q2_5_2,
            '2-(5) 해외인턴십': item.q2_5_3,
            '2-(6) 동아리': item.q2_6_1,
            '2-(6) 봉사활동_자치': item.q2_6_2,
            '2-(6) 학생회': item.q2_6_3,
            '2-(6) 학회': item.q2_6_4,
            '2-(7) 공모전': item.q2_7_1,
            '2-(7) 연구/학회': item.q2_7_2,
            '2-(7) 경진대회': item.q2_7_3,
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelRows);

        // Auto-width (basic)
        const wscols = Object.keys(excelRows[0]).map(() => ({ wch: 15 }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "사전설문결과");
        XLSX.writeFile(wb, "사전설문_결과.xlsx");
    };

    return (
        <div className="ewha-container" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDragging && <div className="drag-overlay"><Upload size={48} /><p>파일을 놓아주세요</p></div>}

            <div className="ewha-header" style={{ position: 'relative' }}>
                <h1>사전 설문</h1>
                <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
                    <button className="ewha-btn outline danger" onClick={handleClear} disabled={surveyData.length === 0} style={{ padding: '0.4rem 1rem' }}>
                        <Trash2 size={16} style={{ marginRight: '6px' }} />
                        초기화
                    </button>
                </div>
            </div>

            <div className="content-tabs">
                <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                    <List size={16} style={{ marginRight: '6px' }} /> 설문 목록
                </button>
                <button className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
                    <FileText size={16} style={{ marginRight: '6px' }} /> 원본 문서 (미리보기)
                </button>
            </div>

            {activeTab === 'list' ? (
                <div className="pre-survey-table-container">
                    <table className="pre-survey-table">
                        <thead>
                            {/* Row 1: Group Headers */}
                            <tr>
                                <th rowSpan="2" style={{ minWidth: '50px' }}>No</th>
                                <th rowSpan="2" style={{ minWidth: '120px' }}>컨설팅 일자</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>단과대학</th>
                                <th rowSpan="2" style={{ minWidth: '120px' }}>전공</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>학번</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>이름</th>

                                {/* Q1 */}
                                <th>1-(1)</th>
                                <th>1-(2)</th>
                                <th>1-(3)</th>
                                <th>1-(4)</th>
                                <th>1-(5)</th>

                                {/* Q2 */}
                                <th colSpan="4">2-(1)<br />대학생활</th>
                                <th colSpan="2">2-(2)<br />어학능력</th>
                                <th colSpan="2">2-(3)<br />자격증</th>
                                <th colSpan="3">2-(4)<br />일경험</th>
                                <th colSpan="3">2-(5)<br />글로벌경험</th>
                                <th colSpan="4">2-(6)<br />자치활동</th>
                                <th colSpan="2">2-(7)<br />도전경험</th>
                                <th>2-(8)</th>

                                {/* Q3 */}
                                <th colSpan="6">3-(1)<br />경영지원</th>
                                <th colSpan="3">3-(2)<br />마케팅/영업</th>
                                <th colSpan="3">3-(3)<br />물류/구매</th>
                                <th colSpan="2">3-(4)<br />데이터</th>
                                <th colSpan="2">3-(5)<br />생산/품질</th>
                                <th colSpan="3">3-(6)<br />연구</th>
                                <th colSpan="3">3-(7)<br />IT</th>
                                <th colSpan="3">3-(8)<br />기타</th>
                                <th>3-(9)</th>

                                {/* Q4 */}
                                <th colSpan="4">4-(1)<br />근무조건</th>
                                <th colSpan="4">4-(2)<br />업무조건</th>
                                <th colSpan="3">4-(3)<br />가치관 기준</th>
                                <th colSpan="3">4-(4)<br />가치판단</th>

                                {/* Q5 */}
                                <th>5-(1)</th>
                                <th>5-(2)</th>
                                <th>5-(3)</th>
                                <th>5-(4)</th>

                                {/* Q6 */}
                                <th>6</th>
                            </tr>

                            {/* Row 2: Detailed Options */}
                            <tr>
                                {/* Q1 Sublabels */}
                                <th>자기탐색용</th><th>진로선택용</th><th>취업정보<br />수집용</th><th>취업준비<br />전략용</th><th>기타</th>

                                {/* Q2 */}
                                <th>학점관리</th><th>인/적성검사</th><th>진로상담</th><th>선배 및<br />현직자 멘토링</th>
                                <th>공인어학<br />성적</th><th>어학 회화<br />능력 향상</th>
                                <th>컴퓨터 관련</th><th>업무관련</th>
                                <th>현장실습<br />(인턴)</th><th>아르바이트</th><th>봉사활동</th>
                                <th>어학연수</th><th>교환학생</th><th>해외인턴십</th>
                                <th>교내외동아리</th><th>봉사활동</th><th>학생회활동</th><th>학회활동</th>
                                <th>공모전</th><th>경진대회</th>
                                <th>기타</th>

                                {/* Q3 */}
                                <th>인사</th><th>교육</th><th>재무/회계</th><th>법무</th><th>미디어/홍보</th><th>비즈니스전략</th>
                                <th>마케팅</th><th>영업</th><th>데이터</th>
                                <th>구매</th><th>물류</th><th>SCM</th>
                                <th>기획 및 분석</th><th>빅데이터</th>
                                <th>생산</th><th>품질</th>
                                <th>연구개발</th><th>엔지니어링</th><th>리서치</th>
                                <th>서비스기획</th><th>프론트/<br />백앤드개발</th><th>정보보안</th>
                                <th>디자인</th><th>사업개발</th><th>투자</th>
                                <th>기타</th>

                                {/* Q4 */}
                                <th>급여</th><th>승진기회</th><th>근무환경</th><th>근무시간</th>
                                <th>업무량</th><th>업무난이도</th><th>적은스트레스</th><th>전공연관성</th>
                                <th>비전/<br />가치관부합</th><th>적성과 흥미</th><th>기업브랜드</th>
                                <th>미래전망</th><th>취업 및 이직</th><th>매력</th>

                                {/* Q5 */}
                                <th>언제</th><th>어디서</th><th>역할</th><th>무엇을/<br />어떻게?</th>

                                {/* Q6 */}
                                <th>기대하는 점</th>
                            </tr>
                        </thead>
                        <tbody>
                            {surveyData.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="col-center">{idx + 1}</td>
                                    <td className="col-center">{item.consultDate || '-'}</td>
                                    <td className="col-center">{item.college}</td>
                                    <td className="col-center">{item.dept}</td>
                                    <td className="col-center">{item.studentId}</td>
                                    <td className="col-center">{item.name}</td>

                                    {/* Q1 */}
                                    <td className="col-center q-check">{item.q1_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q1_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q1_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q1_4 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q1_5 === '1' ? '1' : ''}</td>

                                    {/* Q2 */}
                                    <td className="col-center q-check">{item.q2_1_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_1_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_1_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_1_4 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_2_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_2_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_3_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_3_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_4_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_4_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_4_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_5_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_5_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_5_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_6_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_6_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_6_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_6_4 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_7_1 === '1' ? '1' : ''}</td>
                                    {/*Removed q2_7_2*/}
                                    <td className="col-center q-check">{item.q2_7_3 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_8 === '1' ? '1' : ''}</td>

                                    {/* Q3 (26 cols total) */}
                                    {[...Array(26)].map((_, i) => <td key={`q3-${i}`} className="col-center q-check">{item[`q3_${i + 1}`] === '1' ? '1' : ''}</td>)}

                                    {/* Q4 (14 cols total) */}
                                    {[...Array(14)].map((_, i) => <td key={`q4-${i}`} className="col-center q-check">{item[`q4_${i + 1}`] === '1' ? '1' : ''}</td>)}

                                    {/* Q5 */}
                                    <td className="col-center">{item.q5_1}</td>
                                    <td className="col-center">{item.q5_2}</td>
                                    <td className="col-center">{item.q5_3}</td>
                                    <td className="col-center">{item.q5_4}</td>

                                    {/* Q6 */}
                                    <td className="col-center">{item.q6}</td>
                                </tr>
                            ))}
                            {surveyData.length === 0 && (
                                <tr>
                                    <td colSpan="100" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                                        업로드된 데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : activeTab === 'preview' ? (
                <div className="preview-container" style={{ padding: '20px' }}>
                    {surveyData.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                            {surveyData.map((item, idx) => (
                                <div key={idx} style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '30px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    border: '1px solid #e0e0e0'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: '20px',
                                        paddingBottom: '15px',
                                        borderBottom: '2px solid #00462A'
                                    }}>
                                        <FileText size={20} style={{ marginRight: '10px', color: '#00462A' }} />
                                        <h3 style={{ margin: 0, color: '#00462A', fontSize: '18px', fontWeight: '600' }}>
                                            {item.fileName}
                                        </h3>
                                        <span style={{
                                            marginLeft: 'auto',
                                            padding: '4px 12px',
                                            background: '#f0f0f0',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            color: '#666'
                                        }}>
                                            {item.name || '이름 미기재'} ({item.studentId || '학번 미기재'})
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            lineHeight: '1.8',
                                            color: '#333',
                                            maxHeight: '600px',
                                            overflowY: 'auto',
                                            padding: '10px'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: item.originalHtml || '<p>원본 HTML이 없습니다.</p>' }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-data" style={{ background: 'white', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
                            <FileText size={48} style={{ color: '#ccc', marginBottom: '15px' }} />
                            <p style={{ color: '#888', fontSize: '16px' }}>업로드된 문서가 없습니다.</p>
                        </div>
                    )}
                </div>
            ) : null}

            <div className="button-container">
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".docx, .hwp"
                    style={{ display: 'none' }}
                />
                <button className="ewha-btn outline" onClick={() => fileInputRef.current.click()}>
                    <Upload size={16} style={{ marginRight: '8px' }} />
                    파일 업로드 (.docx)
                </button>
                <button className="ewha-btn" onClick={handleDownload} disabled={surveyData.length === 0}>
                    <Download size={16} style={{ marginRight: '8px' }} />
                    엑셀 다운로드
                </button>
                {/* Reset button removed from here */}
                {isProcessing && <span style={{ marginLeft: '10px', color: '#666' }}>처리 중...</span>}
            </div>
        </div>
    );
};

export default PreSurvey;
