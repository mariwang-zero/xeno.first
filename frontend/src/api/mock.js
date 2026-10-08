// 가짜 API. 백엔드가 생기면 http.js 가 같은 함수 이름·같은 응답 모양으로 대신합니다.
// 데이터는 이 브라우저에만 저장됩니다(localStorage). "데모 데이터 초기화"로 처음 상태로 돌아갑니다.
import { buildSeed, toLocalIso } from './seed.js'
import { isStalled, sectionStatus, isOpen, fmtRev, MANUAL_STATUS } from '../lib/status.js'

const KEY = 'manual-system-demo-v1'
let db = load()
let me = null

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return buildSeed()
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch {}
}
const clone = v => JSON.parse(JSON.stringify(v))
const wait = (v) => new Promise(r => setTimeout(() => r(clone(v)), 40))
const now = () => toLocalIso(new Date())
const fail = (msg) => Promise.reject(new Error(msg))
const user = id => db.users.find(u => u.id === id)
const nextId = (k, p) => p + ++db.seq[k]

function logEvent(manualId, issueId, type, text) {
  db.events.push({ id: nextId('event', 'e'), at: now(), userId: me.id, manualId, issueId, type, text })
}

function decorateIssue(i) {
  const s = db.sections.find(s => s.id === i.sectionId)
  const m = db.manuals.find(m => m.id === i.manualId)
  return {
    ...i,
    section: s ? { id: s.id, no: s.no, title: s.title, cert: s.cert } : null,
    manual: { id: m.id, product: m.product, docNo: m.docNo },
    requester: user(i.requesterId),
    assignee: user(i.assigneeId),
    stalled: isStalled(i, db.settings.stallDays),
  }
}

function counts(issues) {
  const open = issues.filter(isOpen)
  return {
    requested: open.filter(i => i.status === 'requested').length,
    fixing: open.filter(i => i.status === 'fixing').length,
    review: open.filter(i => i.status === 'done').length,
    stalled: open.filter(i => isStalled(i, db.settings.stallDays)).length,
    confirmed: issues.filter(i => i.confirmedAt && i.revision == null).length,
    open: open.length,
  }
}

function manualSummary(m) {
  const issues = db.issues.filter(i => i.manualId === m.id)
  return { ...m, drafter: user(m.drafterId), counts: counts(issues), statusLabel: MANUAL_STATUS[m.status] }
}

function requireMe() {
  if (!me) throw new Error('로그인이 필요합니다.')
}

