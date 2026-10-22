<script setup>
import { ref, onMounted } from 'vue'
import { api, isDemo } from '../api/index.js'
import { attempt, refreshMe, notify } from '../store.js'
import { ROLES, DEPARTMENTS } from '../lib/status.js'

// S10 관리: 사용자·역할 / 제품 / 기본값
const data = ref(null)
const tab = ref('users')
const newUser = ref({ name: '', username: '', dept: '매뉴얼', role: 'user' })
const newProd = ref({ name: '', categoryId: '' })
const newReason = ref('')
const newCat = ref('')
const folder = ref(null)
async function load() {
  data.value = await api.adminData()
  newProd.value.categoryId ||= data.value.categories[0]?.id
}
async function loadFolder() {
  try { folder.value = await api.folderStatus() } catch (e) { folder.value = { connected: false, error: e.message } }
}
onMounted(() => { load(); loadFolder() })

// 매뉴얼 폴더: 데모는 이 브라우저에서 폴더를 골라 연결, 실제 서버는 설정의 NAS 폴더를 쓴다
const syncText = r => [r.created ? `제품 폴더 ${r.created}개를 만들었습니다.` : '제품 폴더가 모두 있습니다.', r.added?.length ? `폴더에서 새 제품 ${r.added.length}개를 찾아 '미분류'로 등록했습니다: ${r.added.join(', ')}` : '', r.adopted ? `최종본 폴더의 Rev. 파일 ${r.adopted}개를 현재 사용본으로 반영했습니다.` : ''].join(' ').trim()
async function folderAct(fn) {
  const r = await attempt(fn)
  if (r && r !== true) notify(r.created === undefined ? '폴더 연결을 끊었습니다.' : syncText(r))
  await loadFolder()
  await load()
}

async function saveUser(u) {
  if (await attempt(() => api.saveUser(u), '저장했습니다.')) { await load(); await refreshMe() }
  else await load()
}
async function addUser() {
  if (await attempt(() => api.saveUser({ ...newUser.value }), '사용자를 추가했습니다.')) {
    newUser.value = { name: '', username: '', dept: '매뉴얼', role: 'user' }
    await load()
  }
}
async function saveProduct(p) {
  await attempt(() => api.saveProduct(p), '저장했습니다.')
  await load()
}
async function addProduct() {
  const msg = folder.value?.connected ? `제품을 추가하고 ${newProd.value.name.trim()} 폴더를 만들었습니다.` : '제품을 추가했습니다.'
  if (await attempt(() => api.saveProduct({ ...newProd.value }), msg)) {
    newProd.value.name = ''
    await load()
  }
}
async function addCategory() {
  if (await attempt(() => api.saveCategory(newCat.value), '대분류를 추가했습니다.')) {
    newCat.value = ''
    await load()
  }
}
async function saveSettings(patch, msg = '저장했습니다.') {
  await attempt(() => api.saveSettings(patch), msg)
  await load()
}
function addReason() {
  const r = newReason.value.trim()
  if (!r) return
  saveSettings({ reasons: [...data.value.settings.reasons, r] })
  newReason.value = ''
}
const catOrder = id => data.value.categories.find(c => c.id === id)?.order ?? 999
</script>

