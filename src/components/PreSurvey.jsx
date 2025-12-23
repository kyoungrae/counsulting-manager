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
            const options = {
                styleMap: ["highlight => mark", "b => b"]
            };
            const result = await mammoth.convertToHtml({ arrayBuffer }, options);
            const html = result.value;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            const extracted = {
                fileName: file.name,
                originalHtml: html,
                consultDate: '', college: '', dept: '', studentId: '', name: '',
                q1_1: '', q1_2: '', q1_3: '', q1_4: '', q1_5: '',
                q2_1_1: '', q2_1_2: '', q2_1_3: '', q2_1_4: '',
                q2_2_1: '', q2_2_2: '',
                q2_3_1: '', q2_3_2: '',
                q2_4_1: '', q2_4_2: '', q2_4_3: '',
                q2_5_1: '', q2_5_2: '', q2_5_3: '',
                q2_6_1: '', q2_6_2: '', q2_6_3: '', q2_6_4: '',
                q2_7_1: '', q2_7_3: '',
                q2_8: '',
                q5_1: '', q5_2: '', q5_3: '', q5_4: '',
                q6: ''
            };

            for (let i = 1; i <= 26; i++) extracted[`q3_${i}`] = '';
            for (let i = 1; i <= 14; i++) extracted[`q4_${i}`] = '';

            // --- Segment Analysis Engine ---
            const analyzeSegments = (targetText, targetHtml, configs) => {
                const rawMatches = [];
                configs.forEach(cfg => {
                    const flexibleKW = cfg.kw.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
                    const regex = new RegExp(flexibleKW, 'gi');
                    let m;
                    while ((m = regex.exec(targetText)) !== null) {
                        rawMatches.push({ start: m.index, end: regex.lastIndex, field: cfg.field, matchedKW: m[0] });
                    }
                });

                const uniquePosMap = new Map();
                rawMatches.forEach(m => {
                    const key = `${m.start}-${m.end}`;
                    if (!uniquePosMap.has(key)) {
                        uniquePosMap.set(key, { ...m, fields: [m.field] });
                    } else {
                        uniquePosMap.get(key).fields.push(m.field);
                    }
                });

                const matches = Array.from(uniquePosMap.values()).sort((a, b) => a.start - b.start);
                if (matches.length === 0) return;

                const labelMatch = targetText.match(/\(\d\)\s*[^\s□▣■☑]+/);
                const categoryLabel = labelMatch ? labelMatch[0].trim() : "분류";
                const units = [];

                matches.forEach((m, idx) => {
                    const prevEnd = idx > 0 ? matches[idx - 1].end : 0;
                    const prefix = targetText.substring(prevEnd, m.start);

                    const symbolPart = prefix.match(/[Vv\u2713\u2714\u25A1\u2610\u25A3\u25A0\u2611▣■☑\s]*$/);
                    const cleanPre = symbolPart ? symbolPart[0].trim() : "";

                    const unitString = `${cleanPre}${m.matchedKW}`;
                    units.push(unitString);

                    const vChars = '[Vv\u2713\u2714]';
                    const checkedChars = '[▣■☑\u25A3\u25A0\u2611]';
                    const boxChars = '[□\u25A1\u2610]';

                    let isChecked = false;

                    if (new RegExp(`^${checkedChars}`, 'i').test(unitString) ||
                        new RegExp(`^${vChars}${boxChars}?`, 'i').test(unitString) ||
                        new RegExp(`^${boxChars}${vChars}`, 'i').test(unitString)) {
                        isChecked = true;
                    }

                    if (!isChecked) {
                        const escKW = m.matchedKW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const hRegex = new RegExp(`<mark[^>]*>(?:(?!<\\/mark>).)*${escKW}`, 'i');
                        if (hRegex.test(targetHtml)) isChecked = true;
                    }

                    if (isChecked) {
                        m.fields.forEach(f => extracted[f] = '1');
                    }
                });
                console.log(JSON.stringify({ [categoryLabel]: units }, null, 2));
            };

            const contentNodes = tempDiv.querySelectorAll('tr, p, li');
            contentNodes.forEach(node => {
                let cells = [];
                let fullText = '';
                const nodeHtml = node.innerHTML;

                if (node.tagName.toLowerCase() === 'tr') {
                    cells = Array.from(node.querySelectorAll('td')).map(td => td.innerText.trim());
                    fullText = cells.join(' ');
                } else {
                    fullText = node.innerText.trim();
                    cells = [fullText];
                }

                if (!fullText) return;

                const checkRowForMark = () => {
                    return cells.some(cell => {
                        const t = cell.trim();
                        return /^(V|v|■|☑|check)$/i.test(t) || t.includes('■') || t.includes('☑');
                    });
                };

                // Student Info
                if (node.tagName.toLowerCase() === 'tr') {
                    cells.forEach((cell, idx) => {
                        if (cell.includes('일시') || cell.includes('일자')) extracted.consultDate = cells[idx + 1] || extracted.consultDate;
                        if (cell.includes('단과대학')) extracted.college = cells[idx + 1] || extracted.college;
                        if (cell.includes('학과') || cell.includes('전공')) extracted.dept = cells[idx + 1] || extracted.dept;
                        if (cell.includes('학번')) extracted.studentId = cells[idx + 1] || extracted.studentId;
                        if (cell.includes('이름') || cell.includes('성명')) extracted.name = cells[idx + 1] || extracted.name;
                    });
                }

                if (fullText.includes('자기탐색용') && checkRowForMark()) extracted.q1_1 = '1';
                if (fullText.includes('진로선택용') && checkRowForMark()) extracted.q1_2 = '1';
                if (fullText.includes('취업정보 수집용') && checkRowForMark()) extracted.q1_3 = '1';
                if (fullText.includes('취업준비 전략용') && checkRowForMark()) extracted.q1_4 = '1';

                // --- Categorized Configuration ---
                const q2Groups = {
                    group1: [{ kw: '학점 관리', field: 'q2_1_1' }, { kw: '인/적성검사', field: 'q2_1_2' }, { kw: '진로상담', field: 'q2_1_3' }, { kw: '선배 및 현직자 등 멘토링 참여', field: 'q2_1_4' }],
                    group2: [{ kw: '공인어학성적 취득 노력', field: 'q2_2_1' }, { kw: '어학 회화 능력 향상(제2외국어, 한자 등 포함)', field: 'q2_2_2' }],
                    group3: [{ kw: '컴퓨터 관련 자격증 취득 or 노력', field: 'q2_3_1' }, { kw: '업무(직무) 관련 자격증 취득 or 노력', field: 'q2_3_2' }],
                    group4: [{ kw: '현장실습 및 인턴', field: 'q2_4_1' }, { kw: '아르바이트', field: 'q2_4_2' }, { kw: '봉사활동', field: 'q2_4_3' }],
                    group5: [{ kw: '어학연수', field: 'q2_5_1' }, { kw: '교환학생', field: 'q2_5_2' }, { kw: '해외인턴십', field: 'q2_5_3' }],
                    group6: [{ kw: '교내.외 동아리', field: 'q2_6_1' }, { kw: '봉사활동', field: 'q2_6_2' }, { kw: '학생회 활동', field: 'q2_6_3' }, { kw: '학회 활동', field: 'q2_6_4' }],
                    group7: [{ kw: '공모전 – 연구 및 학회참석, 포스터로 학회참석', field: 'q2_7_1' }, { kw: '경진대회', field: 'q2_7_3' }]
                };

                const q3Groups = {
                    group1: [{ kw: '인사', field: 'q3_1' }, { kw: '교육', field: 'q3_2' }, { kw: '재무/회계', field: 'q3_3' }, { kw: '법무', field: 'q3_4' }, { kw: '미디어/홍보', field: 'q3_5' }, { kw: '비즈니스전략', field: 'q3_6' }],
                    group2: [{ kw: '마케팅', field: 'q3_7' }, { kw: '영업', field: 'q3_8' }, { kw: '데이터', field: 'q3_9' }],
                    group3: [{ kw: '구매', field: 'q3_10' }, { kw: '물류', field: 'q3_11' }, { kw: 'SCM', field: 'q3_12' }],
                    group4: [{ kw: '기획 및 분석', field: 'q3_13' }, { kw: '빅데이터', field: 'q3_14' }],
                    group5: [{ kw: '생산', field: 'q3_15' }, { kw: '품질', field: 'q3_16' }],
                    group6: [{ kw: '연구개발', field: 'q3_17' }, { kw: '엔지니어링', field: 'q3_18' }, { kw: '리서치', field: 'q3_19' }],
                    group7: [{ kw: '서비스기획', field: 'q3_20' }, { kw: '프론트/백앤드 개발', field: 'q3_21' }, { kw: '정보보안', field: 'q3_22' }],
                    group8: [{ kw: '디자인', field: 'q3_23' }, { kw: '사업개발', field: 'q3_24' }, { kw: '투자', field: 'q3_25' }, { kw: '기타', field: 'q3_26' }]
                };

                const q4Groups = {
                    group1: [{ kw: '급여', field: 'q4_1' }, { kw: '승진기회', field: 'q4_2' }, { kw: '근무환경', field: 'q4_3' }, { kw: '근무시간', field: 'q4_4' }],
                    group2: [{ kw: '업무량', field: 'q4_5' }, { kw: '업무 난이도', field: 'q4_6' }, { kw: '적은 스트레스', field: 'q4_7' }, { kw: '전공과의 연관성', field: 'q4_8' }],
                    group3: [{ kw: '비전 및 가치관', field: 'q4_9' }, { kw: '적성과 흥미', field: 'q4_10' }, { kw: '기업브랜드', field: 'q4_11' }],
                    group4: [{ kw: '미래전망', field: 'q4_12' }, { kw: '취업 및 이직', field: 'q4_13' }, { kw: '매력적인 느낌', field: 'q4_14' }]
                };

                // Apply conditional logic based on section headers
                if (/\(1\)\s*대학\s*생활/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group1);
                else if (/\(2\)\s*어학/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group2);
                else if (/\(3\)\s*자격증/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group3);
                else if (/\(4\)\s*(일\s*경험|사회\s*활동)/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group4);
                else if (/\(5\)\s*(글로벌|해외\s*경험)/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group5);
                else if (/\(6\)\s*(자치\s*활동|교내\s*활동)/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group6);
                else if (/\(7\)\s*(도전\s*경험|공모전)/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q2Groups.group7);

                else if (/\(1\)\s*경영지원/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group1);
                else if (/\(2\)\s*마케팅/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group2);
                else if (/\(3\)\s*물류/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group3);
                else if (/\(4\)\s*데이터/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group4);
                else if (/\(5\)\s*생산/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group5);
                else if (/\(6\)\s*연구/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group6);
                else if (/\(7\)\s*IT/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group7);
                else if (/\(8\)\s*기타/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q3Groups.group8);

                else if (/\(1\)\s*근무조건|경제적/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q4Groups.group1);
                else if (/\(2\)\s*업무조건|업무수행/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q4Groups.group2);
                else if (/\(3\)\s*가치관/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q4Groups.group3);
                else if (/\(4\)\s*가치판단|미래전망/i.test(fullText)) analyzeSegments(fullText, nodeHtml, q4Groups.group4);

                if (fullText.includes('(8) 기타')) {
                    const idx = cells.findIndex(c => c.includes('(8) 기타'));
                    if (idx !== -1 && idx < cells.length - 1) extracted.q2_8 = cells[idx + 1];
                }

                const findTextAfter = (label) => {
                    const idx = cells.findIndex(c => c.includes(label));
                    if (idx !== -1 && idx < cells.length - 1) return cells[idx + 1];
                    return '';
                };
                if (fullText.includes('언제')) extracted.q5_1 = findTextAfter('언제') || extracted.q5_1;
                if (fullText.includes('어디서')) extracted.q5_2 = findTextAfter('어디서') || extracted.q5_2;
                if (fullText.includes('역할')) extracted.q5_3 = findTextAfter('역할') || extracted.q5_3;
                if (fullText.includes('무엇을')) extracted.q5_4 = findTextAfter('무엇을') || extracted.q5_4;
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

    const handleDownload = () => {
        if (surveyData.length === 0) return;
        const excelRows = surveyData.map((item, idx) => ({
            'No': idx + 1, '컨설팅 일자': item.consultDate, '단과대학': item.college, '전공': item.dept, '학번': item.studentId, '이름': item.name,
            ...Object.fromEntries([...Array(5)].map((_, i) => [`1-(${i + 1})`, item[`q1_${i + 1}`]])),
            ...Object.fromEntries([...Array(26)].map((_, i) => [`3-(${i + 1})`, item[`q3_${i + 1}`]])),
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelRows);
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
                        <Trash2 size={16} /> 초기화
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
                            {/* Row 1: Sub-numbers and Group Categorization */}
                            <tr>
                                <th rowSpan="2" style={{ minWidth: '50px' }}>No</th>
                                <th rowSpan="2" style={{ minWidth: '120px' }}>컨설팅 일자</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>단과대학</th>
                                <th rowSpan="2" style={{ minWidth: '120px' }}>전공</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>학번</th>
                                <th rowSpan="2" style={{ minWidth: '100px' }}>이름</th>

                                <th>1-(1)</th><th>1-(2)</th><th>1-(3)</th><th>1-(4)</th><th>1-(5)</th>
                                <th colSpan="4">2-(1) 대학생활</th>
                                <th colSpan="2">2-(2) 어학능력</th>
                                <th colSpan="2">2-(3) 자격증</th>
                                <th colSpan="3">2-(4) 일경험</th>
                                <th colSpan="3">2-(5) 글로벌경험</th>
                                <th colSpan="4">2-(6) 자치활돌</th>
                                <th colSpan="2">2-(7) 도전경험</th>
                                <th>2-(8)</th>
                                <th colSpan="6">3-(1) 경영지원</th>
                                <th colSpan="3">3-(2) 마케팅/영업</th>
                                <th colSpan="3">3-(3) 물류</th>
                                <th colSpan="2">3-(4) 데이터</th>
                                <th colSpan="2">3-(5) 생산/품질</th>
                                <th colSpan="3">3-(6) 연구</th>
                                <th colSpan="3">3-(7) IT</th>
                                <th colSpan="4">3-(8) 기타</th>
                                <th>3-(9)</th>
                                <th colSpan="4">4-(1) 근무조건</th>
                                <th colSpan="4">4-(2) 업무조건</th>
                                <th colSpan="3">4-(3) 가치관 기준</th>
                                <th colSpan="3">4-(4) 가치판단</th>
                                <th>5-(1)</th><th>5-(2)</th><th>5-(3)</th><th>5-(4)</th>
                                <th>6</th>
                            </tr>
                            {/* Row 2: Detailed Text Labels */}
                            <tr>
                                <th>자기탐색용</th><th>진로선택용</th><th>취업정보<br />수집용</th><th>취업준비<br />전략용</th><th>기타</th>
                                <th>학점관리</th><th>인/적성검사</th><th>진로상담</th><th>선배 및 현직자 멘토링</th>
                                <th>공인어학 성적</th><th>어학 회화 능력 향상</th><th>컴퓨터관련</th><th>업무관련</th>
                                <th>현장실습(인턴)</th><th>아르바이트</th><th>봉사활동</th><th>어학연수</th>
                                <th>교환학생</th><th>해외인턴십</th><th>교내외동아리</th><th>봉사활동</th>
                                <th>학생회활동</th><th>학회활동</th><th>공모전</th><th>경진대회</th><th>기타</th>
                                <th>인사</th><th>교육</th><th>재무/회계</th><th>법무</th><th>미디어/홍보</th><th>비즈니스전략</th>
                                <th>마케팅</th><th>영업</th><th>데이터</th><th>구매</th><th>물류</th><th>SCM</th>
                                <th>기획및분석</th><th>빅데이터</th><th>생산</th><th>품질</th><th>연구개발</th><th>엔지니어링</th>
                                <th>리서치</th><th>서비스기획</th><th>프론트/백앤드개발</th><th>정보보안</th><th>디자인</th><th>사업개발</th>
                                <th>투자</th><th>기타</th><th></th>
                                <th>급여</th><th>승진기회</th><th>근무환경</th><th>근무시간</th>
                                <th>업무량</th><th>업무난이도</th><th>적은스트레스</th><th>전공연관성</th>
                                <th>비전/가치관부합</th><th>적성과흥미</th><th>기업브랜드</th><th>미래전망</th>
                                <th>취업및이직</th><th>매력</th>
                                <th>언제</th><th>어디서</th><th>역할</th><th>무엇을</th>
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
                                    <td className="col-center q-check">{item.q1_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q1_2 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q1_3 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q1_4 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q1_5 === '1' ? '1' : ''}</td>
                                    {/* Q2 */}
                                    <td className="col-center q-check">{item.q2_1_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_1_2 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_1_3 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_1_4 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_2_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_2_2 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_3_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_3_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_4_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_4_2 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_4_3 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_5_1 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_5_2 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_5_3 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_6_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_6_2 === '1' ? '1' : ''}</td>
                                    <td className="col-center q-check">{item.q2_6_3 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_6_4 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_7_1 === '1' ? '1' : ''}</td><td className="col-center q-check">{item.q2_7_3 === '1' ? '1' : ''}</td><td className="col-center">{item.q2_8}</td>
                                    {/* Q3 */}
                                    {[...Array(26)].map((_, i) => <td key={i} className="col-center q-check">{item[`q3_${i + 1}`] === '1' ? '1' : ''}</td>)}
                                    {/* Q4 */}
                                    {[...Array(14)].map((_, i) => <td key={i} className="col-center q-check">{item[`q4_${i + 1}`] === '1' ? '1' : ''}</td>)}
                                    {/* Q5 */}
                                    <td className="col-center">{item.q5_1}</td><td className="col-center">{item.q5_2}</td><td className="col-center">{item.q5_3}</td><td className="col-center">{item.q5_4}</td><td className="col-center">{item.q6}</td>
                                </tr>
                            ))}
                            {surveyData.length === 0 && (
                                <tr><td colSpan="100" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>업로드된 데이터가 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="preview-container">
                    {surveyData.map((item, idx) => (
                        <div key={idx} className="preview-item" style={{ background: 'white', borderRadius: '12px', padding: '30px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ borderBottom: '2px solid #00462A', paddingBottom: '10px' }}>{item.fileName}</h3>
                            <div dangerouslySetInnerHTML={{ __html: item.originalHtml }} />
                        </div>
                    ))}
                </div>
            )}

            <div className="button-container">
                <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept=".docx" style={{ display: 'none' }} />
                <button className="ewha-btn outline" onClick={() => fileInputRef.current.click()}><Upload size={16} /> 파일 업로드</button>
                <button className="ewha-btn" onClick={handleDownload} disabled={surveyData.length === 0}><Download size={16} /> 엑셀 다운로드</button>
            </div>
        </div>
    );
};

export default PreSurvey;
