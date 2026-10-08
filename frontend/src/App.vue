<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, isDemo } from './api/index.js'
import { session, toast, refreshMe, attempt } from './store.js'

const router = useRouter()
const route = useRoute()
const users = ref([])

onMounted(async () => {
  if (isDemo) users.value = await api.users()
})

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
      <router-link to="/" class="brand"><span class="brand-mark">Rev</span>매뉴얼 개정 관리</router-link>
      <nav class="nav">
        <router-link to="/">홈</router-link>
        <router-link v-if="session.user.admin" to="/admin">관리</router-link>
      </nav>
      <span class="spacer"></span>
      <div class="who">
        <template v-if="isDemo">
          <label for="who-select" class="muted hide-sm">보는 사람</label>
          <select id="who-select" :value="session.user.id" @change="switchUser">
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ u.dept }}</option>
          </select>
        </template>
        <span v-else>{{ session.user.name }} <span class="muted">· {{ session.user.dept }}</span></span>
        <button class="btn ghost sm" @click="logout">로그아웃</button>
      </div>
    </div>
  </header>
  <router-view :key="route.fullPath + (session.user?.id || '')" />
  <div v-if="toast.text" class="toast" :class="toast.kind" role="status">{{ toast.text }}</div>
</template>
