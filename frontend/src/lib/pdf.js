// 워드 원본을 PDF 쪽 그대로 보여 주기 위한 도우미.
// pdf.js 는 vendor/pdfjs/ 에 둔 파일을 필요할 때만 불러온다(사내 서버는 인터넷 없이도 동작).
// src: 주소 문자열, 또는 데모에서 올린 PDF 는 'idb:<키>' (이 브라우저의 IndexedDB)
const base = () => new URL(import.meta.env.BASE_URL, location.href)
let libP = null
function pdfjs() {
  if (!libP) {
    libP = import(/* @vite-ignore */ new URL('vendor/pdfjs/pdf.min.mjs', base()).href).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', base()).href
      return lib
    })
  }
  return libP
}
export const pdfLib = pdfjs

const docs = new Map()
export function openPdf(src) {
  if (!docs.has(src)) {
    const p = (async () => {
      const lib = await pdfjs()
      if (src.startsWith('idb:')) {
        const blob = await idbGet(src.slice(4))
        if (!blob) throw new Error('이 브라우저에 저장된 PDF 가 없습니다.')
        return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
      }
      return lib.getDocument({ url: new URL(src, base()).href, withCredentials: true }).promise
    })()
    p.catch(() => docs.delete(src))
    docs.set(src, p)
  }
  return docs.get(src)
}

// ── 데모: 올린 PDF 를 이 브라우저에 보관 ──
function idb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open('manual-demo-pdf', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('pdf')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  })
}
export async function idbPut(key, blob) {
  const db = await idb()
  await new Promise((ok, no) => {
    const t = db.transaction('pdf', 'readwrite')
    t.objectStore('pdf').put(blob, key)
    t.oncomplete = ok
    t.onerror = () => no(t.error)
  })
}
async function idbGet(key) {
  const db = await idb()
  return new Promise((ok, no) => {
    const r = db.transaction('pdf').objectStore('pdf').get(key)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  })
}
