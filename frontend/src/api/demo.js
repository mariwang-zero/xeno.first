// 데모 API: mock.js 에 "폴더 연결"을 덧붙인다.
// 폴더를 연결하면 제품 추가 때 제품 폴더를 만들고, 올린 파일을 그 폴더에 실제로 쓰고, 폴더 내용을 읽는다.
// 함수 이름과 응답 모양은 http.js(실제 서버)와 같다.
import { api as mock, server } from './mock.js'
import * as folder from './localFolder.js'
import { safeName, stamp, SUBFOLDERS } from '../lib/folders.js'
import { idbPut, readStored } from '../lib/pdf.js'

const db = () => server.db()
const productOf = id => db().products.find(p => p.id === id)
const docOf = id => db().docs.find(d => d.id === id)

// 폴더가 연결돼 있으면 파일을 제품 폴더에 쓰고 상대 경로를 돌려준다. 아니면 null
// name 을 주면 그 이름(파일 이름 규칙)으로, 아니면 시각_원래이름 으로 쓴다
async function put(product, sub, file, name) {
  if (!folder.ready() || !(file instanceof Blob)) return null
  await folder.ensureProduct(product.name)
  const rel = `${safeName(product.name)}/${sub}/${name ? safeName(name) : `${stamp()}_${safeName(file.name)}`}`
  await folder.write(rel, file)
  return rel
}
function saveBlob(file, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
const plainName = rel => rel.split('/').at(-1).replace(/^\d{8}-\d{6}_/, '')

// 최종본 폴더에 직접 넣은 Rev. 파일을 현재 사용본으로 반영하고, 그 파일을 내려받기·뷰어에 잇는다
async function adoptFinals(p, subs) {
  const files = (subs || (await folder.listProduct(p.name))).find(x => x.sub === '최종본')?.files || []
  const hits = mock.adoptFolderFinal(p.id, files)
  for (const h of hits) {
    const v = db().versions.find(x => x.id === h.versionId)
    v.path = `${safeName(p.name)}/최종본/${h.name}`
    const blob = await folder.read(v.path).catch(() => null)
    if (blob) await keepForViewer(v, blob)
  }
  if (hits.length) server.save()
  return hits.length
}

// 연결 직후·다시 읽기: 모든 제품의 폴더를 만들고, 목록에 없는 폴더는 제품으로 등록한다
async function sync() {
  let created = 0
  for (const p of db().products) if (await folder.ensureProduct(p.name)) created++
  const known = new Set(db().products.map(p => safeName(p.name).toLowerCase()))
  const fresh = (await folder.folderNames()).filter(n => !known.has(n.toLowerCase()))
  const added = fresh.length ? await mock.registerFolders(fresh) : []
  for (const name of added) await folder.ensureProduct(name)
  let adopted = 0
  for (const p of db().products) adopted += await adoptFinals(p)
  return { created, added, adopted }
}

// 데모에는 워드→PDF 변환기가 없다. 함께 올린 PDF 가 있으면 그것을, 없으면 .docx 를 브라우저에서 바로 그려 보여 준다
async function keepForViewer(v, file, pdf) {
  // 올린 워드 원본은 폴더 연결이 없어도 이 브라우저에 보관해 다시 내려받을 수 있게 한다
  if (file instanceof Blob) { await idbPut('file-' + v.id, file); v.file = 'idb:file-' + v.id }
  if (pdf instanceof Blob) { await idbPut(v.id, pdf); v.pdf = 'idb:' + v.id }
  else if (file instanceof Blob && /\.docx$/i.test(file.name)) { await idbPut('docx-' + v.id, file); v.docx = 'idb:docx-' + v.id }
}

export const api = {
  ...mock,

  // ── 폴더 연결 ──
  folderStatus: () => folder.status(),
  async connectFolder() {
    if (!(await folder.pick())) return null
    return { ...(await folder.status()), ...(await sync()) }
  },
  async regrantFolder() {
    if (!(await folder.regrant())) throw new Error('폴더 권한을 받지 못했습니다.')
    return { ...(await folder.status()), ...(await sync()) }
  },
  async disconnectFolder() { await folder.forget(); return folder.status() },
  async syncFolders() {
    if (!folder.ready()) throw new Error('먼저 폴더를 연결해 주세요.')
    return sync()
  },
  async productFolder(productId) {
    const p = productOf(productId)
    const st = await folder.status()
    if (!st.connected) return { ...st, subs: SUBFOLDERS.map(sub => ({ sub, files: [] })) }
    const subs = await folder.listProduct(p.name)
    const adopted = folder.ready() ? await adoptFinals(p, subs) : 0
    return { ...st, path: safeName(p.name), subs, adopted }
  },
  async openFolderFile(productId, sub, name) {
    if (!folder.ready()) throw new Error('먼저 폴더를 연결해 주세요.')
    const rel = `${safeName(productOf(productId).name)}/${sub}/${name}`
    saveBlob(await folder.read(rel), plainName(rel))
    return true
  },
  // 등록된 버전·파일 내려받기. 폴더에 저장된 것만 받을 수 있다
  // 등록된 버전·파일 내려받기. 이름은 파일 이름 규칙(최종본 Rev., 검토본 날짜)을 따른다.
  // 검토 요청·배포처럼 기록만 생긴 버전은 그 바탕이 된 파일(from)의 내용을 받는다
  async download(kind, id) {
    const d = db()
    const item = kind === 'files' ? d.files.find(f => f.id === id)
      : kind === 'versions' ? d.versions.find(v => v.id === id)
      : kind === 'products' ? d.versions.find(v => v.id === productOf(id)?.currentVersionId)
      : d.versions.filter(v => v.docId === id).at(-1)
    let src = item
    for (let n = 0; src && !src.path && !src.file && n < 20; n++) src = d.versions.find(v => v.id === src.from) || d.versions.find(v => v !== src && v.name === src.name && (v.path || v.file))
    if (!src?.path && !src?.file) throw new Error('이 버전은 데모에 실제 파일이 없습니다(처음부터 들어 있던 예시). 편집본으로 올린 파일은 내려받을 수 있습니다.')
    let blob = null
    if (src.file) blob = await readStored(src.file).catch(() => null)
    if (!blob && src.path) {
      if (!folder.ready()) throw new Error('폴더 연결이 끊겼습니다. 관리 > 제품에서 다시 연결해 주세요.')
      blob = await folder.read(src.path)
    }
    if (!blob) throw new Error('이 브라우저에 저장된 파일을 찾지 못했습니다.')
    saveBlob(blob, item.name || plainName(src.path))
    return true
  },

  // ── 파일이 오가는 기능: 규칙은 mock 이 확인하고, 통과하면 폴더에 쓴다 ──
  async saveProduct(prod) {
    const r = await mock.saveProduct(prod)
    if (!prod.id && folder.ready()) await folder.ensureProduct(prod.name.trim())
    return r
  },
  async addFile(docId, file, size) {
    const r = await mock.addFile(docId, file?.name ?? file, size ?? file?.size)
    const rel = await put(productOf(docOf(docId).productId), '참고자료', file)
    if (rel) { db().files.find(f => f.id === r.id).path = rel; server.save() }
    return r
  },
  async startAi(productId, inputs) {
    const r = await mock.startAi(productId, inputs)
    const p = productOf(productId)
    for (const f of db().files.filter(x => x.docId === r.docId && !x.path)) {
      const rel = await put(p, '참고자료', (inputs.files || []).find(x => x.name === f.name))
      if (rel) f.path = rel
    }
    server.save()
    return r
  },
  async importManual(productId, args) {
    const r = await mock.importManual(productId, args)
    const p = productOf(productId)
    const v = db().versions.find(x => x.id === p.currentVersionId)
    const rel = await put(p, '최종본', args.file, v.name)
    if (rel) v.path = rel
    await keepForViewer(v, args.file, args.pdf)
    server.save()
    return r
  },
  // 배포: 최종본(Rev. 이름)을 폴더의 최종본에도 쓴다
  async deploy(docId, summary) {
    const r = await mock.deploy(docId, summary)
    const p = productOf(docOf(docId).productId)
    const fin = db().versions.find(v => v.id === p.currentVersionId)
    const src = db().versions.find(v => v.id === fin.from)
    if (folder.ready() && src && (src.file || src.path)) {
      const blob = src.file ? await readStored(src.file).catch(() => null) : await folder.read(src.path).catch(() => null)
      const rel = blob && (await put(p, '최종본', blob, fin.name))
      if (rel) { fin.path = rel; server.save() }
    }
    return r
  },
  async uploadEdit(docId, args) {
    const r = await mock.uploadEdit(docId, args)
    const v = db().versions.filter(x => x.docId === docId && x.kind === 'review').at(-1)
    const rel = await put(productOf(docOf(docId).productId), '검토본', args.file, v.name)
    if (rel) v.path = rel
    // 사내 서버는 워드를 PDF 로 자동 변환한다. 데모는 함께 올린 PDF 를 이 브라우저에 보관해 뷰어에 쓴다
    await keepForViewer(v, args.file, args.pdf)
    server.save()
    return r
  },
}
