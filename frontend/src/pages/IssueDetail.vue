<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session, attempt, refreshMe, notify } from '../store.js'
import StatusChip from '../components/StatusChip.vue'
import { fmtDate, fmtDateTime, stallReason, fmtRev } from '../lib/status.js'

const props = defineProps({ id: String })
const i = ref(null)
const m = ref(null)
const users = ref([])
const stallDays = ref(3)
const resolution = ref('')
const reopenReason = ref('')
const showReopen = ref(false)
const edit = ref({ assigneeId: '', due: '' })

async function load() {
  const [ii, us, st] = await Promise.all([api.getIssue(props.id), api.users(), api.getSettings()])
  m.value = await api.getManual(ii.manualId)
  i.value = ii
  users.value = us
  stallDays.value = st.stallDays
  edit.value = { assigneeId: i.value.assigneeId, due: i.value.due || '' }
}
onMounted(load)

const me = computed(() => session.user)
const isAssignee = computed(() => i.value?.assigneeId === me.value.id || me.value.admin)
const isRequester = computed(() => i.value?.requesterId === me.value.id || me.value.admin)
const confirmed = computed(() => !!i.value?.confirmedAt)

async function act(fn, ok) {
  const r = await attempt(fn, ok)
  if (r) {
    i.value = r
    await refreshMe()
  }
}
const start = () => act(() => api.startIssue(props.id), '수정 중으로 바꿨습니다. 원본을 열어 고쳐 주세요.')
const complete = () => act(() => api.completeIssue(props.id, { resolution: resolution.value }), '수정 완료로 바꾸고 원본 사본을 저장했습니다.')
const confirm = () => act(() => api.confirmIssue(props.id), '확인했습니다. 다음 Rev. 확정 때 포함됩니다.')
async function reopen() {
  await act(() => api.reopenIssue(props.id, { reason: reopenReason.value }), '재요청했습니다.')
  showReopen.value = false
  reopenReason.value = ''
}
async function saveEdit() {
  await act(() => api.updateIssue(props.id, edit.value), '바꿨습니다.')
}
async function copyPath() {
  try {
    await navigator.clipboard.writeText(m.value.path)
    notify('원본 위치를 복사했습니다.')
  } catch {
    notify('복사하지 못했습니다. 경로를 직접 선택해 복사하세요.', 'error')
  }
}
</script>

