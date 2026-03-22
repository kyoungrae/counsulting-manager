import * as XLSX from 'xlsx';

export const COLLEGE_ORDER = [
  '인문과학대학',
  '사회과학대학',
  '자연과학대학',
  '공과대학',
  '엘텍공과대학',
  '음악대학',
  '조형예술대학',
  '사범대학',
  '경영대학',
  '신산업융합대학',
  '의과대학',
  '간호대학',
  '약학대학',
  '스크랜튼대학',
  '인공지능대학',
  '호크마교양대학',
  '대학원'
];

const COLLEGE_ALIAS_MAP = [
  ['인문', '인문과학대학'],
  ['사회', '사회과학대학'],
  ['자연', '자연과학대학'],
  ['엘텍', '엘텍공과대학'],
  ['공과', '공과대학'],
  ['음악', '음악대학'],
  ['조형', '조형예술대학'],
  ['사범', '사범대학'],
  ['경영', '경영대학'],
  ['신산업', '신산업융합대학'],
  ['의과', '의과대학'],
  ['의예', '의과대학'],
  ['간호', '간호대학'],
  ['약학', '약학대학'],
  ['스크랜튼', '스크랜튼대학'],
  ['인공지능', '인공지능대학'],
  ['호크마', '호크마교양대학'],
  ['대학원', '대학원']
];

const KEYWORDS = {
  applyDate: ['신청일'],
  college: ['대학'],
  dept: ['학과', '전공'],
  grade: ['학년'],
  studentId: ['학번'],
  name: ['이름', '성명'],
  type: ['상담구분', '상담분류', '컨설팅유형'],
  consultant: ['상담사', '컨설턴트'],
  consultDate: ['컨설팅일자', '상담일자'],
  attend: ['참석여부'],
  answerStatus: ['답변상태'],
  completeDate: ['완료일자']
};

const normalizeHeader = (v) => String(v || '').replace(/\s+/g, '').trim();

const findColIndex = (header, names, fallback = -1) => {
  for (let i = 0; i < header.length; i += 1) {
    const h = normalizeHeader(header[i]);
    if (!h) continue;
    if (names.some((k) => h.includes(k.replace(/\s+/g, '')))) return i;
  }
  return fallback;
};

const normalizeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const normalizeTypeKey = (v) => normalizeText(v).replace(/[()\[\]{}\-_/]/g, '').replace(/\s+/g, '').toLowerCase();

export const normalizeConsultantName = (raw) => {
  let s = normalizeText(raw);
  if (!s) return '';
  s = s.replace(/인재개발원\s*\((.*?)\)/g, '$1');
  s = s.replace(/\[[^\]]*]/g, '').replace(/［[^］]*］/g, '').replace(/【[^】]*】/g, '');
  s = s.replace(/\s*선생님\s*$/g, '').replace(/\s*상담사\s*$/g, '');
  return normalizeText(s);
};

export const normalizeStudentId = (raw) => normalizeText(raw).toUpperCase();

const isGradStudentId = (sid) => /^[A-Z0-9]{8}$/.test(sid) && /[A-Z]/.test(sid) && /\d/.test(sid);

export const normalizeGrade = (grade, studentId) => {
  const g = normalizeText(grade);
  if (g) return g;
  return isGradStudentId(studentId) ? '대학원' : '';
};

export const normalizeCollege = (college) => {
  const c = normalizeText(college);
  if (!c) return '';
  const found = COLLEGE_ALIAS_MAP.find(([key]) => c.includes(key));
  return found ? found[1] : c;
};

export const normalizeRealtimeAttend = (raw) => {
  const v = normalizeText(raw);
  if (v === '참석') return '참석';
  if (v === '불참') return '불참';
  return '검토 필요';
};

export const normalizeOfflineAnswer = (raw) => {
  const v = normalizeText(raw);
  if (v === '완료' || v === '첨삭중') return '완료';
  return '검토 필요';
};

const detectFileKind = (fileName, header) => {
  const n = normalizeText(fileName);
  if (n.includes('서면첨삭')) return 'offline';
  const hasAnswer = findColIndex(header, KEYWORDS.answerStatus, -1) >= 0;
  const hasComplete = findColIndex(header, KEYWORDS.completeDate, -1) >= 0;
  return hasAnswer || hasComplete ? 'offline' : 'realtime';
};

