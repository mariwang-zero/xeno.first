<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/index.js'
import { attempt } from '../store.js'

// S04 AI 초안: 자료 등록 (과제계획서 4.1)
const props = defineProps({ id: String })
const router = useRouter()
const p = ref(null)
const refs = ref([])
const form = ref({ referenceId: '', mustInclude: '', extra: '' })
const sources = ref([])
const busy = ref(false)
const over = ref(false)

onMounted(async () => {
  const [pp, rr] = await Promise.all([api.product(props.id), api.references()])
  p.value = pp
  refs.value = rr
  // 같은 대분류의 현재 사용본을 기본 레퍼런스로
  const same = rr.find(r => pp.category && r.productId !== pp.id && pp.category.id === (r.categoryId || pp.category.id))
  form.value.referenceId = (same || rr[0])?.versionId || ''
})

function addFiles(list) {
  for (const f of list) if (!sources.value.some(s => s.name === f.name)) sources.value.push(f)
}
function onDrop(e) {
  over.value = false
  addFiles(e.dataTransfer.files)
}
async function run() {
  busy.value = true
  const r = await attempt(() => api.startAi(props.id, { ...form.value, sources: sources.value.map(f => ({ name: f.name, size: f.size })), files: sources.value }))
  busy.value = false
  if (r) router.push('/ai/' + r.id)
}
</script>

<template>
  <main class="page narrow" v-if="p">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">제품</router-link> / <router-link :to="'/products/' + p.id">{{ p.name }}</router-link> / <span>AI 초안 생성</span></div>
        <h1>AI 초안 생성</h1>
        <ol class="wiz small"><li class="on">1 자료 등록</li><li>2 변경 추천 검토</li></ol>
      </div>
    </div>

    <section class="panel">
      <div class="panel-body stack" style="gap: 20px">
        <label class="field"><span class="req">기존 레퍼런스</span><span class="hint">지금 쓰는 매뉴얼 중 이번 초안의 바탕이 될 문서입니다.</span>
          <select id="ai-ref" v-model="form.referenceId">
            <option v-for="r in refs" :key="r.versionId" :value="r.versionId">{{ r.label }}</option>
          </select>
        </label>

        <div class="field"><span class="req">참고 자료</span><span class="hint">신규 사양서, 변경 요청서, 사진, 기술·시험 자료. 여러 개를 함께 올릴 수 있습니다.</span>
          <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
            <input id="ai-files" type="file" multiple @change="e => { addFiles(e.target.files); e.target.value = '' }" />
            <span>파일을 끌어다 놓거나 <u>골라서</u> 올리세요</span>
          </label>
          <ul class="chosen" v-if="sources.length">
            <li v-for="(f, i) in sources" :key="f.name"><span class="mono xs">{{ f.name }}</span><span class="xs muted num">{{ (f.size / 1e6).toFixed(1) }}MB</span><button class="btn ghost sm" :aria-label="f.name + ' 빼기'" @click="sources.splice(i, 1)">×</button></li>
          </ul>
        </div>

        <label class="field">참고할 작성 내용<span class="hint">반드시 들어가야 할 문구나 작성 방향. 한 줄에 하나씩 적으면 항목별로 반영합니다.</span>
          <textarea id="ai-must" v-model="form.mustInclude" placeholder="예: 제품명은 LooksCAM3로 통일&#10;Viewer Recording 기능 설명 추가"></textarea>
        </label>
        <label class="field">추가 지시사항<span class="hint">이번 개정에만 적용할 조건</span>
          <textarea id="ai-extra" v-model="form.extra" placeholder="예: 이미지는 바꾸지 말 것"></textarea>
        </label>

        <div class="note small">AI는 여기 올린 자료만 봅니다. 문서를 바로 고치지 않고 <b>변경 추천 목록</b>을 만들며, 무엇을 반영할지는 다음 단계에서 직접 고릅니다. 이미지는 자동으로 바꾸지 않습니다.</div>
        <div class="row"><button class="btn primary" :disabled="busy" @click="run">{{ busy ? '분석 중…' : 'AI 분석 실행' }}</button><router-link class="btn ghost" :to="'/products/' + p.id">취소</router-link></div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.narrow { max-width: 820px; }
.wiz { list-style: none; display: flex; gap: 16px; margin: 4px 0 0; padding: 0; color: var(--muted); }
.wiz .on { color: var(--accent); font-weight: 600; }
.field { display: grid; gap: 6px; font-size: var(--fs-sm); font-weight: 500; }
.field .hint { font-weight: 400; color: var(--muted); font-size: var(--fs-xs); }
.drop { position: relative; border: 1.5px dashed var(--line); border-radius: 8px; padding: 22px; text-align: center; color: var(--muted); cursor: pointer; font-weight: 400; }
.drop.over, .drop:hover { border-color: var(--accent); background: var(--accent-soft); }
.drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.chosen { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 4px; }
.chosen li { display: flex; gap: 10px; align-items: center; padding: 4px 8px; background: var(--surface-2); border-radius: 4px; }
.chosen .mono { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.note { background: var(--surface-2); border-left: 3px solid var(--accent); padding: 10px 14px; border-radius: 4px; }
</style>
