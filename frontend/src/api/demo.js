// 데모 API: mock.js 에 "폴더 연결"을 덧붙인다.
// 폴더를 연결하면 제품 추가 때 제품 폴더를 만들고, 올린 파일을 그 폴더에 실제로 쓰고, 폴더 내용을 읽는다.
// 함수 이름과 응답 모양은 http.js(실제 서버)와 같다.
import { api as mock, server } from './mock.js'
import * as folder from './localFolder.js'
import { safeName, stamp, SUBFOLDERS } from '../lib/folders.js'

const db = () => server.db()
const productOf = id => db().products.find(p => p.id === id)
const docOf = id => db().docs.find(d => d.id === id)

// 폴더가 연결돼 있으면 파일을 제품 폴더에 쓰고 상대 경로를 돌려준다. 아니면 null
async function put(product, sub, file) {
  if (!folder.ready() || !(file instanceof Blob)) return null
  await folder.ensureProduct(product.name)
  const rel = `${safeName(product.name)}/${sub}/${stamp()}_${safeName(file.name)}`
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

// 연결 직후·다시 읽기: 모든 제품의 폴더를 만들고, 목록에 없는 폴더는 제품으로 등록한다
async function sync() {
  let created = 0
  for (const p of db().products) if (await folder.ensureProduct(p.name)) created++
  const known = new Set(db().products.map(p => safeName(p.name).toLowerCase()))
  const fresh = (await folder.folderNames()).filter(n => !known.has(n.toLowerCase()))
  const added = fresh.length ? await mock.registerFolders(fresh) : []
  for (const name of added) await folder.ensureProduct(name)
  return { created, added }
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
    return { ...st, path: safeName(p.name), subs: await folder.listProduct(p.name) }
  },
  async openFolderFile(productId, sub, name) {
    if (!folder.ready()) throw new Error('먼저 폴더를 연결해 주세요.')
    const rel = `${safeName(productOf(productId).name)}/${sub}/${name}`
    saveBlob(await folder.read(rel), plainName(rel))
    return true
  },
  // 등록된 버전·파일 내려받기. 폴더에 저장된 것만 받을 수 있다
  async download(kind, id) {
    const d = db()
    const item = kind === 'files' ? d.files.find(f => f.id === id)
      : kind === 'versions' ? d.versions.find(v => v.id === id)
      : kind === 'products' ? d.versions.find(v => v.id === productOf(id)?.currentVersionId)
      : d.versions.filter(v => v.docId === id && v.path).at(-1)
    if (!item?.path) throw new Error('데모 예시 파일이라 실제 파일이 없습니다. 관리 > 제품에서 폴더를 연결한 뒤 올린 파일은 내려받을 수 있습니다.')
    if (!folder.ready()) throw new Error('폴더 연결이 끊겼습니다. 관리 > 제품에서 다시 연결해 주세요.')
    saveBlob(await folder.read(item.path), plainName(item.path))
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
    const rel = await put(p, '최종본', args.file)
    if (rel) { db().versions.find(v => v.id === p.currentVersionId).path = rel; server.save() }
    return r
  },
  async uploadEdit(docId, args) {
    const r = await mock.uploadEdit(docId, args)
    const rel = await put(productOf(docOf(docId).productId), '검토본', args.file)
    if (rel) { db().versions.filter(v => v.docId === docId && v.kind === 'review').at(-1).path = rel; server.save() }
    return r
  },
}
