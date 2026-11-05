/**
 * 취업컨설팅 강사비/세션 기준표
 * 출처: [혁신][취업컨설팅] 지출결의 상세내용 HWP 양식
 * 엑셀 지급표에 단가가 있으면 엑셀 값을 우선하고, 비고는 이 목록에서 보완합니다.
 */
export const EMPLOYMENT_RATE_CATALOG = [
  { name: '강 진', aliases: ['강진'], rate: 80000, remark: '서류면접(일반)/인개원경력10년이상' },
  { name: '강은서', aliases: ['강은서'], rate: 25000, remark: '서면첨삭(영문)' },
  { name: '김나영', aliases: ['김나영'], rate: 60000, remark: '진로취업중점' },
  { name: '김동은', aliases: ['김동은'], rate: 20000, remark: '서면첨삭(국문)' },
  { name: '김민경', aliases: ['김민경'], rate: 70000, remark: '서류면접(일반)' },
  { name: '김선화', aliases: ['김선화'], rate: 70000, remark: '서류면접(공기업/일반)' },
  { name: '김세희', aliases: ['김세희'], rate: 70000, remark: '서류면접(이공계/일반)' },
  { name: '김지현', aliases: ['김지현'], rate: 70000, remark: '서류면접(일반)' },
  { name: '범하나', aliases: ['범하나'], rate: 70000, remark: '서류면접(일반)' },
  { name: '범하나', aliases: ['범하나'], rate: 20000, remark: '서면첨삭(국문)' },
  { name: '성지우', aliases: ['성지우'], rate: 60000, remark: '서류면접(외국계)/(경력10년미만)' },
  { name: '성지우', aliases: ['성지우'], rate: 25000, remark: '서면첨삭(영문)' },
  { name: '신민이', aliases: ['신민이'], rate: 60000, remark: '진로취업중점' },
  { name: '심영섭', aliases: ['심영섭'], rate: 80000, remark: '서류면접(공기업/일반)/인개원경력10년이상' },
  { name: '양우석', aliases: ['양우석'], rate: 70000, remark: '서류면접(임원면접)' },
  { name: '이상환', aliases: ['이상환'], rate: 70000, remark: '서류면접(콘텐츠엔터/일반)' },
  { name: '이희영', aliases: ['이희영'], rate: 70000, remark: '서류면접(일반)' },
  { name: '(신규)원미영', aliases: ['원미영', '(신규)원미영'], rate: 65000, remark: '서류면접(외국계)/(경력 10년이상)' },
  { name: '장신혜', aliases: ['장신혜'], rate: 80000, remark: '서류면접(일반)/인개원경력10년이상' },
  { name: '정지선', aliases: ['정지선'], rate: 70000, remark: '서류면접(이공계/일반)' },
  { name: '지명선', aliases: ['지명선'], rate: 75000, remark: '서류면접(외국계)/(경력10년이상)' },
  { name: '최윤호', aliases: ['최윤호'], rate: 20000, remark: '서면첨삭(국문)' },
  { name: '(신규)최미화', aliases: ['최미화', '(신규)최미화'], rate: 20000, remark: '서면첨삭(국문)' },
  { name: '한 나', aliases: ['한나', '한 나'], rate: 70000, remark: '서류면접(일반)' },
];

export function normalizeConsultantKey(name) {
  return String(name ?? '')
    .replace(/\(신규\)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function findCatalogEntries(name) {
  const key = normalizeConsultantKey(name);
  return EMPLOYMENT_RATE_CATALOG.filter((row) =>
    row.aliases.some((alias) => normalizeConsultantKey(alias) === key)
      || normalizeConsultantKey(row.name) === key
  );
}

export function displayConsultantName(name) {
  const entries = findCatalogEntries(name);
  if (entries.length) return entries[0].name.replace(/^\(신규\)/, '');
  return String(name ?? '').trim();
}

export function formatWon(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('ko-KR');
}
