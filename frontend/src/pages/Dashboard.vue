<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session } from '../store.js'
import Chip from '../components/Chip.vue'
import { REQ_STATUS, REQ_STEPS, daysBetween, fmtDate, fmtDateTime } from '../lib/status.js'

// 요청 현황: 수정 요청을 한 화면에서 보고, 숫자·막대를 누르면 아래 목록이 그 조건으로 걸러진다
const data = ref(null)
const q = ref('')
const quick = ref('open')     // open | mine | wait | late | week | all
const product = ref(null)     // { id, name }
const assignee = ref(null)    // { id, name }
const status = ref(null)      // requested | checking | done | closed
onMounted(async () => { data.value = await api.requestBoard() })

const OPEN = ['requested', 'checking', 'done']
const reqs = computed(() => data.value?.requests || [])
const isMine = r => (r.assigneeId === session.user.id && ['requested', 'checking'].includes(r.status)) || (r.requesterId === session.user.id && r.status === 'done')
const closedThisWeek = r => r.status === 'closed' && r.closedAt && daysBetween(r.closedAt) <= 7
const QUICK = {
  open: { label: '열린 요청', test: r => OPEN.includes(r.status) },
  mine: { label: '내가 처리할 것', test: isMine },
  wait: { label: '요청자 확인 대기', test: r => r.status === 'done' },
  late: { label: '기한 지남', test: r => r.overdue },
  week: { label: '최근 7일 완료', test: closedThisWeek },
}
const count = k => reqs.value.filter(QUICK[k].test).length

// 제품별: 상태마다 몇 건인지 (요청이 있는 제품만, 열린 요청 많은 순)
const byProduct = computed(() => {
  const m = new Map()
  for (const r of reqs.value) {
    const e = m.get(r.product.id) || { ...r.product, n: {}, total: 0, open: 0, late: 0 }
    e.n[r.status] = (e.n[r.status] || 0) + 1
    e.total++
    if (OPEN.includes(r.status)) e.open++
    if (r.overdue) e.late++
    m.set(r.product.id, e)
  }
  return [...m.values()].sort((a, b) => b.open - a.open || b.total - a.total)
})
// 담당자별 열린 요청: 누가 몇 건을 쥐고 있는지, 그중 기한 지난 것
const byAssignee = computed(() => {
  const m = new Map()
  for (const r of reqs.value.filter(r => ['requested', 'checking'].includes(r.status))) {
    const e = m.get(r.assigneeId) || { id: r.assigneeId, name: r.assignee?.name || '-', open: 0, late: 0 }
    e.open++
    if (r.overdue) e.late++
    m.set(r.assigneeId, e)
  }
  return [...m.values()].sort((a, b) => b.open - a.open || b.late - a.late)
})
const maxOpen = computed(() => Math.max(1, ...byAssignee.value.map(a => a.open)))

const list = computed(() => {
  const k = q.value.trim().toLowerCase()
  return reqs.value
    .filter(r => quick.value === 'all' || QUICK[quick.value].test(r))
    .filter(r => !product.value || r.product.id === product.value.id)
    .filter(r => !assignee.value || r.assigneeId === assignee.value.id)
    .filter(r => !status.value || r.status === status.value)
    .filter(r => !k || [r.title, r.body, r.product.name, r.requester?.name, r.assignee?.name, '#' + r.no].some(x => x && x.toLowerCase().includes(k)))
    .sort((a, b) => (b.overdue - a.overdue) || (a.status === 'closed') - (b.status === 'closed') || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt))
})
const filtered = computed(() => product.value || assignee.value || status.value || q.value.trim())

function pickQuick(k) {
  quick.value = quick.value === k ? 'all' : k
}
function pickProduct(p, st = null) {
  product.value = p
  status.value = st
  quick.value = st && !OPEN.includes(st) ? 'all' : quick.value === 'week' ? 'all' : quick.value
}
function pickAssignee(a) {
  assignee.value = assignee.value?.id === a.id ? null : a
  if (!['open', 'late', 'all'].includes(quick.value)) quick.value = 'open'
}
function clearAll() {
  product.value = assignee.value = status.value = null
  q.value = ''
  quick.value = 'open'
}

