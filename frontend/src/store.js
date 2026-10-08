import { reactive } from 'vue'
import { api } from './api/index.js'

// 로그인한 사람과 "내가 처리할 이슈", 화면 아래 알림 한 줄
export const session = reactive({ user: null, todo: { assigned: [], toReview: [] }, loaded: false })
export const toast = reactive({ text: '', kind: 'ok', timer: null })

export async function refreshMe() {
  const r = await api.me()
  session.user = r?.user || null
  session.todo = r?.todo || { assigned: [], toReview: [] }
  session.loaded = true
}

export function notify(text, kind = 'ok') {
  toast.text = text
  toast.kind = kind
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (toast.text = ''), 3200)
}

// 버튼 동작을 감싸서 실패하면 이유를 알림으로 보여 줌
export async function attempt(fn, okText) {
  try {
    const r = await fn()
    if (okText) notify(okText)
    return r
  } catch (e) {
    notify(e.message, 'error')
    return null
  }
}
