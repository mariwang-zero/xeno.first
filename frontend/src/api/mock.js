// 가짜 API. 백엔드가 생기면 http.js 가 같은 함수 이름·같은 응답 모양으로 대신합니다.
// 데이터는 이 브라우저에만 저장됩니다(localStorage). "예시 데이터로 되돌리기"로 처음 상태로 돌아갑니다.
import { buildSeed, toLocalIso, applyItems, cameraManual, lightManual } from './seed.js'
import { DOC_STATUS, REQ_STATUS, can, isOverdue, fmtRev } from '../lib/status.js'

const KEY = 'manual-system-demo-v2'
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
const wait = (v, ms = 40) => new Promise(r => setTimeout(() => r(clone(v)), ms))
const now = () => toLocalIso(new Date())
const fail = msg => Promise.reject(new Error(msg))
const user = id => db.users.find(u => u.id === id) || null
const nextId = (k, p) => p + ++db.seq[k]
const docOf = id => db.docs.find(d => d.id === id)
const productOf = id => db.products.find(p => p.id === id)

function requireMe() {
  if (!me) throw new Error('로그인이 필요합니다.')
}
function log(docId, text, change = false) {
  db.activity.push({ docId, at: now(), userId: me.id, text, change })
}
function notifyUser(userId, text, link) {
  if (!userId || userId === me?.id) return
  db.notifications.push({ id: nextId('notif', 'n'), userId, at: now(), text, link, read: false })
}

const openReq = r => r.kind === 'request' && r.status !== 'closed'
function docSummary(d) {
  const reqs = db.requests.filter(r => r.docId === d.id && r.kind === 'request')
  const pr = productOf(d.productId)
  return {
    id: d.id, title: d.title, status: d.status, held: d.held, createdAt: d.createdAt,
    statusLabel: d.held ? DOC_STATUS.hold : DOC_STATUS[d.status],
    product: { id: pr.id, name: pr.name, docNo: pr.docNo, rev: pr.rev },
    owner: user(d.ownerId),
    lock: d.lock ? { ...d.lock, user: user(d.lock.userId) } : null,
    open: reqs.filter(openReq).length,
    counts: Object.fromEntries(Object.keys(REQ_STATUS).map(s => [s, reqs.filter(r => r.status === s).length])),
    lastAt: db.activity.filter(a => a.docId === d.id).map(a => a.at).sort().at(-1) || d.createdAt,
    manualLeft: d.manualLeft?.length || 0,
  }
}
function decorateReq(r) {
  const d = docOf(r.docId)
  const pr = productOf(d.productId)
  return {
    ...r,
    requester: user(r.requesterId),
    assignee: user(r.assigneeId),
    doc: { id: d.id, title: d.title },
    product: { id: pr.id, name: pr.name },
    overdue: isOverdue(r),
    cert: blockCert(d, r),
  }
}
// 요청이 걸린 블록이 인증 문구가 있는 절(안전 및 주의사항, EMC) 안에 있는지
function blockCert(d, r) {
  if (!d.pages || !r.page) return false
  const pg = d.pages.find(p => p.no === r.page)
  if (!pg) return false
  let cert = false
  for (const b of pg.blocks) {
    if (b.type === 'h') cert = b.cert
    if (r.anchor?.blockId === b.id) return cert
  }
  return r.anchor?.type === 'area' ? pg.blocks.some(b => b.type === 'h' && b.cert) : false
}
function runOf(id) {
  return db.aiRuns.find(r => r.id === id)
}
function reqOf(id) {
  const r = db.requests.find(r => r.id === id)
  if (!r) throw new Error('요청을 찾을 수 없습니다.')
  return r
}
function addVersion(docId, kind, name, note, size = 4.3) {
  const v = { id: nextId('version', 'v'), docId, kind, name, at: now(), userId: me.id, note, size }
  db.versions.push(v)
  return v
}
function reviewers() {
  return db.users.filter(u => u.active && (u.role === 'reviewer' || u.role === 'final'))
}

