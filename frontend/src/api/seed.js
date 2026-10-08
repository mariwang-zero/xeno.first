// 데모용 예시 데이터. 제품 목록은 과제계획서 그림 1, 시나리오는 7장(LooksCAM3 첫 시험)을 따릅니다.
// 매뉴얼 본문은 화면을 보여 주기 위한 예시 문장이며 실제 매뉴얼 내용이 아닙니다.

export function toLocalIso(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}
function at(daysAgo, hh = 10, mm = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hh, mm, 0, 0)
  return toLocalIso(d)
}
const day = n => at(n).slice(0, 10)

// ── 매뉴얼 본문 (페이지 → 블록) ─────────────────────────────
function pages(list) {
  return list.map((blocks, i) => ({
    no: i + 1,
    blocks: blocks.map((b, j) => ({ id: `p${i + 1}-b${j + 1}`, ...b })),
  }))
}
const h = (text, cert) => ({ type: 'h', text, cert: !!cert })
const p = text => ({ type: 'p', text })
const img = text => ({ type: 'img', text })
const table = rows => ({ type: 'table', rows })

export function cameraManual(model) {
  return pages([
    [h('1. 제품 소개'), p(`${model}는 의료용 루페에 장착하여 시술 장면을 촬영하는 소형 카메라입니다.`), p(`본 설명서는 ${model}의 설치, 사용, 관리 방법을 설명합니다.`), img('제품 전체 사진')],
    [h('2. 안전 및 주의사항', true), p('제품을 사용하기 전에 이 설명서를 끝까지 읽어 주십시오.'), p('렌즈를 태양이나 강한 광원에 직접 향하게 하지 마십시오.'), p('배터리는 지정된 충전기로만 충전하십시오.')],
    [h('3. 제품 특성 및 기능'), p('1080p Full HD 영상 녹화를 지원합니다.'), p('Viewer 프로그램에서 실시간 화면을 확인할 수 있습니다.'), h('4. 구성품'), table([['품목', '수량'], ['카메라 본체', '1'], ['USB 케이블 (1.5m)', '1'], ['클립 마운트', '1']])],
    [h('5. 사용 방법'), p('카메라를 클립 마운트로 루페에 고정합니다.'), p('USB 케이블로 PC에 연결한 뒤 Viewer를 실행합니다.'), img('루페 장착 그림')],
    [h('6. 제품 규격'), table([['항목', '규격'], ['해상도', '1920 × 1080'], ['소비전류', '350 mA'], ['무게', '28 g']]), h('7. 전자파 적합성(EMC)', true), p('본 제품은 IEC 60601-1-2 요구사항을 만족합니다.')],
    [h('8. 운송 및 보관'), p('보관 온도: -10 ~ 50 °C, 습도 85% 이하'), h('9. 세척 방법'), p('부드러운 천에 소독용 알코올을 묻혀 닦아 주십시오.'), h('10. 서비스 및 보증'), p('보증 기간은 구입일로부터 1년입니다.')],
  ])
}

export function lightManual(model) {
  return pages([
    [h('1. 제품 소개'), p(`${model}는 루페에 장착하는 LED 조명입니다.`), img('제품 전체 사진')],
    [h('2. 안전 및 주의사항', true), p('LED를 눈으로 직접 바라보지 마십시오.'), h('3. 사용 방법'), p('밝기 조절 버튼으로 밝기를 2단으로 조절합니다.')],
    [h('4. 제품 규격'), table([['항목', '규격'], ['밝기', '45,000 lux'], ['배터리', '2개 (교체형)'], ['사용 시간', '4시간']])],
  ])
}

// AI 추천 항목을 본문에 반영한다. 찾지 못한 항목은 failed 로 돌려준다. (mock.js 도 같은 함수를 씀)
export function applyItems(pgs, items) {
  const out = JSON.parse(JSON.stringify(pgs))
  const failed = []
  for (const it of items) {
    const page = out.find(pg => pg.no === it.page)
    let ok = false
    if (page && it.op === 'add') {
      const idx = page.blocks.findIndex(b => b.type === 'p' && b.text.includes(it.anchor))
      if (idx >= 0) {
        page.blocks.splice(idx + 1, 0, { id: `p${page.no}-n${it.no}`, type: 'p', text: it.after })
        ok = true
      }
    } else if (page) {
      for (const b of page.blocks) {
        if (b.type === 'table') {
          for (const row of b.rows) row.forEach((c, k) => { if (!ok && c.includes(it.before)) { row[k] = c.replace(it.before, it.after); ok = true } })
        } else if (b.text && b.text.includes(it.before)) {
          b.text = b.text.replace(it.before, it.after)
          ok = true
        }
        if (ok) break
      }
    }
    if (!ok) failed.push({ no: it.no, reason: '수정 위치를 찾지 못했습니다' })
  }
  return { pages: out, failed }
}

