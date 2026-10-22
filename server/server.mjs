// AI 매뉴얼 협업시스템 앱 서버 (사내 PC에서 실행)
// - 화면(frontend/dist)과 /api 를 내보낸다. 업무 규칙은 frontend/src/api/mock.js 를 그대로 쓴다.
// - 앱 데이터(요청·상태·이력)는 data/db.json 한 파일, 매뉴얼 파일은 NAS 공유 폴더(filesDir)에 둔다.
// - 로그인은 NAS(시놀로지) 계정으로 확인한다. 앱은 역할만 따로 기억한다.
// 외부 패키지 없이 Node.js 20 이상에서 돈다.
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { docxToPages } from './docx.mjs'
import { createPreviews } from './preview.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const cfgPath = process.env.MANUAL_CONFIG || path.join(HERE, 'config.json')
const cfg = {
  port: 8080,
  dataDir: './data',
  filesDir: './files',
  auth: 'nas', // nas: NAS 계정으로 로그인 / local: 시험용 공용 비밀번호
  nas: { url: '', insecureTls: true },
  localPassword: '',
  admins: [],
  sessionHours: 12,
  backupDays: 30,
  preview: 'auto', // 뷰어의 원본 모양(PDF): auto(워드, 없으면 LibreOffice) / word / libreoffice / off
  sofficePath: '',
  ...(fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, '')) : {}),
}
const abs = p => (path.isAbsolute(p) || /^\\\\/.test(p) ? p : path.resolve(path.dirname(cfgPath), p))
const DATA = abs(cfg.dataDir)
const FILES = abs(cfg.filesDir)
const DIST = process.env.MANUAL_DIST || path.resolve(HERE, '../frontend/dist')
fs.mkdirSync(DATA, { recursive: true })
const previews = createPreviews({ dataDir: DATA, filesDir: FILES, mode: cfg.preview, sofficePath: cfg.sofficePath })

// ── 앱 데이터 저장: mock.js 가 쓰는 localStorage 를 파일로 바꿔 끼운다 ──────────
const DB_FILE = path.join(DATA, 'db.json')
const { buildSeed } = await import('../frontend/src/api/seed.js')
function emptyDb() {
  // 처음 설치: 예시 제품 목록과 기본값만 두고 사람·작업·요청은 비운다
  const s = buildSeed()
  return {
    ...s,
    users: [], docs: [], versions: [], files: [], aiRuns: [], requests: [], activity: [], revs: [], notifications: [],
    products: s.products.map(p => ({ ...p, rev: 0, currentVersionId: null })),
    seq: { doc: 0, version: 0, file: 0, run: 0, req: 0, notif: 0 },
  }
}
let lastBackupDay = ''
function backup(json) {
  const day = new Date().toISOString().slice(0, 10)
  if (day === lastBackupDay) return
  try {
    const dir = path.join(FILES, '_앱데이터_백업')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `db-${day}.json`), json)
    lastBackupDay = day
    const old = fs.readdirSync(dir).filter(f => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -cfg.backupDays)
    old.forEach(f => fs.unlinkSync(path.join(dir, f)))
  } catch (e) {
    console.error('[백업 실패]', e.message)
  }
}
globalThis.__MANUAL_SERVER__ = true
globalThis.localStorage = {
  getItem: () => (fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : JSON.stringify(emptyDb())),
  setItem: (_k, json) => {
    fs.writeFileSync(DB_FILE + '.tmp', json)
    fs.renameSync(DB_FILE + '.tmp', DB_FILE)
    backup(json)
  },
}
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { api, server } = await import('../frontend/src/api/mock.js')
const { fmtRev } = await import('../frontend/src/lib/status.js')
const db = () => server.db()
if (!fs.existsSync(DB_FILE)) server.save()

