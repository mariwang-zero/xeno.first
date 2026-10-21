// 데모(시연)용 데이터. 제품과 최신 한글판 파일 이름은 실제(2026-10), 사람 이름은 가명입니다.
// 매뉴얼 본문은 LooksCAM LT 만 실제 문서이고(공개 허락), 나머지 제품은 안내 문장만 둡니다.

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

import { LT_PAGES } from './ltManual.js'

// 시연용 데이터: 11개 제품은 배포된 최신 한글판만 등록되어 있고, LooksCAM LT 만 다음 개정이 진행 중이다.
// 공개 데모라서 LooksCAM LT 외 매뉴얼 본문은 싣지 않는다(실제 본문은 사내 서버에서만). 사람 이름은 가명.
const notice = name => pages([[h('본문 미리보기 안내'), p(`${name} 최신 한글판은 공개 데모에 본문을 싣지 않았습니다.`), p('사내 서버에서는 등록한 워드 파일의 본문이 여기에 보입니다. 데모에서 본문을 보려면 LooksCAM LT 를 열어 주세요.')]])

export function buildSeed() {
  const users = [
    { id: 'u1', username: 'manual1', name: '매뉴얼 담당 A', dept: '매뉴얼', role: 'owner', admin: true, active: true },
    { id: 'u2', username: 'manual2', name: '매뉴얼 담당 B', dept: '매뉴얼', role: 'owner', admin: false, active: true },
    { id: 'u3', username: 'review1', name: '검토 담당 C', dept: '매뉴얼', role: 'reviewer', admin: false, active: true },
    { id: 'u4', username: 'final', name: '최종 검토자', dept: '품질', role: 'final', admin: false, active: true },
    { id: 'u5', username: 'mech', name: '기구 담당', dept: '기구', role: 'user', admin: false, active: true },
    { id: 'u6', username: 'elec', name: '전자 담당', dept: '전자', role: 'user', admin: false, active: true },
    { id: 'u7', username: 'sw', name: 'SW 담당', dept: '소프트웨어', role: 'user', admin: false, active: true },
    { id: 'u8', username: 'qa', name: '품질 담당', dept: '품질', role: 'reviewer', admin: false, active: true },
  ]

  const categories = [
    { id: 'c1', name: '루페', order: 1 },
    { id: 'c2', name: '라이트', order: 2 },
    { id: 'c3', name: '카메라', order: 3 },
  ]
  const P = (id, categoryId, name, docNo, order) => ({ id, categoryId, name, docNo, rev: 1, order, hidden: false, currentVersionId: null })
  // 제품군 (2026-10 기준). 제품명이 그대로 매뉴얼 폴더 이름이 된다. 새 제품은 관리 화면에서 추가한다
  const products = [
    P('p1', 'c1', 'Looks', 'LS-UM-KO', 1),
    P('p2', 'c2', 'L2S14C', 'L2S14C-UM-KO', 1),
    P('p4', 'c2', 'L2S15', 'L2S15-UM-KO', 2),
    P('p3', 'c2', 'L2SW', 'L2SW-UM-KO', 3),
    P('p10', 'c2', 'L2SWE', 'L2SWE-UM-KO', 4),
    P('p11', 'c2', 'L2SX5', 'L2SX5-UM-KO', 5),
    P('p5', 'c2', 'L2SX6', 'L2SX6-UM-KO', 6),
    P('p6', 'c2', 'XD Light', 'XDL-UM-KO', 7),
    P('p7', 'c2', 'XD Light4', 'XDL4-UM-KO', 8),
    P('p9', 'c3', 'LooksCAM LT', 'LCLT-UM-KO', 1),
    P('p8', 'c3', 'LooksCAM2', 'LC2-UM-KO', 2),
  ]

  // 배포된 최신 한글판 (제품 메뉴얼_복사본 폴더, 2026-10-21 기준): 제품마다 Rev.01 로 등록
  const latestKo = [
    ['p1', 'Looks 한글매뉴얼-260915.docx', '2026-09-28', 3.4],
    ['p2', 'L2S14C MANUAL-20260914(한글)-V2.2.docx', '2026-09-15', 5.7],
    ['p4', 'L2S15 MANUAL-20260914(한글)-V2_1 (화상주의).doc', '2026-09-14', 20.9],
    ['p3', 'L2SW MANUAL(한글)-20261002.doc', '2026-10-02', 14.4],
    ['p10', 'L2SWE MANUAL(한글)-V1_0_20260914.doc', '2026-09-14', 6.8],
    ['p11', 'L2SX5 MANUAL(한글)-20261002.doc', '2026-10-02', 19.4],
    ['p5', 'L2SX6 MANUAL-20261002(한글).doc', '2026-10-14', 9.3],
    ['p6', 'XD LIGHT MANUAL(한글)-V2_1_260915.doc', '2026-09-15', 22.2],
    ['p7', 'XD LIGHT4 MANUAL(KO)_261002.doc', '2026-10-02', 11.8],
    ['p9', 'LooksCAM-LT 사용자 설명서(한글)__V0_1 260915.docx', '2026-10-02', 6.6],
    ['p8', '260915 LooksCAM2 사용자 설명서(한글)_초안수정_V0_0.docx', '2026-09-28', 8.1],
  ]
  const docs = [], versions = [], revs = [], activity = []
  latestKo.forEach(([pid, file, date, size], i) => {
    const pr = products.find(x => x.id === pid)
    const docId = 'dk' + (i + 1), vId = 'vk' + (i + 1), when = date + 'T09:00:00'
    docs.push({ id: docId, productId: pid, title: `${pr.name} KO 사용설명서 Rev.01 (최신 한글판)`, status: 'deploy', held: null, ownerId: 'u1', lock: null, createdAt: when, pages: pid === 'p9' ? LT_PAGES : notice(pr.name), manualLeft: [] })
    versions.push({ id: vId, docId, kind: 'final', name: file, at: when, userId: 'u1', note: '최신 한글판 등록', size })
    revs.push({ productId: pid, rev: 1, summary: `최신 한글판 등록: ${file}`, at: date, userId: 'u1' })
    activity.push({ docId, at: when, userId: 'u1', text: `최신 한글판 등록: ${file}`, change: true })
    pr.currentVersionId = vId
  })

  // LooksCAM LT 만 다음 개정(Rev.02)이 진행 중: 현재 사용본을 원본으로 연 작업
  const lt = docs.find(d => d.productId === 'p9')
  const ltV = versions.find(v => v.docId === lt.id)
  const start = at(0, 9)
  docs.push({ id: 'd1', productId: 'p9', title: 'LooksCAM LT KO 사용설명서 Rev.02 개정', status: 'progress', held: null, ownerId: 'u1', lock: null, createdAt: start, pages: JSON.parse(JSON.stringify(LT_PAGES)), manualLeft: [] })
  versions.push({ id: 'v1', docId: 'd1', kind: 'original', name: ltV.name, at: start, userId: 'u1', note: 'Rev.02 개정의 원본 (현재 사용본)', size: ltV.size })
  activity.push({ docId: 'd1', at: start, userId: 'u1', text: '개정 시작: Rev.01 현재 사용본에서 Rev.02 진행 중', change: false })

  return {
    seq: { doc: 1, version: 1, file: 0, run: 0, req: 0, notif: 0 },
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
    users, categories, products, docs, versions, revs, activity,
    files: [], aiRuns: [], requests: [], notifications: [],
  }
}
