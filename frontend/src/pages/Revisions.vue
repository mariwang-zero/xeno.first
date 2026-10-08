<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session, attempt } from '../store.js'
import { fmtDate, fmtRev } from '../lib/status.js'

const props = defineProps({ id: String })
const data = ref(null)
const open = ref(null)
const picked = ref([])
const summary = ref('')
const summaryTouched = ref(false)

async function load() {
  data.value = await api.listRevisions(props.id)
  picked.value = data.value.pending.map(i => i.id)
  summaryTouched.value = false
  buildSummary()
}
onMounted(load)

const canRelease = computed(() => session.user.release || session.user.admin)
const nextRev = computed(() => fmtRev((data.value?.manual.rev ?? 0) + 1))

// 주요 변경사항은 고른 이슈의 수정 내용을 모아 만들고, 배포 담당이 다듬을 수 있습니다.
function buildSummary() {
  if (summaryTouched.value) return
  summary.value = data.value.pending.filter(i => picked.value.includes(i.id)).map(i => i.resolution).join('; ')
}
async function release() {
  const r = await attempt(() => api.createRevision(props.id, { summary: summary.value, issueIds: picked.value }), `${nextRev.value}를 확정하고 정식 파일을 저장했습니다.`)
  if (r) {
    await load()
    open.value = r.id
  }
}
</script>

<template>
  <main class="page" v-if="data">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">홈</router-link> / <router-link :to="'/manuals/' + data.manual.id">{{ data.manual.product }}</router-link> / 개정 이력</div>
        <h1>개정 이력 <span class="mono muted" style="font-weight: 400">{{ data.manual.docNo }}</span></h1>
        <p class="muted small">Rev.마다 주요 변경사항과 개정일만 보여 줍니다. 누르면 포함된 이슈와 그 Rev.의 파일을 볼 수 있습니다.</p>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2>다음 Rev. 준비 · {{ nextRev }}</h2>
        <span class="muted small">요청자가 확인한 이슈 {{ data.pending.length }}건이 기다리고 있습니다</span>
      </div>
      <div class="panel-body stack" v-if="data.pending.length">
        <ul class="pending">
          <li v-for="i in data.pending" :key="i.id">
            <label class="check" style="align-items: flex-start">
              <input :id="'p-' + i.id" type="checkbox" :value="i.id" v-model="picked" @change="buildSummary" :disabled="!canRelease" />
              <span>
                <span class="num muted">#{{ i.no }}</span> {{ i.resolution }}
                <span class="xs muted"> · {{ i.section.no }}. {{ i.section.title }} · {{ i.assignee.name }} · 확인 {{ fmtDate(i.confirmedAt) }}</span>
              </span>
            </label>
          </li>
        </ul>
        <template v-if="canRelease">
          <label class="field">주요 변경사항 <span class="hint">고른 이슈의 수정 내용을 모았습니다. 고쳐 써도 됩니다.</span>
            <textarea id="r-summary" v-model="summary" @input="summaryTouched = true"></textarea>
          </label>
          <div class="row">
            <button class="btn primary" @click="release" :disabled="!picked.length">{{ nextRev }} 확정</button>
            <span class="xs muted">확정하면 지금의 원본이 이 Rev.의 정식 파일로 저장됩니다. 바로 배포하거나 월말에 모아 확정해도 됩니다.</span>
          </div>
        </template>
        <p v-else class="small muted">Rev. 확정은 배포 담당이 합니다.</p>
      </div>
      <p v-else class="empty">확인된 이슈가 없습니다. 이슈가 수정 완료되고 요청자가 확인하면 여기에 모입니다.</p>
    </section>

    <section class="panel">
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Rev.</th><th>개정일</th><th>주요 변경사항</th><th class="hide-sm">확정</th></tr></thead>
          <tbody>
            <template v-for="r in data.revisions" :key="r.id">
              <tr class="click" @click="open = open === r.id ? null : r.id">
                <td class="mono">{{ fmtRev(r.rev) }}</td>
                <td class="num small">{{ fmtDate(r.date) }}</td>
                <td>{{ r.summary }}</td>
                <td class="small hide-sm">{{ r.by?.name }}</td>
              </tr>
              <tr v-if="open === r.id">
                <td colspan="4" style="background: var(--surface-2)">
                  <div class="stack small">
                    <div v-if="r.file" class="row"><span class="muted">정식 파일</span><span class="mono xs">{{ r.file.name }}</span><span class="xs muted">{{ r.file.size }}MB</span></div>
                    <div v-if="r.issues.length">
                      <div class="muted xs">포함된 이슈</div>
                      <ul style="margin: 4px 0 0; padding-left: 18px">
                        <li v-for="i in r.issues" :key="i.id"><router-link :to="'/issues/' + i.id">#{{ i.no }} {{ i.title }}</router-link> <span class="muted">· {{ i.resolution }}</span></li>
                      </ul>
                    </div>
                    <p v-else class="muted xs">이 도구를 쓰기 전의 Rev.라 연결된 이슈가 없습니다.</p>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pending { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
</style>
