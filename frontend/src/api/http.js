// 실제 서버(FastAPI)와 통신. 함수 이름과 응답 모양은 mock.js 와 같습니다.
async function call(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = `요청이 실패했습니다 (${res.status}).`
    try { msg = (await res.json()).detail || msg } catch {}
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}
const q = (f = {}) => {
  const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== false))
  return p.toString() ? '?' + p : ''
}

export const api = {
  login: (username, password) => call('POST', '/login', { username, password }),
  logout: () => call('POST', '/logout'),
  me: () => call('GET', '/me'),
  users: () => call('GET', '/users'),
  listManuals: () => call('GET', '/manuals'),
  getManual: id => call('GET', `/manuals/${id}`),
  createManual: data => call('POST', '/manuals', data),
  draftComplete: id => call('POST', `/manuals/${id}/draft-complete`),
  listIssues: (manualId, f) => call('GET', `/manuals/${manualId}/issues${q(f)}`),
  createIssue: (manualId, data) => call('POST', `/manuals/${manualId}/issues`, data),
  getIssue: id => call('GET', `/issues/${id}`),
  updateIssue: (id, patch) => call('PATCH', `/issues/${id}`, patch),
  startIssue: id => call('POST', `/issues/${id}/start`),
  completeIssue: (id, body) => call('POST', `/issues/${id}/complete`, body),
  confirmIssue: id => call('POST', `/issues/${id}/confirm`),
  reopenIssue: (id, body) => call('POST', `/issues/${id}/reopen`, body),
  listRevisions: manualId => call('GET', `/manuals/${manualId}/revisions`),
  createRevision: (manualId, body) => call('POST', `/manuals/${manualId}/revisions`, body),
  aiPropose: body => call('POST', '/ai-drafts', body),
  aiApply: (id, body) => call('POST', `/ai-drafts/${id}/apply`, body),
  getSettings: () => call('GET', '/admin/settings'),
  updateSettings: patch => call('PATCH', '/admin/settings', patch),
  createUser: data => call('POST', '/admin/users', data),
  updateUser: (id, patch) => call('PATCH', `/admin/users/${id}`, patch),
  manualEvents: manualId => call('GET', `/manuals/${manualId}/events`),
  resetDemo: async () => true,
}
