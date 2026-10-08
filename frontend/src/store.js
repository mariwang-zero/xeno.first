import { reactive } from 'vue'
import { api } from './api/index.js'

// 로그인한 사람, 처리할 요청 수, 안 읽은 알림 수, 화면 아래 알림 한 줄
export const session = reactive({ user: null, todoCount: 0, unread: 0, loaded: false })
export const toast = reactive({ text: '', kind: 'ok', timer: null })

export async function refreshMe() {
  const r = await api.me()
  session.user = r?.user || null
  session.todoCount = r?.todoCount || 0
  session.unread = r?.unread || 0
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
    await refreshMe()
    return r ?? true
  } catch (e) {
    notify(e.message, 'error')
    return null
  }
}