<template>
  <main class="page" v-if="data">
    <div class="page-head"><div class="grow"><h1>관리</h1><p class="muted small">사용자 역할, 제품 목록, 기본값을 바꿉니다. 관리자만 볼 수 있습니다.<template v-if="!isDemo"> NAS 계정으로 처음 로그인한 사람은 일반 사용자로 자동 추가됩니다. 아이디를 NAS 계정과 같게 미리 추가해 두면 역할을 먼저 정할 수 있습니다.</template></p></div></div>
    <div class="tabs-bar" role="tablist">
      <button role="tab" :aria-selected="tab === 'users'" :class="{ on: tab === 'users' }" @click="tab = 'users'">사용자·역할</button>
      <button role="tab" :aria-selected="tab === 'products'" :class="{ on: tab === 'products' }" @click="tab = 'products'">제품</button>
      <button role="tab" :aria-selected="tab === 'defaults'" :class="{ on: tab === 'defaults' }" @click="tab = 'defaults'">기본값</button>
    </div>

    <section v-if="tab === 'users'" class="panel">
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>이름</th><th>아이디</th><th>부서</th><th>역할</th><th>관리자</th><th>사용</th></tr></thead>
          <tbody>
            <tr v-for="u in data.users" :key="u.id" :class="{ off: !u.active }">
              <td><input type="text" class="name-in" :value="u.name" :aria-label="u.username + ' 이름'" @change="e => e.target.value.trim() && saveUser({ ...u, name: e.target.value.trim() })" /></td>
              <td class="mono small">{{ u.username }}</td>
              <td><select :value="u.dept" @change="e => saveUser({ ...u, dept: e.target.value })"><option v-for="x in DEPARTMENTS" :key="x">{{ x }}</option></select></td>
              <td><select :value="u.role" @change="e => saveUser({ ...u, role: e.target.value })"><option v-for="(l, k) in ROLES" :key="k" :value="k">{{ l }}</option></select></td>
              <td><input type="checkbox" :checked="u.admin" :aria-label="u.name + ' 관리자'" @change="e => saveUser({ ...u, admin: e.target.checked })" /></td>
              <td><input type="checkbox" :checked="u.active" :aria-label="u.name + ' 사용'" @change="e => saveUser({ ...u, active: e.target.checked })" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="panel-body add">
        <h3>사용자 추가</h3>
        <div class="add-row">
          <label class="field">이름<input type="text" v-model="newUser.name" /></label>
          <label class="field">아이디<input type="text" v-model="newUser.username" /></label>
          <label class="field">부서<select v-model="newUser.dept"><option v-for="x in DEPARTMENTS" :key="x">{{ x }}</option></select></label>
          <label class="field">역할<select v-model="newUser.role"><option v-for="(l, k) in ROLES" :key="k" :value="k">{{ l }}</option></select></label>
          <button class="btn primary" @click="addUser">추가</button>
        </div>
        <p class="xs muted">역할: 일반 사용자는 요청·메모, 문서 담당자는 AI 초안·편집·검토 요청, 검토자는 검토 의견, 최종 검토자는 최종 검토 완료·배포를 합니다.</p>
      </div>
    </section>

    <template v-else-if="tab === 'products'">
    <section class="panel" v-if="folder">
      <div class="panel-head"><h2>매뉴얼 폴더</h2><span class="muted small">제품마다 &lt;제품명&gt;/최종본·검토본·참고자료 폴더를 둡니다.</span></div>
      <div class="panel-body stack">
        <template v-if="folder.mode === 'server'">
          <div class="row small"><span :class="folder.connected ? 'ok-dot' : 'bad-dot'"></span><span class="mono" style="overflow-wrap: anywhere">{{ folder.name }}</span><span class="muted">{{ folder.connected ? '연결됨' : '연결되지 않음. 서버 설정(filesDir)과 NAS 연결을 확인해 주세요.' }}</span></div>
          <div class="row"><button class="btn" @click="folderAct(() => api.syncFolders())">폴더 다시 읽기</button></div>
        </template>
        <template v-else>
          <div class="row small" v-if="folder.connected"><span class="ok-dot"></span><span>연결됨:</span><b class="mono">{{ folder.name }}</b></div>
          <div class="row small" v-else-if="folder.needsPermission"><span class="bad-dot"></span><span>전에 연결한 폴더 <b class="mono">{{ folder.name }}</b>에 다시 권한이 필요합니다.</span></div>
          <p class="small muted" v-else>데모에서는 이 PC의 폴더(또는 NAS 공유 폴더)를 직접 연결해 볼 수 있습니다. 연결하면 모든 제품 폴더를 만들고, 제품을 추가하면 폴더가 생기고, 올린 파일이 그 폴더에 저장됩니다. 폴더에 직접 만든 제품 폴더는 '폴더 다시 읽기'로 제품 목록에 들어옵니다.</p>
          <div class="row">
            <button v-if="folder.needsPermission" class="btn primary" @click="folderAct(() => api.regrantFolder())">다시 연결</button>
            <button class="btn" :class="{ primary: !folder.connected && !folder.needsPermission }" :disabled="!folder.supported" @click="folderAct(() => api.connectFolder())">{{ folder.connected || folder.needsPermission ? '다른 폴더 연결' : '폴더 연결' }}</button>
            <button v-if="folder.connected" class="btn" @click="folderAct(() => api.syncFolders())">폴더 다시 읽기</button>
            <button v-if="folder.connected || folder.needsPermission" class="btn ghost" @click="folderAct(() => api.disconnectFolder())">연결 끊기</button>
          </div>
          <p v-if="!folder.supported" class="xs muted">이 브라우저는 폴더 연결을 지원하지 않습니다. PC의 크롬이나 엣지로 열어 주세요.</p>
          <p v-else class="xs muted">연결 정보는 이 브라우저에만 남습니다. 폴더 안의 파일은 지우지 않습니다.</p>
        </template>
      </div>
    </section>
    <section class="panel">
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>대분류</th><th>제품명 (폴더 이름)</th><th>문서 번호</th><th>Rev.</th><th>목록에 보이기</th></tr></thead>
          <tbody>
            <tr v-for="p in [...data.products].sort((a, b) => catOrder(a.categoryId) - catOrder(b.categoryId) || a.order - b.order)" :key="p.id">
              <td><select :value="p.categoryId" :aria-label="p.name + ' 대분류'" @change="e => saveProduct({ ...p, categoryId: e.target.value })"><option v-for="c in data.categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></td>
              <td class="t-title">{{ p.name }}</td>
              <td class="mono small">{{ p.docNo }}</td>
              <td class="num">{{ String(p.rev).padStart(2, '0') }}</td>
              <td><input type="checkbox" :checked="!p.hidden" :aria-label="p.name + ' 보이기'" @change="e => saveProduct({ ...p, hidden: !e.target.checked })" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="panel-body add">
        <h3>제품 추가</h3>
        <div class="add-row">
          <label class="field">대분류<select v-model="newProd.categoryId"><option v-for="c in data.categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
          <label class="field">제품명<input type="text" v-model="newProd.name" placeholder="예: L2SX7" @keydown.enter="addProduct" /></label>
          <button class="btn primary" @click="addProduct">추가</button>
        </div>
        <p class="xs muted">제품명이 그대로 폴더 이름이 됩니다. 추가한 뒤에는 이름을 바꿀 수 없고, 목록에서 숨길 수 있습니다.</p>
        <h3>대분류 추가</h3>
        <div class="add-row">
          <label class="field">대분류 이름<input type="text" v-model="newCat" placeholder="예: 액세서리" @keydown.enter="addCategory" /></label>
          <button class="btn" @click="addCategory">추가</button>
        </div>
      </div>
    </section>
    </template>

    <template v-else>
      <section class="panel">
        <div class="panel-head"><h2>검토·배포 단계</h2></div>
        <div class="panel-body stack">
          <label class="check"><input type="checkbox" :checked="data.settings.reviewFlow" @change="e => saveSettings({ reviewFlow: e.target.checked }, e.target.checked ? '검토·배포 단계를 켰습니다.' : '검토·배포 단계를 껐습니다.')" /> 검토 요청 → 최종 검토 완료 → 배포 단계를 사용</label>
          <p class="xs muted">끄면 문서는 진행 중 단계까지만 쓰고, 검토 요청 버튼이 숨겨집니다. 2단계 이후에 켜는 것을 기본으로 합니다(데모에서는 켜 둠).</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>매뉴얼 목차</h2><span class="muted small">EU MDR 기준 11개 절. 인증 문구가 있는 절은 요청할 때 경고가 나옵니다.</span></div>
        <div class="panel-body">
          <ol class="sections">
            <li v-for="(s, i) in data.settings.sections" :key="i">
              <span>{{ s.title }}</span>
              <label class="check xs"><input type="checkbox" :checked="s.cert" @change="e => saveSettings({ sections: data.settings.sections.map((x, j) => (j === i ? { ...x, cert: e.target.checked } : x)) })" /> 인증 문구</label>
            </li>
          </ol>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>요청 사유 목록</h2></div>
        <div class="panel-body stack">
          <div class="row"><span v-for="(r, i) in data.settings.reasons" :key="r" class="tag reason">{{ r }} <button class="x" :aria-label="r + ' 지우기'" @click="saveSettings({ reasons: data.settings.reasons.filter((_, j) => j !== i) })">×</button></span></div>
          <div class="row"><input type="text" v-model="newReason" placeholder="새 사유" style="max-width: 240px" @keydown.enter="addReason" /><button class="btn" @click="addReason">추가</button></div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.tabs-bar { display: flex; gap: 2px; border-bottom: 1px solid var(--line); }
.tabs-bar button { font: inherit; background: none; border: 0; padding: 8px 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs-bar button.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
tr.off td { opacity: .55; }
.name-in { width: 9em; padding: 4px 8px; font-size: var(--fs-sm); }
table.list select { width: auto; padding: 4px 8px; font-size: var(--fs-sm); }
.add { border-top: 1px solid var(--line); display: grid; gap: 10px; }
.add-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.add-row .field { flex: 1 1 140px; }
.sections { margin: 0; padding-left: 22px; display: grid; gap: 6px; font-size: var(--fs-sm); }
.sections li > * { vertical-align: middle; }
.sections li { display: list-item; }
.sections .check { margin-left: 10px; color: var(--muted); }
.ok-dot, .bad-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--st-done-fg); flex: none; }
.bad-dot { background: var(--danger); }
.reason { display: inline-flex; gap: 4px; align-items: center; }
.x { font: inherit; border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 2px; }
</style>