// ── 로그인 ──────────────────────────────────────────────
const sessions = new Map() // sid → { userId, exp }
function nasLogin(username, password) {
  return new Promise((resolve, reject) => {
    if (!cfg.nas.url) return reject(new Error('config.json 에 NAS 주소(nas.url)가 없습니다.'))
    const u = new URL('/webapi/auth.cgi', cfg.nas.url)
    const body = new URLSearchParams({ api: 'SYNO.API.Auth', version: '3', method: 'login', account: username, passwd: password, session: 'ManualSystem', format: 'sid' }).toString()
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, rejectUnauthorized: !cfg.nas.insecureTls, timeout: 8000 }, res => {
      let s = ''
      res.on('data', c => (s += c))
      res.on('end', () => {
        try {
          const j = JSON.parse(s)
          if (j.success) {
            // 앱은 NAS 세션이 필요 없으니 바로 닫는다
            const out = new URL('/webapi/auth.cgi', cfg.nas.url)
            out.search = new URLSearchParams({ api: 'SYNO.API.Auth', version: '3', method: 'logout', session: 'ManualSystem', _sid: j.data.sid }).toString()
            lib.get(out, { rejectUnauthorized: !cfg.nas.insecureTls }, r => r.resume()).on('error', () => {})
            return resolve(true)
          }
          const code = j.error?.code
          const why = { 400: '아이디 또는 비밀번호가 맞지 않습니다.', 401: 'NAS에서 사용 중지된 계정입니다.', 402: 'NAS에서 이 계정의 로그인을 막아 두었습니다.', 403: '2단계 인증을 쓰는 계정은 아직 로그인할 수 없습니다.', 404: '2단계 인증을 쓰는 계정은 아직 로그인할 수 없습니다.', 407: '로그인을 여러 번 실패해 NAS가 잠시 막았습니다. 잠시 뒤 다시 해 주세요.' }
          reject(new Error(why[code] || `NAS 로그인에 실패했습니다 (코드 ${code}).`))
        } catch {
          reject(new Error('NAS 응답을 읽지 못했습니다. NAS 주소를 확인해 주세요.'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', () => reject(new Error('NAS에 연결하지 못했습니다. NAS가 켜져 있는지, 주소가 맞는지 확인해 주세요.')))
    req.end(body)
  })
}
async function checkPassword(username, password) {
  if (!username || !password) throw new Error('아이디와 비밀번호를 적어 주세요.')
  if (cfg.auth === 'local') {
    if (!cfg.localPassword || password !== cfg.localPassword) throw new Error('아이디 또는 비밀번호가 맞지 않습니다.')
    return
  }
  await nasLogin(username, password)
}
// NAS 로그인에 성공한 사람을 앱 사용자와 잇는다. 처음 온 사람은 일반 사용자로 만든다.
function userFor(username) {
  const d = db()
  let u = d.users.find(x => x.username.toLowerCase() === username.toLowerCase())
  if (!u) {
    const admin = cfg.admins.map(a => a.toLowerCase()).includes(username.toLowerCase()) || !d.users.some(x => x.admin)
    u = { id: 'u' + crypto.randomBytes(4).toString('hex'), username, name: username, dept: '매뉴얼', role: admin ? 'owner' : 'user', admin, active: true }
    d.users.push(u)
    server.save()
    console.log(`[사용자 추가] ${username}${admin ? ' (관리자)' : ''}`)
  }
  if (!u.active) throw new Error('사용하지 않는 계정입니다. 관리자에게 문의해 주세요.')
  return u
}
const cookieOf = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]))
function sessionOf(req) {
  const sid = cookieOf(req).ms_sid
  const s = sid && sessions.get(sid)
  if (!s) return null
  if (s.exp < Date.now()) { sessions.delete(sid); return null }
  return { sid, ...s }
}

// ── NAS 파일 ───────────────────────────────────────────
const { SUBFOLDERS, isProductFolder, safeName: safe, stamp } = await import('../frontend/src/lib/folders.js')
const productOf = id => db().products.find(p => p.id === id)
const docOf = id => db().docs.find(d => d.id === id)
// exact: 파일 이름 규칙으로 정한 이름 그대로 쓴다(같은 이름이 있으면 뒤에 시각을 붙인다). 아니면 시각_원래이름
function nasRel(product, folder, name, exact) {
  let rel = path.join(safe(product.name), folder, exact ? safe(name) : `${stamp()}_${safe(name)}`)
  if (exact && fs.existsSync(path.join(FILES, rel))) rel = rel.replace(/(\.docx?)$/i, `_${stamp()}$1`)
  return rel
}
function writeFileToNas(product, folder, name, buf, exact = false) {
  const rel = nasRel(product, folder, name, exact)
  const full = path.join(FILES, rel)
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, buf)
  } catch (e) {
    console.error('[NAS 저장 실패]', full, e.message)
    throw new Error('NAS 공유 폴더에 파일을 저장하지 못했습니다. NAS 연결을 확인해 주세요.')
  }
  return rel
}
// 제품 폴더: <제품명>/최종본·검토본·참고자료. 제품을 추가하거나 서버가 켜질 때 없는 폴더를 만든다
function ensureProductFolders(product) {
  let made = 0
  for (const sub of SUBFOLDERS) {
    const dir = path.join(FILES, safe(product.name), sub)
    if (fs.existsSync(dir)) continue
    fs.mkdirSync(dir, { recursive: true })
    made++
  }
  return made
}
function ensureAllFolders() {
  if (!fs.existsSync(FILES)) return { created: 0 }
  let created = 0
  for (const p of db().products) {
    try { if (ensureProductFolders(p)) created++ } catch (e) { console.error('[제품 폴더 만들기 실패]', p.name, e.message) }
  }
  return { created }
}
// 최종본 폴더에 직접 넣은 Rev. 파일(예: LCLT-UM-KO_Rev.02.docx)을 현재 사용본으로 반영하고 그 파일을 잇는다
function adoptFinals(p, userId) {
  const files = listProductFolder(p).find(x => x.sub === '최종본')?.files || []
  const hits = as(userId, () => api.adoptFolderFinal(p.id, files))
  for (const h of hits) {
    const v = db().versions.find(x => x.id === h.versionId)
    v.path = path.join(safe(p.name), '최종본', h.name)
    delete v.nofile
    const d = docOf(v.docId)
    if (/\.docx$/i.test(h.name)) { const pages = pagesOf(fs.readFileSync(path.join(FILES, v.path))); if (pages) d.pages = pages }
    previews.request(v.path)
  }
  if (hits.length) server.save()
  return hits.length
}
// NAS 폴더에 직접 만든 제품 폴더는 제품 목록에 등록한다 (대분류: 미분류)
async function syncFolders(userId) {
  if (!fs.existsSync(FILES)) throw new HttpError(400, 'NAS 공유 폴더에 연결되지 않았습니다. 서버 설정(filesDir)과 NAS 연결을 확인해 주세요.')
  const { created } = ensureAllFolders()
  const known = new Set(db().products.map(p => safe(p.name).toLowerCase()))
  const fresh = fs.readdirSync(FILES, { withFileTypes: true }).filter(e => e.isDirectory() && isProductFolder(e.name) && !known.has(e.name.toLowerCase())).map(e => e.name)
  const added = fresh.length ? await as(userId, () => api.registerFolders(fresh)) : []
  ensureAllFolders()
  let adopted = 0
  for (const p of db().products) adopted += adoptFinals(p, userId)
  return { created, added, adopted }
}
function listProductFolder(product) {
  return SUBFOLDERS.map(sub => {
    const dir = path.join(FILES, safe(product.name), sub)
    let files = []
    try {
      files = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => {
        const st = fs.statSync(path.join(dir, e.name))
        return { name: e.name, size: st.size, at: st.mtime.toISOString() }
      }).sort((a, b) => b.at.localeCompare(a.at))
    } catch {}
    return { sub, files }
  })
}