// LooksCAM3 첫 시험 때 AI가 낸 추천 목록 (예시)
function looksCam3Items() {
  return [
    { no: 1, page: 1, kind: 'text', note: 'ai', before: 'LooksCAM2는 의료용', after: 'LooksCAM3는 의료용', summary: '제품명을 LooksCAM3로 변경', basis: 'LooksCAM3 사양서 1p', checked: true },
    { no: 2, page: 1, kind: 'text', note: 'ai', before: '본 설명서는 LooksCAM2의', after: '본 설명서는 LooksCAM3의', summary: '제품명을 LooksCAM3로 변경', basis: 'LooksCAM3 사양서 1p', checked: true },
    { no: 3, page: 1, kind: 'image', note: 'manual', before: '제품 전체 사진', after: '', summary: '구형 사진을 신형 제품 사진으로 교체', basis: 'LooksCAM3 제품 사진.jpg', checked: false },
    { no: 4, page: 2, kind: 'text', note: 'check', cert: true, before: '배터리는 지정된 충전기로만 충전하십시오.', after: '(문장 삭제)', summary: 'USB 전원 제품이라 배터리 문구 삭제 제안. 인증 문구가 있는 절이라 확인 필요', basis: 'LooksCAM3 사양서 3p', checked: false },
    { no: 5, page: 3, kind: 'text', note: 'ai', before: '1080p Full HD 영상 녹화를 지원합니다.', after: '4K UHD 영상 녹화를 지원합니다.', summary: '기능 설명을 신규 사양에 맞게 수정', basis: 'LooksCAM3 사양서 2p', checked: true },
    { no: 6, page: 3, kind: 'text', note: 'ai', op: 'add', anchor: 'Viewer 프로그램에서', before: '', after: 'Viewer의 Recording 버튼으로 영상을 PC에 바로 저장할 수 있습니다.', summary: '신규 기능 설명 문단 추가', basis: '작성 참고 내용 2번', checked: true },
    { no: 7, page: 3, kind: 'table', note: 'ai', before: 'USB 케이블 (1.5m)', after: 'USB-C 케이블 (2m)', summary: '구성품 표의 케이블 사양 변경', basis: 'LooksCAM3 구성품 목록.xlsx', checked: true },
    { no: 8, page: 4, kind: 'image', note: 'manual', before: '루페 장착 그림', after: '', summary: '장착 그림을 신형 클립으로 교체', basis: 'LooksCAM3 제품 사진.jpg', checked: false },
    { no: 9, page: 5, kind: 'table', note: 'ai', before: '1920 × 1080', after: '3840 × 2160', summary: '해상도 값을 신규 자료 기준으로 변경', basis: 'LooksCAM3 사양서 2p', checked: true },
    { no: 10, page: 5, kind: 'table', note: 'check', before: '350 mA', after: '420 mA', summary: '소비전류 값 변경 제안. 사양서(420 mA)와 시험성적서(400 mA)가 서로 다름', basis: 'LooksCAM3 사양서 2p, EMC 시험성적서 5p', checked: false },
  ]
}

