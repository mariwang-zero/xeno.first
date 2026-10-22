// 제품 폴더 규칙. 화면(데모의 폴더 연결)과 앱 서버(server.mjs)가 같이 쓴다.
// 매뉴얼 폴더/<제품명>/최종본·검토본·참고자료
export const SUBFOLDERS = ['최종본', '검토본', '참고자료']

// 이름이 _ 로 시작하는 폴더(_앱데이터_백업 등)는 제품으로 보지 않는다
export const isProductFolder = name => !!name && !name.startsWith('_') && !name.startsWith('.')

// 폴더 이름으로 못 쓰는 글자를 _ 로 바꾼다 (윈도우·NAS 공통)
export const safeName = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '_'

// 제품명 확인: 그대로 폴더 이름이 되므로 못 쓰는 글자를 막는다. 문제가 없으면 null
export function productNameProblem(name, products = [], selfId = null) {
  const n = String(name || '').trim()
  if (!n) return '제품명을 적어 주세요.'
  if (/[\\/:*?"<>|]/.test(n)) return '제품명에는 \\ / : * ? " < > | 를 쓸 수 없습니다. 폴더 이름으로 쓰입니다.'
  if (!isProductFolder(n) || /[. ]$/.test(n)) return '제품명은 _ 나 . 로 시작하거나 . 이나 빈칸으로 끝날 수 없습니다.'
  if (products.some(p => p.id !== selfId && p.name.toLowerCase() === n.toLowerCase())) return `이미 있는 제품입니다: ${n}`
  return null
}

// 저장 파일 이름 앞에 붙이는 시각. 같은 이름을 덮어쓰지 않게 한다
export function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// 파일 이름 규칙 (화면·서버 공통). 문서번호 + Rev. 로 시작해서, 폴더에서 이름순으로 보면 Rev.·날짜순으로 줄 선다.
//   최종본: LCLT-UM-KO_Rev.02.docx            (배포할 때 그 Rev. 로)
//   검토본: LCLT-UM-KO_Rev.02_검토_20261022-1015.docx  (작업 중인 Rev. + 올린 날짜·시각)
//   AI 초안: LCLT-UM-KO_Rev.02_AI초안_20261022-1015.docx
// 확장자는 올린 파일을 따른다(.docx / .doc).
const revTag = rev => 'Rev.' + String(rev).padStart(2, '0')
const ymdhm = iso => iso.slice(0, 16).replace(/[-:]/g, '').replace('T', '-') // 2026-10-22T10:15 → 20261022-1015
export const extOf = name => (String(name || '').match(/\.docx?$/i)?.[0] || '.docx').toLowerCase()
export const fileRule = {
  final: (docNo, rev, from) => `${docNo}_${revTag(rev)}${extOf(from)}`,
  review: (docNo, rev, at, from) => `${docNo}_${revTag(rev)}_검토_${ymdhm(at)}${extOf(from)}`,
  ai: (docNo, rev, at) => `${docNo}_${revTag(rev)}_AI초안_${ymdhm(at)}.docx`,
}
