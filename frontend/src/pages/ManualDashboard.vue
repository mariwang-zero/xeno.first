<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/index.js'
import { session, attempt, notify } from '../store.js'
import StatusChip from '../components/StatusChip.vue'
import IssueTable from '../components/IssueTable.vue'
import { fmtRev, fmtDate, fmtDateTime } from '../lib/status.js'

const props = defineProps({ id: String })
const m = ref(null)
const issues = ref([])
const events = ref([])
const stallDays = ref(3)
const filter = ref({ status: 'open', sectionId: '', mine: false, stalledOnly: false })

async function load() {
  const [mm, ev, st] = await Promise.all([api.getManual(props.id), api.manualEvents(props.id), api.getSettings(), loadIssues()])
  m.value = mm
  events.value = ev
  stallDays.value = st.stallDays
}
async function loadIssues() {
  const f = filter.value
  let list = await api.listIssues(props.id, { status: f.status, sectionId: f.sectionId, mine: f.mine })
  if (f.stalledOnly) list = list.filter(i => i.stalled)
  issues.value = list
}
onMounted(load)
watch(filter, loadIssues, { deep: true })

const section = computed(() => m.value?.sections.find(s => s.id === filter.value.sectionId))
const canDraftComplete = computed(() => m.value?.status === 'drafting' && (m.value.drafterId === session.user.id || session.user.admin))

function pick(status, stalledOnly = false) {
  filter.value = { ...filter.value, status, stalledOnly }
}
function pickSection(id) {
  filter.value = { ...filter.value, sectionId: filter.value.sectionId === id ? '' : id }
}
async function draftComplete() {
  if (await attempt(() => api.draftComplete(props.id), '초안 완료로 바꿨습니다.')) load()
}
async function copyPath() {
  try {
    await navigator.clipboard.writeText(m.value.path)
    notify('원본 위치를 복사했습니다. 파일 탐색기 주소창에 붙여 넣으세요.')
  } catch {
    notify('복사하지 못했습니다. 경로를 직접 선택해 복사하세요.', 'error')
  }
}
</script>

