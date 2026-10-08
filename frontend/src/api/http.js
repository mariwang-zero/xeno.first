// 실제 서버(FastAPI)용. mock.js 와 같은 함수 이름, 같은 응답 모양.
async function call(method, url, body) {
  const r = await fetch('/api' + url, {
    method,
    credentials: 'same-origin',
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = '요청을 처리하지 못했습니다.'
    try { msg = (await r.json()).detail || msg } catch {}
    throw new Error(msg)
  }
  return r.status === 204 ? null : r.json()
}
const get = u => call('GET', u)
const post = (u, b = {}) => call('POST', u, b)
const patch = (u, b) => call('PATCH', u, b)
const del = u => call('DELETE', u)

function filesForm(fields, files) {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.append(k, v ?? ''))
  files.forEach(x => f.append('files', x))
  return f
}

export const api = {
  login: (username, password) => post('/auth/login', { username, password }),
  logout: () => post('/auth/logout'),
  me: () => get('/me'),
  users: () => get('/users'),
  settings: () => get('/settings'),

  notifications: () => get('/notifications'),
  readNotification: id => post(`/notifications/${id}/read`),
  readAllNotifications: () => post('/notifications/read-all'),

  catalog: () => get('/catalog'),
  product: id => get(`/products/${id}`),
  addFile: (docId, file) => post(`/docs/${docId}/files`, filesForm({}, [file])),

  references: () => get('/references'),
  startAi: (productId, inputs) => post(`/products/${productId}/ai`, filesForm({ referenceId: inputs.referenceId, mustInclude: inputs.mustInclude, extra: inputs.extra }, inputs.files || [])),
  aiRun: id => get(`/ai/${id}`),
  applyAi: (id, checkedNos) => post(`/ai/${id}/apply`, { checked: checkedNos }),

  doc: id => get(`/docs/${id}`),
  requests: docId => get(`/docs/${docId}/requests`),
  createRequest: (docId, data) => post(`/docs/${docId}/requests`, data),
  updateRequest: (id, data) => patch(`/requests/${id}`, data),
  cancelRequest: id => del(`/requests/${id}`),
  startRequest: id => post(`/requests/${id}/start`),
  completeRequest: (id, resolution) => post(`/requests/${id}/complete`, { resolution }),
  closeRequest: id => post(`/requests/${id}/close`),
  reopenRequest: (id, reason) => post(`/requests/${id}/reopen`, { reason }),

  startEdit: docId => post(`/docs/${docId}/lock`),
  uploadEdit: (docId, { file, note }) => post(`/docs/${docId}/upload`, filesForm({ note }, file ? [file] : [])),
  cancelEdit: docId => del(`/docs/${docId}/lock`),
  setHold: (docId, reason) => post(`/docs/${docId}/hold`, { reason }),
  requestReview: docId => post(`/docs/${docId}/review`),
  finalize: (docId, ok, reason) => post(`/docs/${docId}/finalize`, { ok, reason }),
  deployPreview: docId => get(`/docs/${docId}/deploy-preview`),
  deploy: (docId, summary) => post(`/docs/${docId}/deploy`, { summary }),

  myRequests: () => get('/requests/mine'),
  history: docId => get(`/docs/${docId}/history`),
  setCurrent: versionId => post(`/versions/${versionId}/current`),

  adminData: () => get('/admin'),
  saveUser: u => post('/admin/users', u),
  saveProduct: p => post('/admin/products', p),
  saveSettings: s => post('/admin/settings', s),
  resetDemo: async () => true,
}