// 데모용 AI: 기준 문서와 자료 이름을 보고 미리 정한 규칙으로 추천을 만든다. (실제는 백엔드가 Claude API 호출)
function fakeSuggest(refPages, productName, inputs) {
  const items = []
  const all = refPages.flatMap(p => p.blocks.map(b => ({ ...b, page: p.no })))
  const first = all.find(b => b.type === 'p' && /는 (의료용 )?루페에/.test(b.text))
  if (first) {
    const old = first.text.split('는 ')[0]
    if (old !== productName) {
      all.filter(b => b.type === 'p' && b.text.includes(old)).forEach(b => items.push({ page: b.page, kind: 'text', note: 'ai', before: old, after: productName, summary: `제품명을 ${productName}(으)로 변경`, basis: inputs.sources[0] || '작성 참고 내용', checked: true }))
    }
  }
  all.filter(b => b.type === 'img').forEach(b => items.push({ page: b.page, kind: 'image', note: 'manual', before: b.text, after: '', summary: `${b.text}을(를) 신형으로 교체`, basis: inputs.sources.find(s => /jpg|png/i.test(s)) || '(사진 자료 없음)', checked: false }))
  const mustLines = (inputs.mustInclude || '').split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
  const lastP = all.filter(b => b.type === 'p').at(2)
  mustLines.forEach(line => {
    if (lastP) items.push({ page: lastP.page, kind: 'text', note: 'ai', op: 'add', anchor: lastP.text.slice(0, 12), before: '', after: line.endsWith('.') ? line : line + '.', summary: '작성 참고 내용 반영 문단 추가', basis: '작성 참고 내용', checked: true })
  })
  const spec = all.find(b => b.type === 'table' && b.rows.some(r => r[0] === '항목'))
  if (spec) {
    const row = spec.rows[2] || spec.rows[1]
    items.push({ page: spec.page, kind: 'table', note: 'check', before: row[1], after: '(신규 값 확인 필요)', summary: `${row[0]} 값이 등록 자료에서 확인되지 않음`, basis: '(근거 없음)', checked: false })
  }
  return items.map((it, i) => ({ no: i + 1, ...it }))
}

