<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { attempt } from '../store.js'
import { ITEM_KIND, ITEM_NOTE, fmtDateTime } from '../lib/status.js'

// S05 AI 초안: 변경 추천 검토 (과제계획서 4.3~4.6, 그림 2)
const props = defineProps({ id: String })
const run = ref(null)
const checked = ref([])
const open = ref({})
const filter = ref('')
const busy = ref(false)

async function load() {
  run.value = await api.aiRun(props.id)
  checked.value = run.value.items.filter(i => i.checked).map(i => i.no)
}
onMounted(load)

const applied = computed(() => run.value?.status === 'applied')
const counts = computed(() => {
  const it = run.value?.items || []
  return { all: it.length, ai: it.filter(i => i.note === 'ai').length, manual: it.filter(i => i.note === 'manual').length, check: it.filter(i => i.note === 'check').length }
})
const rows = computed(() => (run.value?.items || []).filter(i => !filter.value || i.note === filter.value))
const selectable = computed(() => rows.value.filter(i => i.kind !== 'image'))
const allOn = computed(() => selectable.value.length && selectable.value.every(i => checked.value.includes(i.no)))
function toggleAll() {
  const nos = selectable.value.map(i => i.no)
  checked.value = allOn.value ? checked.value.filter(n => !nos.includes(n)) : [...new Set([...checked.value, ...nos])]
}
async function apply() {
  busy.value = true
  const r = await attempt(() => api.applyAi(props.id, checked.value))
  busy.value = false
  if (r) await load()
}
</script>

<template>
  <main class="page" v-if="run">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">제품</router-link> / <router-link :to="'/products/' + run.doc.product.id">{{ run.doc.product.name }}</router-link> / <span>AI 초안</span></div>
        <h1>변경 추천 검토</h1>
        <div class="small muted">{{ run.user.name }} · {{ fmtDateTime(run.at) }} · 기준: <span class="mono">{{ run.inputs.reference }}</span></div>
      </div>
      <router-link v-if="applied" class="btn primary" :to="'/docs/' + run.docId">문서 검토로 가기</router-link>
    </div>

    <div class="stats">
      <button class="stat" :class="{ on: filter === '' }" @click="filter = ''"><span class="n">{{ counts.all }}</span><span class="l">추천 전체</span></button>
      <button class="stat" :class="{ on: filter === 'ai' }" @click="filter = 'ai'"><span class="n">{{ counts.ai }}</span><span class="l"><i style="background: var(--st-done-fg)"></i>AI 적용 가능</span></button>
      <button class="stat" :class="{ on: filter === 'manual' }" @click="filter = 'manual'"><span class="n">{{ counts.manual }}</span><span class="l"><i style="background: var(--st-quiet-fg)"></i>수작업 권장</span></button>
      <button class="stat" :class="{ on: filter === 'check' }" @click="filter = 'check'"><span class="n">{{ counts.check }}</span><span class="l"><i style="background: var(--st-req-fg)"></i>확인 필요</span></button>
    </div>

    <div v-if="run.failures.length" class="band error">
      <b>읽지 못한 자료 {{ run.failures.length }}건</b> — 이 자료는 분석에 들어가지 않았습니다. 결과를 완성본으로 보지 마세요.
      <ul><li v-for="f in run.failures" :key="f.file"><span class="mono">{{ f.file }}</span>: {{ f.reason }}</li></ul>
    </div>
    <div v-if="applied" class="band ok">
      <b>{{ fmtDateTime(run.appliedAt) }}에 반영했습니다.</b> 반영 {{ run.result.applied }}건<template v-if="run.result.failed.length">, 실패 {{ run.result.failed.length }}건</template>, 수작업으로 남긴 이미지 {{ run.result.manual }}건.
      <ul v-if="run.result.failed.length"><li v-for="f in run.result.failed" :key="f.no">#{{ f.no }} {{ f.summary }}: {{ f.reason }}</li></ul>
    </div>

    <section class="panel">
      <div class="table-wrap">
        <table class="list items">
          <thead><tr><th>No.</th><th>페이지</th><th>구분</th><th>변경 내용</th><th>비고</th><th class="ck"><label class="check" v-if="!applied"><input type="checkbox" :checked="allOn" @change="toggleAll" />체크</label><span v-else>반영</span></th></tr></thead>
          <tbody>
            <template v-for="i in rows" :key="i.no">
              <tr class="click" @click="open[i.no] = !open[i.no]" :class="{ dim: applied && !i.checked }">
                <td class="num">{{ i.no }}</td>
                <td class="num">{{ i.page }}P</td>
                <td>{{ ITEM_KIND[i.kind] }}</td>
                <td><span class="t-title">{{ i.summary }}</span><span v-if="i.cert" class="tag cert" style="margin-left: 6px">인증 문구</span><div class="xs muted">{{ open[i.no] ? '접기' : '전·후 보기' }}</div></td>
                <td><span class="note" :class="i.note">{{ ITEM_NOTE[i.note] }}</span></td>
                <td class="ck" @click.stop>
                  <input v-if="!applied && i.kind !== 'image'" type="checkbox" :value="i.no" v-model="checked" :aria-label="i.no + '번 반영'" />
                  <span v-else-if="i.kind === 'image'" class="xs muted">수작업</span>
                  <span v-else class="xs">{{ i.checked ? '✓' : '-' }}</span>
                </td>
              </tr>
              <tr v-if="open[i.no]" class="detail"><td></td><td colspan="5">
                <div class="diff">
                  <div><span class="xs muted">기존 내용</span><p>{{ i.op === 'add' ? '(기존 위치 없음, 새 문단)' : i.before }}</p></div>
                  <div><span class="xs muted">제안 내용</span><p>{{ i.kind === 'image' ? '담당자가 직접 교체·배치' : i.after }}</p></div>
                </div>
                <div class="xs muted">근거 자료: {{ i.basis }}</div>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <div class="row" v-if="!applied">
      <button class="btn primary" :disabled="busy" @click="apply">선택 변경 진행 ({{ checked.length }}건 반영)</button>
      <span class="small muted">체크한 항목만 초안 복사본에 반영하고 원본은 그대로 둡니다. 확인 필요 항목은 근거를 본 뒤 직접 체크하세요.</span>
    </div>
  </main>
</template>

<style scoped>
.band { padding: 12px 16px; border-radius: 8px; font-size: var(--fs-sm); }
.band ul { margin: 6px 0 0; padding-left: 18px; }
.band.error { background: var(--danger-bg); color: var(--ink); border-left: 3px solid var(--danger); }
.band.ok { background: var(--st-done-bg); border-left: 3px solid var(--st-done-fg); }
.ck { text-align: center; width: 64px; }
.ck input { width: 18px; height: 18px; }
.note { font-size: var(--fs-xs); font-weight: 600; white-space: nowrap; }
.note.ai { color: var(--st-done-fg); }
.note.manual { color: var(--st-quiet-fg); }
.note.check { color: var(--st-req-fg); }
tr.dim td { color: var(--muted); }
tr.detail td { background: var(--surface-2); }
.diff { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 6px; }
.diff p { margin-top: 2px; }
@media (max-width: 720px) { .diff { grid-template-columns: 1fr; } }
</style>