<template>
  <main class="page" v-if="m">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">홈</router-link> / <span class="mono">{{ m.docNo }}</span> · {{ m.lang }} · <span class="mono">{{ fmtRev(m.rev) }}</span></div>
        <div class="row"><h1>{{ m.product }} 사용설명서</h1><StatusChip kind="manual" :status="m.status" /></div>
        <p class="small muted">초안 작성자 {{ m.drafter?.name }}<template v-if="m.draftedAt"> · 초안 완료 {{ fmtDate(m.draftedAt) }}</template></p>
      </div>
      <div class="row">
        <button v-if="canDraftComplete" class="btn" @click="draftComplete">초안 완료로 바꾸기</button>
        <router-link :to="`/manuals/${m.id}/revisions`" class="btn">개정 이력</router-link>
        <router-link :to="{ path: `/manuals/${m.id}/issues/new`, query: section ? { section: section.id } : {} }" class="btn primary">새 수정 요청</router-link>
      </div>
    </div>

    <div class="panel panel-body row small" style="gap: 12px">
      <span class="muted">원본 파일</span>
      <code class="mono xs" style="flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: all">{{ m.path }}</code>
      <button class="btn sm" @click="copyPath">위치 복사</button>
    </div>

    <div class="stats">
      <button class="stat" :class="{ on: filter.status === 'requested' && !filter.stalledOnly }" @click="pick('requested')">
        <span class="n">{{ m.counts.requested }}</span><span class="l"><i style="background: var(--st-req-fg)"></i>수정 요청 중</span>
      </button>
      <button class="stat" :class="{ on: filter.status === 'fixing' }" @click="pick('fixing')">
        <span class="n">{{ m.counts.fixing }}</span><span class="l"><i style="background: var(--st-fix-fg)"></i>수정 중</span>
      </button>
      <button class="stat" :class="{ on: filter.status === 'done' }" @click="pick('done')">
        <span class="n">{{ m.counts.review }}</span><span class="l"><i style="background: var(--st-done-fg)"></i>수정 완료, 검토 대기</span>
      </button>
      <button class="stat" :class="{ on: filter.stalledOnly, alert: m.counts.stalled }" @click="pick('open', true)">
        <span class="n">{{ m.counts.stalled }}</span><span class="l"><i style="background: var(--danger)"></i>멈춘 이슈 ({{ stallDays }}일 이상 미착수·기한 초과)</span>
      </button>
      <button class="stat" :class="{ on: filter.status === 'confirmed' }" @click="pick('confirmed')">
        <span class="n">{{ m.counts.confirmed }}</span><span class="l"><i style="background: var(--muted)"></i>확인함, 다음 Rev. 대기</span>
      </button>
    </div>

    <div class="dash">
      <section class="panel toc">
        <div class="panel-head"><h2>목차</h2><span class="muted xs">절을 누르면 그 절의 이슈만 봅니다</span></div>
        <ol class="toc-list">
          <li v-for="s in m.sections" :key="s.id">
            <button class="toc-item" :class="{ on: filter.sectionId === s.id }" @click="pickSection(s.id)">
              <span class="num muted">{{ s.no }}</span>
              <span class="toc-title">{{ s.title }} <span v-if="s.cert" class="tag cert" title="인증 기관 필수 문구가 있는 절">인증 문구</span></span>
              <span class="toc-state">
                <span v-if="s.stalled" class="chip stalled">멈춤</span>
                <StatusChip v-else kind="section" :status="m.status === 'drafting' && s.status === 'none' ? 'drafting' : s.status" />
                <span class="num xs muted" v-if="s.openCount">{{ s.openCount }}</span>
              </span>
            </button>
          </li>
        </ol>
      </section>

      <section class="panel" style="min-width: 0">
        <div class="panel-head">
          <h2>이슈<template v-if="section"> · {{ section.no }}. {{ section.title }}</template></h2>
          <button v-if="section" class="btn ghost sm" @click="pickSection(section.id)">절 선택 해제</button>
          <span class="spacer"></span>
          <label class="check"><input id="f-mine" type="checkbox" v-model="filter.mine" /> 내 것만</label>
          <select id="f-status" v-model="filter.status" style="width: auto" @change="filter.stalledOnly = false">
            <option value="open">열린 이슈 전체</option>
            <option value="requested">수정 요청 중</option>
            <option value="fixing">수정 중</option>
            <option value="done">수정 완료(검토)</option>
            <option value="confirmed">확인함</option>
            <option value="">전체</option>
          </select>
        </div>
        <IssueTable :issues="issues" :stall-days="stallDays" empty-text="조건에 맞는 이슈가 없습니다." />
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>최근 활동</h2><span class="muted xs">상태가 바뀔 때마다 자동으로 남습니다</span></div>
      <div class="panel-body">
        <ul class="timeline">
          <li v-for="e in events.slice(0, 8)" :key="e.id" :class="'k-' + e.type">
            <div>
              <span class="num xs muted">{{ fmtDateTime(e.at) }}</span> · <b>{{ e.user?.name }}</b> · {{ e.text }}
              <router-link v-if="e.issueId" :to="'/issues/' + e.issueId" class="xs">이슈 보기</router-link>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dash { display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 900px) { .dash { grid-template-columns: 1fr; } }
.toc-list { list-style: none; margin: 0; padding: 6px; display: grid; gap: 2px; }
.toc-item { width: 100%; display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; text-align: left;
  font: inherit; font-size: var(--fs-sm); color: var(--ink); background: transparent; border: 0; border-radius: var(--radius); padding: 8px 10px; cursor: pointer; }
.toc-item:hover { background: var(--surface-2); }
.toc-item.on { background: var(--accent-soft); }
.toc-title { min-width: 0; }
.toc-state { display: flex; gap: 6px; align-items: center; }
</style>
