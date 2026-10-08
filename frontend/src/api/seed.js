// 데모용 예시 데이터. 사람 이름(부서 담당자)과 날짜는 모두 예시입니다.
// 날짜는 오늘을 기준으로 며칠 전인지로 만들어 "멈춘 이슈" 표시가 항상 보이게 합니다.

const DAY = 86400000
function ago(days, hour = 10) {
  const d = new Date(Date.now() - days * DAY)
  d.setHours(hour, 0, 0, 0)
  return toLocalIso(d)
}
function dateAgo(days) {
  return ago(days).slice(0, 10)
}
function toLocalIso(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

export const DEFAULT_SECTIONS = [
  { title: '제품 소개', cert: false },
  { title: '안전 및 주의사항', cert: true },
  { title: '제품 특성 및 기능', cert: false },
  { title: '구성품', cert: false },
  { title: '사용 방법', cert: false },
  { title: '제품 규격', cert: false },
  { title: '전자파 적합성(EMC)', cert: true },
  { title: '운송', cert: false },
  { title: '보관', cert: false },
  { title: '세척 방법', cert: false },
  { title: '서비스 및 보증', cert: false },
]

export const DEFAULT_REASONS = ['사양 변경 필요', '시험 결과 반영', '부품 단종·교체', '자료 누락', '오류 수정', '인증 문구 확인', '기타']

export function buildSeed() {
  const users = [
    { id: 'u1', username: 'khlee', name: '이경환', dept: '매뉴얼', admin: true, release: true },
    { id: 'u2', username: 'hsjeon', name: '전현수', dept: '매뉴얼', admin: false, release: false },
    { id: 'u3', username: 'whlee', name: '이왕희', dept: '매뉴얼', admin: false, release: false },
    { id: 'u4', username: 'mech', name: '기구 담당(예시)', dept: '기구', admin: false, release: false },
    { id: 'u5', username: 'elec', name: '전자 담당(예시)', dept: '전자', admin: false, release: false },
    { id: 'u6', username: 'sw', name: 'SW 담당(예시)', dept: '소프트웨어', admin: false, release: false },
    { id: 'u7', username: 'qa', name: '품질 담당(예시)', dept: '품질', admin: false, release: false },
    { id: 'u8', username: 'prod', name: '생산 담당(예시)', dept: '생산', admin: false, release: false },
  ]

  const manuals = [
    {
      id: 'm1', product: 'LooksCAM S3', docNo: 'LC-S3-UM-KO', lang: '한국어', rev: 2, status: 'drafted',
      drafterId: 'u1', draftedAt: ago(60), path: '\\\\NAS\\manuals\\LC-S3-UM-KO\\현재\\LooksCAM_S3_사용설명서.docx',
    },
    {
      id: 'm2', product: 'L2S X6', docNo: 'L2S-X6-UM-KO', lang: '한국어', rev: 0, status: 'drafting',
      drafterId: 'u2', draftedAt: null, path: '\\\\NAS\\manuals\\L2S-X6-UM-KO\\현재\\L2S_X6_사용설명서.docx',
    },
    {
      id: 'm3', product: 'LooksCAM S3', docNo: 'LC-S3-UM-EN', lang: '영어', rev: 1, status: 'drafted',
      drafterId: 'u1', draftedAt: ago(80), path: '\\\\NAS\\manuals\\LC-S3-UM-EN\\현재\\LooksCAM_S3_User_Manual.docx',
    },
  ]

  const sections = []
  for (const m of manuals) {
    DEFAULT_SECTIONS.forEach((s, i) => sections.push({ id: `${m.id}-s${i + 1}`, manualId: m.id, no: i + 1, title: s.title, cert: s.cert }))
  }
  const sec = (m, no) => `${m}-s${no}`

  // status: requested | fixing | done, confirmedAt 이 있으면 요청자가 확인함
  const issues = [
    {
      id: 'i1', no: 14, manualId: 'm1', sectionId: sec('m1', 7), title: 'EMI 시험 FAIL에 따른 페라이트 사양 수정',
      reason: '시험 결과 반영', body: 'EMI 시험 FAIL로 페라이트 사양 변경이 필요합니다.',
      doneWhen: '최종 PASS 결과 확인 후 확정된 페라이트 사양을 매뉴얼에 반영', refs: '시험 성적서 EMI-2026-031', due: dateAgo(-7),
      requesterId: 'u1', assigneeId: 'u5', status: 'requested', requestedAt: ago(5), startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
    {
      id: 'i2', no: 15, manualId: 'm1', sectionId: sec('m1', 4), title: 'USB 케이블 단종으로 모델 교체',
      reason: '부품 단종·교체', body: '시중품 USB 케이블 단종으로 대체 모델로 바뀝니다. 구성품 사진과 품번 수정 필요.',
      doneWhen: '구성품 표의 케이블 품번·사진이 새 모델로 바뀜', refs: '', due: dateAgo(-3),
      requesterId: 'u8', assigneeId: 'u4', status: 'fixing', requestedAt: ago(6), startedAt: ago(4), doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
    {
      id: 'i3', no: 16, manualId: 'm1', sectionId: sec('m1', 5), title: 'Viewer 화면의 Recording 기능 설명 추가',
      reason: '자료 누락', body: 'Viewer 1.4부터 Recording 버튼이 생겼는데 사용 방법에 설명이 없습니다.',
      doneWhen: 'Recording 시작·정지·저장 위치 설명과 화면 캡처 추가', refs: 'Viewer 1.4 릴리스 노트', due: null,
      requesterId: 'u2', assigneeId: 'u6', status: 'done', requestedAt: ago(9), startedAt: ago(8), doneAt: ago(1, 16), confirmedAt: null,
      resolution: 'Viewer 화면의 Recording 기능 설명 추가 (5.3절, 캡처 2장)', revision: null,
    },
    {
      id: 'i4', no: 13, manualId: 'm1', sectionId: sec('m1', 3), title: 'LED 밝기 조절 단계 변경',
      reason: '사양 변경 필요', body: 'LED 밝기 조절이 2단에서 3단으로 바뀌었습니다. 제품 규격 표도 함께 수정해 주세요.',
      doneWhen: '3장 기능 설명과 6장 규격 표 모두 3단으로 수정', refs: '', due: null,
      requesterId: 'u1', assigneeId: 'u5', status: 'done', requestedAt: ago(15), startedAt: ago(14), doneAt: ago(10), confirmedAt: ago(9),
      resolution: 'LED 밝기 조절 2단 → 3단, 제품 규격도 수정', revision: null,
    },
    {
      id: 'i5', no: 17, manualId: 'm1', sectionId: sec('m1', 2), title: '배터리 폐기 문구 인증 기준 확인',
      reason: '인증 문구 확인', body: '식약처 표시 기준 개정으로 배터리 폐기 문구가 맞는지 확인이 필요합니다.',
      doneWhen: '현행 기준 문구와 일치 여부 확인, 다르면 수정', refs: '식약처 고시 (번호 확인 필요)', due: null,
      requesterId: 'u3', assigneeId: 'u7', status: 'requested', requestedAt: ago(1), startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
    {
      id: 'i6', no: 12, manualId: 'm1', sectionId: sec('m1', 6), title: '제품 무게 값이 S2 값으로 남아 있음',
      reason: '오류 수정', body: '제품 규격의 무게가 이전 모델(S2) 값 그대로입니다.',
      doneWhen: '실측 무게로 수정', refs: '', due: null,
      requesterId: 'u2', assigneeId: 'u4', status: 'done', requestedAt: ago(20), startedAt: ago(19), doneAt: ago(18), confirmedAt: ago(17),
      resolution: '제품 무게 182g → 205g (S3 실측값)', revision: null,
    },
    {
      id: 'i7', no: 11, manualId: 'm1', sectionId: sec('m1', 6), title: '소비전류 값 변경',
      reason: '사양 변경 필요', body: '전원부 변경으로 소비전류가 바뀌었습니다.',
      doneWhen: '제품 규격 표의 소비전류 값 수정', refs: '', due: null,
      requesterId: 'u1', assigneeId: 'u5', status: 'done', requestedAt: ago(40), startedAt: ago(39), doneAt: ago(37), confirmedAt: ago(36),
      resolution: '제품 규격의 소비전류 값 변경 (450mA → 380mA)', revision: 2,
    },
    {
      id: 'i8', no: 3, manualId: 'm2', sectionId: sec('m2', 4), title: '구성품 도면 필요',
      reason: '자료 누락', body: '구성품 절에 들어갈 X6 외형 도면과 제품 사진이 아직 없습니다.',
      doneWhen: '외형 도면 1장, 구성품 사진 1장을 원본에 넣음', refs: '', due: null,
      requesterId: 'u2', assigneeId: 'u4', status: 'requested', requestedAt: ago(4), startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
    {
      id: 'i9', no: 4, manualId: 'm2', sectionId: sec('m2', 6), title: '전기적 사양 확인',
      reason: '자료 누락', body: '정격 전압, 소비전력, 배터리 용량 값을 주세요. 표는 만들어 두었습니다.',
      doneWhen: '제품 규격 표의 전기 항목 채움', refs: '', due: null,
      requesterId: 'u2', assigneeId: 'u5', status: 'fixing', requestedAt: ago(3), startedAt: ago(1), doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
    {
      id: 'i10', no: 5, manualId: 'm3', sectionId: sec('m3', 5), title: 'Viewer Recording 기능 설명 추가 (영문판)',
      reason: '자료 누락', body: '한글판 이슈 #16과 같은 내용을 영문판에도 반영해 주세요.',
      doneWhen: 'Recording 설명과 캡처 추가', refs: '한글판 #16', due: null,
      requesterId: 'u1', assigneeId: 'u3', status: 'requested', requestedAt: ago(2), startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
    },
  ]

  const revisions = [
    { id: 'r1', manualId: 'm1', rev: 0, date: dateAgo(210), summary: '초판 발행', byId: 'u1', issueIds: [] },
    { id: 'r2', manualId: 'm1', rev: 1, date: dateAgo(120), summary: '세척 방법 문구 보완; 서비스 연락처 변경', byId: 'u1', issueIds: [] },
    { id: 'r3', manualId: 'm1', rev: 2, date: dateAgo(35), summary: '제품 규격의 소비전류 값 변경 (450mA → 380mA)', byId: 'u1', issueIds: ['i7'] },
    { id: 'r4', manualId: 'm3', rev: 0, date: dateAgo(200), summary: '초판 발행', byId: 'u1', issueIds: [] },
    { id: 'r5', manualId: 'm3', rev: 1, date: dateAgo(34), summary: 'Power consumption value updated', byId: 'u1', issueIds: [] },
  ]

  const files = [
    { id: 'f1', manualId: 'm1', kind: 'rev', issueId: null, rev: 2, at: ago(35), name: 'LC-S3-UM-KO_Rev02.docx', size: 18.4 },
    { id: 'f2', manualId: 'm1', kind: 'issue', issueId: 'i7', rev: null, at: ago(37), name: 'LC-S3-UM-KO_#11_소비전류.docx', size: 18.4 },
    { id: 'f3', manualId: 'm1', kind: 'issue', issueId: 'i6', rev: null, at: ago(18), name: 'LC-S3-UM-KO_#12_무게.docx', size: 18.5 },
    { id: 'f4', manualId: 'm1', kind: 'issue', issueId: 'i4', rev: null, at: ago(10), name: 'LC-S3-UM-KO_#13_LED.docx', size: 18.5 },
    { id: 'f5', manualId: 'm1', kind: 'issue', issueId: 'i3', rev: null, at: ago(1, 16), name: 'LC-S3-UM-KO_#16_Recording.docx', size: 19.6 },
  ]

  const events = []
  let ev = 0
  const log = (at, userId, manualId, issueId, type, text) => events.push({ id: 'e' + ++ev, at, userId, manualId, issueId, type, text })
  for (const i of issues) {
    log(i.requestedAt, i.requesterId, i.manualId, i.id, 'create', `수정 요청 작성, 수정자 지정: ${users.find(u => u.id === i.assigneeId).name}`)
    if (i.startedAt) log(i.startedAt, i.assigneeId, i.manualId, i.id, 'start', '수정 시작')
    if (i.doneAt) log(i.doneAt, i.assigneeId, i.manualId, i.id, 'complete', `수정 완료: ${i.resolution}`)
    if (i.confirmedAt) log(i.confirmedAt, i.requesterId, i.manualId, i.id, 'confirm', '요청자 확인')
  }
  log(ago(35), 'u1', 'm1', null, 'revision', 'Rev.02 확정')
  log(ago(60), 'u1', 'm1', null, 'drafted', '초안 완료')

  return {
    users, manuals, sections, issues, revisions, files, events,
    settings: { stallDays: 3, reasons: DEFAULT_REASONS, sectionTemplate: DEFAULT_SECTIONS },
    seq: { issue: 100, manual: 10, file: 100, event: 1000, revision: 10, ai: 1 },
  }
}

export { ago, toLocalIso }