// 기한: D-3 / 오늘 / 2일 지남
function dueText(r) {
  if (!r.due || r.status === 'closed') return { t: r.due ? fmtDate(r.due) : '-', cls: '' }
  const d = daysBetween(r.due)
  if (d > 0) return { t: `${d}일 지남`, cls: r.status === 'done' ? '' : 'late' }
  if (d === 0) return { t: '오늘', cls: 'soon' }
  return { t: `D-${-d}`, cls: d >= -2 ? 'soon' : '' }
}
const age = r => daysBetween(r.createdAt)
const nextStep = r => {
  if (r.status === 'closed') return '끝남'
  if (r.status === 'done') return `${r.requester.name} 확인`
  return `${r.assignee?.name} ${r.status === 'requested' ? '확인 시작' : '수정 중'}`
}
const EV = { requested: '요청', checking: '시작', done: '수정 완료', closed: '확인 완료' }
</script>

<template>
  <main class="page" v-if="data">
    <div class="page-head">
      <div class="grow"><h1>요청 현황</h1><p class="muted small">숫자나 막대를 누르면 아래 목록이 그 조건으로 걸러집니다. 줄을 누르면 문서의 그 위치로 갑니다.</p></div>
      <label class="search"><span class="sr">요청 검색</span><input type="text" v-model="q" placeholder="번호, 내용, 제품, 사람" /></label>
    </div>

    <div class="stats" role="tablist" aria-label="빠른 보기">
      <button v-for="(v, k) in QUICK" :key="k" role="tab" :aria-selected="quick === k" class="stat" :class="{ on: quick === k, alert: k === 'late' && count(k), mine: k === 'mine' && count(k) }" @click="pickQuick(k)">
        <span class="n">{{ count(k) }}</span><span class="l">{{ v.label }}</span>
      </button>
    </div>

    <div class="cols">
      <section class="panel">
        <div class="panel-head"><h2>제품별 요청</h2>
          <span class="legend xs muted"><span v-for="s in REQ_STEPS" :key="s"><i :class="'seg-' + s"></i>{{ REQ_STATUS[s] }}</span></span>
        </div>
        <div class="panel-body bars" v-if="byProduct.length">
          <div v-for="p in byProduct" :key="p.id" class="bar-row" :class="{ dim: product && product.id !== p.id }">
            <button class="linkish name" @click="pickProduct(product?.id === p.id && !status ? null : p)">{{ p.name }}</button>
            <div class="stack-bar">
              <button v-for="s in REQ_STEPS.filter(s => p.n[s])" :key="s" :class="'seg-' + s" :style="{ flex: p.n[s] }" :title="`${p.name} · ${REQ_STATUS[s]} ${p.n[s]}건`" :aria-label="`${p.name} ${REQ_STATUS[s]} ${p.n[s]}건 보기`" @click="pickProduct(p, s)">{{ p.n[s] }}</button>
            </div>
            <span class="num small">{{ p.open }}<span class="muted">/{{ p.total }}</span><span v-if="p.late" class="late xs"> 지연{{ p.late }}</span></span>
          </div>
        </div>
        <div v-else class="empty">아직 요청이 없습니다.</div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>담당자별 처리 중</h2><span class="xs muted">요청됨 + 확인 중. 빨간 부분은 기한 지남</span></div>
        <div class="panel-body bars" v-if="byAssignee.length">
          <button v-for="a in byAssignee" :key="a.id" class="bar-row as-btn" :class="{ dim: assignee && assignee.id !== a.id, on: assignee?.id === a.id }" @click="pickAssignee(a)">
            <span class="name">{{ a.name }}</span>
            <span class="track"><span class="fill" :style="{ width: (a.open / maxOpen) * 100 + '%' }"><span class="fill-late" :style="{ width: (a.late / a.open) * 100 + '%' }"></span></span></span>
            <span class="num small">{{ a.open }}<span v-if="a.late" class="late xs"> · {{ a.late }}</span></span>
          </button>
        </div>
        <div v-else class="empty">처리 중인 요청이 없습니다.</div>
      </section>
    </div>

    <div class="cols wide">
      <section class="panel">
        <div class="panel-head">
          <h2>{{ quick === 'all' ? '전체 요청' : QUICK[quick].label }}</h2>
          <span class="num small muted">{{ list.length }}건</span>
          <span v-if="product" class="tag">{{ product.name }}<button class="x" aria-label="제품 조건 지우기" @click="product = null; status = null">×</button></span>
          <span v-if="status" class="tag">{{ REQ_STATUS[status] }}<button class="x" aria-label="상태 조건 지우기" @click="status = null">×</button></span>
          <span v-if="assignee" class="tag">담당 {{ assignee.name }}<button class="x" aria-label="담당자 조건 지우기" @click="assignee = null">×</button></span>
          <button v-if="filtered || quick !== 'open'" class="btn sm ghost" style="margin-left: auto" @click="clearAll">조건 지우기</button>
          <button v-if="quick !== 'all'" class="btn sm ghost" :style="filtered || quick !== 'open' ? '' : 'margin-left: auto'" @click="quick = 'all'">닫힌 것도 보기</button>
        </div>
        <div class="table-wrap" v-if="list.length">
          <table class="list">
            <thead><tr><th>상태</th><th>요청</th><th>제품</th><th>다음 할 일</th><th>기한</th><th class="hide-sm">열린 지</th></tr></thead>
            <tbody>
              <tr v-for="r in list" :key="r.id" class="click" :class="{ stalled: r.overdue, mine: isMine(r) }" @click="$router.push('/docs/' + r.docId + '?req=' + r.id)">
                <td><Chip :status="r.status" /></td>
                <td>
                  <span class="num muted xs">#{{ r.no }}</span> <a class="t-title">{{ r.title }}</a>
                  <div class="xs muted">{{ r.requester.name }} → {{ r.assignee?.name }}<template v-if="r.reason"> · {{ r.reason }}</template><template v-if="r.cert"> · <b class="cert">인증 문구</b></template></div>
                </td>
                <td class="small">{{ r.product.name }}</td>
                <td class="small" :class="{ me: isMine(r) }">{{ isMine(r) ? '내 차례' : nextStep(r) }}</td>
                <td class="num small" :class="dueText(r).cls">{{ dueText(r).t }}</td>
                <td class="num small muted hide-sm">{{ r.status === 'closed' ? '-' : age(r) + '일' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">조건에 맞는 요청이 없습니다.</div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>최근 처리</h2></div>
        <div class="panel-body">
          <ul class="timeline" v-if="data.events.length">
            <li v-for="(e, i) in data.events" :key="i" :class="{ 'k-complete': e.kind === 'done' || e.kind === 'closed', 'k-start': e.kind === 'checking' }">
              <div>
                <div class="num xs muted">{{ fmtDateTime(e.at) }} · {{ e.who?.name }} · {{ EV[e.kind] }}</div>
                <a class="linkish ev" @click="$router.push('/docs/' + e.docId + '?req=' + e.reqId)">{{ e.text }}</a>
              </div>
            </li>
          </ul>
          <p v-else class="muted small">기록이 없습니다.</p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.search input { width: 260px; max-width: 100%; }
.stat.mine .n { color: var(--accent); }
.cols { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.cols.wide { grid-template-columns: minmax(0, 2.2fr) minmax(260px, 1fr); }
@media (max-width: 900px) { .cols, .cols.wide { grid-template-columns: 1fr; } }

.legend { display: flex; gap: 10px; flex-wrap: wrap; margin-left: auto; }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.seg-requested { background: var(--st-req-fg); }
.seg-checking { background: var(--st-fix-fg); }
.seg-done { background: var(--st-done-fg); }
.seg-closed { background: var(--line); }

.bars { display: grid; gap: 10px; }
.bar-row { display: grid; grid-template-columns: 110px 1fr 84px; gap: 10px; align-items: center; font-size: var(--fs-sm); }
.bar-row.dim { opacity: .45; }
.bar-row .name { text-align: left; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-btn { font: inherit; color: inherit; background: none; border: 0; padding: 4px 6px; margin: -4px -6px; border-radius: 6px; cursor: pointer; text-align: left; }
.as-btn:hover, .as-btn.on { background: var(--surface-2); }
.as-btn .name { font-weight: 500; }
.stack-bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; gap: 2px; }
.stack-bar button { border: 0; min-width: 22px; color: #fff; font: inherit; font-size: var(--fs-xs); font-family: var(--font-mono); cursor: pointer; padding: 0; }
.stack-bar button.seg-closed { color: var(--muted); }
.stack-bar button:hover { filter: brightness(1.12); }
.track { height: 12px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; background: var(--st-fix-fg); border-radius: 3px; position: relative; overflow: hidden; }
.fill-late { position: absolute; right: 0; top: 0; bottom: 0; background: var(--danger); }
.late { color: var(--danger); }
.soon { color: var(--st-req-fg); font-weight: 600; }
.me { color: var(--accent); font-weight: 600; }
.cert { color: var(--danger); font-weight: 600; }
.tag { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-xs); background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 2px 4px 2px 10px; }
.x { font: inherit; border: 0; background: none; color: inherit; cursor: pointer; padding: 0 4px; }
tr.mine td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
tr.mine.stalled td:first-child { box-shadow: inset 3px 0 0 var(--danger); }
.ev { cursor: pointer; text-align: left; }
@media (max-width: 600px) { .bar-row { grid-template-columns: 84px 1fr 70px; } }
.bar-row > .num { white-space: nowrap; }
</style>
