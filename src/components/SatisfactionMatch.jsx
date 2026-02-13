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
    const [statusFilter, setStatusFilter] = useState('all');

    const refInputRef = useRef(null);
    const studentInputRef = useRef(null);

    // Helper to read Excel file
    const readExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    // cellStyles: true 옵션을 추가하여 숨겨진 행(!rows) 등의 메타데이터를 확실하게 읽어옴
                    const workbook = XLSX.read(data, { type: 'binary', cellStyles: true });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    // 헤더 행을 포함한 전체 데이터 읽기 (열 인덱스로 접근하기 위해)
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
                    resolve({ data: jsonData, sheet });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    };

    // 열 인덱스로 특정 키워드가 포함된 헤더 찾기
    const findColumnIndex = (headerRow, keyword) => {
        for (let i = 0; i < headerRow.length; i++) {
            const headerValue = String(headerRow[i] || '').trim();
            if (headerValue.includes(keyword)) {
                return i; // B=1, C=2, D=3, E=4, F=5, G=6, H=7
            }
        }
        return -1;
    };

    // 응답데이터(구글폼) 파싱: 특정 열만 읽기 (숨겨진 행 제외)
    const parseResponseData = (jsonData, sheet) => {
        if (!jsonData || jsonData.length < 2) return [];

        // 엑셀 시트의 행 속성 (!rows) 가져오기
        const rowProps = sheet['!rows'] || [];

        const headerRow = jsonData[0];
        // 사용자 요청에 따른 키워드 매핑
        const colB = findColumnIndex(headerRow, '전공'); // B열: '학과 또는 전공'
        const colC = findColumnIndex(headerRow, '학번'); // C열: '학번'
        const colD = findColumnIndex(headerRow, '이름'); // D열: '이름'
        const colE = findColumnIndex(headerRow, '유형'); // E열: '유형'
        const colF = findColumnIndex(headerRow, '일정'); // F열: '일정'
        const colG = findColumnIndex(headerRow, '시간'); // G열: '시간'

        // H열: '선생님', '상담사' 등 포함 여부 확인
        let colH = findColumnIndex(headerRow, '선생님');
        if (colH < 0) colH = findColumnIndex(headerRow, '상담사');

        // 디버깅: 컬럼 인덱스 확인
        console.log('[응답데이터 파싱] 컬럼 인덱스:', {
            전공: colB, 학번: colC, 이름: colD, 유형: colE, 일정: colF, 시간: colG, 상담사: colH
        });

        const results = [];
        let hiddenCount = 0;
        let testDataCount = 0;

        for (let i = 1; i < jsonData.length; i++) {
            // 숨겨진 행(필터링된 행) 건너뛰기
            if (rowProps[i] && rowProps[i].hidden) {
                hiddenCount++;
                continue;
            }

            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            // 각 컬럼이 유효한 인덱스일 때만 데이터 읽기
            const name = colD >= 0 ? String(row[colD] || '').trim() : '';
            const studentId = colC >= 0 ? String(row[colC] || '').trim() : '';
            const type = colE >= 0 ? String(row[colE] || '').trim() : '';
            const schedule = colF >= 0 ? String(row[colF] || '').trim() : '';
            const time = colG >= 0 ? String(row[colG] || '').trim() : '';
            let counselor = colH >= 0 ? String(row[colH] || '').trim() : '';


            // 상담사 이름 정제: [내용] 제거
            counselor = counselor.replace(/\[.*?\]/g, '').trim();

            // "서면첨삭" 여부 확인 (시간 열 또는 유형 열에 포함된 경우)
            const isWritten = (time && time.includes('서면첨삭')) || (type && type.includes('서면첨삭'));

            // 날짜+시간 문자열 생성 (표시용)
            // 서면첨삭인 경우 시간 정보를 제외하고 날짜만 표시
            let dateTime = schedule;
            if (time && !isWritten) {
                dateTime = `${schedule} ${time}`.trim();
            }

            // 테스트 데이터 필터링 (이름이나 학번에 'test', '테스트' 등이 포함된 경우 제외)
            const isTestData = (str) => {
                if (!str) return false;
                const lower = str.toLowerCase();
                return lower.includes('test') || lower.includes('테스트') ||
                    lower.includes('admin') || lower.includes('관리자');
            };

            if (isTestData(name) || isTestData(studentId)) {
                testDataCount++;
                continue; // 테스트 데이터 건너뛰기
            }

            if (name || studentId) {
                results.push({
                    name,
                    studentId,
                    type,
                    schedule, // F열
                    time,     // G열
                    dateTime, // 표시용
                    counselor,
                    rawRow: row
                });
            }
        }
        console.log(`[응답데이터 파싱 결과] 전체: ${jsonData.length - 1}건, 숨겨짐(필터): ${hiddenCount}건, 테스트데이터 제외: ${testDataCount}건, 유효 데이터: ${results.length}건`);
        return results;
    };

    // 기준데이터 파싱: E열 이름, D열 학번, J열 상담분류, C열 일자+시간, K열 상담사
    const parseReferenceData = (jsonData) => {
        if (!jsonData || jsonData.length < 2) return [];

        const headerRow = jsonData[0];
        // 열 인덱스: A=0, B=1, C=2, D=3, E=4, ..., J=9, K=10
        const colC = 2; // C열: 컨설팅일자
        const colD = 3; // D열: 학번
        const colE = 4; // E열: 이름
        const colJ = 9; // J열: 상담분류
        const colK = 10; // K열: 상담사

        const results = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const name = String(row[colE] || '').trim();
            const studentId = String(row[colD] || '').trim();
            const type = String(row[colJ] || '').trim();
            const dateTime = String(row[colC] || '').trim();
            const counselor = String(row[colK] || '').trim();

            if (name || studentId) {
                results.push({
                    id: i, // 고유 식별자 추가
                    name,
                    studentId,
                    type,
                    dateTime,
                    counselor,
                    rawRow: row
                });
            }
        }
        return results;
    };

    // 날짜 형식을 YYYY.MM.DD HH:MM 형식으로 통일
    const formatDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return '';

        const str = String(dateTimeStr).trim();

        // 엑셀 날짜 숫자 (1900년 기준 일수)인 경우
        if (/^\d+\.?\d*$/.test(str) && parseFloat(str) > 1) {
            try {
                // 엑셀 날짜는 1900-01-01부터의 일수 (실제로는 1899-12-30부터)
                const excelEpoch = new Date(1899, 11, 30);
                const days = parseFloat(str);
                const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);

                // 유효한 날짜인지 확인
                if (isNaN(date.getTime())) return str;

                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                // 초 단위는 무시하고 분까지만
                return `${year}.${month}.${day} ${hours}:${minutes}`;
            } catch (e) {
                return str;
            }
        }

        // M/D/YY or M/D/YYYY H:MM:SS AM/PM 형식 파싱
        const mdyMatch = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?/i);
        // 주의: YYYY.MM.DD 형식이 M/D/YY와 혼동될 수 있음. 
        // 연도가 4자리이고 첫번째 그룹이 4자리이면 YYYY.MM.DD로 처리해야 함.

        // YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY/MM/DD 형식 (Dot, Dash, Slash)
        // 뒤에 시간 (HH:MM:SS AM/PM)이 올 수 있음
        const ymdMatch = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?/i);

        if (ymdMatch) {
            const year = ymdMatch[1];
            const month = String(ymdMatch[2]).padStart(2, '0');
            const day = String(ymdMatch[3]).padStart(2, '0');

            let hours = 0;
            let minutes = '00';

            if (ymdMatch[4]) {
                hours = parseInt(ymdMatch[4]);
                minutes = ymdMatch[5];
                const ampm = ymdMatch[6];

                if (ampm) {
                    if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                }
            }

            return `${year}.${month}.${day} ${String(hours).padStart(2, '0')}:${minutes}`;
        }

        // M/D/YY (미국식) - YYYY로 시작하지 않는 경우
        if (mdyMatch) {
            let month = parseInt(mdyMatch[1]);
            let day = parseInt(mdyMatch[2]);
            let year = parseInt(mdyMatch[3]);

            // 첫 번째 그룹이 13 이상이면 월이 아님 -> 그러나 여기선 M/D 순서 가정

            let hours = 0;
            let minutes = '00';

            if (mdyMatch[4]) {
                hours = parseInt(mdyMatch[4]);
                minutes = mdyMatch[5];
                const ampm = mdyMatch[6];

                if (ampm) {
                    if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                }
            }

            // 2자리 연도 처리
            if (year < 100) {
                year = year <= 30 ? 2000 + year : 1900 + year;
            }

            return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${minutes}`;
        }

        // 파싱 실패 시 원본 반환
        return str;
    };

    // 이름 정규화
    const normalizeName = (name) => {
        if (!name) return '';
        return name.replace(/[^\w\uAC00-\uD7A3]/g, '').trim();
    };

    // 상담사 이름 정규화 (선생님, 상담사 제거)
    const normalizeCounselorName = (name) => {
        if (!name) return '';
        return name.replace(/\s+/g, '')
            .replace(/선생님/g, '')
            .replace(/상담사/g, '')
            .trim();
    };

    // 상담분류 비교
    const checkTypeMatch = (type1, type2) => {
        if (!type1 || !type2) return false;
        // 1. 단순 공백 제거 비교 및 부분 포함 비교
        const t1 = type1.replace(/\s+/g, '').trim();
        const t2 = type2.replace(/\s+/g, '').trim();
        if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) return true;

        // 2. 괄호 안팎 순서 변경 대응 (예: "서면첨삭(국문)" vs "(국문)서면첨삭")
        // 괄호, 대괄호 등으로 분리하여 키워드 배열 생성 후 정렬 비교
        const normalize = (s) => s.split(/[()\[\]]/).map(x => x.trim()).filter(Boolean).sort().join('');
        if (normalize(type1) === normalize(type2)) return true;

        return false;
    };

    // 날짜+시간 비교 (기준데이터 C열 vs 응답데이터 F열+G열)
    const checkDateTimeMatch = (refDateTime, respSchedule, respTime, respType) => {
        if (!refDateTime) return false;
        if (!respSchedule) return false;

        // 기준 데이터 정규화 (YYYY.MM.DD HH:MM)
        const refNorm = formatDateTime(refDateTime);
        if (!refNorm) return false;

        // 응답 데이터: "서면첨삭" 여부 확인 (시간 열 또는 유형 열에 "서면첨삭" 포함 시)
        const isWrittenCorrection = (respTime && respTime.includes('서면첨삭')) || (respType && respType.includes('서면첨삭'));

        // 응답 데이터 시간 조합 및 정규화
        let respDateTimeRaw = respSchedule;
        if (respTime && !isWrittenCorrection) {
            respDateTimeRaw += ` ${respTime}`;
        }
        const respNorm = formatDateTime(respDateTimeRaw);
        if (!respNorm) return false;

        if (isWrittenCorrection) {
            // 서면첨삭인 경우 날짜(YYYY.MM.DD)만 비교
            const refDate = refNorm.split(' ')[0];
            const respDate = respNorm.split(' ')[0];
            return refDate === respDate;
        } else {
            // 그 외의 경우 날짜와 시간까지 모두 비교 (YYYY.MM.DD HH:MM)
            return refNorm === respNorm;
        }
    };

    const compareFiles = async (refFile, studFile) => {
        try {
            const [refResult, studResult] = await Promise.all([
                readExcel(refFile),
                readExcel(studFile)
            ]);

            const refDataRaw = parseReferenceData(refResult.data);
            let studDataRaw = parseResponseData(studResult.data, studResult.sheet);

            if (refDataRaw.length === 0) {
                alert('기준 데이터 파일에서 데이터를 읽을 수 없습니다.');
                return;
            }

            if (studDataRaw.length === 0) {
                alert('응답 데이터 파일에서 데이터를 읽을 수 없습니다. 구글폼 설문 결과 파일인지 확인하세요.');
                return;
            }

            // 기준데이터의 날짜 범위 계산
            let minDate = null;
            let maxDate = null;
            const validRefDates = [];

            refDataRaw.forEach(ref => {
                const fmtDate = formatDateTime(ref.dateTime);
                if (fmtDate) {
                    // YYYY.MM.DD 부분만 추출하여 Date 객체 생성
                    const datePart = fmtDate.split(' ')[0];
                    const [yyyy, mm, dd] = datePart.split('.').map(Number);
                    const d = new Date(yyyy, mm - 1, dd);
                    if (!isNaN(d.getTime())) {
                        validRefDates.push(d);
                        if (!minDate || d < minDate) minDate = d;
                        if (!maxDate || d > maxDate) maxDate = d;
                    }
                }
            });

            // 기준데이터에 날짜가 존재하면, 응답데이터 필터링 (범위: Min-30일 ~ Max+30일)
            if (minDate && maxDate) {
                const bufferDays = 30;
                const filterStart = new Date(minDate);
                filterStart.setDate(filterStart.getDate() - bufferDays);

                const filterEnd = new Date(maxDate);
                filterEnd.setDate(filterEnd.getDate() + bufferDays);

                const originalCount = studDataRaw.length;

                studDataRaw = studDataRaw.filter(stud => {
                    const fmtDate = formatDateTime(stud.dateTime);
                    if (!fmtDate) return true; // 날짜 없으면 필터링 하지 않음 (안전책)

                    const datePart = fmtDate.split(' ')[0];
                    const [yyyy, mm, dd] = datePart.split('.').map(Number);
                    const d = new Date(yyyy, mm - 1, dd);

                    if (isNaN(d.getTime())) return true; // 날짜 파싱 실패 시 유지

                    return d >= filterStart && d <= filterEnd;
                });

                console.log(`[날짜 필터링] 기준: ${minDate.toISOString().split('T')[0]} ~ ${maxDate.toISOString().split('T')[0]}`);
                console.log(`[날짜 필터링] 적용 범위: ${filterStart.toISOString().split('T')[0]} ~ ${filterEnd.toISOString().split('T')[0]}`);
                console.log(`[날짜 필터링] 결과: ${originalCount}건 -> ${studDataRaw.length}건 (제외된 과거/미래 데이터: ${originalCount - studDataRaw.length}건)`);
            }

            // 기준데이터를 학번 기준으로 그룹화 (동일 학번이 여러 건일 수 있음)
            const refMapByStudentId = new Map();
            refDataRaw.forEach(ref => {
                const studentId = String(ref.studentId || '').trim();
                if (!studentId) return;
                if (!refMapByStudentId.has(studentId)) {
                    refMapByStudentId.set(studentId, []);
                }
                refMapByStudentId.get(studentId).push(ref);
            });

            // 응답데이터를 학번 기준으로 그룹화 (중복 응답 처리)
            const studMapByStudentId = new Map();
            studDataRaw.forEach(stud => {
                const studentId = String(stud.studentId || '').trim();
                if (!studentId) return;
                if (!studMapByStudentId.has(studentId)) {
                    studMapByStudentId.set(studentId, []);
                }
                studMapByStudentId.get(studentId).push(stud);
            });

            // 응답데이터 기준으로 비교 (학번을 고유 식별값으로 사용)
            const results = [];
            const usedRefIds = new Set(); // 이미 매칭된 기준데이터 ID 추적

            studMapByStudentId.forEach((studResponses, studentId) => {
                const refRecords = refMapByStudentId.get(studentId) || [];

                // 각 응답에 대해 가장 일치율이 높은 기준데이터 건과 매칭
                studResponses.forEach(studResp => {
                    let bestMatch = null;
                    let bestMatchScore = -1;

                    refRecords.forEach(refRecord => {
                        let score = 0;

                        // 이름 비교 (기준 E열 vs 응답 D열)
                        const refNameNorm = normalizeName(refRecord.name);
                        const studNameNorm = normalizeName(studResp.name);

                        let nameMatch = false;
                        if (checkNameMatch(refNameNorm, studNameNorm)) {
                            score += 1;
                            nameMatch = true;
                        }

                        // 상담분류 비교 (기준 J열 vs 응답 E열)
                        if (checkTypeMatch(refRecord.type, studResp.type)) {
                            score += 3;
                        }

                        // 상담일자 비교 (기준 C열 vs 응답 F열+G열)
                        if (checkDateTimeMatch(refRecord.dateTime, studResp.schedule, studResp.time, studResp.type)) {
                            score += 3;
                        }

                        // 상담사 비교 (기준 K열 vs 응답 H열, 선생님 제거 후 비교)
                        const refCounselorNorm = normalizeCounselorName(refRecord.counselor);
                        const studCounselorNorm = normalizeCounselorName(studResp.counselor);
                        if (refCounselorNorm && studCounselorNorm && refCounselorNorm === studCounselorNorm) {
                            score += 2;
                        }

                        if (score > bestMatchScore) {
                            bestMatchScore = score;
                            bestMatch = refRecord;
                        }
                    });

                    // 일치 여부 판단 (bestMatch 재검증)
                    // 위에서 루프 돌 때 이미 score 계산을 위해 checkNameMatch 등을 수행했지만, 
                    // bestMatch가 결정된 후 최종 status 결정을 위해 다시 한 번 정확한 조건 확인

                    const finalNameMatch = bestMatch && checkNameMatch(normalizeName(bestMatch.name), normalizeName(studResp.name));
                    const typeMatch = bestMatch && checkTypeMatch(bestMatch.type, studResp.type);
                    const dateMatch = bestMatch && checkDateTimeMatch(
                        bestMatch.dateTime,
                        studResp.schedule,
                        studResp.time,
                        studResp.type
                    );
                    const counselorMatch = bestMatch &&
                        normalizeCounselorName(bestMatch.counselor) === normalizeCounselorName(studResp.counselor);

                    let isMatch = finalNameMatch && typeMatch && dateMatch && counselorMatch;
                    let status = isMatch ? 'MATCH' : 'MISMATCH';

                    // 중복 응답 처리: 이미 매칭된 기준데이터인 경우
                    if (bestMatch && usedRefIds.has(bestMatch.id)) {
                        status = 'DUPLICATE';
                        isMatch = false; // 중복인 경우 불일치로 간주하거나 별도 처리
                    } else if (bestMatch && isMatch) {
                        // 일치하는 경우 해당 기준 데이터는 사용된 것으로 표시
                        usedRefIds.add(bestMatch.id);
                    } else if (bestMatch) {
                        // 불일치하더라도 가장 유사한 항목으로 일단 점유 처리 (다른 응답이 가로채지 못하게)
                        // 단, 점유를 원치 않는다면 이 부분은 조정 가능
                        usedRefIds.add(bestMatch.id);
                    }

                    // 디버깅: 상담사 데이터 확인
                    if (!studResp.counselor && studResp.rawRow) {
                        console.warn('[비교] 상담사 데이터 없음:', {
                            학번: studResp.studentId,
                            이름: studResp.name,
                            rawRow: studResp.rawRow,
                            rawRowLength: studResp.rawRow.length
                        });
                    }

                    results.push({
                        student: studResp,
                        reference: bestMatch || {},
                        status: status,
                        matchDetails: {
                            name: finalNameMatch,
                            studentId: true, // 학번으로 매칭했으므로 항상 true
                            type: typeMatch,
                            date: dateMatch,
                            counselor: counselorMatch
                        }
                    });
                });
            });

            setComparisonData(results);

        } catch (error) {
            console.error("Error processing files:", error);
            alert("파일 처리 중 오류가 발생했습니다: " + error.message);
        }
    };

    // --- 한글 로마자 변환 및 이름 유사도 비교 함수 ---

    const CHO = [
        'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
    ];
    const JUNG = [
        'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
    ];
    const JONG = [
        '', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h'
    ];

    const romanizeHangul = (text) => {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i) - 44032;
            if (code > -1 && code < 11172) {
                const cho = Math.floor(code / 588);
                const jung = Math.floor((code - (cho * 588)) / 28);
                const jong = code % 28;
                result += (CHO[cho] || '') + (JUNG[jung] || '') + (JONG[jong] || '');
            } else {
                result += text.charAt(i);
            }
        }
        return result;
    };

    const levenshtein = (s1, s2) => {
        const len1 = s1.length;
        const len2 = s2.length;
        const grid = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) grid[i][0] = i;
        for (let j = 0; j <= len2; j++) grid[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                grid[i][j] = Math.min(
                    grid[i - 1][j] + 1,
                    grid[i][j - 1] + 1,
                    grid[i - 1][j - 1] + cost
                );
            }
        }
        return grid[len1][len2];
    };

    const checkNameMatch = (name1, name2) => {
        if (!name1 || !name2) return false;
        const n1 = normalizeName(name1).toLowerCase();
        const n2 = normalizeName(name2).toLowerCase();

        // 1. 완전 일치 (정규화 후)
        if (n1 === n2) return true;

        // 2. 한글 vs 영문 혼합 비교
        const isK1 = /[가-힣]/.test(n1);
        const isK2 = /[가-힣]/.test(n2);

        // 둘 중 하나만 한글이고 하나는 아닐 때 (즉, 교차 스크립트)
        if (isK1 !== isK2) {
            const hangul = isK1 ? n1 : n2;
            const english = isK1 ? n2 : n1;

            // 한글을 로마자로 변환
            const romanized = romanizeHangul(hangul).toLowerCase();

            // (1) 변환 후 완전 일치
            if (romanized === english) return true;

            // (2) 유사도 비교 (Levenshtein Distance)
            // 길이가 짧은 이름에 대해서는 허용치를 작게, 길면 조금 넉넉하게
            const dist = levenshtein(romanized, english);
            const maxLength = Math.max(romanized.length, english.length);

            // 허용 오차: 기본 2자 이내
            // 단, 첫 글자가(초성) k/g, p/b, t/d, r/l 등으로 다를 수 있으므로 이를 감안
            // 예: Gouno Aoi (romanized) vs Kono Aoi (english) -> g/k 차이, u 삽입 등

            if (dist <= 2 && maxLength >= 4) return true;

            // (3) 첫 글자 변환 후 재비교 (G->K, B->P, D->T, R->L, J->Z/Ch)
            // 이것은 로마자 변환 규칙 차이(MacCune-Reischauer vs Revised Romanization) 대응
            const firstCharMap = {
                'g': 'k', 'k': 'g',
                'b': 'p', 'p': 'b',
                'd': 't', 't': 'd',
                'r': 'l', 'l': 'r',
                'j': 'ch', 'ch': 'j'
            };

            const firstChar = romanized[0];
            if (firstCharMap[firstChar]) {
                const altRomanized = firstCharMap[firstChar] + romanized.slice(1);
                if (altRomanized === english) return true;
                if (levenshtein(altRomanized, english) <= 2 && maxLength >= 4) return true;
            }
        }

        return false;
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
        e.target.value = '';
    };

    const handleDownload = () => {
        if (comparisonData.length === 0) return;

        const exportData = comparisonData.map(row => ({
            '상태': row.status === 'MATCH' ? '일치' : '불일치',
            '이름 (실제)': row.reference.name || '',
            '이름 (응답)': row.student.name,
            '학번': row.student.studentId,
            '상담분류 (실제)': row.reference.type || '',
            '상담분류 (응답)': row.student.type,
            '상담일자 (실제)': formatDateTime(row.reference.dateTime || ''),
            '상담일자 (응답)': formatDateTime(row.student.dateTime),
            '상담사 (실제)': row.reference.counselor || '',
            '상담사 (응답)': row.student.counselor,
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
                aValue = a.student.dateTime;
                bValue = b.student.dateTime;
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
                <div
                    className={`drop-zone ${isDraggingRef ? 'drag-active' : ''}`}
                    onClick={() => handleZoneClick('reference')}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
                    onDragLeave={() => setIsDraggingRef(false)}
                    onDrop={(e) => handleFileDrop(e, 'reference')}
                >
                    <Upload size={32} className="upload-icon" />
                    <span className="zone-title">기준 데이터 (전체 상담내역)</span>
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

                <div
                    className={`drop-zone ${isDraggingStudent ? 'drag-active' : ''}`}
                    onClick={() => handleZoneClick('student')}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingStudent(true); }}
                    onDragLeave={() => setIsDraggingStudent(false)}
                    onDrop={(e) => handleFileDrop(e, 'student')}
                >
                    <Upload size={32} className="upload-icon" />
                    <span className="zone-title">응답 데이터 (구글폼 설문 결과)</span>
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
                    <h2 className="results-title">대조 결과 (기준: 학번)</h2>
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
                                    <th>순번</th>
                                    <th className="sortable" onClick={() => handleSort('status')}>
                                        상태
                                        {sortConfig.key === 'status' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('name')}>
                                        이름 (실제/응답)
                                        {sortConfig.key === 'name' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('studentId')}>
                                        학번
                                        {sortConfig.key === 'studentId' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('type')}>
                                        상담분류 (실제/응답)
                                        {sortConfig.key === 'type' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('date')}>
                                        상담일자 (실제/응답)
                                        {sortConfig.key === 'date' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                    <th className="sortable" onClick={() => handleSort('counselor')}>
                                        상담사 (실제/응답)
                                        {sortConfig.key === 'counselor' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {getFilteredData().map((row, idx) => {
                                    // 서면첨삭 여부 확인
                                    const isWritten = (row.student.time && row.student.time.includes('서면첨삭')) ||
                                        (row.student.type && row.student.type.includes('서면첨삭'));

                                    // 날짜 표시 함수 (서면첨삭이면 날짜만, 아니면 시간까지)
                                    const displayDate = (dateStr) => {
                                        const formatted = formatDateTime(dateStr);
                                        if (!formatted) return '';
                                        return isWritten ? formatted.split(' ')[0] : formatted;
                                    };

                                    return (
                                        <tr key={idx} className={row.status === 'DUPLICATE' ? 'duplicate-row' : ''}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <span className={`status-badge ${row.status === 'MATCH' ? 'status-match' :
                                                        row.status === 'DUPLICATE' ? 'status-duplicate' :
                                                            'status-mismatch'
                                                    }`}>
                                                    {row.status === 'MATCH' ? '일치' :
                                                        row.status === 'DUPLICATE' ? '중복 의심' : '불일치'}
                                                </span>
                                            </td>
                                            <td className={!row.matchDetails.name ? 'mismatch-cell' : ''}>
                                                <div className="data-content">
                                                    <span className="student-data">{row.student.name || '(응답 없음)'}</span>
                                                    {!row.matchDetails.name && (
                                                        <div className="reference-data">
                                                            (실제: {row.reference?.name || '데이터 없음'})
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{row.student.studentId}</td>
                                            <td className={!row.matchDetails.type ? 'mismatch-cell' : ''}>
                                                <div className="data-content">
                                                    <span className="student-data">{row.student.type || '(응답 없음)'}</span>
                                                    {!row.matchDetails.type && (
                                                        <div className="reference-data">
                                                            (실제: {row.reference?.type || '데이터 없음'})
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={!row.matchDetails.date ? 'mismatch-cell' : ''}>
                                                <div className="data-content">
                                                    <span className="student-data">{displayDate(row.student.dateTime) || '(응답 없음)'}</span>
                                                    {!row.matchDetails.date && (
                                                        <div className="reference-data">
                                                            (실제: {displayDate(row.reference?.dateTime) || '데이터 없음'})
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={!row.matchDetails.counselor ? 'mismatch-cell' : ''}>
                                                <div className="data-content">
                                                    <span className="student-data">{row.student?.counselor || '(응답 없음)'}</span>
                                                    {!row.matchDetails.counselor && (
                                                        <div className="reference-data">
                                                            (실제: {row.reference?.counselor || '데이터 없음'})
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
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
