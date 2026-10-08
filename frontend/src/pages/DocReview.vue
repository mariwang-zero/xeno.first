<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, isDemo } from '../api/index.js'
import { session, attempt, notify } from '../store.js'
import Chip from '../components/Chip.vue'
import DocPage from '../components/DocPage.vue'
import AreaThumb from '../components/AreaThumb.vue'
import { REQ_STATUS, can, fmtDate, fmtDateTime, isOverdue } from '../lib/status.js'

// S06 문서 검토 (+ S07 수정 요청 쓰기 창). 과제계획서 5장.
const props = defineProps({ id: String })
const route = useRoute()
const router = useRouter()
const d = ref(null)
const reqs = ref([])
const users = ref([])
const settings = ref({ reviewFlow: true, reasons: [] })
const tab = ref('request')
const statusFilter = ref('')
const activeId = ref(null)
const areaMode = ref(false)
const menu = ref(null) // { x, y, anchor, page }
const composer = ref(null) // { mode, anchor, page, form }
const panel = ref(null) // 위쪽 작은 입력창: upload | hold | reject | deploy
const work = ref({}) // 카드별 입력값
const previewRef = ref(null)

const me = computed(() => session.user)
async function load() {
  const [dd, rr, us, st] = await Promise.all([api.doc(props.id), api.requests(props.id), api.users(), api.settings()])
  d.value = dd
  reqs.value = rr
  users.value = us
  settings.value = st
}
onMounted(async () => {
  await load()
  if (route.query.req) pick(route.query.req)
  document.addEventListener('selectionchange', onSelChange)
})
onBeforeUnmount(() => document.removeEventListener('selectionchange', onSelChange))
watch(() => route.query.req, id => id && pick(id))

// ── 역할 ──
const isOwner = computed(() => d.value && (d.value.ownerId === me.value.id || me.value.admin))
const lockMine = computed(() => d.value?.lock?.userId === me.value.id)
const canEdit = computed(() => d.value?.status === 'progress' && (isOwner.value || can.aiDraft(me.value) || reqs.value.some(r => r.assigneeId === me.value.id && r.status === 'checking')))

// ── 요청 목록 ──
const ofKind = k => reqs.value.filter(r => r.kind === k)
const counts = computed(() => Object.fromEntries(Object.keys(REQ_STATUS).map(s => [s, ofKind('request').filter(r => r.status === s).length])))
const list = computed(() => ofKind(tab.value).filter(r => tab.value !== 'request' || !statusFilter.value || r.status === statusFilter.value))
const anchorsOn = no => reqs.value.filter(r => r.page === no)

