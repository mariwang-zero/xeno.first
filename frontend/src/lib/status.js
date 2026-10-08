// 상태와 역할 규칙 (화면 설계서 v2, 과제계획서 3.2·5.3·8장)
// 문서 작업: ai(AI 초안 생성) → progress(진행 중) → review(검토 요청) → final(최종 검토 완료) → deploy(배포 중)
//           어느 단계에서든 보류(held)할 수 있고, 보류는 단계와 따로 표시한다.
// 수정 요청: requested(요청됨) → checking(확인 중) → done(수정 완료) → closed(확인 완료)

export const DOC_STEPS = ['ai', 'progress', 'review', 'final', 'deploy']
export const DOC_STATUS = {
  ai: 'AI 초안 생성',
  progress: '진행 중',
  review: '검토 요청',
  final: '최종 검토 완료',
  deploy: '배포 중',
  hold: '보류',
}

export const REQ_STEPS = ['requested', 'checking', 'done', 'closed']
export const REQ_STATUS = {
  requested: '요청됨',
  checking: '확인 중',
  done: '수정 완료',
  closed: '확인 완료',
}

export const ROLES = {
  user: '일반 사용자',
  owner: '문서 담당자',
  reviewer: '검토자',
  final: '최종 검토자',
}

export const VERSION_KIND = {
  original: '원본',
  ai: 'AI 초안',
  review: '검토본',
  final: '최종본',
}

export const ITEM_KIND = { text: '텍스트', table: '표', image: '이미지' }
export const ITEM_NOTE = { ai: 'AI 적용 가능', manual: '수작업 권장', check: '확인 필요' }

export const DEPARTMENTS = ['매뉴얼', '기구', '전자', '소프트웨어', '품질', '생산', '영업']

// 역할로 할 수 있는 일. 관리자는 모든 버튼을 쓸 수 있다.
export const can = {
  aiDraft: u => ['owner', 'final'].includes(u?.role) || !!u?.admin,
  review: u => ['reviewer', 'final'].includes(u?.role) || !!u?.admin,
  finalize: u => u?.role === 'final' || !!u?.admin,
  setCurrent: u => ['owner', 'final'].includes(u?.role) || !!u?.admin,
}

export function today() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysBetween(fromIso, to = today()) {
  if (!fromIso) return 0
  const from = new Date(fromIso.slice(0, 10) + 'T00:00:00')
  return Math.round((to - from) / 86400000)
}

export function isOverdue(r) {
  return !!r.due && ['requested', 'checking'].includes(r.status) && daysBetween(r.due) > 0
}

export function fmtDate(iso) {
  if (!iso) return '-'
  return iso.slice(0, 10).replaceAll('-', '.')
}

export function fmtDateTime(iso) {
  if (!iso) return '-'
  return fmtDate(iso) + ' ' + iso.slice(11, 16)
}

export function fmtRev(n) {
  return 'Rev.' + String(n).padStart(2, '0')
}