// 파일 없이 기록만 생긴 버전(최종본, 개정 시작 원본 등)에 실제 파일을 잇는다
function linkVersionFiles() {
  const d = db()
  let changed = false
  for (const v of d.versions) {
    if (v.path || v.nofile) continue
    const withFile = d.versions.filter(x => x.path && x.at <= v.at && x.id !== v.id)
    // 바탕 파일: from(개정 시작 원본, 배포 최종본)을 따라가고, 없으면 같은 이름·같은 작업의 마지막 파일
    let src = null
    for (let x = v, n = 0; x?.from && !src && n < 20; n++) { x = d.versions.find(y => y.id === x.from); if (x?.path) src = x }
    src = src || withFile.filter(x => x.name === v.name || v.name.startsWith(x.name + ' ')).at(-1) || withFile.filter(x => x.docId === v.docId).at(-1)
    changed = true
    if (!src) { v.nofile = true; continue }
    if (v.kind === 'final') {
      const doc = docOf(v.docId)
      const p = productOf(doc.productId)
      try {
        const rel = nasRel(p, '최종본', v.name, true)
        fs.mkdirSync(path.dirname(path.join(FILES, rel)), { recursive: true })
        fs.copyFileSync(path.join(FILES, src.path), path.join(FILES, rel))
        v.path = rel
      } catch (e) {
        console.error('[최종본 복사 실패]', e.message)
        v.path = src.path
      }
    } else v.path = src.path
  }
  if (changed) server.save()
}
const DOC_ONLY_PAGES = [{ no: 1, blocks: [{ id: 'p1-b1', type: 'p', text: '.doc 파일은 글자 미리보기를 만들지 않습니다. 원본 모양(PDF)이 만들어지면 여기에 보입니다.' }] }]
function pagesOf(buf) {
  try {
    return docxToPages(buf, db().settings.sections.filter(s => s.cert).map(s => s.title))
  } catch (e) {
    console.error('[미리보기 실패]', e.message)
    return null
  }
}

