<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/index.js'
import { session, attempt } from '../store.js'
import { fmtRev } from '../lib/status.js'

const router = useRouter()
const mode = ref('ai')
const manuals = ref([])
const users = ref([])
const form = ref({ product: '', docNo: '', lang: '한국어', drafterId: '', fileName: '' })
const ai = ref({ baseManualId: '', product: 'LooksCAM S3 Wired', docNo: 'LC-S3W-UM-KO', diff: '유선 제품이라 Wi-Fi 없음. USB 케이블 5m 기본 포함. 나머지 기능은 S3와 같음.' })
const step = ref(1)
const proposal = ref(null)
const result = ref(null)
const busy = ref(false)

onMounted(async () => {
  manuals.value = await api.listManuals()
  users.value = await api.users()
  form.value.drafterId = session.user.id
  ai.value.baseManualId = manuals.value.find(m => m.status === 'drafted')?.id || ''
})

const TYPE = { replace: '바꾸기', remove: '빼기', edit: '고치기', human: '사람 확인' }
const autoItems = computed(() => proposal.value?.suggestions.filter(s => s.type !== 'human') || [])
const humanItems = computed(() => proposal.value?.suggestions.filter(s => s.type === 'human') || [])
const pickedCount = computed(() => autoItems.value.filter(s => s.selected).length)

async function createPlain() {
  const r = await attempt(() => api.createManual({ ...form.value }), '매뉴얼을 만들었습니다.')
  if (r) router.push('/manuals/' + r.id)
}
function onFile(e) {
  form.value.fileName = e.target.files[0]?.name || ''
}
async function propose() {
  busy.value = true
  const r = await attempt(() => api.aiPropose(ai.value))
  busy.value = false
  if (r) {
    proposal.value = r
    step.value = 2
  }
}
async function apply() {
  busy.value = true
  const r = await attempt(() => api.aiApply(proposal.value.id, { selectedIds: autoItems.value.filter(s => s.selected).map(s => s.id), docNo: ai.value.docNo }))
  busy.value = false
  if (r) {
    result.value = r
    step.value = 3
  }
}
</script>