const detectFileHintUpper = (fileName, kind) => {
  if (kind === 'offline') return '서면첨삭';
  const n = normalizeText(fileName);
  const hasCareer = n.includes('진로개발');
  const hasInterview = n.includes('서류면접');
  if (hasCareer && !hasInterview) return '진로개발';
  if (!hasCareer && hasInterview) return '서류면접';
  return '';
};

export const inferConsultType = (rawType, kind, fileHintUpper, runtimeTypeMap = {}) => {
  const raw = normalizeText(rawType);
  const key = normalizeTypeKey(raw);
  if (key && runtimeTypeMap[key]) {
    const upper = runtimeTypeMap[key];
    const sub = upper === '서면첨삭' ? '국문' : (upper === '서류면접' ? '일반' : '진로개발');
    return { upper, sub, canonical: sub, unknownTypeKey: '' };
  }

  const includes = (x) => raw.includes(x);
  if (raw && (includes('서면첨삭') || includes('국문 이력서') || includes('영문 이력서') || includes('자기소개서'))) {
    const sub = includes('연계') ? '연계' : (includes('영문') ? '영문' : '국문');
    return { upper: '서면첨삭', sub, canonical: sub, unknownTypeKey: '' };
  }
  if (raw && (includes('서류면접') || includes('이공계') || includes('공기업') || includes('외국계') || includes('콘텐츠엔터') || includes('특화'))) {
    const isSpecial = includes('특화') || includes('이공계') || includes('공기업') || includes('외국계') || includes('콘텐츠엔터');
    const sub = includes('연계') ? '연계' : (isSpecial ? '특화' : '일반');
    return { upper: '서류면접', sub, canonical: sub, unknownTypeKey: '' };
  }
  if (raw && (includes('진로개발') || includes('웰컴') || includes('연계'))) {
    const sub = includes('웰컴') ? '웰컴세션' : (includes('연계') ? '연계' : '진로개발');
    return { upper: '진로개발', sub, canonical: sub, unknownTypeKey: '' };
  }

  if (!raw && fileHintUpper) {
    const sub = fileHintUpper === '서류면접' ? '일반' : (fileHintUpper === '서면첨삭' ? '국문' : '진로개발');
    return { upper: fileHintUpper, sub, canonical: sub, unknownTypeKey: '' };
  }

  if (raw && fileHintUpper) {
    const sub = fileHintUpper === '서류면접' ? '일반' : (fileHintUpper === '서면첨삭' ? '국문' : '진로개발');
    return { upper: fileHintUpper, sub, canonical: sub, unknownTypeKey: '' };
  }

  return { upper: '', sub: '', canonical: raw || '미분류', unknownTypeKey: key || normalizeTypeKey(rawType || '') };
};

export const parseMonthFromFileName = (fileName) => {
  const s = String(fileName || '');
  
  // 1. "X월" format
  let m = s.match(/(\d{1,2})\s*월/);
  if (m) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && v >= 1 && v <= 12) return v;
  }
  
  // 2. "(YY.M)" or "YY.M" format e.g. (26.1), (2026.01), 26.1
  // This matches a 2 or 4 digit year, a dot, and a 1 or 2 digit month, possibly inside parens
  m = s.match(/(?:\()?(\d{2,4})\.(\d{1,2})(?:\))?/);
  if (m) {
    const v = Number(m[2]);
    if (Number.isFinite(v) && v >= 1 && v <= 12) return v;
  }
  
  return null;
};

export const parseDateValue = (raw) => {
  const s = normalizeText(raw);
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 1) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0);
  }
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  }
  const md = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (md) {
    let y = Number(md[3]);
    if (y < 100) y = y > 60 ? 1900 + y : 2000 + y;
    return new Date(y, Number(md[1]) - 1, Number(md[2]), Number(md[4] || 0), Number(md[5] || 0));
  }
  return null;
};

const formatDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${hh}:${mm}`;
};

const extractDominantMonth = (rows) => {
  const counts = new Map();
  rows.forEach((r) => {
    const month = r.month;
    if (!month) return;
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  let best = null;
  let max = -1;
  counts.forEach((v, k) => {
    if (v > max) {
      max = v;
      best = k;
    }
  });
  return best;
};

export const parseApplicationWorkbook = (jsonData, sheet, fileName, runtimeTypeMap = {}) => {
  if (!jsonData || jsonData.length < 2) {
    return { rows: [], unknownTypeKeys: [], kind: 'realtime', month: null, warnings: ['데이터 행이 없습니다.'] };
  }

  const hiddenRows = sheet?.['!rows'] || [];
  const header = jsonData[0] || [];
  const kind = detectFileKind(fileName, header);
  const fileHintUpper = detectFileHintUpper(fileName, kind);

  const col = {
    applyDate: findColIndex(header, KEYWORDS.applyDate, 1),
    college: findColIndex(header, KEYWORDS.college, 2),
    dept: findColIndex(header, KEYWORDS.dept, 3),
    grade: findColIndex(header, KEYWORDS.grade, 5),
    studentId: findColIndex(header, KEYWORDS.studentId, 6),
    name: findColIndex(header, KEYWORDS.name, 7),
    type: findColIndex(header, KEYWORDS.type, 9),
    consultDate: findColIndex(header, KEYWORDS.consultDate, kind === 'offline' ? 12 : 11),
    attend: findColIndex(header, KEYWORDS.attend, 12),
    answerStatus: findColIndex(header, KEYWORDS.answerStatus, 13),
    completeDate: findColIndex(header, KEYWORDS.completeDate, 12)
  };

  let consultantIdx = findColIndex(header, KEYWORDS.consultant, -1);
  if (consultantIdx < 0) consultantIdx = kind === 'offline' ? 11 : 10;

  const unknownTypeKeys = new Set();
  const warnings = [];
  const parsed = [];

  for (let i = 1; i < jsonData.length; i += 1) {
    if (hiddenRows[i] && hiddenRows[i].hidden) continue;
    const row = jsonData[i] || [];
    if (!row.length) continue;

    const studentId = normalizeStudentId(row[col.studentId]);
    const name = normalizeText(row[col.name]);
    if (!studentId && !name) continue;

    const rawType = normalizeText(row[col.type]);
    const typeInfo = inferConsultType(rawType, kind, fileHintUpper, runtimeTypeMap);
    if (typeInfo.unknownTypeKey) unknownTypeKeys.add(typeInfo.unknownTypeKey);

    const consultant = normalizeConsultantName(row[consultantIdx]);
    if (!consultant) warnings.push('컨설턴트 이름 인식 실패');

    const applyDate = parseDateValue(row[col.applyDate]);
    const consultDate = kind === 'offline' ? parseDateValue(row[col.completeDate] || row[col.applyDate]) : parseDateValue(row[col.consultDate]);
    const basisDate = kind === 'offline' ? (consultDate || applyDate) : consultDate;

    const attendValue = kind === 'offline'
      ? normalizeOfflineAnswer(row[col.answerStatus])
      : normalizeRealtimeAttend(row[col.attend]);

    if (attendValue === '검토 필요') {
      warnings.push(kind === 'offline' ? '답변상태 이상값' : '참석여부 이상값');
    }

    const college = normalizeCollege(row[col.college]);
    if (college && !COLLEGE_ORDER.includes(college)) warnings.push('단과대 명칭 불일치');

    const grade = normalizeGrade(row[col.grade], studentId);
    if (!grade && isGradStudentId(studentId)) warnings.push('학년/학번 불일치');

    parsed.push({
      sourceFile: fileName,
      sourceKind: kind,
      studentId,
      name,
      college,
      dept: normalizeText(row[col.dept]),
      grade,
      rawType,
      typeUpper: typeInfo.upper,
      typeSub: typeInfo.sub,
      typeCanonical: typeInfo.canonical,
      unknownTypeKey: typeInfo.unknownTypeKey,
      consultant,
      applyDate,
      consultDate,
      basisDate,
      displayDate: formatDate(basisDate),
      attendance: attendValue,
      isApplied: kind === 'realtime',
      isAttended: kind === 'realtime' && attendValue === '참석',
      isAbsent: kind === 'realtime' && attendValue === '불참',
      isCompleted: kind === 'offline' && attendValue === '완료',
      month: basisDate ? basisDate.getMonth() + 1 : null,
      year: basisDate ? basisDate.getFullYear() : null
    });
  }

  const fileMonth = parseMonthFromFileName(fileName);
  const dominantMonth = extractDominantMonth(parsed);
  
  // 파일명에서 월이 명시적으로 추출되면 전체 행을 해당 월로 통일
  const month = fileMonth || dominantMonth || null;
  const rows = parsed.map((r) => {
     const finalMonth = fileMonth ? fileMonth : (r.month || dominantMonth || null);
     return { ...r, month: finalMonth };
  });

  return {
    rows,
    kind,
    month,
    unknownTypeKeys: Array.from(unknownTypeKeys).filter(Boolean),
    warnings: Array.from(new Set(warnings))
  };
};

export const applyTypeMappings = (rows, runtimeTypeMap) => rows.map((row) => {
  if (!row.unknownTypeKey) return row;
  const mappedUpper = runtimeTypeMap[row.unknownTypeKey];
  if (!mappedUpper) return row;
  const sub = mappedUpper === '서면첨삭' ? '국문' : (mappedUpper === '서류면접' ? '일반' : '진로개발');
  return {
    ...row,
    typeUpper: mappedUpper,
    typeSub: sub,
    typeCanonical: sub,
    unknownTypeKey: ''
  };
});

const gradeBucket = (grade) => {
  if (!grade) return '대학원';
  if (grade.includes('대학원')) return '대학원';
  const d = Number(String(grade).replace(/[^\d]/g, ''));
  if (!Number.isFinite(d) || d <= 0) return '대학원';
  if (d >= 5) return '5학년 이상';
  return `${d}학년`;
};

const monthWeight = (month) => (month <= 2 ? month + 12 : month);

export const sortMonthsDesc = (months) => [...months].sort((a, b) => monthWeight(b) - monthWeight(a));

export const buildMonthlyStats = (rows) => {
  const grouped = new Map();
  rows.forEach((r) => {
    if (!r.month) return;
    if (!grouped.has(r.month)) grouped.set(r.month, []);
    grouped.get(r.month).push(r);
  });

  const result = new Map();

  grouped.forEach((list, month) => {
    const realtime = list.filter((r) => r.sourceKind === 'realtime');
    const offline = list.filter((r) => r.sourceKind === 'offline');
    const attendedOrCompleted = list.filter((r) => r.isAttended || r.isCompleted);

    const rtBy = (predicate, flag) => realtime.filter((r) => predicate(r) && r[flag]).length;
    const offBy = (predicate) => offline.filter((r) => predicate(r) && r.isCompleted).length;

    const agg = {
      month,
      year: list.find((r) => r.year)?.year || new Date().getFullYear(),
      realtime: {
        applied: {
          career: rtBy((r) => r.typeUpper === '진로개발', 'isApplied'),
          interviewGeneral: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '일반', 'isApplied'),
          interviewSpecial: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '특화', 'isApplied')
        },
        attended: {
          career: rtBy((r) => r.typeUpper === '진로개발', 'isAttended'),
          interviewGeneral: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '일반', 'isAttended'),
          interviewSpecial: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '특화', 'isAttended')
        },
        absent: {
          career: rtBy((r) => r.typeUpper === '진로개발', 'isAbsent'),
          interviewGeneral: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '일반', 'isAbsent'),
          interviewSpecial: rtBy((r) => r.typeUpper === '서류면접' && r.typeSub === '특화', 'isAbsent')
        }
      },
      offline: {
        completed: {
          linked: offBy((r) => r.typeUpper === '서면첨삭' && r.typeSub === '연계'),
          korEng: offBy((r) => r.typeUpper === '서면첨삭' && (r.typeSub === '국문' || r.typeSub === '영문'))
        }
      },
      consultantByType: {
        career: Array.from(new Set(realtime.filter((r) => r.typeUpper === '진로개발').map((r) => r.consultant).filter(Boolean))),
        interviewGeneral: Array.from(new Set(realtime.filter((r) => r.typeUpper === '서류면접' && r.typeSub === '일반').map((r) => r.consultant).filter(Boolean))),
        interviewSpecial: Array.from(new Set(realtime.filter((r) => r.typeUpper === '서류면접' && r.typeSub === '특화').map((r) => r.consultant).filter(Boolean))),
        offlineLinked: Array.from(new Set(offline.filter((r) => r.typeUpper === '서면첨삭' && r.typeSub === '연계').map((r) => r.consultant).filter(Boolean))),
        offlineKorEng: Array.from(new Set(offline.filter((r) => r.typeUpper === '서면첨삭' && (r.typeSub === '국문' || r.typeSub === '영문')).map((r) => r.consultant).filter(Boolean)))
      },
      gradeCounts: {
        '1학년': 0,
        '2학년': 0,
        '3학년': 0,
        '4학년': 0,
        '5학년 이상': 0,
        대학원: 0
      },
      /** 학년×컨설팅유형별 참석/완료 수 (구분값 채우기용) */
      countByGradeAndType: {
        '1학년': { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 },
        '2학년': { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 },
        '3학년': { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 },
        '4학년': { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 },
        '5학년 이상': { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 },
        대학원: { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 }
      },
      collegeCounts: Object.fromEntries(COLLEGE_ORDER.map((c) => [c, 0])),
      /** 단과대×컨설팅유형별 참석/완료 수 (구분값 채우기용) */
      countByCollegeAndType: Object.fromEntries(
        COLLEGE_ORDER.map((c) => [c, { career: 0, interviewGeneral: 0, interviewSpecial: 0, offlineLinked: 0, offlineKorEng: 0 }])
      ),
      uniqueParticipants: { once: 0, twice: 0, threePlus: 0, totalUnique: 0 },
      anomalies: {
        unknownType: list.filter((r) => r.unknownTypeKey).length,
        reviewNeeded: list.filter((r) => r.attendance === '검토 필요').length,
        consultantUnknown: list.filter((r) => !r.consultant).length,
        collegeUnknown: list.filter((r) => r.college && !COLLEGE_ORDER.includes(r.college)).length
      },
      rows: list
    };

    const getTypeKey = (r) => {
      if (r.sourceKind === 'realtime') {
        if (r.typeUpper === '진로개발') return 'career';
        if (r.typeUpper === '서류면접' && r.typeSub === '일반') return 'interviewGeneral';
        if (r.typeUpper === '서류면접' && r.typeSub === '특화') return 'interviewSpecial';
      } else if (r.sourceKind === 'offline') {
        if (r.typeUpper === '서면첨삭' && r.typeSub === '연계') return 'offlineLinked';
        if (r.typeUpper === '서면첨삭' && (r.typeSub === '국문' || r.typeSub === '영문')) return 'offlineKorEng';
      }
      return null;
    };

    attendedOrCompleted.forEach((r) => {
      const gb = gradeBucket(r.grade);
      agg.gradeCounts[gb] += 1;
      if (agg.collegeCounts[r.college] !== undefined) agg.collegeCounts[r.college] += 1;
      const typeKey = getTypeKey(r);
      if (typeKey && agg.countByGradeAndType[gb]) agg.countByGradeAndType[gb][typeKey] += 1;
      if (typeKey && r.college && agg.countByCollegeAndType[r.college]) agg.countByCollegeAndType[r.college][typeKey] += 1;
    });

    const participation = new Map();
    attendedOrCompleted.forEach((r) => {
      if (!r.studentId) return;
      participation.set(r.studentId, (participation.get(r.studentId) || 0) + 1);
    });
    participation.forEach((cnt) => {
      if (cnt === 1) agg.uniqueParticipants.once += 1;
      else if (cnt === 2) agg.uniqueParticipants.twice += 1;
      else agg.uniqueParticipants.threePlus += 1;
    });
    agg.uniqueParticipants.totalUnique = participation.size;

    result.set(month, agg);
  });

  return result;
};