// ── HTTP ──────────────────────────────────────────────
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status } }
async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > 200 * 1024 * 1024) throw new HttpError(413, '파일이 너무 큽니다 (200MB까지).')
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}
async function parseBody(req) {
  const buf = await readBody(req)
  const type = req.headers['content-type'] || ''
  if (type.startsWith('multipart/form-data')) {
    const form = await new Request('http://local/', { method: 'POST', headers: { 'content-type': type }, body: buf }).formData()
    const fields = {}
    const files = []
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') fields[k] = v
      else files.push({ name: v.name, size: v.size, buf: Buffer.from(await v.arrayBuffer()) })
    }
    return { fields, files }
  }
  if (!buf.length) return {}
  try { return JSON.parse(buf.toString('utf8')) } catch { throw new HttpError(400, '요청 형식이 잘못되었습니다.') }
}
// 로그인한 사람으로 업무 함수를 부른다. 함수 본문은 기다림 없이 끝나므로 사람이 섞이지 않는다.
function as(userId, fn) {
  server.setMe(userId)
  try { return fn() } finally { server.setMe(null) }
}

const routes = []
const route = (method, pattern, handler, open = false) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, open })

route('POST', '/auth/login', async ({ body, res }) => {
  const username = String(body.username || '').trim()
  await checkPassword(username, String(body.password || ''))
  const u = userFor(username)
  const sid = crypto.randomBytes(24).toString('hex')
  sessions.set(sid, { userId: u.id, exp: Date.now() + cfg.sessionHours * 3600e3 })
  res.setHeader('Set-Cookie', `ms_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${cfg.sessionHours * 3600}`)
  return as(u.id, () => api.login(u.username))
}, true)
route('POST', '/auth/logout', async ({ sess, res }) => {
  if (sess) sessions.delete(sess.sid)
  res.setHeader('Set-Cookie', 'ms_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  return true
}, true)
route('GET', '/me', ({ sess }) => (sess ? as(sess.userId, () => api.me()) : null), true)

const simple = [
  ['GET', '/users', () => api.users()],
  ['GET', '/settings', () => api.settings()],
  ['GET', '/notifications', () => api.notifications()],
  ['POST', '/notifications/read-all', () => api.readAllNotifications()],
  ['POST', '/notifications/:id/read', ({ id }) => api.readNotification(id)],
  ['GET', '/catalog', () => api.catalog()],
  ['GET', '/references', () => api.references()],
  ['GET', '/products/:id', ({ id }) => api.product(id)],
  ['POST', '/products/:id/revisions', ({ id }) => api.startRevision(id)],
  ['GET', '/ai/:id', ({ id }) => api.aiRun(id)],
  ['POST', '/ai/:id/apply', ({ id }, b) => api.applyAi(id, b.checked || [])],
  ['GET', '/docs/:id/requests', ({ id }) => api.requests(id)],
  ['POST', '/docs/:id/requests', ({ id }, b) => api.createRequest(id, b)],
  ['POST', '/docs/:id/lock', ({ id }) => api.startEdit(id)],
  ['DELETE', '/docs/:id/lock', ({ id }) => api.cancelEdit(id)],
  ['POST', '/docs/:id/hold', ({ id }, b) => api.setHold(id, b.reason ?? null)],
  ['POST', '/docs/:id/review', ({ id }) => api.requestReview(id)],
  ['POST', '/docs/:id/finalize', ({ id }, b) => api.finalize(id, !!b.ok, b.reason)],
  ['GET', '/docs/:id/deploy-preview', ({ id }) => api.deployPreview(id)],
  ['POST', '/docs/:id/deploy', ({ id }, b) => api.deploy(id, b.summary)],
  ['GET', '/docs/:id/history', ({ id }) => api.history(id)],
  ['GET', '/requests/mine', () => api.myRequests()],
  ['GET', '/requests/board', () => api.requestBoard()],
  ['PATCH', '/requests/:id', ({ id }, b) => api.updateRequest(id, b)],
  ['DELETE', '/requests/:id', ({ id }) => api.cancelRequest(id)],
  ['POST', '/requests/:id/start', ({ id }) => api.startRequest(id)],
  ['POST', '/requests/:id/complete', ({ id }, b) => api.completeRequest(id, b.resolution)],
  ['POST', '/requests/:id/close', ({ id }) => api.closeRequest(id)],
  ['POST', '/requests/:id/reopen', ({ id }, b) => api.reopenRequest(id, b.reason)],
  ['POST', '/versions/:id/current', ({ id }) => api.setCurrent(id)],
  ['GET', '/admin', () => api.adminData()],
  ['POST', '/admin/users', (_p, b) => api.saveUser(b)],
  ['POST', '/admin/categories', (_p, b) => api.saveCategory(b.name)],
  ['POST', '/admin/settings', (_p, b) => api.saveSettings(b)],
]
for (const [m, p, fn] of simple) route(m, p, async ({ params, body, sess }) => {
  const r = await as(sess.userId, () => fn(params, body || {}))
  if (m !== 'GET') linkVersionFiles()
  return r
})

// 제품·매뉴얼 폴더
route('POST', '/admin/products', async ({ body, sess }) => {
  const r = await as(sess.userId, () => api.saveProduct(body || {}))
  if (!body.id && fs.existsSync(FILES)) {
    const p = db().products.find(x => x.name === String(body.name).trim())
    try { ensureProductFolders(p) } catch (e) { console.error('[제품 폴더 만들기 실패]', p.name, e.message) }
  }
  return r
})
route('GET', '/admin/folder', ({ sess }) => {
  if (!db().users.find(u => u.id === sess.userId)?.admin) throw new HttpError(403, '관리자만 볼 수 있습니다.')
  return { mode: 'server', supported: true, name: FILES, connected: fs.existsSync(FILES), needsPermission: false }
})
route('POST', '/admin/folder/sync', ({ sess }) => {
  if (!db().users.find(u => u.id === sess.userId)?.admin) throw new HttpError(403, '관리자만 바꿀 수 있습니다.')
  return syncFolders(sess.userId)
})
route('POST', '/admin/folders/register', ({ body, sess }) => as(sess.userId, () => api.registerFolders(body.names || [])))
route('GET', '/products/:id/folder', ({ params, sess }) => {
  const p = productOf(params.id)
  if (!p) throw new HttpError(404, '제품을 찾을 수 없습니다.')
  const connected = fs.existsSync(FILES)
  const adopted = connected ? adoptFinals(p, sess.userId) : 0
  return { mode: 'server', name: FILES, path: safe(p.name), connected, subs: connected ? listProductFolder(p) : [], adopted }
})
route('GET', '/products/:id/folder/file', ({ params, req, res }) => {
  const p = productOf(params.id)
  if (!p) throw new HttpError(404, '제품을 찾을 수 없습니다.')
  const q = new URL(req.url, 'http://x').searchParams
  const sub = q.get('sub'), name = q.get('name') || ''
  if (!SUBFOLDERS.includes(sub) || !name || name !== path.basename(name) || name.startsWith('.')) throw new HttpError(400, '파일 이름이 잘못되었습니다.')
  return sendFile(res, path.join(safe(p.name), sub, name), name.replace(/^\d{8}-\d{6}_/, ''))
})

// 문서 보기: 마지막 저장 파일의 원본 모양(PDF)을 함께 알려 준다. 처음 보는 파일이면 이때 만들기 시작한다
route('GET', '/docs/:id', async ({ params, sess }) => {
  const r = await as(sess.userId, () => api.doc(params.id))
  const v = db().versions.filter(x => x.docId === params.id && x.path).at(-1)
  return { ...r, pdf: null, ...(v ? previews.status(v.path) : {}) }
})
route('GET', '/previews/:key', ({ params, res }) => {
  const full = previews.file(params.key)
  if (!full) throw new HttpError(404, '원본 모양(PDF)이 아직 없습니다.')
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': fs.statSync(full).size, 'Cache-Control': 'private, max-age=86400' })
  fs.createReadStream(full).pipe(res)
  return undefined
})

// 파일이 오가는 요청
route('POST', '/docs/:id/files', async ({ params, body, sess }) => {
  const f = body.files?.[0]
  if (!f) throw new HttpError(400, '파일을 골라 주세요.')
  const d = docOf(params.id)
  if (!d) throw new HttpError(404, '문서를 찾을 수 없습니다.')
  const rel = writeFileToNas(productOf(d.productId), '참고자료', f.name, f.buf)
  const r = await as(sess.userId, () => api.addFile(params.id, f.name, f.size))
  db().files.find(x => x.id === r.id).path = rel
  server.save()
  return r
})
route('POST', '/docs/:id/upload', async ({ params, body, sess }) => {
  const f = body.files?.[0]
  const d = docOf(params.id)
  if (!d) throw new HttpError(404, '문서를 찾을 수 없습니다.')
  if (!f) throw new HttpError(400, '고친 워드 파일을 골라 주세요.')
  if (!/\.docx?$/i.test(f.name)) throw new HttpError(400, '워드 파일(.docx, .doc)만 올릴 수 있습니다.')
  if (!d.lock || d.lock.userId !== sess.userId) throw new HttpError(400, '편집을 시작한 사람만 올릴 수 있습니다.')
  const rel = writeFileToNas(productOf(d.productId), '검토본', f.name, f.buf)
  let r
  try {
    r = await as(sess.userId, () => api.uploadEdit(params.id, { fileName: f.name, note: body.fields.note }))
  } catch (e) {
    fs.rmSync(path.join(FILES, rel), { force: true })
    throw e
  }
  // 검토본은 파일 이름 규칙(문서번호_Rev._검토_날짜시각)으로 바꿔 둔다
  const rv = db().versions.filter(v => v.docId === d.id && v.kind === 'review').at(-1)
  rv.path = rel
  try {
    const named = nasRel(productOf(d.productId), '검토본', rv.name, true)
    fs.renameSync(path.join(FILES, rel), path.join(FILES, named))
    rv.path = named
  } catch (e) { console.error('[검토본 이름 바꾸기 실패]', e.message) }
  const pages = /\.docx$/i.test(f.name) && pagesOf(f.buf)
  if (pages) d.pages = pages
  server.save()
  previews.request(rv.path)
  return r
})
route('POST', '/products/:id/import', async ({ params, body, sess }) => {
  const f = body.files?.[0]
  const p = productOf(params.id)
  if (!p) throw new HttpError(404, '제품을 찾을 수 없습니다.')
  if (!f || !/\.docx?$/i.test(f.name)) throw new HttpError(400, '워드 파일(.docx, .doc)을 골라 주세요.')
  // .doc 는 글자 미리보기를 만들지 않고 원본 모양(PDF)으로만 본다
  const pages = /\.doc$/i.test(f.name) ? DOC_ONLY_PAGES : pagesOf(f.buf)
  if (!pages) throw new HttpError(400, '워드 파일을 읽지 못했습니다. 다른 이름으로 저장(.docx)한 뒤 다시 올려 주세요.')
  // 먼저 규칙 확인(권한, 열린 작업, Rev. 번호) 뒤 파일을 쓴다
  const r = await as(sess.userId, () => api.importManual(params.id, { fileName: f.name, size: f.size, rev: body.fields.rev, pages }))
  const v = db().versions.find(x => x.id === p.currentVersionId)
  try {
    v.path = writeFileToNas(p, '최종본', v.name, f.buf, true)
  } catch (e) {
    v.nofile = true
    server.save()
    throw e
  }
  server.save()
  previews.request(v.path)
  return r
})
route('POST', '/products/:id/ai', async ({ params, body, sess }) => {
  const p = productOf(params.id)
  if (!p) throw new HttpError(404, '제품을 찾을 수 없습니다.')
  const files = body.files || []
  const r = await as(sess.userId, () => api.startAi(params.id, { referenceId: body.fields.referenceId, mustInclude: body.fields.mustInclude, extra: body.fields.extra, sources: files.map(f => ({ name: f.name, size: f.size })) }))
  for (const fr of db().files.filter(x => x.docId === r.docId && !x.path)) {
    const f = files.find(x => x.name === fr.name)
    if (f) fr.path = writeFileToNas(p, '참고자료', f.name, f.buf)
  }
  linkVersionFiles()
  return r
})

// 내려받기
function sendFile(res, rel, name) {
  const full = rel && path.join(FILES, rel)
  if (!full || !fs.existsSync(full)) throw new HttpError(404, rel ? 'NAS에서 파일을 찾지 못했습니다. NAS 연결을 확인해 주세요.' : '이 버전은 저장된 파일이 없습니다.')
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, 'Content-Length': fs.statSync(full).size })
  fs.createReadStream(full).pipe(res)
  return undefined
}
// 내려받는 이름: 버전은 파일 이름 규칙으로 정한 이름(최종본 Rev., 검토본 날짜)
const fileName = v => v.name || (v.path ? path.basename(v.path).replace(/^\d{8}-\d{6}_/, '') : '')
route('GET', '/versions/:id/file', ({ params, res }) => {
  const v = db().versions.find(x => x.id === params.id)
  if (!v) throw new HttpError(404, '버전을 찾을 수 없습니다.')
  return sendFile(res, v.path, fileName(v))
})
route('GET', '/files/:id/file', ({ params, res }) => {
  const f = db().files.find(x => x.id === params.id)
  if (!f) throw new HttpError(404, '파일을 찾을 수 없습니다.')
  return sendFile(res, f.path, f.name)
})
route('GET', '/products/:id/file', ({ params, res }) => {
  const p = productOf(params.id)
  const v = p && db().versions.find(x => x.id === p.currentVersionId)
  if (!v) throw new HttpError(404, '현재 사용본이 없습니다.')
  return sendFile(res, v.path, fileName(v))
})
route('GET', '/docs/:id/file', ({ params, res }) => {
  const v = db().versions.filter(x => x.docId === params.id && x.path).at(-1)
  if (!v) throw new HttpError(404, '이 작업에는 아직 저장된 파일이 없습니다.')
  return sendFile(res, v.path, fileName(v))
})

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
function serveStatic(req, res) {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let full = path.join(DIST, path.normalize(u).replace(/^(\.\.[/\\])+/, ''))
  if (!full.startsWith(DIST) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) full = path.join(DIST, 'index.html')
  if (!fs.existsSync(full)) { res.writeHead(500); return res.end('frontend/dist 가 없습니다. 설치 안내서의 빌드 단계를 먼저 해 주세요.') }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': full.endsWith('index.html') ? 'no-cache' : 'max-age=86400' })
  fs.createReadStream(full).pipe(res)
}