<template>
  <main class="page" style="max-width: 980px">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">홈</router-link> / 새 매뉴얼</div>
        <h1>새 매뉴얼</h1>
        <p class="muted small">어떤 방법으로 시작해도 기본 목차(EU MDR 11개 절)가 붙고, "초안 작성 중" 상태로 만들어집니다.</p>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="mode === 'ai'" :class="{ on: mode === 'ai' }" @click="mode = 'ai'">AI 초안</button>
      <button role="tab" :aria-selected="mode === 'upload'" :class="{ on: mode === 'upload' }" @click="mode = 'upload'">워드 파일 등록</button>
      <button role="tab" :aria-selected="mode === 'blank'" :class="{ on: mode === 'blank' }" @click="mode = 'blank'">빈 매뉴얼</button>
    </div>

    <!-- 빈 매뉴얼 / 워드 파일 등록 -->
    <form v-if="mode !== 'ai'" class="panel panel-body stack" @submit.prevent="createPlain">
      <p class="small muted" v-if="mode === 'upload'">이미 만든 워드 파일을 원본으로 올립니다. 파일은 NAS의 원본 폴더로 옮겨집니다.</p>
      <p class="small muted" v-else>원본 파일 없이 시작합니다. 원본 폴더에 워드 파일을 넣으면 됩니다.</p>
      <div class="grid-2">
        <label class="field"><span class="req">제품명</span><input id="b-product" type="text" v-model="form.product" placeholder="예: L2S X7" /></label>
        <label class="field"><span class="req">문서번호</span><input id="b-docno" type="text" v-model="form.docNo" class="mono" placeholder="예: L2S-X7-UM-KO" /></label>
        <label class="field">언어<select id="b-lang" v-model="form.lang"><option>한국어</option><option>영어</option></select></label>
        <label class="field">초안 작성자
          <select id="b-drafter" v-model="form.drafterId"><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ u.dept }}</option></select>
        </label>
      </div>
      <label v-if="mode === 'upload'" class="field">워드 파일 (.docx)<input id="b-file" type="file" accept=".docx" @change="onFile" /></label>
      <div class="row" style="justify-content: flex-end"><button class="btn primary" type="submit" :disabled="!form.product || !form.docNo">매뉴얼 만들기</button></div>
    </form>

    <!-- AI 초안 -->
    <template v-else>
      <ol class="steps">
        <li :class="{ on: step === 1, done: step > 1 }">기준 매뉴얼과 차이점</li>
        <li :class="{ on: step === 2, done: step > 2 }">AI 제안 고르기</li>
        <li :class="{ on: step === 3 }">초안 만들기</li>
      </ol>

      <form v-if="step === 1" class="panel panel-body stack" @submit.prevent="propose">
        <p class="small muted">가장 비슷한 최신 매뉴얼을 고르고 차이점을 적으면, AI가 바꿀 목록을 제안합니다. 워드 파일은 고른 항목만 바뀌고 그림은 그대로 남습니다.</p>
        <label class="field"><span class="req">기준 매뉴얼
          </span><select id="a-base" v-model="ai.baseManualId">
            <option v-for="m in manuals.filter(m => m.status === 'drafted')" :key="m.id" :value="m.id">{{ m.product }} · {{ m.lang }} · {{ m.docNo }} {{ fmtRev(m.rev) }}</option>
          </select>
        </label>
        <div class="grid-2">
          <label class="field"><span class="req">새 제품명</span><input id="a-product" type="text" v-model="ai.product" /></label>
          <label class="field"><span class="req">새 문서번호</span><input id="a-docno" type="text" v-model="ai.docNo" class="mono" /></label>
        </div>
        <label class="field"><span class="req">기준 매뉴얼과 다른 점 </span><span class="hint">기능이 빠지거나 더해진 것, 바뀐 수치를 적어 주세요.</span>
          <textarea id="a-diff" v-model="ai.diff"></textarea>
        </label>
        <div class="row" style="justify-content: flex-end">
          <span class="xs muted">매뉴얼 한 권을 읽는 데 Claude API 토큰이 듭니다.</span>
          <button class="btn primary" type="submit" :disabled="busy">{{ busy ? 'AI가 읽는 중…' : 'AI 제안 받기' }}</button>
        </div>
      </form>

      <section v-if="step === 2" class="stack">
        <div class="panel">
          <div class="panel-head">
            <h2>AI가 바꿀 항목</h2>
            <span class="muted small">{{ autoItems.length }}건 중 {{ pickedCount }}건 적용</span>
            <span class="spacer"></span>
            <span class="xs muted num">토큰 {{ proposal.tokens.input.toLocaleString() }} / {{ proposal.tokens.output.toLocaleString() }}</span>
          </div>
          <div class="table-wrap">
            <table class="list">
              <thead><tr><th>적용</th><th>종류</th><th>위치</th><th>지금</th><th>바뀐 뒤</th></tr></thead>
              <tbody>
                <tr v-for="s in autoItems" :key="s.id">
                  <td><input :id="'s-' + s.id" type="checkbox" v-model="s.selected" :aria-label="s.note" /></td>
                  <td><span class="tag" :class="'k-' + s.type">{{ TYPE[s.type] }}</span></td>
                  <td class="small">{{ s.where }}<div class="xs muted">{{ s.note }}</div></td>
                  <td class="small"><del class="muted">{{ s.before }}</del></td>
                  <td class="small"><b>{{ s.after }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>사람이 확인할 것</h2><span class="muted small">초안을 만들면 초안 작성자에게 이슈로 등록됩니다</span></div>
          <ul class="human">
            <li v-for="s in humanItems" :key="s.id"><b class="small">{{ s.where }}</b><span class="small muted">{{ s.note }} (지금: {{ s.before }})</span></li>
          </ul>
        </div>
        <div class="row" style="justify-content: space-between">
          <button class="btn ghost" @click="step = 1">다시 입력</button>
          <button class="btn primary" @click="apply" :disabled="busy">{{ busy ? '만드는 중…' : `고른 ${pickedCount}건으로 초안 만들기` }}</button>
        </div>
      </section>

      <section v-if="step === 3 && result" class="panel panel-body stack">
        <h2>{{ result.manual.product }} 초안을 만들었습니다</h2>
        <p class="small">제안 {{ result.applied }}건을 적용한 워드 파일이 원본 폴더에 저장되었고, 확인할 항목 {{ result.issuesCreated }}건이 이슈로 등록되었습니다.</p>
        <code class="mono xs" style="overflow-wrap: anywhere">{{ result.manual.path }}</code>
        <div class="row"><router-link :to="'/manuals/' + result.manual.id" class="btn primary">매뉴얼 대시보드로 가기</router-link></div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.tabs button { font: inherit; font-weight: 500; background: none; border: 0; padding: 10px 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button.on { color: var(--ink); border-bottom-color: var(--accent); }
.steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; counter-reset: s; }
.steps li { counter-increment: s; font-size: var(--fs-sm); color: var(--muted); display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
.steps li::before { content: counter(s); width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-family: var(--font-mono); font-size: 12px; }
.steps li.on { color: var(--ink); border-color: var(--accent); }
.steps li.on::before { background: var(--accent); color: var(--accent-ink); }
.steps li.done::before { content: '✓'; background: var(--st-done-bg); color: var(--st-done-fg); }
.tag.k-remove { color: var(--danger); border-color: currentColor; background: transparent; }
.tag.k-replace, .tag.k-edit { color: var(--st-fix-fg); border-color: currentColor; background: transparent; }
.human { list-style: none; margin: 0; padding: 12px 18px; display: grid; gap: 10px; }
.human li { display: grid; gap: 2px; }
</style>
