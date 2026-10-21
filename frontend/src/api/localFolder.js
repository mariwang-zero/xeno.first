// 데모용 폴더 연결. 브라우저(크롬·엣지)의 폴더 접근 기능으로 PC나 NAS 공유 폴더를 직접 읽고 쓴다.
// 실제 서버에서는 server.mjs 가 NAS 폴더를 같은 규칙(lib/folders.js)으로 다룬다.
import { SUBFOLDERS, isProductFolder, safeName } from '../lib/folders.js'

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

// 고른 폴더는 브라우저에 기억해 두고, 다시 열면 권한만 한 번 더 묻는다
const IDB = 'manual-system-folder'
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore('h')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction('h', mode)
      const req = fn(tx.objectStore('h'))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
    }
  })
}
let root = null
let granted = false
async function handle() {
  if (root || !supported) return root
  try { root = (await idb('readonly', s => s.get('root'))) || null } catch { root = null }
  return root
}

export async function status() {
  const h = await handle()
  if (h && !granted) granted = (await h.queryPermission({ mode: 'readwrite' })) === 'granted'
  return { mode: 'browser', supported, name: h?.name || '', connected: !!h && granted, needsPermission: !!h && !granted }
}
// 버튼을 누른 직후에만 부를 수 있다 (브라우저 규칙)
export async function pick() {
  if (!supported) throw new Error('이 브라우저는 폴더 연결을 지원하지 않습니다. PC의 크롬이나 엣지로 열어 주세요.')
  try {
    root = await window.showDirectoryPicker({ id: 'manual-folder', mode: 'readwrite' })
  } catch (e) {
    if (e.name === 'AbortError') return null
    throw e
  }
  granted = true
  try { await idb('readwrite', s => s.put(root, 'root')) } catch {}
  return root
}
export async function regrant() {
  const h = await handle()
  if (!h) return false
  granted = (await h.requestPermission({ mode: 'readwrite' })) === 'granted'
  return granted
}
export async function forget() {
  root = null
  granted = false
  try { await idb('readwrite', s => s.delete('root')) } catch {}
}
export const ready = () => !!root && granted

async function dir(parts, create) {
  let d = root
  for (const p of parts) d = await d.getDirectoryHandle(p, { create })
  return d
}
async function exists(parts) {
  try { await dir(parts, false); return true } catch { return false }
}

// 제품 폴더와 하위 폴더(최종본·검토본·참고자료)를 만든다. 새로 만든 폴더 수를 돌려준다
export async function ensureProduct(name) {
  let made = 0
  const top = safeName(name)
  for (const sub of SUBFOLDERS) {
    if (await exists([top, sub])) continue
    await dir([top, sub], true)
    made++
  }
  return made
}
export async function folderNames() {
  const out = []
  for await (const [name, h] of root.entries()) if (h.kind === 'directory' && isProductFolder(name)) out.push(name)
  return out.sort()
}
export async function listProduct(name) {
  const out = []
  for (const sub of SUBFOLDERS) {
    const files = []
    try {
      for await (const [n, h] of (await dir([safeName(name), sub], false)).entries()) {
        if (h.kind !== 'file') continue
        const f = await h.getFile()
        files.push({ name: n, size: f.size, at: new Date(f.lastModified).toISOString() })
      }
    } catch {}
    out.push({ sub, files: files.sort((a, b) => b.at.localeCompare(a.at)) })
  }
  return out
}
// rel: '제품/하위폴더/파일이름'
export async function write(rel, blob) {
  const parts = rel.split('/')
  const d = await dir(parts.slice(0, -1), true)
  const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable()
  await w.write(blob)
  await w.close()
}
export async function read(rel) {
  const parts = rel.split('/')
  return (await (await dir(parts.slice(0, -1), false)).getFileHandle(parts.at(-1))).getFile()
}