const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res)
  const sub = url.pathname.slice(4)
  const sess = sessionOf(req)
  try {
    const r = routes.find(r => r.method === req.method && r.re.test(sub))
    if (!r) throw new HttpError(404, '없는 주소입니다.')
    if (!r.open && !sess) throw new HttpError(401, '로그인이 필요합니다.')
    const params = sub.match(r.re).groups || {}
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await parseBody(req) : {}
    const out = await r.handler({ params, body, sess, req, res })
    if (res.headersSent) return
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(out ?? null))
  } catch (e) {
    // 업무 규칙에서 막힌 것(mock.js 의 fail)은 그 문장을 그대로 보여 준다
    const rule = !(e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError || e instanceof SyntaxError)
    if (!rule) console.error('[오류]', req.method, sub, e)
    if (res.headersSent) return res.end()
    res.writeHead(e.status || (rule ? 400 : 500), { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ detail: rule ? e.message : '서버에서 문제가 생겼습니다. 관리자에게 알려 주세요.' }))
  }
})
const startup = ensureAllFolders()
// 서버가 켜질 때, 각 문서의 마지막 파일 중 원본 모양(PDF)이 없는 것을 차례로 만든다
for (const dd of db().docs) {
  const v = db().versions.filter(x => x.docId === dd.id && x.path).at(-1)
  if (v) previews.request(v.path)
}
srv.listen(cfg.port, () => {
  console.log(`AI 매뉴얼 협업시스템: http://localhost:${cfg.port}`)
  console.log(`  앱 데이터: ${DB_FILE}`)
  console.log(`  매뉴얼 파일(NAS): ${FILES}${fs.existsSync(FILES) ? (startup.created ? `  (제품 폴더 ${startup.created}개 새로 만듦)` : '') : '  ← 아직 연결되지 않음'}`)
  console.log(`  뷰어 원본 모양(PDF): ${cfg.preview === 'off' ? '끔' : previews.how}`)
  console.log(`  로그인: ${cfg.auth === 'local' ? '시험용 공용 비밀번호' : 'NAS 계정 (' + (cfg.nas.url || '주소 없음') + ')'}`)
})