async function pick(id) {
  const r = reqs.value.find(r => r.id === id)
  if (!r) return
  tab.value = r.kind
  statusFilter.value = ''
  activeId.value = id
  await nextTick()
  const target = document.querySelector(`[data-req="${id}"]`) || document.getElementById('page-' + r.page)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  document.getElementById('card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// ── 문장 선택 → 작은 메뉴 ──
function onSelChange() {
  const sel = document.getSelection()
  if (!sel || sel.isCollapsed) {
    if (menu.value && !menu.value.keep) menu.value = null
  }
}
function onMouseUp() {
  if (areaMode.value) return
  setTimeout(() => {
    const sel = document.getSelection()
    const quote = sel?.toString().trim()
    if (!quote) return
    const a = sel.anchorNode?.parentElement?.closest('[data-block]')
    const b = sel.focusNode?.parentElement?.closest('[data-block]')
    if (!a || a !== b) return notify('한 문단(또는 표 하나) 안에서 골라 주세요.', 'error')
    const page = Number(a.closest('[data-page]').dataset.page)
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    menu.value = { x: Math.min(rect.left + rect.width / 2, window.innerWidth - 150), y: rect.top, anchor: { type: 'text', blockId: a.dataset.block, quote: quote.slice(0, 200) }, page }
  }, 0)
}
function openComposer(mode, anchor, page) {
  menu.value = null
  areaMode.value = false
  document.getSelection()?.removeAllRanges()
  composer.value = { mode, anchor, page, form: { assigneeId: '', title: '', body: '', reason: '', doneWhen: '', due: '' }, more: false }
}
function onArea({ page, rect }) {
  openComposer('request', { type: 'area', rect }, page)
}
function certOf(anchor, page) {
  const pg = d.value.pages?.find(p => p.no === page)
  if (!pg) return false
  if (anchor.type === 'area') return pg.blocks.some(b => b.type === 'h' && b.cert)
  let cert = false
  for (const b of pg.blocks) {
    if (b.type === 'h') cert = b.cert
    if (b.id === anchor.blockId) return cert
  }
  return false
}
async function send() {
  const c = composer.value
  const r = await attempt(() => api.createRequest(props.id, { kind: c.mode, page: c.page, anchor: c.anchor, ...c.form }), c.mode === 'request' ? '요청을 보냈습니다. 담당자에게 알림이 갑니다.' : c.mode === 'memo' ? '메모를 남겼습니다.' : null)
  if (!r) return
  composer.value = null
  await load()
  pick(r.id)
}
function onKey(e) {
  if (e.key === 'Escape') {
    if (composer.value) composer.value = null
    else if (areaMode.value) areaMode.value = false
    menu.value = null
  }
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

// ── 요청 카드 동작 ──
async function act(fn, ok) {
  const r = await attempt(fn, ok)
  if (r) {
    work.value = {}
    await load()
  }
}
const w = id => (work.value[id] ||= { resolution: '', reason: '', reopen: false, edit: false, assigneeId: '', due: '' })
function startEditReq(r) {
  Object.assign(w(r.id), { edit: true, assigneeId: r.assigneeId, due: r.due || '' })
}

// ── 문서 동작 ──
const upload = ref({ file: null, note: '' })
const panelText = ref('')
function openPanel(kind) {
  panel.value = panel.value === kind ? null : kind
  panelText.value = ''
  if (kind === 'deploy') api.deployPreview(props.id).then(p => { panelText.value = p.summary; panel.value = 'deploy'; deployRev.value = p.rev })
}
const deployRev = ref(0)
async function docAct(fn, ok) {
  const r = await attempt(fn, ok)
  if (r) {
    panel.value = null
    await load()
  }
}
const startEdit = () => docAct(() => api.startEdit(props.id), isDemo ? '편집을 시작했습니다. 다른 사람은 편집할 수 없습니다. (데모라서 실제 파일은 내려받지 않습니다)' : '편집을 시작했습니다. 내려받은 파일을 워드로 고친 뒤 올려 주세요.')
const sendUpload = () => docAct(() => api.uploadEdit(props.id, { file: upload.value.file, fileName: upload.value.file?.name, note: upload.value.note }), '편집본을 올렸습니다. 잠금을 풀었습니다.').then(() => (upload.value = { file: null, note: '' }))
const cancelEdit = () => docAct(() => api.cancelEdit(props.id), '잠금을 풀었습니다.')
const hold = () => docAct(() => api.setHold(props.id, panelText.value), '보류했습니다.')
const unhold = () => docAct(() => api.setHold(props.id, null), '보류를 풀었습니다.')
const openCount = computed(() => counts.value.requested + counts.value.checking + counts.value.done)
async function askReview() {
  if (openCount.value && !window.confirm(`끝나지 않은 요청이 ${openCount.value}건 있습니다. 그래도 검토를 요청할까요?`)) return
  docAct(() => api.requestReview(props.id), '검토를 요청했습니다. 검토자에게 알림이 갑니다.')
}
const approve = () => docAct(() => api.finalize(props.id, true), '최종 검토 완료로 바꿨습니다.')
const reject = () => docAct(() => api.finalize(props.id, false, panelText.value), '반려했습니다. 진행 중으로 돌아갑니다.')
const deploy = () => docAct(() => api.deploy(props.id, panelText.value), '배포했습니다. 현재 사용본이 바뀌었습니다.')
function download() {
  notify(isDemo ? '데모라서 실제 파일은 내려받지 않습니다.' : '내려받는 중입니다.')
}
function toggleArea() {
  areaMode.value = !areaMode.value
  menu.value = null
  if (areaMode.value) notify('문서에서 표·사진 영역을 끌어서 고르세요. Esc로 취소합니다.')
}
</script>

<template>
  <main class="page wide" v-if="d">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">제품</router-link> / <router-link :to="'/products/' + d.product.id">{{ d.product.name }}</router-link> / <span>문서 검토</span></div>
        <h1>{{ d.title }}</h1>
        <div class="row small">
          <Chip kind="doc" :status="d.status" :held="d.held" />
          <span class="muted">문서 담당자 {{ d.owner.name }}</span>
          <span v-if="d.version" class="muted">· 보고 있는 버전 <span class="mono">{{ d.version.name }}</span></span>
          <router-link :to="'/docs/' + d.id + '/history'" class="small">버전·이력</router-link>
        </div>
      </div>
      <div class="row actions" v-if="d.pages">
        <template v-if="d.status === 'progress'">
          <button v-if="lockMine" class="btn primary" @click="openPanel('upload')">편집본 올리기</button>
          <button v-if="lockMine" class="btn" @click="cancelEdit">편집 취소</button>
          <button v-else-if="canEdit && !d.lock" class="btn" @click="startEdit">편집 시작</button>
          <button v-if="d.lock && !lockMine && me.admin" class="btn danger" @click="cancelEdit">잠금 강제 해제</button>
        </template>
        <button class="btn" @click="download">내려받기</button>
        <button v-if="d.status === 'progress' || d.status === 'review'" class="btn" :class="{ primary: areaMode }" @click="toggleArea">{{ areaMode ? '영역 선택 끝내기' : '영역 선택하여 수정 요청' }}</button>
        <template v-if="d.status === 'progress' && isOwner && settings.reviewFlow && !d.held">
          <button class="btn primary" @click="askReview">검토 요청</button>
        </template>
        <template v-if="d.status === 'review' && can.finalize(me)">
          <button class="btn primary" @click="approve">최종 검토 완료</button>
          <button class="btn danger" @click="openPanel('reject')">반려</button>
        </template>
        <button v-if="d.status === 'final' && can.finalize(me)" class="btn primary" @click="openPanel('deploy')">배포</button>
        <template v-if="isOwner && ['progress', 'review'].includes(d.status)">
          <button v-if="d.held" class="btn" @click="unhold">보류 해제</button>
          <button v-else class="btn ghost" @click="openPanel('hold')">보류</button>
        </template>
      </div>
    </div>

    <!-- 위쪽 입력창 -->
    <section v-if="panel" class="panel inline-panel">
      <div class="panel-body stack">
        <template v-if="panel === 'upload'">
          <label class="field">워드로 고친 파일 (DOCX)<input id="up-file" type="file" accept=".docx" @change="e => (upload.file = e.target.files[0])" /></label>
          <label class="field"><span class="req">무엇을 바꿨나요</span><span class="hint">변경 이력에 남습니다. 예: 클립 마운트 명칭 정리</span><input id="up-note" type="text" v-model="upload.note" /></label>
          <div class="row"><button class="btn primary" @click="sendUpload">올리기</button><button class="btn ghost" @click="panel = null">닫기</button><span v-if="isDemo" class="xs muted">데모에서는 파일 없이 올려도 됩니다.</span></div>
        </template>
        <template v-else-if="panel === 'hold'">
          <label class="field"><span class="req">보류 사유</span><input id="hold-reason" type="text" v-model="panelText" placeholder="예: 신규 배터리 사양 결정 대기" /></label>
          <div class="row"><button class="btn primary" @click="hold">보류</button><button class="btn ghost" @click="panel = null">닫기</button></div>
        </template>
        <template v-else-if="panel === 'reject'">
          <label class="field"><span class="req">반려 사유</span><input id="reject-reason" type="text" v-model="panelText" /></label>
          <div class="row"><button class="btn danger" @click="reject">반려</button><button class="btn ghost" @click="panel = null">닫기</button></div>
        </template>
        <template v-else-if="panel === 'deploy'">
          <label class="field"><span class="req">Rev.{{ String(deployRev).padStart(2, '0') }} 주요 변경사항</span><span class="hint">확인 완료된 요청의 처리 내용으로 채웠습니다. 고칠 수 있습니다.</span><textarea id="deploy-summary" v-model="panelText"></textarea></label>
          <div class="row"><button class="btn primary" @click="deploy">배포</button><button class="btn ghost" @click="panel = null">닫기</button><span class="xs muted">최종본이 현재 사용본이 되고 Rev. 이력에 한 줄 쌓입니다.</span></div>
        </template>
      </div>
    </section>

    <!-- 안내 띠 -->
    <div v-if="!d.pages" class="band">
      AI 분석 결과를 아직 반영하지 않았습니다. <router-link v-if="d.runId" :to="'/ai/' + d.runId">변경 추천 검토로 가기</router-link>
    </div>
    <div v-if="d.lock && !lockMine" class="band warn">🔒 {{ d.lock.user.name }}님이 {{ fmtDateTime(d.lock.at) }}부터 편집 중입니다. 편집이 끝날 때까지 다른 사람은 편집할 수 없습니다.</div>
    <div v-if="lockMine" class="band info">편집 중입니다. 내려받은 파일을 워드로 고친 뒤 <b>편집본 올리기</b>를 눌러 주세요.</div>
    <div v-if="d.held" class="band warn">보류 중: {{ d.held.reason }}</div>
    <div v-if="d.manual.length" class="band">이미지 {{ d.manual.length }}건은 수작업이 필요합니다: <span v-for="m in d.manual" :key="m.no" class="tag" style="margin-left: 4px">p.{{ m.page }} {{ m.summary }}</span></div>
    <div v-if="d.status === 'progress' && !settings.reviewFlow" class="band">검토·배포 단계는 아직 쓰지 않도록 설정되어 있습니다(관리 &gt; 기본값).</div>

    <div class="layout" v-if="d.pages">
      <div class="preview" ref="previewRef" @mouseup="onMouseUp" @touchend="onMouseUp">
        <p class="xs muted hint-line">문장을 드래그하면 [수정 요청] [메모] [AI에게 질문]이 나타납니다.</p>
        <DocPage v-for="pg in d.pages" :key="pg.no" :page="pg" :anchors="anchorsOn(pg.no)" :active-id="activeId" :area-mode="areaMode" @area="onArea" @pick="pick" />
      </div>

      <aside class="side panel">
        <div class="counts">
          <button v-for="(n, s) in counts" :key="s" :class="{ on: statusFilter === s && tab === 'request' }" @click="tab = 'request'; statusFilter = statusFilter === s ? '' : s">
            <span class="n num">{{ n }}</span><span class="l">{{ REQ_STATUS[s] }}</span>
          </button>
        </div>
        <div class="tabs" role="tablist">
          <button role="tab" :aria-selected="tab === 'request'" :class="{ on: tab === 'request' }" @click="tab = 'request'">요청 <span class="num xs">{{ ofKind('request').length }}</span></button>
          <button role="tab" :aria-selected="tab === 'memo'" :class="{ on: tab === 'memo' }" @click="tab = 'memo'">메모 <span class="num xs">{{ ofKind('memo').length }}</span></button>
          <button role="tab" :aria-selected="tab === 'ai'" :class="{ on: tab === 'ai' }" @click="tab = 'ai'">AI 질문 <span class="num xs">{{ ofKind('ai').length }}</span></button>
        </div>
        <ul class="cards">
          <li v-for="r in list" :key="r.id" :id="'card-' + r.id" class="card" :class="{ active: activeId === r.id, overdue: r.overdue }">
            <button class="card-head" @click="activeId === r.id ? (activeId = null) : pick(r.id)">
              <AreaThumb v-if="r.anchor.type === 'area'" :rect="r.anchor.rect" :page="r.page" />
              <span class="grow">
                <span class="t-title" v-if="r.kind === 'request'"><span class="num muted">#{{ r.no }}</span> {{ r.title }}</span>
                <span v-else class="quote">“{{ r.anchor.quote }}”</span>
                <span class="xs muted meta">p.{{ r.page }} · <template v-if="r.kind === 'request'">{{ r.assignee.name }}<template v-if="r.due"> · 기한 <span :class="{ late: r.overdue }">{{ fmtDate(r.due) }}</span></template></template><template v-else>{{ r.requester.name }} · {{ fmtDate(r.createdAt) }}</template></span>
              </span>
              <Chip v-if="r.kind === 'request'" :status="r.status" />
            </button>

            <div v-if="activeId === r.id" class="card-body stack">
              <blockquote v-if="r.anchor.type === 'text' && r.kind === 'request'">{{ r.anchor.quote }}</blockquote>
              <template v-if="r.kind === 'request'">
                <p>{{ r.body }}</p>
                <dl class="facts">
                  <template v-if="r.reason"><dt>사유</dt><dd>{{ r.reason }}</dd></template>
                  <template v-if="r.doneWhen"><dt>완료 조건</dt><dd>{{ r.doneWhen }}</dd></template>
                  <dt>요청</dt><dd>{{ r.requester.name }} → {{ r.assignee.name }} <span class="muted">· {{ r.assignee.dept }}</span></dd>
                  <dt>요청일</dt><dd class="num">{{ fmtDate(r.createdAt) }}</dd>
                  <template v-if="r.cert"><dt>주의</dt><dd><span class="tag cert">인증 문구가 있는 절</span></dd></template>
                </dl>
                <div v-if="r.resolution" class="resolution"><span class="xs muted">처리 내용</span><p>{{ r.resolution }}</p></div>
                <ul v-if="r.comments.length" class="comments"><li v-for="(c, k) in r.comments" :key="k" class="small"><span class="num xs muted">{{ fmtDateTime(c.at) }}</span> {{ c.text }}</li></ul>

                <!-- 상태·역할별 버튼 (화면 설계서 S06 표) -->
                <template v-if="r.status === 'requested'">
                  <div class="row" v-if="r.assigneeId === me.id || me.admin"><button class="btn primary" @click="act(() => api.startRequest(r.id), '확인을 시작했습니다.')">확인 시작</button></div>
                  <template v-if="r.requesterId === me.id || me.admin">
                    <div class="row" v-if="!w(r.id).edit"><button class="btn sm" @click="startEditReq(r)">요청 고치기</button><button class="btn sm danger" @click="act(() => api.cancelRequest(r.id), '요청을 취소했습니다.')">취소</button></div>
                    <div v-else class="stack">
                      <label class="field">담당자<select v-model="w(r.id).assigneeId"><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ u.dept }}</option></select></label>
                      <label class="field">기한<input type="date" v-model="w(r.id).due" /></label>
                      <div class="row"><button class="btn sm primary" @click="act(() => api.updateRequest(r.id, { assigneeId: w(r.id).assigneeId, due: w(r.id).due || null }), '바꿨습니다.')">저장</button><button class="btn sm ghost" @click="w(r.id).edit = false">닫기</button></div>
                    </div>
                  </template>
                  <p v-if="r.assigneeId !== me.id && r.requesterId !== me.id && !me.admin" class="muted small">{{ r.assignee.name }}님의 확인을 기다리고 있습니다.</p>
                </template>

                <template v-else-if="r.status === 'checking'">
                  <template v-if="r.assigneeId === me.id || me.admin">
                    <p class="small muted">문서를 고쳐야 하면 위의 <b>편집 시작</b>으로 잠그고 고친 뒤 올리세요.</p>
                    <label class="field"><span class="req">처리 내용</span><span class="hint">변경 이력과 Rev. 주요 변경사항이 됩니다. 예: LED 밝기 조절 방법 수정</span><input :id="'res-' + r.id" type="text" v-model="w(r.id).resolution" /></label>
                    <div class="row"><button class="btn primary" @click="act(() => api.completeRequest(r.id, w(r.id).resolution), '수정 완료로 바꿨습니다. 요청자에게 알림이 갑니다.')">수정 완료</button></div>
                  </template>
                  <p v-else class="muted small">{{ r.assignee.name }}님이 {{ fmtDate(r.startedAt) }}부터 확인 중입니다.</p>
                </template>

                <template v-else-if="r.status === 'done'">
                  <template v-if="r.requesterId === me.id || me.admin">
                    <div class="row"><button class="btn primary" @click="act(() => api.closeRequest(r.id), '확인 완료했습니다.')">확인 완료</button><button class="btn" @click="w(r.id).reopen = !w(r.id).reopen">다시 요청</button></div>
                    <div v-if="w(r.id).reopen" class="stack">
                      <label class="field"><span class="req">다시 요청하는 이유</span><input :id="'reopen-' + r.id" type="text" v-model="w(r.id).reason" /></label>
                      <div class="row"><button class="btn danger" @click="act(() => api.reopenRequest(r.id, w(r.id).reason), '다시 요청했습니다.')">다시 요청 보내기</button></div>
                    </div>
                  </template>
                  <p v-else class="muted small">{{ r.requester.name }}님의 확인을 기다리고 있습니다.</p>
                </template>
                <p v-else class="muted small">{{ fmtDate(r.closedAt) }}에 확인 완료되었습니다.</p>
              </template>

              <template v-else>
                <p>{{ r.body }}</p>
                <div v-if="r.answer" class="answer"><span class="xs muted">AI 답변</span><p>{{ r.answer }}</p></div>
                <div class="row" v-if="r.requesterId === me.id"><button class="btn sm ghost" @click="act(() => api.cancelRequest(r.id), '지웠습니다.')">지우기</button></div>
              </template>
            </div>
          </li>
          <li v-if="!list.length" class="empty">{{ tab === 'request' ? '요청이 없습니다.' : tab === 'memo' ? '메모가 없습니다.' : 'AI 질문이 없습니다.' }}</li>
        </ul>
      </aside>
    </div>

    <!-- 문장 선택 메뉴 -->
    <div v-if="menu" class="selmenu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @mousedown.prevent>
      <button class="btn sm primary" @click="openComposer('request', menu.anchor, menu.page)">수정 요청</button>
      <button class="btn sm" @click="openComposer('memo', menu.anchor, menu.page)">메모</button>
      <button class="btn sm" @click="openComposer('ai', menu.anchor, menu.page)">AI에게 질문</button>
    </div>

    <!-- S07 수정 요청 쓰기 -->
    <div v-if="composer" class="scrim" @click.self="composer = null">
      <div class="dialog panel" role="dialog" aria-modal="true" :aria-label="composer.mode === 'request' ? '수정 요청 쓰기' : composer.mode === 'memo' ? '메모' : 'AI에게 질문'">
        <div class="panel-head"><h2>{{ composer.mode === 'request' ? '수정 요청' : composer.mode === 'memo' ? '메모' : 'AI에게 질문' }}</h2><span class="spacer"></span><button class="btn ghost sm" @click="composer = null">닫기</button></div>
        <div class="panel-body stack">
          <div class="where">
            <AreaThumb v-if="composer.anchor.type === 'area'" :rect="composer.anchor.rect" :page="composer.page" wide />
            <blockquote v-else>{{ composer.anchor.quote }}</blockquote>
            <div class="xs muted">{{ d.product.name }} · <span class="mono">{{ d.version?.name }}</span> · {{ composer.page }}페이지</div>
          </div>
          <p v-if="certOf(composer.anchor, composer.page)" class="certwarn small">인증 문구가 있는 절입니다. 문구를 바꾸면 품질팀 확인이 필요합니다.</p>

          <template v-if="composer.mode === 'request'">
            <label class="field"><span class="req">담당자</span>
              <select id="c-assignee" v-model="composer.form.assigneeId"><option value="" disabled>담당자 고르기</option><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ u.dept }}</option></select>
            </label>
            <label class="field"><span class="req">제목</span><input id="c-title" type="text" v-model="composer.form.title" placeholder="예: USB 사양 확인, 제품 사진 변경" /></label>
            <label class="field"><span class="req">요청 내용</span><textarea id="c-body" v-model="composer.form.body" placeholder="어느 부분을 어떻게 고쳐야 하는지, 참고할 도면이나 자료"></textarea></label>
            <button class="btn ghost sm more" @click="composer.more = !composer.more">{{ composer.more ? '▾' : '▸' }} 사유 · 완료 조건 · 기한 (선택)</button>
            <template v-if="composer.more">
              <label class="field">사유<select id="c-reason" v-model="composer.form.reason"><option value="">고르지 않음</option><option v-for="x in settings.reasons" :key="x">{{ x }}</option></select></label>
              <label class="field">완료 조건<input id="c-done" type="text" v-model="composer.form.doneWhen" placeholder="예: 최종 PASS 결과 확인 후 확정된 사양 반영" /></label>
              <label class="field">기한<input id="c-due" type="date" v-model="composer.form.due" /></label>
            </template>
          </template>
          <label v-else class="field"><span class="req">{{ composer.mode === 'memo' ? '메모' : '질문' }}</span><textarea id="c-body" v-model="composer.form.body" :placeholder="composer.mode === 'ai' ? '예: 이 문장의 근거 자료가 있나?' : ''"></textarea></label>
          <p v-if="composer.mode === 'ai'" class="xs muted">AI는 이 작업에 등록된 자료만 보고 답하며, 문서를 바꾸지 않습니다.</p>

          <div class="row"><button class="btn primary" @click="send">{{ composer.mode === 'request' ? '보내기' : composer.mode === 'memo' ? '남기기' : '질문하기' }}</button><button class="btn ghost" @click="composer = null">취소</button></div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
