// 상태 규칙 (기획서 "사용자, 역할, 상태 규칙")
// 매뉴얼: drafting(초안 작성 중) → drafted(초안 완료)
// 이슈: requested(수정 요청 중) → fixing(수정 중) → done(수정 완료(검토)), 확인은 confirmedAt 표시

export const MANUAL_STATUS = {
  drafting: '초안 작성 중',
  drafted: '초안 완료',
}

export const ISSUE_STATUS = {
  requested: '수정 요청 중',
  fixing: '수정 중',
  done: '수정 완료(검토)',
}

// 숫자가 클수록 더딘 상태. 절 상태는 열린 이슈 중 가장 더딘 것을 따른다.
const SLOWNESS = { done: 1, fixing: 2, requested: 3 }

export const DEPARTMENTS = ['매뉴얼', '기구', '전자', '소프트웨어', '품질', '생산', '영업']

export function today() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysBetween(fromIso, to = today()) {
  if (!fromIso) return 0
  const from = new Date(fromIso.slice(0, 10) + 'T00:00:00')
  return Math.round((to - from) / 86400000)
}

export function isOpen(issue) {
  return !issue.confirmedAt
}

// 멈춘 이슈: 수정 요청 중인 채로 기준 일수 이상 지났거나, 끝나지 않았는데 기한을 넘긴 이슈
export function isStalled(issue, stallDays) {
  if (issue.status === 'done') return false
  if (issue.due && daysBetween(issue.due) > 0) return true
  return issue.status === 'requested' && daysBetween(issue.requestedAt) >= stallDays
}

export function stallReason(issue, stallDays) {
  if (issue.status === 'done') return ''
  if (issue.due && daysBetween(issue.due) > 0) return `기한 ${daysBetween(issue.due)}일 지남`
  if (issue.status === 'requested' && daysBetween(issue.requestedAt) >= stallDays)
    return `요청 후 ${daysBetween(issue.requestedAt)}일째 착수 안 됨`
  return ''
}

export function sectionStatus(issues) {
  const open = issues.filter(isOpen)
  if (!open.length) return issues.length ? 'clear' : 'none'
  return open.reduce((a, b) => (SLOWNESS[b.status] > SLOWNESS[a.status] ? b : a)).status
}

export const SECTION_STATUS_LABEL = {
  requested: '수정 요청 중',
  fixing: '수정 중',
  done: '검토 대기',
  clear: '이슈 모두 확인',
  none: '이슈 없음',
  drafting: '초안 작성 중',
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
