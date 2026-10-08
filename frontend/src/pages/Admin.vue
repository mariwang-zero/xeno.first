<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session, attempt } from '../store.js'
import { DEPARTMENTS } from '../lib/status.js'

const users = ref([])
const settings = ref(null)
const reasonsText = ref('')
const newUser = ref({ username: '', name: '', dept: '기구' })
const newSection = ref('')

async function load() {
  users.value = await api.users()
  settings.value = await api.getSettings()
  reasonsText.value = settings.value.reasons.join('\n')
}
onMounted(load)

async function toggle(u, key) {
  await attempt(() => api.updateUser(u.id, { [key]: !u[key] }), '바꿨습니다.')
  load()
}
async function addUser() {
  if (await attempt(() => api.createUser(newUser.value), '계정을 만들었습니다. 처음 비밀번호는 아이디와 같습니다.')) {
    newUser.value = { username: '', name: '', dept: '기구' }
    load()
  }
}
async function saveSettings() {
  const reasons = reasonsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  await attempt(() => api.updateSettings({ stallDays: Number(settings.value.stallDays), reasons, sectionTemplate: settings.value.sectionTemplate }), '설정을 저장했습니다.')
}
function addSection() {
  if (!newSection.value.trim()) return
  settings.value.sectionTemplate.push({ title: newSection.value.trim(), cert: false })
  newSection.value = ''
}
function move(i, d) {
  const t = settings.value.sectionTemplate
  if (i + d < 0 || i + d >= t.length) return
  ;[t[i], t[i + d]] = [t[i + d], t[i]]
}
</script>

<template>
  <main class="page" v-if="settings">
    <div class="page-head">
      <div class="grow">
        <h1>관리</h1>
        <p class="muted small">계정과 부서, 새 매뉴얼에 붙는 기본 목차, 수정 사유 분류, 멈춘 이슈 기준을 정합니다.</p>
      </div>
    </div>
    <p v-if="!session.user.admin" class="panel panel-body muted">관리자만 바꿀 수 있습니다.</p>

    <section class="panel">
      <div class="panel-head"><h2>사용자</h2><span class="muted small">{{ users.length }}명</span></div>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>이름</th><th>아이디</th><th>부서</th><th>관리자</th><th>배포 담당</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td class="t-title">{{ u.name }}</td>
              <td class="mono small">{{ u.username }}</td>
              <td class="small">{{ u.dept }}</td>
              <td><input :id="'adm-' + u.id" type="checkbox" :checked="u.admin" @change="toggle(u, 'admin')" :aria-label="u.name + ' 관리자'" /></td>
              <td><input :id="'rel-' + u.id" type="checkbox" :checked="u.release" @change="toggle(u, 'release')" :aria-label="u.name + ' 배포 담당'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="panel-body row" style="border-top: 1px solid var(--line); align-items: flex-end" @submit.prevent="addUser">
        <label class="field" style="flex: 1 1 140px">이름<input id="u-name" type="text" v-model="newUser.name" /></label>
        <label class="field" style="flex: 1 1 140px">아이디<input id="u-id" type="text" v-model="newUser.username" class="mono" /></label>
        <label class="field" style="flex: 1 1 120px">부서<select id="u-dept" v-model="newUser.dept"><option v-for="d in DEPARTMENTS" :key="d">{{ d }}</option></select></label>
        <button class="btn" type="submit">계정 추가</button>
      </form>
    </section>

    <div class="grid-2" style="align-items: start">
      <section class="panel">
        <div class="panel-head"><h2>기본 목차</h2><span class="muted xs">새 매뉴얼에 붙습니다. 이미 만든 매뉴얼은 바뀌지 않습니다.</span></div>
        <ol class="tpl">
          <li v-for="(s, i) in settings.sectionTemplate" :key="s.title + i">
            <span class="num muted">{{ i + 1 }}</span>
            <span style="flex: 1; min-width: 0">{{ s.title }}</span>
            <label class="check xs"><input :id="'cert-' + i" type="checkbox" v-model="s.cert" /> 인증 문구</label>
            <button class="btn ghost sm" @click="move(i, -1)" aria-label="위로">↑</button>
            <button class="btn ghost sm" @click="move(i, 1)" aria-label="아래로">↓</button>
            <button class="btn ghost sm" @click="settings.sectionTemplate.splice(i, 1)" aria-label="삭제">삭제</button>
          </li>
        </ol>
        <form class="panel-body row" style="border-top: 1px solid var(--line)" @submit.prevent="addSection">
          <input id="sec-new" type="text" v-model="newSection" placeholder="절 이름" style="flex: 1" />
          <button class="btn" type="submit">절 추가</button>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>규칙</h2></div>
        <div class="panel-body stack">
          <label class="field">멈춘 이슈 기준 (일) <span class="hint">수정 요청 중인 채로 이 일수가 지나면 대시보드에 빨갛게 표시합니다.</span>
            <input id="s-stall" type="number" min="1" max="30" v-model="settings.stallDays" style="max-width: 120px" />
          </label>
          <label class="field">수정 사유 분류 <span class="hint">한 줄에 하나씩</span>
            <textarea id="s-reasons" v-model="reasonsText" rows="7"></textarea>
          </label>
        </div>
      </section>
    </div>
    <div class="row" style="justify-content: flex-end"><button class="btn primary" @click="saveSettings">목차·규칙 저장</button></div>
  </main>
</template>

<style scoped>
.tpl { list-style: none; margin: 0; padding: 6px 12px; display: grid; }
.tpl li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); flex-wrap: wrap; }
.tpl li:last-child { border-bottom: 0; }
.tpl .num { width: 20px; }
</style>