<template>
  <main class="page" v-if="i && m">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs">
          <router-link to="/">홈</router-link> / <router-link :to="'/manuals/' + m.id">{{ m.product }}</router-link> /
          <span>{{ i.section.no }}. {{ i.section.title }}</span>
        </div>
        <div class="row"><h1><span class="num muted">#{{ i.no }}</span> {{ i.title }}</h1></div>
        <div class="row">
          <StatusChip :status="i.status" :confirmed="confirmed" />
          <span v-if="i.stalled" class="chip stalled">{{ stallReason(i, stallDays) }}</span>
          <span class="tag">{{ i.reason }}</span>
          <span v-if="i.section.cert" class="tag cert">인증 문구 있는 절</span>
          <span v-if="i.revision != null" class="tag mono">{{ fmtRev(i.revision) }}에 반영</span>
        </div>
      </div>
    </div>

    <div class="detail">
      <div class="stack" style="gap: 16px; min-width: 0">
        <!-- 지금 할 일: 보는 사람과 상태에 따라 바뀜 -->
        <section class="panel next">
          <div class="panel-head"><h2>지금 할 일</h2></div>
          <div class="panel-body stack">
            <template v-if="i.status === 'requested'">
              <template v-if="isAssignee">
                <p>{{ i.requester.name }}님이 수정을 요청했습니다. 시작하면 상태가 "수정 중"으로 바뀌어 다른 사람도 진행을 알 수 있습니다.</p>
                <div class="row"><button class="btn primary" @click="start">수정 시작</button></div>
              </template>
              <p v-else class="muted">{{ i.assignee.name }}님이 수정을 시작하기를 기다리고 있습니다.</p>
            </template>

            <template v-else-if="i.status === 'fixing'">
              <template v-if="isAssignee">
                <p>원본 파일을 워드로 열어 고친 뒤, 무엇을 바꿨는지 한 줄로 적고 완료하세요. 완료하면 그 순간의 원본 사본이 자동으로 저장됩니다.</p>
                <div class="row small"><code class="mono xs" style="flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: all">{{ m.path }}</code><button class="btn sm" @click="copyPath">위치 복사</button></div>
                <label class="field"><span class="req">수정 내용 </span><span class="hint">개정 이력의 "주요 변경사항"이 됩니다. 예: LED 밝기 조절 2단 → 3단, 제품 규격도 수정</span>
                  <input id="d-resolution" type="text" v-model="resolution" />
                </label>
                <div class="row"><button class="btn primary" @click="complete">수정 완료</button></div>
              </template>
              <p v-else class="muted">{{ i.assignee.name }}님이 {{ fmtDate(i.startedAt) }}부터 수정하고 있습니다.</p>
            </template>

            <template v-else-if="i.status === 'done' && !confirmed">
              <div class="resolution"><span class="xs muted">수정 내용</span><p>{{ i.resolution }}</p></div>
              <template v-if="isRequester">
                <p>요청한 수정이 끝났습니다. 원본을 확인하고 맞으면 확인을, 부족하면 사유를 적어 재요청하세요.</p>
                <div class="row">
                  <button class="btn primary" @click="confirm">확인</button>
                  <button class="btn" @click="showReopen = !showReopen">재요청</button>
                </div>
                <div v-if="showReopen" class="stack">
                  <label class="field"><span class="req">재요청 사유</span><textarea id="d-reopen" v-model="reopenReason" placeholder="무엇이 아직 맞지 않는지"></textarea></label>
                  <div class="row"><button class="btn danger" @click="reopen">재요청 보내기</button></div>
                </div>
              </template>
              <p v-else class="muted">{{ i.requester.name }}님의 확인을 기다리고 있습니다.</p>
            </template>

            <template v-else>
              <div class="resolution"><span class="xs muted">수정 내용</span><p>{{ i.resolution }}</p></div>
              <p class="muted small" v-if="i.revision == null">{{ i.requester.name }}님이 {{ fmtDate(i.confirmedAt) }}에 확인했습니다. 다음 Rev. 확정 때 개정 이력에 들어갑니다.</p>
              <p class="muted small" v-else>{{ fmtRev(i.revision) }}에 반영되었습니다.</p>
            </template>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>요청 내용</h2></div>
          <div class="panel-body">
            <dl class="facts">
              <dt>요청 내용</dt><dd>{{ i.body || '-' }}</dd>
              <dt>완료 조건</dt><dd>{{ i.doneWhen }}</dd>
              <dt>참고 문서</dt><dd>{{ i.refs || '-' }}</dd>
              <dt>요청자</dt><dd>{{ i.requester.name }} <span class="muted">· {{ i.requester.dept }}</span></dd>
              <dt>수정자</dt><dd>{{ i.assignee.name }} <span class="muted">· {{ i.assignee.dept }}</span></dd>
              <dt>요청일</dt><dd class="num">{{ fmtDate(i.requestedAt) }}</dd>
              <dt>기한</dt><dd class="num">{{ fmtDate(i.due) }}</dd>
            </dl>
          </div>
        </section>

        <section class="panel" v-if="isRequester && !confirmed">
          <div class="panel-head"><h2>수정자·기한 바꾸기</h2><span class="muted xs">요청자만 바꿀 수 있습니다</span></div>
          <div class="panel-body row" style="align-items: flex-end">
            <label class="field" style="flex: 1 1 200px">수정자
              <select id="e-assignee" v-model="edit.assigneeId">
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ u.dept }}</option>
              </select>
            </label>
            <label class="field" style="flex: 1 1 160px">기한<input id="e-due" type="date" v-model="edit.due" /></label>
            <button class="btn" @click="saveEdit">저장</button>
          </div>
        </section>
      </div>

      <div class="stack" style="gap: 16px; min-width: 0">
        <section class="panel">
          <div class="panel-head"><h2>활동 기록</h2></div>
          <div class="panel-body">
            <ul class="timeline">
              <li v-for="e in i.events" :key="e.id" :class="'k-' + e.type">
                <div><div class="num xs muted">{{ fmtDateTime(e.at) }} · {{ e.user?.name }}</div>{{ e.text }}</div>
              </li>
            </ul>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>저장된 원본 사본</h2></div>
          <div class="panel-body">
            <ul v-if="i.files.length" class="files">
              <li v-for="f in i.files" :key="f.id">
                <span class="mono xs" style="overflow-wrap: anywhere">{{ f.name }}</span>
                <span class="num xs muted">{{ fmtDateTime(f.at) }} · {{ f.size }}MB</span>
              </li>
            </ul>
            <p v-else class="muted small">수정 완료를 누르면 그때의 원본이 여기에 저장됩니다.</p>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 360px); gap: 16px; align-items: start; }
@media (max-width: 900px) { .detail { grid-template-columns: 1fr; } }
.next { border-color: var(--accent); }
.resolution { background: var(--st-done-bg); padding: 10px 14px; border-radius: 6px; display: grid; gap: 2px; }
.files { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.files li { display: grid; gap: 2px; }
</style>