export const api = {
  // 로그인 (데모: 비밀번호는 확인하지 않음)
  async login(username) {
    const u = db.users.find(u => u.username === username)
    if (!u) return fail('아이디를 찾을 수 없습니다.')
    me = u
    try { sessionStorage.setItem(KEY + '-me', u.id) } catch {}
    return wait(u)
  },
  async logout() {
    me = null
    try { sessionStorage.removeItem(KEY + '-me') } catch {}
    return wait(true)
  },
  async me() {
    if (!me) {
      let id = null
      try { id = sessionStorage.getItem(KEY + '-me') } catch {}
      me = id ? user(id) : null
    }
    if (!me) return wait(null)
    const mine = db.issues.filter(i => isOpen(i))
    return wait({
      user: me,
      todo: {
        assigned: mine.filter(i => i.assigneeId === me.id && i.status !== 'done').map(decorateIssue),
        toReview: mine.filter(i => i.requesterId === me.id && i.status === 'done').map(decorateIssue),
      },
    })
  },
  async users() {
    return wait(db.users)
  },

  async listManuals() {
    return wait(db.manuals.map(manualSummary))
  },
  async getManual(id) {
    const m = db.manuals.find(m => m.id === id)
    if (!m) return fail('매뉴얼을 찾을 수 없습니다.')
    const issues = db.issues.filter(i => i.manualId === id)
    const sections = db.sections.filter(s => s.manualId === id).sort((a, b) => a.no - b.no).map(s => {
      const si = issues.filter(i => i.sectionId === s.id)
      return { ...s, status: sectionStatus(si), openCount: si.filter(isOpen).length, stalled: si.some(i => isOpen(i) && isStalled(i, db.settings.stallDays)) }
    })
    return wait({ ...manualSummary(m), sections })
  },
  async createManual(data) {
    requireMe()
    const id = nextId('manual', 'm')
    const m = {
      id, product: data.product, docNo: data.docNo, lang: data.lang || '한국어', rev: 0, status: 'drafting',
      drafterId: data.drafterId || me.id, draftedAt: null,
      path: `\\\\NAS\\manuals\\${data.docNo}\\현재\\${data.fileName || data.product.replaceAll(' ', '_') + '_사용설명서.docx'}`,
    }
    db.manuals.push(m)
    db.settings.sectionTemplate.forEach((s, i) => db.sections.push({ id: `${id}-s${i + 1}`, manualId: id, no: i + 1, title: s.title, cert: s.cert }))
    logEvent(id, null, 'create-manual', data.fromAi ? 'AI 초안으로 매뉴얼 생성' : '매뉴얼 생성')
    save()
    return wait(m)
  },
  async draftComplete(id) {
    requireMe()
    const m = db.manuals.find(m => m.id === id)
    if (m.status !== 'drafting') return fail('이미 초안 완료 상태입니다.')
    if (m.drafterId !== me.id && !me.admin) return fail('초안 작성자만 초안 완료로 바꿀 수 있습니다.')
    m.status = 'drafted'
    m.draftedAt = now()
    logEvent(id, null, 'drafted', '초안 완료')
    save()
    return wait(m)
  },

  async listIssues(manualId, f = {}) {
    let list = db.issues.filter(i => i.manualId === manualId)
    if (f.sectionId) list = list.filter(i => i.sectionId === f.sectionId)
    if (f.mine) list = list.filter(i => i.assigneeId === me.id || i.requesterId === me.id)
    if (f.status === 'open') list = list.filter(isOpen)
    else if (f.status === 'confirmed') list = list.filter(i => i.confirmedAt)
    else if (f.status) list = list.filter(i => isOpen(i) && i.status === f.status)
    return wait(list.map(decorateIssue).sort((a, b) => (b.stalled - a.stalled) || b.no - a.no))
  },
  async createIssue(manualId, data) {
    requireMe()
    if (!data.title?.trim()) return fail('제목을 적어 주세요.')
    if (!data.reason) return fail('수정 사유를 골라 주세요.')
    if (!data.doneWhen?.trim()) return fail('완료 조건을 적어 주세요.')
    if (!data.assigneeId) return fail('수정자를 지정해 주세요.')
    const no = Math.max(0, ...db.issues.filter(i => i.manualId === manualId).map(i => i.no)) + 1
    const i = {
      id: nextId('issue', 'i'), no, manualId, sectionId: data.sectionId, title: data.title.trim(), reason: data.reason,
      body: data.body || '', doneWhen: data.doneWhen.trim(), refs: data.refs || '', due: data.due || null,
      requesterId: me.id, assigneeId: data.assigneeId, status: 'requested', requestedAt: now(),
      startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
    }
    db.issues.push(i)
    logEvent(manualId, i.id, 'create', `수정 요청 작성, 수정자 지정: ${user(i.assigneeId).name}`)
    save()
    return wait(decorateIssue(i))
  },
  async getIssue(id) {
    const i = db.issues.find(i => i.id === id)
    if (!i) return fail('이슈를 찾을 수 없습니다.')
    return wait({
      ...decorateIssue(i),
      events: db.events.filter(e => e.issueId === id).sort((a, b) => a.at.localeCompare(b.at)).map(e => ({ ...e, user: user(e.userId) })),
      files: db.files.filter(f => f.issueId === id),
    })
  },
  async updateIssue(id, patch) {
    requireMe()
    const i = db.issues.find(i => i.id === id)
    if (i.requesterId !== me.id && !me.admin) return fail('요청자만 바꿀 수 있습니다.')
    if (patch.assigneeId && patch.assigneeId !== i.assigneeId) {
      i.assigneeId = patch.assigneeId
      logEvent(i.manualId, id, 'assign', `수정자 변경: ${user(patch.assigneeId).name}`)
    }
    if ('due' in patch) i.due = patch.due || null
    save()
    return api.getIssue(id)
  },
  async startIssue(id) {
    requireMe()
    const i = db.issues.find(i => i.id === id)
    if (i.assigneeId !== me.id && !me.admin) return fail('지정된 수정자만 시작할 수 있습니다.')
    if (i.status !== 'requested') return fail('수정 요청 중인 이슈만 시작할 수 있습니다.')
    i.status = 'fixing'
    i.startedAt = now()
    logEvent(i.manualId, id, 'start', '수정 시작')
    save()
    return api.getIssue(id)
  },
  async completeIssue(id, { resolution }) {
    requireMe()
    const i = db.issues.find(i => i.id === id)
    if (i.assigneeId !== me.id && !me.admin) return fail('지정된 수정자만 완료할 수 있습니다.')
    if (i.status !== 'fixing') return fail('수정 중인 이슈만 완료할 수 있습니다.')
    if (!resolution?.trim()) return fail('무엇을 바꿨는지 한 줄로 적어 주세요.')
    const m = db.manuals.find(m => m.id === i.manualId)
    i.status = 'done'
    i.doneAt = now()
    i.resolution = resolution.trim()
    db.files.push({ id: nextId('file', 'f'), manualId: m.id, kind: 'issue', issueId: id, rev: null, at: now(), name: `${m.docNo}_#${i.no}.docx`, size: 18.6 })
    logEvent(i.manualId, id, 'complete', `수정 완료: ${i.resolution} (원본 사본 저장)`)
    save()
    return api.getIssue(id)
  },
  async confirmIssue(id) {
    requireMe()
    const i = db.issues.find(i => i.id === id)
    if (i.requesterId !== me.id && !me.admin) return fail('요청자만 확인할 수 있습니다.')
    if (i.status !== 'done' || i.confirmedAt) return fail('수정 완료된 이슈만 확인할 수 있습니다.')
    i.confirmedAt = now()
    logEvent(i.manualId, id, 'confirm', '요청자 확인')
    save()
    return api.getIssue(id)
  },
  async reopenIssue(id, { reason }) {
    requireMe()
    const i = db.issues.find(i => i.id === id)
    if (i.requesterId !== me.id && !me.admin) return fail('요청자만 재요청할 수 있습니다.')
    if (!reason?.trim()) return fail('재요청 사유를 적어 주세요.')
    i.status = 'requested'
    i.requestedAt = now()
    i.startedAt = null
    i.doneAt = null
    i.confirmedAt = null
    logEvent(i.manualId, id, 'reopen', `재요청: ${reason.trim()}`)
    save()
    return api.getIssue(id)
  },

  async listRevisions(manualId) {
    const m = db.manuals.find(m => m.id === manualId)
    const revisions = db.revisions.filter(r => r.manualId === manualId).sort((a, b) => b.rev - a.rev).map(r => ({
      ...r, by: user(r.byId),
      issues: r.issueIds.map(id => decorateIssue(db.issues.find(i => i.id === id))),
      file: db.files.find(f => f.manualId === manualId && f.kind === 'rev' && f.rev === r.rev) || null,
    }))
    const pending = db.issues.filter(i => i.manualId === manualId && i.confirmedAt && i.revision == null).map(decorateIssue)
    return wait({ manual: manualSummary(m), revisions, pending })
  },
  async createRevision(manualId, { summary, issueIds }) {
    requireMe()
    if (!me.release && !me.admin) return fail('배포 담당만 Rev.를 확정할 수 있습니다.')
    if (!issueIds?.length) return fail('Rev.에 넣을 이슈를 하나 이상 골라 주세요.')
    const m = db.manuals.find(m => m.id === manualId)
    m.rev += 1
    const r = { id: nextId('revision', 'r'), manualId, rev: m.rev, date: now().slice(0, 10), summary, byId: me.id, issueIds }
    db.revisions.push(r)
    for (const id of issueIds) db.issues.find(i => i.id === id).revision = m.rev
    db.files.push({ id: nextId('file', 'f'), manualId, kind: 'rev', issueId: null, rev: m.rev, at: now(), name: `${m.docNo}_${fmtRev(m.rev).replace('.', '')}.docx`, size: 19.0 })
    logEvent(manualId, null, 'revision', `${fmtRev(m.rev)} 확정`)
    save()
    return wait(r)
  },

  // AI 초안: 데모에서는 입력에 맞춰 만든 예시 제안을 돌려줍니다.
  async aiPropose({ baseManualId, product, docNo, diff }) {
    requireMe()
    const base = db.manuals.find(m => m.id === baseManualId)
    if (!base) return fail('기준 매뉴얼을 골라 주세요.')
    if (!product?.trim()) return fail('새 제품명을 적어 주세요.')
    const s = []
    let n = 0
    const add = (type, where, before, after, note) => s.push({ id: 'a' + ++n, type, where, before, after, note, selected: type !== 'human' })
    add('replace', '문서 전체 (42곳)', base.product, product.trim(), '제품명 일괄 변경')
    if (docNo?.trim()) add('replace', '표지, 머리글 (3곳)', base.docNo, docNo.trim(), '문서번호 변경')
    const d = diff || ''
    if (/wi-?fi|무선/i.test(d)) {
      add('remove', '3. 제품 특성 및 기능 > 3.4 Wi-Fi 연결', '3.4 Wi-Fi 연결 (문단 6개, [그림 7])', '(삭제)', '차이점에 "Wi-Fi 없음"이 있어 절을 뺍니다')
      add('remove', '5. 사용 방법 > 5.2 앱과 무선으로 연결하기', '5.2 앱과 무선으로 연결하기 (문단 9개, [그림 11], [그림 12])', '(삭제)', '무선 연결 절차 삭제')
      add('edit', '6. 제품 규격 > 통신 방식', 'Wi-Fi 802.11 b/g/n, USB 2.0', 'USB 2.0', '무선 항목만 지움')
    }
    const cable = d.match(/(\d+(?:\.\d+)?)\s*m/)
    if (cable) add('edit', '4. 구성품 > 표 1, 3행', 'USB 케이블 (1.5m)', `USB 케이블 (${cable[1]}m)`, '케이블 길이 변경')
    add('human', '4. 구성품 > [그림 4]', '제품 사진 (기존 모델)', '', '새 제품 사진으로 교체 필요. 그림은 AI가 바꾸지 않습니다')
    add('human', '6. 제품 규격 > 무게, 크기', '182g, 120 × 45 × 38 mm', '', '새 제품 실측값 확인 필요')
    const id = 'ai' + ++db.seq.ai
    db.aiDrafts = db.aiDrafts || []
    db.aiDrafts.push({ id, baseManualId, product: product.trim(), diff: d, suggestions: s })
    save()
    return wait({ id, base: manualSummary(base), suggestions: s, tokens: { input: 48210, output: 1830 } })
  },
  async aiApply(draftId, { selectedIds, docNo }) {
    requireMe()
    const d = db.aiDrafts.find(d => d.id === draftId)
    const m = await api.createManual({ product: d.product, docNo, drafterId: me.id, fromAi: true })
    const human = d.suggestions.filter(s => s.type === 'human')
    for (const h of human) {
      const secNo = parseInt(h.where, 10)
      const sec = db.sections.find(s => s.manualId === m.id && s.no === secNo)
      db.issues.push({
        id: nextId('issue', 'i'), no: db.issues.filter(i => i.manualId === m.id).length + 1, manualId: m.id, sectionId: sec?.id || `${m.id}-s1`,
        title: h.note.split('.')[0], reason: '자료 누락', body: `AI 초안이 남긴 확인 항목: ${h.where} (${h.before})`, doneWhen: h.note, refs: '', due: null,
        requesterId: me.id, assigneeId: me.id, status: 'requested', requestedAt: now(), startedAt: null, doneAt: null, confirmedAt: null, resolution: '', revision: null,
      })
    }
    logEvent(m.id, null, 'ai', `AI 초안 적용: 제안 ${selectedIds.length}건, 확인 이슈 ${human.length}건 생성`)
    save()
    return wait({ manual: m, applied: selectedIds.length, issuesCreated: human.length })
  },

  // 관리
  async getSettings() {
    return wait(db.settings)
  },
  async updateSettings(patch) {
    requireMe()
    if (!me.admin) return fail('관리자만 바꿀 수 있습니다.')
    Object.assign(db.settings, patch)
    save()
    return wait(db.settings)
  },
  async createUser(data) {
    requireMe()
    if (!me.admin) return fail('관리자만 계정을 만들 수 있습니다.')
    if (!data.username?.trim() || !data.name?.trim()) return fail('아이디와 이름을 적어 주세요.')
    if (db.users.some(u => u.username === data.username.trim())) return fail('이미 있는 아이디입니다.')
    const u = { id: 'u' + (db.users.length + 1) + Date.now() % 1000, username: data.username.trim(), name: data.name.trim(), dept: data.dept, admin: false, release: false }
    db.users.push(u)
    save()
    return wait(u)
  },
  async updateUser(id, patch) {
    requireMe()
    if (!me.admin) return fail('관리자만 바꿀 수 있습니다.')
    Object.assign(user(id), patch)
    save()
    return wait(user(id))
  },
  async manualEvents(manualId) {
    return wait(db.events.filter(e => e.manualId === manualId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).map(e => ({ ...e, user: user(e.userId) })))
  },

  // 데모 전용
  async resetDemo() {
    db = buildSeed()
    save()
    if (me) me = user(me.id) || null
    return wait(true)
  },
}
