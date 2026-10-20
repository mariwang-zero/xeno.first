// .docx 파일에서 미리보기용 본문(페이지 → 블록)을 뽑는다. 외부 라이브러리 없이 zip 을 직접 푼다.
// 화면의 블록 모양(seed.js 와 같음): { id, type: 'h' | 'p' | 'img' | 'table', text | rows, cert }
import { inflateRawSync } from 'node:zlib'

function unzipEntry(buf, wanted) {
  // 끝에서 중앙 디렉터리 끝 레코드(0x06054b50)를 찾는다
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('DOCX(zip) 형식이 아닙니다.')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + csize)
      return method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8')
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const textOf = xml => unxml((xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g) || []).map(t => (t === '<w:tab/>' ? ' ' : t.replace(/<[^>]+>/g, ''))).join('')).replace(/\s+/g, ' ').trim()

// 본문을 위에서부터 읽어 블록 목록으로 만든다. 쪽 나눔이 있으면 페이지를 나누고, 없으면 블록 14개마다 나눈다.
export function docxToPages(buf, certTitles = []) {
  const xml = unzipEntry(buf, 'word/document.xml')
  if (!xml) throw new Error('워드 본문(word/document.xml)을 찾지 못했습니다.')
  const body = xml.slice(xml.indexOf('<w:body'), xml.lastIndexOf('</w:body>'))
  const pages = [[]]
  let cert = false
  const push = b => pages.at(-1).push(b)
  const breakPage = () => { if (pages.at(-1).length) pages.push([]) }
  // 최상위 문단과 표만 순서대로 읽는다
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g
  let m
  while ((m = re.exec(body))) {
    const part = m[0]
    if (part.startsWith('<w:tbl>')) {
      const rows = (part.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(tr => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(textOf))
      if (rows.length) push({ type: 'table', rows })
      continue
    }
    if (/<w:br [^>]*w:type="page"|<w:pageBreakBefore\/>/.test(part)) breakPage()
    const style = (part.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || ''
    const text = textOf(part)
    const hasImg = /<w:drawing>|<w:pict>/.test(part)
    if (hasImg) push({ type: 'img', text: text || '그림' })
    if (!text || (hasImg && text)) continue
    if (/^(Heading|heading|제목)\s?\d|^Title$|^\d$/.test(style)) {
      cert = certTitles.some(t => text.replace(/\s/g, '').includes(t.replace(/\s|\(.*\)/g, '')))
      push({ type: 'h', text, cert })
    } else push({ type: 'p', text })
  }
  // 쪽 나눔이 없는 문서는 적당히 나눈다
  const out = pages.filter(p => p.length).flatMap(p => {
    if (p.length <= 20) return [p]
    const chunks = []
    for (let i = 0; i < p.length; i += 14) chunks.push(p.slice(i, i + 14))
    return chunks
  })
  if (!out.length) out.push([{ type: 'p', text: '(본문에서 글을 찾지 못했습니다)' }])
  return out.map((blocks, i) => ({ no: i + 1, blocks: blocks.map((b, j) => ({ id: `p${i + 1}-b${j + 1}`, ...b })) }))
}
