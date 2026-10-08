<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, isDemo } from './api/index.js'
import { session, toast, refreshMe, attempt } from './store.js'
import { ROLES, fmtDateTime } from './lib/status.js'

const router = useRouter()
const route = useRoute()
const users = ref([])
const bellOpen = ref(false)
const notes = ref([])
const bellRef = ref(null)

onMounted(async () => {
  if (isDemo) users.value = await api.users()
  document.addEventListener('click', outside)
})
onBeforeUnmount(() => document.removeEventListener('click', outside))
function outside(e) {
  if (bellOpen.value && bellRef.value && !bellRef.value.contains(e.target)) bellOpen.value = false
}

async function toggleBell() {
  bellOpen.value = !bellOpen.value
  if (bellOpen.value) notes.value = await api.notifications()
}
async function openNote(n) {
  await api.readNotification(n.id)
  bellOpen.value = false
  await refreshMe()
  router.push(n.link)
}
async function readAll() {
  await api.readAllNotifications()
  notes.value = notes.value.map(n => ({ ...n, read: true }))
  await refreshMe()
}

// 데모 전용: 다른 사람으로 바꿔 보기
async function switchUser(e) {
  const u = users.value.find(u => u.id === e.target.value)
  await api.login(u.username)
  await refreshMe()
  router.replace(route.fullPath === '/login' ? '/' : route.fullPath)
}
async function logout() {
  await api.logout()
  await refreshMe()
  router.push('/login')
}
async function reset() {
  await attempt(() => api.resetDemo(), '예시 데이터로 되돌렸습니다.')
  users.value = await api.users()
  await refreshMe()
  router.push('/')
}
</script>

<template>
  <div v-if="isDemo" class="demo-banner">
    <div class="topbar-inner">
      <span><b>데모</b> · 예시 데이터로 동작합니다. 바꾼 내용은 이 브라우저에만 남습니다.</span>
      <span class="spacer"></span>
      <button class="btn ghost sm" @click="reset">예시 데이터로 되돌리기</button>
    </div>
  </div>
  <header v-if="session.user" class="topbar">
    <div class="topbar-inner">
      <router-link to="/" class="brand"><span class="brand-mark">AI</span>매뉴얼 협업시스템</router-link>
      <nav class="nav">
        <router-link to="/" :class="{ active: route.path === '/' || route.path.startsWith('/products') }">제품</router-link>
        <router-link to="/requests">내 요청함<span v-if="session.todoCount" class="badge">{{ session.todoCount }}</span></router-link>
        <router-link v-if="session.user.admin" to="/admin">관리</router-link>
      </nav>
      <span class="spacer"></span>
      <div class="bell-wrap" ref="bellRef">
        <button class="btn ghost bell" :aria-label="'알림 ' + session.unread + '건'" @click.stop="toggleBell">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
          <span v-if="session.unread" class="badge">{{ session.unread }}</span>
        </button>
        <div v-if="bellOpen" class="bell-menu panel">
          <div class="panel-head"><h3>알림</h3><span class="spacer"></span><button class="btn ghost sm" @click="readAll">모두 읽음</button></div>
          <ul>
            <li v-for="n in notes" :key="n.id"><button :class="{ unread: !n.read }" @click="openNote(n)"><span>{{ n.text }}</span><span class="num xs muted">{{ fmtDateTime(n.at) }}</span></button></li>
            <li v-if="!notes.length" class="empty">알림이 없습니다.</li>
          </ul>
        </div>
      </div>
      <div class="who">
        <template v-if="isDemo">
          <label for="who-select" class="muted hide-sm">보는 사람</label>
          <select id="who-select" :value="session.user.id" @change="switchUser">
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ ROLES[u.role] }}{{ u.admin ? ' · 관리자' : '' }}</option>
          </select>
        </template>
        <span v-else>{{ session.user.name }} <span class="muted">· {{ session.user.dept }} · {{ ROLES[session.user.role] }}</span></span>
        <button class="btn ghost sm" @click="logout">로그아웃</button>
      </div>
    </div>
  </header>
  <router-view :key="route.path + (session.user?.id || '')" />
  <div v-if="toast.text" class="toast" :class="toast.kind" role="status">{{ toast.text }}</div>
</template>