main.wide { max-width: 1400px; }
.actions { justify-content: flex-end; }
.inline-panel { border-color: var(--accent); }
.band { padding: 10px 14px; border-radius: 8px; font-size: var(--fs-sm); background: var(--surface-2); border-left: 3px solid var(--line); }
.band.warn { background: var(--st-req-bg); border-left-color: var(--st-req-fg); }
.band.info { background: var(--accent-soft); border-left-color: var(--accent); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 20px; align-items: start; }
.preview { display: grid; gap: 20px; min-width: 0; max-width: 760px; width: 100%; justify-self: center; }
.hint-line { margin-bottom: -10px; }
.side { position: sticky; top: 64px; max-height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden; }
.counts { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--line); }
.counts button { font: inherit; background: none; border: 0; padding: 10px 4px; cursor: pointer; display: grid; gap: 0; color: var(--ink); border-bottom: 3px solid transparent; }
.counts button.on { border-bottom-color: var(--accent); background: var(--surface-2); }
.counts .n { font-size: 20px; }
.counts .l { font-size: 11px; color: var(--muted); }
.tabs { display: flex; gap: 2px; padding: 6px 10px 0; border-bottom: 1px solid var(--line); }
.tabs button { font: inherit; font-size: var(--fs-sm); background: none; border: 0; padding: 8px 10px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs button.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
.cards { list-style: none; margin: 0; padding: 8px; overflow-y: auto; display: grid; gap: 6px; align-content: start; }
.card { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.card.active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.card.overdue { border-left: 3px solid var(--danger); }
.card-head { font: inherit; text-align: left; width: 100%; background: none; border: 0; padding: 10px; display: flex; gap: 10px; align-items: flex-start; cursor: pointer; color: inherit; }
.card-head .grow { flex: 1; min-width: 0; display: grid; gap: 2px; }
.card-head .t-title { font-size: var(--fs-sm); }
.quote { font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.card-body { padding: 0 12px 12px; font-size: var(--fs-sm); }
blockquote { margin: 0; padding: 6px 10px; border-left: 3px solid var(--st-req-fg); background: var(--surface-2); font-size: var(--fs-sm); overflow-wrap: anywhere; }
.resolution, .answer { background: var(--st-done-bg); padding: 8px 12px; border-radius: 6px; display: grid; gap: 2px; }
.answer { background: var(--surface-2); }
.comments { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.late { color: var(--danger); }
.selmenu { position: fixed; z-index: 40; transform: translate(-50%, calc(-100% - 8px)); display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--line); padding: 4px; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.15); }
.scrim { position: fixed; inset: 0; background: rgba(10, 15, 25, .45); z-index: 60; display: grid; place-items: center; padding: 16px; }
.dialog { width: min(520px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; }
.where { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.where blockquote { flex: 1 1 100%; }
.certwarn { color: var(--st-req-fg); background: var(--st-req-bg); padding: 6px 10px; border-radius: 4px; }
.more { justify-self: start; padding-left: 0; }
@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
  .side { position: static; max-height: none; }
}
</style>