export const api = {
  // ── 로그인 ────────────────────────────────────────
  async login(username, password) {
    const u = db.users.find(u => u.username === username)
    if (!u) return fail('아이디 또는 비밀번호가 맞지 않습니다.')
    if (!u.active) return fail('사용하지 않는 계정입니다. 관리자에게 문의해 주세요.')
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
    const todo = db.requests.filter(r => r.kind === 'request' && ((r.assigneeId === me.id && ['requested', 'checking'].includes(r.status)) || (r.requesterId === me.id && r.status === 'done')))
    return wait({ user: me, todoCount: todo.length, unread: db.notifications.filter(n => n.userId === me.id && !n.read).length })
  },
  async users() {
    return wait(db.users.filter(u => u.active))
  },
  async settings() {
    return wait(db.settings)
  },

  // ── 알림 ──────────────────────────────────────────
  async notifications() {
    requireMe()
    return wait(db.notifications.filter(n => n.userId === me.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10))
  },
  async readNotification(id) {
    const n = db.notifications.find(n => n.id === id)
    if (n) n.read = true
    save()
    return wait(true)
  },
  async readAllNotifications() {
    db.notifications.filter(n => n.userId === me.id).forEach(n => (n.read = true))
    save()
    return wait(true)
  },

  // ── S02 메인 ──────────────────────────────────────
  async catalog() {
    requireMe()
    const cats = [...db.categories].sort((a, b) => a.order - b.order).map(c => ({
      ...c,
      products: db.products.filter(p => p.categoryId === c.id && !p.hidden).sort((a, b) => a.order - b.order).map(p => {
        const docs = db.docs.filter(d => d.productId === p.id)
        const active = docs.filter(d => d.status !== 'deploy').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        const mine = db.requests.filter(r => docs.some(d => d.id === r.docId) && r.kind === 'request' && ((r.assigneeId === me.id && ['requested', 'checking'].includes(r.status)) || (r.requesterId === me.id && r.status === 'done'))).length
        return { id: p.id, name: p.name, rev: p.rev, active: active ? docSummary(active) : null, mine }
      }),
    }))
    return wait(cats)
  },

  // ── S03 제품 작업 화면 ─────────────────────────────
  async product(id) {
    const p = productOf(id)
    if (!p) return fail('제품을 찾을 수 없습니다.')
    const docs = db.docs.filter(d => d.productId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const docIds = docs.map(d => d.id)
    const cur = db.versions.find(v => v.id === p.currentVersionId)
    return wait({
      ...p,
      category: db.categories.find(c => c.id === p.categoryId),
      docs: docs.map(docSummary),
      current: cur ? { ...cur, user: user(cur.userId) } : null,
      versions: db.versions.filter(v => docIds.includes(v.docId)).sort((a, b) => b.at.localeCompare(a.at)).map(v => ({ ...v, user: user(v.userId) })),
      files: db.files.filter(f => docIds.includes(f.docId)).map(f => ({ ...f, user: user(f.userId) })),
      activity: db.activity.filter(a => docIds.includes(a.docId)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10).map(a => ({ ...a, user: user(a.userId) })),
      revs: db.revs.filter(r => r.productId === id).sort((a, b) => b.rev - a.rev),
    })
  },
  async addFile(docId, name, size) {
    requireMe()
    const f = { id: nextId('file', 'f'), docId, name, size: Math.round(size / 1e5) / 10 || 0.1, at: now(), userId: me.id }
    db.files.push(f)
    log(docId, `참고자료 등록: ${name}`)
    save()
    return wait(f)
  },

  // ── S04·S05 AI 초안 ───────────────────────────────
  async references() {
    // 기준 레퍼런스 후보: 각 제품의 현재 사용본
    return wait(db.products.filter(p => p.currentVersionId).map(p => {
      const v = db.versions.find(v => v.id === p.currentVersionId)
      return { versionId: v.id, productId: p.id, label: `${p.name} · ${v.name}` }
    }))
  },
  async startAi(productId, inputs) {
    requireMe()
    if (!can.aiDraft(me)) return fail('AI 초안은 문서 담당자만 만들 수 있습니다.')
    if (!inputs.referenceId) return fail('기존 레퍼런스를 골라 주세요.')
    if (!inputs.sources?.length) return fail('참고 자료를 하나 이상 올려 주세요.')
    const p = productOf(productId)
    const refV = db.versions.find(v => v.id === inputs.referenceId)
    const refDoc = docOf(refV.docId)
    const d = { id: nextId('doc', 'd'), productId, title: `${p.name} KO 사용설명서 ${p.rev ? fmtRev(p.rev + 1) + ' 개정' : '신규 작성'}`, status: 'ai', held: null, ownerId: me.id, lock: null, createdAt: now(), pages: null, manualLeft: [], refPages: refDoc.pages }
    db.docs.push(d)
    const okFiles = inputs.sources.filter(s => /\.(docx|pdf|png|jpe?g|xlsx|txt)$/i.test(s.name))
    const bad = inputs.sources.filter(s => !okFiles.includes(s))
    okFiles.forEach(s => db.files.push({ id: nextId('file', 'f'), docId: d.id, name: s.name, size: Math.round(s.size / 1e5) / 10 || 0.1, at: now(), userId: me.id }))
    db.versions.push({ id: nextId('version', 'v'), docId: d.id, kind: 'original', name: refV.name + ' (기존 레퍼런스)', at: now(), userId: me.id, note: 'AI 초안의 기준 문서', size: refV.size })
    const inputsLog = { reference: refV.name, sources: inputs.sources.map(s => s.name), mustInclude: inputs.mustInclude || '', extra: inputs.extra || '' }
    const run = {
      id: nextId('run', 'r'), docId: d.id, userId: me.id, at: now(), status: 'ready', appliedAt: null, inputs: inputsLog,
      items: fakeSuggest(refDoc.pages, p.name, inputsLog),
      failures: bad.map(s => ({ file: s.name, reason: '읽을 수 없는 형식입니다. DOCX, PDF, 이미지, 엑셀로 올려 주세요.' })),
      result: null,
    }
    db.aiRuns.push(run)
    log(d.id, `AI 분석: 추천 ${run.items.length}건${bad.length ? `, 읽지 못한 자료 ${bad.length}건` : ''}`)
    save()
    return wait(run, 900)
  },
  async aiRun(id) {
    const r = runOf(id)
    if (!r) return fail('AI 분석 결과를 찾을 수 없습니다.')
    const d = docOf(r.docId)
    return wait({ ...r, user: user(r.userId), doc: docSummary(d) })
  },
  async applyAi(id, checkedNos) {
    requireMe()
    const r = runOf(id)
    if (r.status === 'applied') return fail('이미 반영한 분석입니다.')
    if (!checkedNos.length) return fail('반영할 항목을 하나 이상 골라 주세요.')
    const d = docOf(r.docId)
    r.items.forEach(it => (it.checked = checkedNos.includes(it.no) && it.kind !== 'image'))
    const chosen = r.items.filter(it => it.checked)
    const base = d.pages || d.refPages || (productOf(d.productId).categoryId === 'c3' ? cameraManual('기존 제품') : lightManual('기존 제품'))
    const { pages, failed } = applyItems(base, chosen)
    d.pages = pages
    d.manualLeft = r.items.filter(it => it.kind === 'image').map(it => it.no)
    d.status = 'progress'
    delete d.refPages
    r.status = 'applied'
    r.appliedAt = now()
    r.result = { applied: chosen.length - failed.length, failed: failed.map(f => ({ ...f, summary: r.items.find(i => i.no === f.no).summary })), manual: d.manualLeft.length }
    addVersion(d.id, 'ai', `${productOf(d.productId).docNo}_AI초안.docx`, `AI 추천 ${r.result.applied}건 반영`)
    log(d.id, `AI 추천 ${r.items.length}건 중 ${r.result.applied}건 반영${failed.length ? `, 실패 ${failed.length}건` : ''}, 이미지 ${r.result.manual}건 수작업으로 남김`, true)
    save()
    return wait(r)
  },

  // ── S06 문서 검토 ─────────────────────────────────
  async doc(id) {
    const d = docOf(id)
    if (!d) return fail('문서를 찾을 수 없습니다.')
    const run = db.aiRuns.filter(r => r.docId === id).at(-1)
    const manual = d.manualLeft?.length && run ? run.items.filter(i => d.manualLeft.includes(i.no)) : []
    const latest = db.versions.filter(v => v.docId === id).at(-1)
    return wait({ ...docSummary(d), pages: d.pages, ownerId: d.ownerId, manual, runId: run?.id || null, runStatus: run?.status || null, version: latest ? { ...latest, user: user(latest.userId) } : null })
  },
  async requests(docId) {
    return wait(db.requests.filter(r => r.docId === docId).sort((a, b) => a.no - b.no).map(decorateReq))
  },
  async createRequest(docId, data) {
    requireMe()
    const d = docOf(docId)
    const kind = data.kind || 'request'
    if (!data.body?.trim()) return fail(kind === 'ai' ? '질문을 적어 주세요.' : '내용을 적어 주세요.')
    if (kind === 'request') {
      if (!data.assigneeId) return fail('담당자를 골라 주세요.')
      if (!data.title?.trim()) return fail('제목을 적어 주세요.')
      if (data.due && data.due < now().slice(0, 10)) return fail('기한은 오늘 이후로 골라 주세요.')
    }
    const no = Math.max(0, ...db.requests.filter(r => r.docId === docId).map(r => r.no)) + 1
    const r = {
      id: nextId('req', 'q'), no, docId, kind, page: data.page, anchor: data.anchor, title: (data.title || '').trim(), body: data.body.trim(),
      reason: data.reason || '', doneWhen: data.doneWhen || '', due: data.due || null,
      requesterId: me.id, assigneeId: kind === 'request' ? data.assigneeId : null,
      status: kind === 'request' ? 'requested' : 'closed', resolution: '', comments: [], createdAt: now(), startedAt: null, doneAt: null, closedAt: null,
    }
    if (kind === 'ai') {
      // 데모: 등록 자료 밖의 내용은 지어내지 않는다는 원칙을 보여 주는 고정 답
      r.answer = `선택한 문장("${(data.anchor?.quote || '').slice(0, 30)}")에 대해 등록된 자료에서 근거를 찾지 못했습니다. 담당 부서 확인이 필요합니다. (데모 답변이며, 실제로는 이 작업에 등록한 자료만 보고 답합니다)`
    }
    db.requests.push(r)
    if (kind === 'request') {
      log(docId, `수정 요청 #${no} ${r.title} → ${user(r.assigneeId).name}`)
      notifyUser(r.assigneeId, `${me.name}님이 #${no} ${r.title}을(를) 요청했습니다.`, `/docs/${docId}?req=${r.id}`)
    }
    save()
    return wait(decorateReq(r), kind === 'ai' ? 700 : 40)
  },
  async updateRequest(id, patch) {
    requireMe()
    const r = reqOf(id)
    if (r.requesterId !== me.id && !me.admin) return fail('요청한 사람만 고칠 수 있습니다.')
    if (r.status !== 'requested') return fail('담당자가 확인을 시작한 요청은 고칠 수 없습니다.')
    if (patch.assigneeId && patch.assigneeId !== r.assigneeId) {
      r.assigneeId = patch.assigneeId
      notifyUser(r.assigneeId, `${me.name}님이 #${r.no} ${r.title}을(를) 요청했습니다.`, `/docs/${r.docId}?req=${r.id}`)
      log(r.docId, `#${r.no} 담당자 변경 → ${user(r.assigneeId).name}`)
    }
    ;['title', 'body', 'due', 'doneWhen'].forEach(k => { if (k in patch) r[k] = patch[k] })
    save()
    return wait(decorateReq(r))
  },
  async cancelRequest(id) {
    requireMe()
    const r = reqOf(id)
    if (r.requesterId !== me.id && !me.admin) return fail('요청한 사람만 취소할 수 있습니다.')
    if (r.kind === 'request' && r.status !== 'requested') return fail('담당자가 확인을 시작한 요청은 취소할 수 없습니다.')
    db.requests = db.requests.filter(x => x.id !== id)
    if (r.kind === 'request') log(r.docId, `수정 요청 #${r.no} 취소`)
    save()
    return wait(true)
  },
  async startRequest(id) {
    requireMe()
    const r = reqOf(id)
    if (r.assigneeId !== me.id && !me.admin) return fail('담당자만 확인을 시작할 수 있습니다.')
    if (r.status !== 'requested') return fail('요청됨 상태에서만 시작할 수 있습니다.')
    r.status = 'checking'
    r.startedAt = now()
    log(r.docId, `#${r.no} 확인 시작`)
    save()
    return wait(decorateReq(r))
  },
  async completeRequest(id, resolution) {
    requireMe()
    const r = reqOf(id)
    const d = docOf(r.docId)
    if (r.assigneeId !== me.id && !me.admin) return fail('담당자만 수정 완료할 수 있습니다.')
    if (r.status !== 'checking') return fail('확인 중인 요청만 완료할 수 있습니다.')
    if (!resolution?.trim()) return fail('무엇을 고쳤는지 한 줄로 적어 주세요.')
    if (d.lock && d.lock.userId !== me.id) return fail(`${user(d.lock.userId).name}님이 문서를 편집 중입니다. 편집이 끝난 뒤 완료해 주세요.`)
    r.status = 'done'
    r.doneAt = now()
    r.resolution = resolution.trim()
    log(r.docId, `수정 완료 #${r.no}: ${r.resolution}`, true)
    notifyUser(r.requesterId, `${me.name}님이 #${r.no} ${r.title}을(를) 수정 완료했습니다. 확인해 주세요.`, `/docs/${r.docId}?req=${r.id}`)
    save()
    return wait(decorateReq(r))
  },
  async closeRequest(id) {
    requireMe()
    const r = reqOf(id)
    if (r.requesterId !== me.id && !me.admin) return fail('요청한 사람만 확인 완료할 수 있습니다.')
    if (r.status !== 'done') return fail('수정 완료된 요청만 닫을 수 있습니다.')
    r.status = 'closed'
    r.closedAt = now()
    log(r.docId, `#${r.no} 확인 완료`)
    save()
    return wait(decorateReq(r))
  },
  async reopenRequest(id, reason) {
    requireMe()
    const r = reqOf(id)
    if (r.requesterId !== me.id && !me.admin) return fail('요청한 사람만 다시 요청할 수 있습니다.')
    if (r.status !== 'done') return fail('수정 완료된 요청만 다시 요청할 수 있습니다.')
    if (!reason?.trim()) return fail('다시 요청하는 이유를 적어 주세요.')
    r.comments.push({ at: now(), userId: me.id, text: `다시 요청: ${reason.trim()}` })
    r.status = 'checking'
    log(r.docId, `#${r.no} 다시 요청: ${reason.trim()}`)
    notifyUser(r.assigneeId, `${me.name}님이 #${r.no} ${r.title}을(를) 다시 요청했습니다.`, `/docs/${r.docId}?req=${r.id}`)
    save()
    return wait(decorateReq(r))
  },

  // 편집 잠금: 시작하면 잠그고 현재 버전을 내려받는다. 올리면 검토본 버전이 생기고 잠금이 풀린다.
  async startEdit(docId) {
    requireMe()
    const d = docOf(docId)
    const mineReq = db.requests.some(r => r.docId === docId && r.assigneeId === me.id && r.status === 'checking')
    if (d.ownerId !== me.id && !can.aiDraft(me) && !mineReq) return fail('문서 담당자나 확인 중인 요청의 담당자만 편집할 수 있습니다.')
    if (d.lock && d.lock.userId !== me.id) return fail(`${user(d.lock.userId).name}님이 편집 중입니다.`)
    if (d.status !== 'progress') return fail('진행 중인 문서만 편집할 수 있습니다.')
    d.lock = { userId: me.id, at: now() }
    log(docId, '편집 시작 (잠금)')
    save()
    return wait(docSummary(d))
  },
  async uploadEdit(docId, { fileName, note }) {
    requireMe()
    const d = docOf(docId)
    if (!d.lock || d.lock.userId !== me.id) return fail('편집을 시작한 사람만 올릴 수 있습니다.')
    if (fileName && !/\.docx$/i.test(fileName)) return fail('DOCX 파일만 올릴 수 있습니다.')
    if (!note?.trim()) return fail('무엇을 바꿨는지 한 줄로 적어 주세요.')
    const n = db.versions.filter(v => v.docId === docId && v.kind === 'review').length + 1
    addVersion(docId, 'review', fileName || `${productOf(d.productId).docNo}_검토본_${n}.docx`, `편집본 올림: ${note.trim()}`)
    d.lock = null
    log(docId, `편집본 올림: ${note.trim()}`, true)
    save()
    return wait(docSummary(d))
  },
  async cancelEdit(docId) {
    requireMe()
    const d = docOf(docId)
    if (!d.lock) return wait(docSummary(d))
    if (d.lock.userId !== me.id && !me.admin) return fail('편집을 시작한 사람이나 관리자만 잠금을 풀 수 있습니다.')
    const own = d.lock.userId === me.id
    const who = user(d.lock.userId).name
    d.lock = null
    log(docId, own ? '편집 취소 (잠금 해제)' : `잠금 강제 해제 (${who}님의 편집)`)
    save()
    return wait(docSummary(d))
  },

  // 문서 단계
  async setHold(docId, reason) {
    requireMe()
    const d = docOf(docId)
    if (d.ownerId !== me.id && !me.admin) return fail('문서 담당자만 보류할 수 있습니다.')
    if (reason === null) {
      d.held = null
      log(docId, '보류 해제')
    } else {
      if (!reason?.trim()) return fail('보류 사유를 적어 주세요.')
      d.held = { reason: reason.trim(), at: now(), userId: me.id }
      log(docId, `보류: ${reason.trim()}`)
    }
    save()
    return wait(docSummary(d))
  },
  async requestReview(docId) {
    requireMe()
    const d = docOf(docId)
    if (!db.settings.reviewFlow) return fail('검토·배포 단계를 쓰지 않도록 설정되어 있습니다.')
    if (d.ownerId !== me.id && !me.admin) return fail('문서 담당자만 검토를 요청할 수 있습니다.')
    if (d.status !== 'progress') return fail('진행 중인 문서만 검토를 요청할 수 있습니다.')
    if (d.held) return fail('보류를 먼저 해제해 주세요.')
    if (d.lock) return fail(`${user(d.lock.userId).name}님이 편집 중입니다.`)
    d.status = 'review'
    addVersion(docId, 'review', `${productOf(d.productId).docNo}_검토요청본.docx`, '검토 요청 시점 버전')
    log(docId, '검토 요청')
    reviewers().forEach(u => notifyUser(u.id, `${productOf(d.productId).name} 사용설명서 검토 요청이 왔습니다.`, `/docs/${docId}`))
    save()
    return wait(docSummary(d))
  },
  async finalize(docId, ok, reason) {
    requireMe()
    const d = docOf(docId)
    if (!can.finalize(me)) return fail('최종 검토자만 할 수 있습니다.')
    if (d.status !== 'review') return fail('검토 요청된 문서가 아닙니다.')
    if (ok) {
      d.status = 'final'
      addVersion(docId, 'final', `${productOf(d.productId).docNo}_최종본.docx`, '최종 검토 완료')
      log(docId, '최종 검토 완료', true)
      notifyUser(d.ownerId, `${productOf(d.productId).name} 사용설명서가 최종 검토 완료되었습니다.`, `/docs/${docId}`)
    } else {
      if (!reason?.trim()) return fail('반려 사유를 적어 주세요.')
      d.status = 'progress'
      log(docId, `반려: ${reason.trim()}`)
      notifyUser(d.ownerId, `${productOf(d.productId).name} 사용설명서가 반려되었습니다: ${reason.trim()}`, `/docs/${docId}`)
    }
    save()
    return wait(docSummary(d))
  },
  async deployPreview(docId) {
    const d = docOf(docId)
    const p = productOf(d.productId)
    const lines = db.requests.filter(r => r.docId === docId && r.kind === 'request' && r.status === 'closed').map(r => r.resolution).filter(Boolean)
    return wait({ rev: p.rev + 1, summary: lines.join(', ') })
  },
  async deploy(docId, summary) {
    requireMe()
    const d = docOf(docId)
    const p = productOf(d.productId)
    if (!can.finalize(me)) return fail('최종 검토자만 배포할 수 있습니다.')
    if (d.status !== 'final') return fail('최종 검토 완료된 문서만 배포할 수 있습니다.')
    if (!summary?.trim()) return fail('주요 변경사항을 적어 주세요.')
    p.rev += 1
    db.revs.push({ productId: p.id, rev: p.rev, summary: summary.trim(), at: now().slice(0, 10), userId: me.id })
    const fin = db.versions.filter(v => v.docId === docId && v.kind === 'final').at(-1)
    p.currentVersionId = fin.id
    d.status = 'deploy'
    log(docId, `배포: ${fmtRev(p.rev)} (${summary.trim()})`, true)
    notifyUser(d.ownerId, `${p.name} ${fmtRev(p.rev)}이(가) 배포되었습니다.`, `/products/${p.id}`)
    save()
    return wait(docSummary(d))
  },

  // ── S08 내 요청함 ─────────────────────────────────
  async myRequests() {
    requireMe()
    const list = db.requests.filter(r => r.kind === 'request')
    return wait({
      todo: list.filter(r => (r.assigneeId === me.id && ['requested', 'checking'].includes(r.status)) || (r.requesterId === me.id && r.status === 'done')).map(decorateReq),
      sent: list.filter(r => r.requesterId === me.id && r.status !== 'closed').map(decorateReq),
      closed: list.filter(r => (r.requesterId === me.id || r.assigneeId === me.id) && r.status === 'closed').map(decorateReq),
    })
  },

  // ── S09 버전·변경 이력 ────────────────────────────
  async history(docId) {
    const d = docOf(docId)
    const p = productOf(d.productId)
    return wait({
      doc: docSummary(d),
      currentVersionId: p.currentVersionId,
      versions: db.versions.filter(v => v.docId === docId).sort((a, b) => b.at.localeCompare(a.at)).map(v => ({ ...v, user: user(v.userId) })),
      changes: db.activity.filter(a => a.docId === docId).sort((a, b) => b.at.localeCompare(a.at)).map(a => ({ ...a, user: user(a.userId) })),
      revs: db.revs.filter(r => r.productId === p.id).sort((a, b) => b.rev - a.rev).map(r => ({ ...r, user: user(r.userId) })),
    })
  },
  async setCurrent(versionId) {
    requireMe()
    if (!can.setCurrent(me)) return fail('문서 담당자나 최종 검토자만 지정할 수 있습니다.')
    const v = db.versions.find(v => v.id === versionId)
    const d = docOf(v.docId)
    productOf(d.productId).currentVersionId = v.id
    log(d.id, `현재 사용본 지정: ${v.name}`, true)
    save()
    return wait(true)
  },

  // ── S10 관리 ──────────────────────────────────────
  async adminData() {
    requireMe()
    if (!me.admin) return fail('관리자만 볼 수 있습니다.')
    return wait({ users: db.users, categories: db.categories, products: db.products, settings: db.settings })
  },
  async saveUser(u) {
    requireMe()
    if (!me.admin) return fail('관리자만 바꿀 수 있습니다.')
    if (u.id) {
      const cur = user(u.id)
      if (cur.admin && !u.admin && db.users.filter(x => x.admin).length === 1) return fail('관리자가 한 명은 있어야 합니다.')
      Object.assign(cur, u)
    } else {
      if (!u.name?.trim() || !u.username?.trim()) return fail('이름과 아이디를 적어 주세요.')
      if (db.users.some(x => x.username === u.username)) return fail('이미 있는 아이디입니다.')
      db.users.push({ id: 'u' + (db.users.length + 1) + Date.now() % 1000, role: 'user', admin: false, active: true, dept: '매뉴얼', ...u })
    }
    save()
    return wait(db.users)
  },
  async saveProduct(prod) {
    requireMe()
    if (!me.admin) return fail('관리자만 바꿀 수 있습니다.')
    if (!prod.name?.trim()) return fail('제품명을 적어 주세요.')
    if (prod.id) Object.assign(productOf(prod.id), prod)
    else {
      const order = Math.max(0, ...db.products.filter(p => p.categoryId === prod.categoryId).map(p => p.order)) + 1
      db.products.push({ id: 'p' + Date.now() % 100000, rev: 0, hidden: false, currentVersionId: null, docNo: prod.name.toUpperCase().replace(/\s+/g, '') + '-UM-KO', order, ...prod })
    }
    save()
    return wait(db.products)
  },
  async saveSettings(s) {
    requireMe()
    if (!me.admin) return fail('관리자만 바꿀 수 있습니다.')
    db.settings = { ...db.settings, ...clone(s) }
    save()
    return wait(db.settings)
  },
  async resetDemo() {
    db = buildSeed()
    save()
    return wait(true)
  },
}
