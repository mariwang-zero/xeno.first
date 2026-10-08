<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, isDemo } from '../api/index.js'
import { refreshMe } from '../store.js'

const router = useRouter()
const route = useRoute()
const username = ref(isDemo ? 'lkh' : '')
const password = ref(isDemo ? 'demo' : '')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await api.login(username.value.trim(), password.value)
    await refreshMe()
    router.replace(route.query.next || '/')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <main class="login">
    <form class="panel" @submit.prevent="submit">
      <div class="panel-body stack">
        <div class="brand"><span class="brand-mark">AI</span>매뉴얼 협업시스템</div>
        <p class="muted small">제품별 매뉴얼 작업, AI 초안, 수정 요청을 한곳에서</p>
        <label class="field">ID<input id="l-user" type="text" v-model="username" autocomplete="username" /></label>
        <label class="field">비밀번호<input id="l-pass" type="password" v-model="password" autocomplete="current-password" /></label>
        <button class="btn primary" type="submit">로그인</button>
        <p v-if="error" class="err small" role="alert">{{ error }}</p>
        <p v-if="isDemo" class="muted xs">데모: 아이디 lkh(이경환) 그대로 로그인하세요. 로그인 뒤 위쪽 "보는 사람"에서 다른 사람으로 바꿔 볼 수 있습니다.</p>
      </div>
    </form>
  </main>
</template>

<style scoped>
.login { min-height: 70vh; display: grid; place-items: center; padding: 24px 16px; }
form { width: min(380px, 100%); }
.brand { font-size: var(--fs-lg); }
.err { color: var(--danger); }
</style>
