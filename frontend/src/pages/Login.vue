<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, isDemo } from '../api/index.js'
import { refreshMe, attempt } from '../store.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const users = ref([])

onMounted(async () => {
  if (isDemo) {
    users.value = await api.users()
    username.value = 'whlee'
  }
})

async function submit() {
  const ok = await attempt(() => api.login(username.value.trim(), password.value))
  if (ok) {
    await refreshMe()
    router.push('/')
  }
}
</script>

<template>
  <main class="page" style="max-width: 420px; padding-top: 10vh">
    <div class="stack">
      <div class="brand" style="font-size: 18px"><span class="brand-mark">Rev</span>매뉴얼 개정 관리</div>
      <p class="muted small">제품 매뉴얼의 초안, 수정 요청, 개정을 한곳에서 관리합니다.</p>
    </div>
    <form class="panel panel-body stack" @submit.prevent="submit">
      <label class="field" v-if="isDemo">로그인할 사람 (데모)
        <select id="login-user" v-model="username">
          <option v-for="u in users" :key="u.id" :value="u.username">{{ u.name }} · {{ u.dept }}</option>
        </select>
        <span class="hint">데모에서는 비밀번호를 확인하지 않습니다.</span>
      </label>
      <label class="field" v-else>아이디
        <input id="login-id" type="text" v-model="username" autocomplete="username" required />
      </label>
      <label class="field">비밀번호
        <input id="login-pw" type="password" v-model="password" autocomplete="current-password" :required="!isDemo" />
      </label>
      <button class="btn primary" type="submit" style="justify-content: center">로그인</button>
      <p class="xs muted">계정이 없으면 관리자에게 요청하세요.</p>
    </form>
  </main>
</template>