export function buildSeed() {
  const users = [
    { id: 'u1', username: 'lkh', name: '이경환', dept: '매뉴얼', role: 'owner', admin: true, active: true },
    { id: 'u2', username: 'jhs', name: '전현수', dept: '매뉴얼', role: 'owner', admin: false, active: true },
    { id: 'u3', username: 'lwh', name: '이왕희', dept: '매뉴얼', role: 'reviewer', admin: false, active: true },
    { id: 'u4', username: 'final', name: '최종 검토자(예시)', dept: '품질', role: 'final', admin: false, active: true },
    { id: 'u5', username: 'mech', name: '기구 담당(예시)', dept: '기구', role: 'user', admin: false, active: true },
    { id: 'u6', username: 'elec', name: '전자 담당(예시)', dept: '전자', role: 'user', admin: false, active: true },
    { id: 'u7', username: 'sw', name: 'SW 담당(예시)', dept: '소프트웨어', role: 'user', admin: false, active: true },
    { id: 'u8', username: 'qa', name: '품질 담당(예시)', dept: '품질', role: 'reviewer', admin: false, active: true },
  ]

  const categories = [
    { id: 'c1', name: '루페', order: 1 },
    { id: 'c2', name: '라이트', order: 2 },
    { id: 'c3', name: '카메라', order: 3 },
  ]
  const P = (id, categoryId, name, docNo, rev, order) => ({ id, categoryId, name, docNo, rev, order, hidden: false, currentVersionId: null })
  const products = [
    P('p1', 'c1', 'Looks 시리즈', 'LS-UM-KO', 4, 1),
    P('p2', 'c1', 'Looks-H 시리즈', 'LH-UM-KO', 2, 2),
    P('p3', 'c2', 'L2SW', 'L2SW-UM-KO', 0, 1),
    P('p4', 'c2', 'L2SN5', 'L2SN5-UM-KO', 3, 2),
    P('p5', 'c2', 'L2SX6', 'L2SX6-UM-KO', 1, 3),
    P('p6', 'c2', 'XD-Light', 'XDL-UM-KO', 5, 4),
    P('p7', 'c2', 'XD-Light4', 'XDL4-UM-KO', 0, 5),
    P('p8', 'c3', 'LooksCAM2', 'LC2-UM-KO', 3, 1),
    P('p9', 'c3', 'LooksCAM3', 'LC3-UM-KO', 0, 2),
    P('p10', 'c3', 'LooksCAM-LT', 'LCLT-UM-KO', 1, 3),
  ]

  const cam2 = cameraManual('LooksCAM2')
  const r1Items = looksCam3Items()
  const cam3 = applyItems(cam2, r1Items.filter(i => i.checked)).pages

  const docs = [
    { id: 'd1', productId: 'p9', title: 'LooksCAM3 KO 사용설명서 신규 작성', status: 'progress', held: null, ownerId: 'u1', lock: null, createdAt: at(9, 9), pages: cam3, manualLeft: [3, 8] },
    { id: 'd2', productId: 'p8', title: 'LooksCAM2 KO 사용설명서 Rev.03 개정', status: 'deploy', held: null, ownerId: 'u1', lock: null, createdAt: at(60), pages: cam2, manualLeft: [] },
    { id: 'd3', productId: 'p5', title: 'L2SX6 KO 사용설명서 Rev.02 개정', status: 'review', held: null, ownerId: 'u2', lock: null, createdAt: at(20), pages: lightManual('L2SX6'), manualLeft: [] },
    { id: 'd4', productId: 'p7', title: 'XD-Light4 KO 사용설명서 신규 작성', status: 'progress', held: { reason: '신규 배터리 사양 결정 대기', at: at(4), userId: 'u2' }, ownerId: 'u2', lock: { userId: 'u2', at: at(4, 15) }, createdAt: at(15), pages: lightManual('XD-Light4'), manualLeft: [] },
    { id: 'd5', productId: 'p3', title: 'L2SW KO 사용설명서 신규 작성', status: 'ai', held: null, ownerId: 'u2', lock: null, createdAt: at(0, 9, 10), pages: null, manualLeft: [] },
  ]

  const V = (id, docId, kind, name, daysAgo, userId, note, size) => ({ id, docId, kind, name, at: at(daysAgo, 11), userId, note, size })
  const versions = [
    V('v1', 'd2', 'original', 'LC2-UM-KO_Rev02.docx', 62, 'u1', 'Rev.02 원본 등록', 4.1),
    V('v2', 'd2', 'review', 'LC2-UM-KO_Rev03_검토본.docx', 40, 'u1', '편집본 올림: USB 케이블 길이 변경', 4.2),
    V('v3', 'd2', 'final', 'LC2-UM-KO_Rev03.docx', 31, 'u4', '최종 검토 완료', 4.2),
    V('v4', 'd1', 'original', 'LC2-UM-KO_Rev03.docx (기존 레퍼런스)', 9, 'u1', 'AI 초안의 기준 문서', 4.2),
    V('v5', 'd1', 'ai', 'LC3-UM-KO_AI초안.docx', 9, 'u1', 'AI 추천 6건 반영', 4.3),
    V('v6', 'd1', 'review', 'LC3-UM-KO_검토본_1.docx', 3, 'u5', '편집본 올림: 클립 마운트 명칭 정리', 4.4),
    V('v7', 'd3', 'original', 'L2SX6-UM-KO_Rev01.docx', 21, 'u2', '원본 등록', 2.2),
    V('v8', 'd3', 'review', 'L2SX6-UM-KO_Rev02_검토본.docx', 2, 'u2', '검토 요청 시점 버전', 2.3),
    V('v9', 'd4', 'original', 'XD-Light_Rev05.docx (기존 레퍼런스)', 15, 'u2', '기준 문서', 2.0),
  ]
  products.find(x => x.id === 'p8').currentVersionId = 'v3'
  products.find(x => x.id === 'p5').currentVersionId = 'v7'

  const files = [
    { id: 'f1', docId: 'd1', name: 'LooksCAM3 사양서.pdf', size: 1.2, at: at(9, 9, 20), userId: 'u1' },
    { id: 'f2', docId: 'd1', name: 'LooksCAM3 제품 사진.jpg', size: 3.4, at: at(9, 9, 21), userId: 'u1' },
    { id: 'f3', docId: 'd1', name: 'LooksCAM3 구성품 목록.xlsx', size: 0.1, at: at(9, 9, 22), userId: 'u1' },
    { id: 'f4', docId: 'd1', name: 'EMC 시험성적서.pdf', size: 2.7, at: at(9, 9, 23), userId: 'u1' },
    { id: 'f5', docId: 'd5', name: 'L2SW 사양서.pdf', size: 0.9, at: at(0, 9, 12), userId: 'u2' },
  ]

  const aiRuns = [
    {
      id: 'r1', docId: 'd1', userId: 'u1', at: at(9, 9, 30), status: 'applied', appliedAt: at(9, 10, 5),
      inputs: { reference: 'LC2-UM-KO_Rev03.docx', sources: ['LooksCAM3 사양서.pdf', 'LooksCAM3 제품 사진.jpg', 'LooksCAM3 구성품 목록.xlsx', 'EMC 시험성적서.pdf'], mustInclude: '1. 제품명은 LooksCAM3로 통일\n2. Viewer Recording 기능 설명 추가', extra: '이미지는 바꾸지 말 것' },
      items: r1Items, failures: [], result: { applied: 6, failed: [], manual: 2 },
    },
    {
      id: 'r2', docId: 'd5', userId: 'u2', at: at(0, 9, 15), status: 'ready', appliedAt: null,
      inputs: { reference: 'L2SX6-UM-KO_Rev01.docx', sources: ['L2SW 사양서.pdf', '제품 사진.zip'], mustInclude: '밝기 3단 조절', extra: '' },
      items: [
        { no: 1, page: 1, kind: 'text', note: 'ai', before: 'L2SX6는 루페에', after: 'L2SW는 루페에', summary: '제품명을 L2SW로 변경', basis: 'L2SW 사양서 1p', checked: true },
        { no: 2, page: 1, kind: 'image', note: 'manual', before: '제품 전체 사진', after: '', summary: '제품 사진 교체', basis: '(사진 자료 없음)', checked: false },
        { no: 3, page: 2, kind: 'text', note: 'ai', before: '밝기를 2단으로', after: '밝기를 3단으로', summary: 'LED 밝기 조절 방법 수정', basis: '작성 참고 내용', checked: true },
        { no: 4, page: 3, kind: 'table', note: 'ai', before: '45,000 lux', after: '60,000 lux', summary: '밝기 값 변경', basis: 'L2SW 사양서 2p', checked: true },
        { no: 5, page: 3, kind: 'table', note: 'check', before: '2개 (교체형)', after: '1개 (내장형)', summary: '배터리 사양 변경 제안. 근거 자료 부족', basis: '(근거 없음)', checked: false },
      ],
      failures: [{ file: '제품 사진.zip', reason: '압축 파일은 읽을 수 없습니다. 사진을 따로 올려 주세요.' }],
      result: null,
    },
  ]

  const R = o => ({ kind: 'request', reason: '', doneWhen: '', due: null, resolution: '', comments: [], startedAt: null, doneAt: null, closedAt: null, ...o })
  const requests = [
    R({ id: 'q1', no: 1, docId: 'd1', page: 5, anchor: { type: 'text', blockId: 'p5-b2', quote: '350 mA' }, title: '소비전류 값 확인', body: '사양서는 420 mA, EMC 시험성적서는 400 mA입니다. 최종 값을 확인해 주세요.', reason: '자료 불일치', doneWhen: '확정된 값으로 규격표 수정', due: day(-3), requesterId: 'u1', assigneeId: 'u6', status: 'checking', createdAt: at(8, 14), startedAt: at(6, 10) }),
    R({ id: 'q2', no: 2, docId: 'd1', page: 1, anchor: { type: 'area', rect: { x: 0.08, y: 0.15, w: 0.84, h: 0.4 } }, title: '제품 사진 신형으로 교체', body: 'AI 추천 3번 항목(수작업 권장)입니다. 신형 사진으로 바꿔 주세요.', reason: '신규 제품', doneWhen: '신형 제품 사진 반영', due: day(2), requesterId: 'u1', assigneeId: 'u5', status: 'requested', createdAt: at(8, 14, 20) }),
    R({ id: 'q3', no: 3, docId: 'd1', page: 2, anchor: { type: 'text', blockId: 'p2-b4', quote: '배터리는 지정된 충전기로만 충전하십시오.' }, title: '배터리 문구 삭제 여부', body: 'USB 전원 제품인데 배터리 문구가 남아 있습니다. 인증 문구가 있는 절이라 확인 부탁드립니다.', reason: '인증 문구 확인', doneWhen: '삭제 또는 유지 결정 후 반영', requesterId: 'u1', assigneeId: 'u8', status: 'done', createdAt: at(7, 11), startedAt: at(6, 9), doneAt: at(1, 16), resolution: 'USB 전원 제품이라 배터리 문구 삭제. 인증 문구 영향 없음 확인' }),
    R({ id: 'q4', no: 4, docId: 'd1', page: 3, anchor: { type: 'text', blockId: 'p3-n6', quote: 'Recording 버튼' }, title: 'Recording 설명 보완', body: '저장 위치도 함께 적어 주세요.', reason: '기능 추가', doneWhen: '저장 폴더 위치 설명 추가', requesterId: 'u2', assigneeId: 'u7', status: 'closed', createdAt: at(7, 15), startedAt: at(6, 13), doneAt: at(5, 10), closedAt: at(4, 9), resolution: 'Viewer Recording 저장 폴더 위치 설명 추가' }),
    R({ id: 'q5', no: 5, docId: 'd1', page: 4, anchor: { type: 'area', rect: { x: 0.08, y: 0.15, w: 0.84, h: 0.4 } }, title: '루페 장착 그림 교체', body: '신형 클립 마운트 그림으로 바꿔 주세요.', reason: '신규 제품', doneWhen: '장착 그림 교체', due: day(-5), requesterId: 'u2', assigneeId: 'u5', status: 'requested', createdAt: at(6, 10) }),
    R({ id: 'q6', no: 6, docId: 'd1', page: 3, kind: 'memo', anchor: { type: 'text', blockId: 'p3-b2', quote: '4K UHD' }, title: '', body: '마케팅 자료의 표기(4K Ultra HD)와 맞출지 검토', requesterId: 'u3', assigneeId: null, status: 'closed', createdAt: at(5, 16) }),
    R({ id: 'q7', no: 7, docId: 'd1', page: 6, kind: 'ai', anchor: { type: 'text', blockId: 'p6-b6', quote: '보증 기간은 구입일로부터 1년입니다.' }, title: '', body: 'EU 판매 시 보증 기간 표기 기준이 따로 있나?', answer: '등록된 자료에는 EU 판매용 보증 기간의 근거가 없습니다. 판매 지역별 기준은 영업·품질 담당 확인이 필요합니다. (AI는 등록된 자료만 봅니다)', requesterId: 'u1', assigneeId: null, status: 'closed', createdAt: at(2, 11) }),
    R({ id: 'q8', no: 1, docId: 'd3', page: 3, anchor: { type: 'text', blockId: 'p3-b2', quote: '4시간' }, title: '사용 시간 시험값 반영', body: '시험 결과 4.5시간입니다.', reason: '시험 결과', doneWhen: '규격표 수정', requesterId: 'u2', assigneeId: 'u6', status: 'closed', createdAt: at(10), startedAt: at(9), doneAt: at(8), closedAt: at(7), resolution: '사용 시간 4시간 → 4.5시간' }),
  ]

  const A = (docId, daysAgo, hh, userId, text, change) => ({ docId, at: at(daysAgo, hh), userId, text, change: !!change })
  const activity = [
    A('d2', 31, 11, 'u4', '최종 검토 완료', true),
    A('d2', 30, 9, 'u4', '배포: Rev.03 (USB 케이블 길이 변경)', true),
    A('d1', 9, 9, 'u1', '작업 시작: AI 초안 생성'),
    A('d1', 9, 10, 'u1', 'AI 추천 10건 중 6건 반영, 이미지 2건 수작업으로 남김', true),
    A('d1', 8, 14, 'u1', '수정 요청 #1 소비전류 값 확인 → 전자 담당(예시)'),
    A('d1', 8, 14, 'u1', '수정 요청 #2 제품 사진 신형으로 교체 → 기구 담당(예시)'),
    A('d1', 5, 10, 'u7', '수정 완료 #4: Viewer Recording 저장 폴더 위치 설명 추가', true),
    A('d1', 3, 11, 'u5', '편집본 올림: 클립 마운트 명칭 정리', true),
    A('d1', 1, 16, 'u8', '수정 완료 #3: USB 전원 제품이라 배터리 문구 삭제', true),
    A('d3', 2, 11, 'u2', '검토 요청'),
    A('d4', 4, 15, 'u2', '보류: 신규 배터리 사양 결정 대기'),
    A('d5', 0, 9, 'u2', 'AI 분석 완료: 추천 5건, 읽지 못한 자료 1건'),
  ]

  const revs = [
    { productId: 'p8', rev: 1, summary: '최초 배포', at: day(400), userId: 'u1' },
    { productId: 'p8', rev: 2, summary: 'EMI 시험 FAIL에 따라 페라이트 사양 변경', at: day(180), userId: 'u1' },
    { productId: 'p8', rev: 3, summary: 'USB 케이블 길이 변경, Viewer 화면의 Recording 기능 설명 추가', at: day(30), userId: 'u4' },
    { productId: 'p5', rev: 1, summary: '최초 배포', at: day(120), userId: 'u2' },
  ]

  const N = (userId, daysAgo, hh, text, link, read) => ({ userId, at: at(daysAgo, hh), text, link, read: !!read })
  const notifications = [
    N('u1', 1, 16, '품질 담당(예시)님이 #3 배터리 문구 삭제 여부를 수정 완료했습니다. 확인해 주세요.', '/docs/d1?req=q3'),
    N('u1', 0, 9, 'L2SX6 사용설명서 검토 요청이 왔습니다.', '/docs/d3', true),
    N('u6', 8, 14, '이경환님이 #1 소비전류 값 확인을 요청했습니다.', '/docs/d1?req=q1', true),
    N('u5', 8, 14, '이경환님이 #2 제품 사진 신형으로 교체를 요청했습니다.', '/docs/d1?req=q2'),
    N('u5', 6, 10, '전현수님이 #5 루페 장착 그림 교체를 요청했습니다.', '/docs/d1?req=q5'),
    N('u3', 2, 11, 'L2SX6 사용설명서 검토 요청이 왔습니다.', '/docs/d3'),
    N('u4', 2, 11, 'L2SX6 사용설명서 검토 요청이 왔습니다.', '/docs/d3'),
    N('u2', 0, 9, 'L2SW AI 분석이 끝났습니다. 추천 5건을 검토해 주세요.', '/ai/r2'),
  ]

  return {
    seq: { doc: 5, version: 9, file: 5, run: 2, req: 8, notif: notifications.length },
    settings: {
      reviewFlow: true,
      sections: [
        { title: '제품 소개', cert: false }, { title: '안전 및 주의사항', cert: true }, { title: '제품 특성 및 기능', cert: false },
        { title: '구성품', cert: false }, { title: '사용 방법', cert: false }, { title: '제품 규격', cert: false },
        { title: '전자파 적합성(EMC)', cert: true }, { title: '운송', cert: false }, { title: '보관', cert: false },
        { title: '세척 방법', cert: false }, { title: '서비스 및 보증', cert: false },
      ],
      reasons: ['인증 시험 결과', '생산 변경', '신규 제품', '자료 불일치', '오탈자·표현', '기능 추가', '인증 문구 확인', '시험 결과'],
    },
    users, categories, products, docs, versions, files, aiRuns, requests, activity, revs,
    notifications: notifications.map((n, i) => ({ id: 'n' + (i + 1), ...n })),
  }
}
