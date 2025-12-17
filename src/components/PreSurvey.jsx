import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { Upload, Download, FileText, Trash2, PieChart as PieChartIcon, List } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LabelList
} from 'recharts';
import './EwhaGrid.css';

const COLORS = ['#00462A', '#0D5F34', '#1A7A40', '#2E934E', '#4CAF60', '#81C784', '#A5D6A7', '#C8E6C9'];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null; // Hide small labels
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const PreSurvey = () => {
    const [surveyData, setSurveyData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'chart'
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

                    const escaped = keyword.replace(/\s+/g, '\\s*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    // Regex for UNCHECKED box (□, \u25A1, \u2610) adjacent to keyword
                    // We look for the box BEFORE or AFTER the keyword.
                    const uncheckedRegex = new RegExp(`[□\u25A1\u2610]\\s*${escaped}|${escaped}\\s*[□\u25A1\u2610]`, 'i');

                    if (uncheckedRegex.test(fullText)) {
                        // Explicit empty box found -> Unchecked
                        return;
                    } else {
                        // Keyword is there, but NO empty box.
                        // Must be checked.
                        extracted[targetField] = '1';
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
                checkKeyword('선배 및 현직자 등 멘토링', 'q2_1_4'); // Exact match

                // (2) Language
                checkKeyword('공인어학성적 취득', 'q2_2_1');
                checkKeyword('어학 회화 능력', 'q2_2_2');

                // (3) Certificates
                checkKeyword('컴퓨터 관련 자격증', 'q2_3_1');
                checkKeyword('업무(직무) 관련 자격증', 'q2_3_2');

                // (4) Work Experience
                checkKeyword('현장실습 및 인턴', 'q2_4_1');
                checkKeyword('아르바이트', 'q2_4_2');
                // Context-aware: '봉사활동' appears in both (4) and (6).
                // Use strict context check based on row content if possible
                if (fullText.includes('(4) 일 경험')) {
                    if (fullText.includes('봉사활동') && isChecked(fullText)) extracted.q2_4_3 = '1';
                }

                // (5) Global
                checkKeyword('어학연수', 'q2_5_1');
                checkKeyword('교환학생', 'q2_5_2');
                checkKeyword('해외인턴십', 'q2_5_3');

                // (6) Autonomous
                checkKeyword('교내.외 동아리', 'q2_6_1');
                if (fullText.includes('(6) 자치 활동')) {
                    if (fullText.includes('봉사활동') && isChecked(fullText)) extracted.q2_6_2 = '1';
                }
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

                // Q3 Job Hope Keys (1-26)
                // 3-(1) Management Support
                checkKeyword('인사', 'q3_1'); checkKeyword('교육', 'q3_2'); checkKeyword('재무/회계', 'q3_3');
                checkKeyword('법무', 'q3_4'); checkKeyword('미디어/홍보', 'q3_5'); checkKeyword('비즈니스전략', 'q3_6');
                // 3-(2) Mkt/Sales
                checkKeyword('마케팅', 'q3_7'); checkKeyword('영업', 'q3_8'); checkKeyword('데이터', 'q3_9'); // New Data column in this group? '데이터' appears twice.
                // 3-(3) Logistics/Purchase
                checkKeyword('구매', 'q3_10'); checkKeyword('물류', 'q3_11'); checkKeyword('SCM', 'q3_12');
                // 3-(4) Data (Original)
                checkKeyword('기획 및 분석', 'q3_13'); if (fullText.includes('빅데이터')) extracted.q3_14 = '1'; // Keyword overlap
                // 3-(5) Prod/Quality
                checkKeyword('생산', 'q3_15'); checkKeyword('품질', 'q3_16');
                // 3-(6) Research
                checkKeyword('연구개발', 'q3_17'); checkKeyword('엔지니어링', 'q3_18'); checkKeyword('리서치', 'q3_19');
                // 3-(7) IT
                checkKeyword('서비스기획', 'q3_20');
                if (fullText.includes('프론트') || fullText.includes('백앤드')) extracted.q3_21 = '1';
                checkKeyword('정보보안', 'q3_22');
                // 3-(8) Other/Design
                checkKeyword('디자인', 'q3_23'); checkKeyword('사업개발', 'q3_24'); checkKeyword('투자', 'q3_25');
                // 3-(9) Others

                // Q4 Work Values (1-14)
                checkKeyword('급여', 'q4_1'); checkKeyword('승진기회', 'q4_2'); checkKeyword('근무환경', 'q4_3'); checkKeyword('근무시간', 'q4_4');
                checkKeyword('업무량', 'q4_5'); checkKeyword('업무난이도', 'q4_6'); checkKeyword('적은스트레스', 'q4_7'); checkKeyword('전공연관성', 'q4_8');
                checkKeyword('비전', 'q4_9'); // Vision/Values
                checkKeyword('적성과 흥미', 'q4_10');
                checkKeyword('기업브랜드', 'q4_11');
                checkKeyword('미래전망', 'q4_12');
                checkKeyword('취업 및 이직', 'q4_13'); // Charm?
                checkKeyword('매력', 'q4_14');

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

    // --- Stats Aggregation ---
    const chartsData = useMemo(() => {
        if (surveyData.length === 0) return { q1: [], q2: [], college: [] };

        // Q1 Reasons
        const q1Counts = [
            { name: '자기탐색', key: 'q1_1', count: 0 },
            { name: '진로선택', key: 'q1_2', count: 0 },
            { name: '취업정보', key: 'q1_3', count: 0 },
            { name: '취업전략', key: 'q1_4', count: 0 },
            { name: '기타', key: 'q1_5', count: 0 },
        ];
        // Q2 Experiences (Top 10 mostly populated)
        // Specific Logic for Q2 mapping to readable names
        const q2Map = {
            'q2_1_1': '학점관리', 'q2_1_2': '인/적성', 'q2_1_3': '진로상담', 'q2_1_4': '선배/현직자',
            'q2_2_1': '어학성적', 'q2_2_2': '어학회화',
            'q2_3_1': '컴퓨터', 'q2_3_2': '직무자격증',
            'q2_4_1': '현장실습', 'q2_4_2': '아르바이트', 'q2_4_3': '봉사활동',
            'q2_5_1': '어학연수', 'q2_5_2': '교환학생', 'q2_5_3': '해외인턴',
            'q2_6_1': '동아리', 'q2_6_2': '자치봉사', 'q2_6_3': '학생회', 'q2_6_4': '학회',
            'q2_7_1': '공모전', 'q2_7_2': '연구/논문', 'q2_7_3': '경진대회',
        };

        const q2Agg = {};
        // College
        const colCounts = {};

        surveyData.forEach(item => {
            // Q1
            q1Counts.forEach(q => { if (item[q.key] === '1') q.count++; });

            // Q2
            Object.entries(q2Map).forEach(([key, label]) => {
                if (item[key] === '1') {
                    if (!q2Agg[label]) q2Agg[label] = 0;
                    q2Agg[label]++;
                }
            });

            // College
            const c = item.college || '미기재';
            if (!colCounts[c]) colCounts[c] = 0;
            colCounts[c]++;
        });

        // Format Q2 for Chart (Sort by count)
        const q2ChartData = Object.entries(q2Agg)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Format College
        const colChartData = Object.entries(colCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { q1: q1Counts, q2: q2ChartData, college: colChartData };
    }, [surveyData]);


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
                <button className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
                    <PieChartIcon size={16} style={{ marginRight: '6px' }} /> 설문 통계
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
            ) : (
                <div className="chart-dashboard">
                    {/* Charts Grid */}
                    {surveyData.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                            {/* Q1 Chart */}
                            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#00462A' }}>상담 신청 이유 (Q1)</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartsData.q1}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis allowDecimals={false} />
                                            <RechartsTooltip cursor={{ fill: '#f5f5f5' }} />
                                            <Bar dataKey="count" fill="#00462A" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="count" position="top" fill="#333" fontSize={12} fontWeight="bold" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* College Chart */}
                            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#00462A' }}>참여 단과대학 비율</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartsData.college}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={renderCustomizedLabel}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {chartsData.college.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend layout="vertical" verticalAlign="middle" align="right" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Q2 Chart (Full Width) */}
                            <div style={{ gridColumn: '1 / -1', background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#00462A' }}>대학생활 경험 (Q2) - 응답 순위</h3>
                                <div style={{ height: '400px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartsData.q2} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" allowDecimals={false} />
                                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip cursor={{ fill: '#f5f5f5' }} />
                                            <Bar dataKey="count" fill="#4CAF60" radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="count" position="right" fill="#333" fontSize={12} fontWeight="bold" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="no-data" style={{ background: 'white', borderRadius: '12px' }}>
                            데이터를 업로드하면 통계가 표시됩니다.
                        </div>
                    )}
                </div>
            )}

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
