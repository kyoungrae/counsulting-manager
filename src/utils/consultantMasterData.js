/**
 * 상담사(강사) 마스터 데이터 — 임시 기억용
 *
 * 출처(우선):
 * - 3.[혁신][취업컨설팅] 강사비 영수증 (26.3).doc
 *   → 고유번호, 생년월일, 핸드폰, 소속/주소, 통장번호
 * - 5.[혁신][취업컨설팅] 지출결의 상세내용 (26.10).hwp
 *   → 세션당 금액(강사비/세션) 및 비고
 *
 * 엑셀 지급표에 단가가 있으면 런타임에서 엑셀 값을 우선합니다.
 * 이후 최신 파일이 오면 이 목록만 갱신하면 됩니다.
 */

export function normalizeConsultantKey(name) {
  return String(name ?? '')
    .replace(/\(신규\)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export const CONSULTANT_MASTER = [
  {
    name: '강 진',
    aliases: ['강진'],
    code: 'A017228',
    birth: '75.09.13',
    phone: '010-3169-7350',
    affiliation: '한국외국어대학교 미네르바교양대학 특임교수 / 서울시 강남구 영동대로22 디에이치자이개포',
    bank: '신한',
    account: '110-150-652142',
    accountHolder: '강 진',
    placeInterview: 'ECC B306-1호 / 온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 80000, remark: '서류면접(일반)/인개원경력10년이상', kinds: ['서류면접'] },
    ],
  },
  {
    name: '강은서',
    aliases: ['강은서'],
    code: '',
    birth: '',
    phone: '',
    affiliation: '',
    bank: '',
    account: '',
    accountHolder: '강은서',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 25000, remark: '서면첨삭(영문)', kinds: ['서면첨삭(영문)', '서면첨삭'] },
    ],
  },
  {
    name: '김나영',
    aliases: ['김나영'],
    code: 'A210990',
    birth: '75.06.21',
    phone: '010-3780-1942',
    affiliation: '서울대학교 경력개발센터 취업 컨설턴트 / 서울시 강서구 마곡서1로 81 마곡엠벨리8단지',
    bank: '하나',
    account: '399810140-48607',
    accountHolder: '김나영',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 60000, remark: '진로취업중점', kinds: ['진로', '진로개발'] },
    ],
  },
  {
    name: '김동은',
    aliases: ['김동은'],
    code: 'A224635',
    birth: '77.03.19',
    phone: '010-5065-9883',
    affiliation: '프리랜서 / 서울시 종로구 통일로 18길 9 인왕산아이파크',
    bank: '신한',
    account: '110-323-104853',
    accountHolder: '김동은',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 20000, remark: '서면첨삭(국문)', kinds: ['서면첨삭(국문)', '서면첨삭'] },
    ],
  },
  {
    name: '김민경',
    aliases: ['김민경'],
    code: 'A123260',
    birth: '79.12.02',
    phone: '010-8929-7401',
    affiliation: '프리랜서 / 경기도 고양시 덕양구 통일로802번길 69 주공그린빌',
    bank: '농협',
    account: '302-1625-0143-71',
    accountHolder: '김민경',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '김선화',
    aliases: ['김선화'],
    code: 'A202399',
    birth: '76.02.29',
    phone: '010-4234-1815',
    affiliation: 'YEs consulting 대표 / 경기도 남양주시 호평동 늘을3로7 현대아이파크',
    bank: '국민',
    account: '43720204109028',
    accountHolder: '김선화',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(공기업/일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '김세희',
    aliases: ['김세희'],
    code: 'A217638',
    birth: '88.04.03',
    phone: '010-2623-2193',
    affiliation: '테크로스 선임 연구원 / 경기도 광명시 안현로 35 하안주공',
    bank: '우리',
    account: '1002-357-393691',
    accountHolder: '김세희',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(이공계/일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '김지현',
    aliases: ['김지현'],
    code: 'A176754',
    birth: '80.04.24',
    phone: '010-3373-4387',
    affiliation: 'HOWHR 대표 / 서울시 용산구 효창원로17 삼성',
    bank: '우리',
    account: '53114852202001',
    accountHolder: '김지현',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '범하나',
    aliases: ['범하나'],
    code: '',
    birth: '',
    phone: '',
    affiliation: '',
    bank: '',
    account: '',
    accountHolder: '범하나',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(일반)', kinds: ['서류면접'] },
      { rate: 20000, remark: '서면첨삭(국문)', kinds: ['서면첨삭(국문)', '서면첨삭'] },
    ],
  },
  {
    name: '성지우',
    aliases: ['성지우'],
    code: 'A135708',
    birth: '93.05.09',
    phone: '010-8727-2911',
    affiliation: '프리랜서 / U213, 301 Old Northern Road, Castle Hill, NSW Australia 2154',
    bank: '국민',
    account: '98727291166',
    accountHolder: '성지우',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 60000, remark: '서류면접(외국계)/(경력10년미만)', kinds: ['서류면접'] },
      { rate: 25000, remark: '서면첨삭(영문)', kinds: ['서면첨삭(영문)', '서면첨삭'] },
    ],
  },
  {
    name: '신민이',
    aliases: ['신민이'],
    code: 'A204441',
    birth: '80.09.30',
    phone: '010-3301-5007',
    affiliation: '코너스톤컨설팅 대표 / 서울시 동작구 양녕로 220 롯데캐슬파크엘',
    bank: '신한',
    account: '140-011-399423',
    accountHolder: '신민이',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 60000, remark: '진로취업중점', kinds: ['진로', '진로개발'] },
    ],
  },
  {
    name: '심영섭',
    aliases: ['심영섭'],
    code: 'A125933',
    birth: '68.07.12',
    phone: '010-3262-3977',
    affiliation: '한국외국어대 서울캠퍼스 취업교과목 겸임교수 / 서울특별시 서초구 반포동',
    bank: '국민은행',
    account: '40170295102763',
    accountHolder: '심영섭',
    placeInterview: 'ECC B306-1호 / 온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 80000, remark: '서류면접(공기업/일반)/인개원경력10년이상', kinds: ['서류면접'] },
    ],
  },
  {
    name: '양우석',
    aliases: ['양우석'],
    code: 'A216535',
    birth: '73.12.20',
    phone: '010-9697-6300',
    affiliation: '미래에셋생명 소비자보호팀 / 서울특별시 영등포구 국제금융로 56 미래에셋증권빌딩',
    bank: '카카오뱅크',
    account: '3333-16-6869473',
    accountHolder: '양우석',
    placeInterview: 'ECC B306-1호 / 온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(임원면접)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '이상환',
    aliases: ['이상환'],
    code: 'A137451',
    birth: '82.04.10',
    phone: '010-9411-6052',
    affiliation: '케이랩컴퍼니 공동대표이사 / 서울시 광진구 자양로 129, RBW타워',
    bank: '우리',
    account: '',
    accountHolder: '이상환',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(콘텐츠엔터/일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '이희영',
    aliases: ['이희영'],
    code: 'A180994',
    birth: '77.12.10',
    phone: '010-4744-3590',
    affiliation: '커리어포트',
    bank: '신한',
    account: '555-06-005615',
    accountHolder: '이희영',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '원미영',
    aliases: ['원미영', '(신규)원미영'],
    code: '',
    birth: '',
    phone: '',
    affiliation: '',
    bank: '',
    account: '',
    accountHolder: '원미영',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 65000, remark: '서류면접(외국계)/(경력 10년이상)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '장신혜',
    aliases: ['장신혜'],
    code: 'A032137',
    birth: '76.02.04',
    phone: '010-9170-7934',
    affiliation: '한국외국어대학교 미네르바 교양대학 특임강의교수 / 서울시 강남구 선릉로120',
    bank: '신한',
    account: '110-182-868518',
    accountHolder: '장신혜',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 80000, remark: '서류면접(일반)/인개원경력10년이상', kinds: ['서류면접'] },
    ],
  },
  {
    name: '정지선',
    aliases: ['정지선'],
    code: 'A210991',
    birth: '88.12.17',
    phone: '010-6502-7632',
    affiliation: '잡아이디어 수석 컨설턴트 / 서울 서초구 바우뫼로 150, 5층 혜산빌딩',
    bank: '국민',
    account: '760702-04-255638',
    accountHolder: '정지선',
    placeInterview: 'ECC B306-1호 / 온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(이공계/일반)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '지명선',
    aliases: ['지명선'],
    code: 'A218173',
    birth: '75.01.08',
    phone: '010-3368-5671',
    affiliation: 'HIGHROAD CEO / 서울시 마포구 연남로3길 22-5',
    bank: '국민',
    account: '012-21-1106-284',
    accountHolder: '지명선',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 75000, remark: '서류면접(외국계)/(경력10년이상)', kinds: ['서류면접'] },
    ],
  },
  {
    name: '최윤호',
    aliases: ['최윤호'],
    code: 'A219674',
    birth: '84.10.29',
    phone: '010-3349-6269',
    affiliation: '레이첨단소재 / 서울시 마곡동로 10길7',
    bank: '신한',
    account: '110206328962',
    accountHolder: '최윤호',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 20000, remark: '서면첨삭(국문)', kinds: ['서면첨삭(국문)', '서면첨삭'] },
    ],
  },
  {
    name: '최미화',
    aliases: ['최미화', '(신규)최미화'],
    code: 'A030265',
    birth: '84.12.11',
    phone: '010-5547-6671',
    affiliation: '경기도 수원시 영통구 덕영대로 1462-14',
    bank: '신한',
    account: '110-141-100922',
    accountHolder: '최미화',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 20000, remark: '서면첨삭(국문)', kinds: ['서면첨삭(국문)', '서면첨삭'] },
    ],
  },
  {
    name: '한 나',
    aliases: ['한나', '한 나'],
    code: 'A026768',
    birth: '83.11.06',
    phone: '010-3974-2941',
    affiliation: '프리랜서 / 서울시 서대문구 가재울미래로2 DMC파크뷰자이',
    bank: '신한',
    account: '110303122961',
    accountHolder: '한 나',
    placeInterview: '온라인 ZOOM',
    placeCorrection: '온라인 접수',
    rates: [
      { rate: 70000, remark: '서류면접(일반)', kinds: ['서류면접'] },
    ],
  },
];

export function findConsultantMaster(name) {
  const key = normalizeConsultantKey(name);
  return (
    CONSULTANT_MASTER.find(
      (p) =>
        normalizeConsultantKey(p.name) === key
        || (p.aliases || []).some((a) => normalizeConsultantKey(a) === key)
    ) || null
  );
}

export function findMasterRates(name, preferRemarkIncludes = '') {
  const master = findConsultantMaster(name);
  if (!master?.rates?.length) return [];
  if (!preferRemarkIncludes) return master.rates;
  const preferred = master.rates.filter(
    (r) =>
      r.remark.includes(preferRemarkIncludes)
      || (r.kinds || []).some((k) => k.includes(preferRemarkIncludes))
  );
  return preferred.length ? preferred : master.rates;
}
