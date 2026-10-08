<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, isDemo } from '../api/index.js'
import { session, attempt, notify } from '../store.js'
import Chip from '../components/Chip.vue'
import DocSteps from '../components/DocSteps.vue'
import { can, fmtDate, fmtDateTime, fmtRev, VERSION_KIND } from '../lib/status.js'

// S03 제품 작업 화면: 문서 단계, 작업 목록, 현재 사용본, 등록 파일, 최근 활동
const props = defineProps({ id: String })
const p = ref(null)
const settings = ref({ reviewFlow: true })
const tab = ref('ref')
const fileInput = ref(null)
const router = useRouter()
// 배포가 끝나 열린 작업이 없으면, 현재 사용본에서 다음 개정을 진행 중부터 시작할 수 있다
const canRevise = computed(() => p.value && can.aiDraft(session.user) && p.value.current && !p.value.docs.some(d => d.status !== 'deploy'))
async function startRevision() {
  if (!window.confirm(`${fmtRev(p.value.rev)} 현재 사용본에서 ${fmtRev(p.value.rev + 1)} 개정을 시작할까요?`)) return
  const d = await attempt(() => api.startRevision(p.value.id), `${fmtRev(p.value.rev + 1)} 개정을 시작했습니다. 진행 중 단계입니다.`)
  if (d) router.push('/docs/' + d.id)
}

async function load() {
  const [pp, st] = await Promise.all([api.product(props.id), api.settings()])
  p.value = pp
  settings.value = st
}
onMounted(load)

const active = computed(() => p.value?.docs.find(d => d.status !== 'deploy') || p.value?.docs[0])
const tabs = computed(() => {
  if (!p.value) return []
  const v = k => p.value.versions.filter(x => x.kind === k)
  return [
    { k: 'ref', label: '참고자료', items: p.value.files.map(f => ({ ...f, note: '' })) },
    { k: 'original', label: '원본', items: v('original') },
    { k: 'ai', label: 'AI 초안', items: v('ai') },
    { k: 'review', label: '검토본', items: v('review') },
    { k: 'final', label: '최종본', items: v('final') },
  ]
})
const tabItems = computed(() => tabs.value.find(t => t.k === tab.value)?.items || [])

async function onFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f || !active.value) return
  if (await attempt(() => api.addFile(active.value.id, isDemo ? f.name : f, f.size), '참고자료를 등록했습니다.')) load()
}
function pickFile() {
  if (!active.value) return notify('먼저 작업을 시작해 주세요. AI 초안 생성으로 작업이 만들어집니다.', 'error')
  fileInput.value.click()
}
function download() {
  notify(isDemo ? '데모라서 실제 파일은 내려받지 않습니다.' : '내려받는 중입니다.')
}
</script>

<template>
  <main class="page" v-if="p">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">제품</router-link> / <span>{{ p.category.name }}</span> / <span>{{ p.name }}</span></div>
        <h1>{{ p.name }}</h1>
        <div class="row small muted"><span class="mono">{{ p.docNo }}</span><span>·</span><span>{{ p.rev ? '배포 ' + fmtRev(p.rev) : '배포 이력 없음' }}</span></div>
      </div>
      <div class="row">
        <button class="btn" @click="pickFile">참고자료 등록</button>
        <input ref="fileInput" type="file" hidden @change="onFile" />
        <button v-if="canRevise" class="btn primary" @click="startRevision">{{ fmtRev(p.rev + 1) }} 개정 시작</button>
        <router-link v-if="can.aiDraft(session.user)" class="btn" :class="{ primary: !canRevise }" :to="'/products/' + p.id + '/ai/new'">AI 초안 생성</router-link>
      </div>
    </div>

    <section class="panel" v-if="active">
      <div class="panel-body stack">
        <div class="row"><span class="small muted">지금 작업</span><router-link :to="'/docs/' + active.id" class="t-title">{{ active.title }}</router-link></div>
        <DocSteps :status="active.status" :held="active.held" :review-flow="settings.reviewFlow" />
      </div>
    </section>

    <div class="cols">
      <section class="panel">
        <div class="panel-head"><h2>작업 목록</h2><span class="muted small">{{ p.docs.length }}건</span></div>
        <div class="table-wrap" v-if="p.docs.length">
          <table class="list">
            <thead><tr><th>작업</th><th>상태</th><th>문서 담당자</th><th>미처리 요청</th><th>마지막 활동</th></tr></thead>
            <tbody>
              <tr v-for="d in p.docs" :key="d.id" class="click" @click="$router.push(d.status === 'ai' ? '/docs/' + d.id : '/docs/' + d.id)">
                <td><a class="t-title">{{ d.title }}</a><div v-if="d.lock" class="xs muted">🔒 {{ d.lock.user.name }}님 편집 중</div></td>
                <td><Chip kind="doc" :status="d.status" :held="d.held" /></td>
                <td class="small">{{ d.owner.name }}</td>
                <td class="num">{{ d.open }}</td>
                <td class="num small">{{ fmtDate(d.lastAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">아직 작업이 없습니다. <b>AI 초안 생성</b>으로 첫 작업을 시작합니다.</div>
      </section>

      <div class="stack" style="gap: 16px; min-width: 0">
        <section class="panel">
          <div class="panel-head"><h2>현재 사용본</h2></div>
          <div class="panel-body stack" v-if="p.current">
            <div class="mono small" style="overflow-wrap: anywhere">{{ p.current.name }}</div>
            <div class="xs muted">{{ VERSION_KIND[p.current.kind] }} · {{ p.current.user.name }} · {{ fmtDate(p.current.at) }}</div>
            <div class="row"><button class="btn sm" @click="download">내려받기</button><router-link v-if="active" class="btn sm" :to="'/docs/' + active.id + '/history'">버전·이력 보기</router-link></div>
          </div>
          <div v-else class="panel-body muted small">아직 지정된 현재 사용본이 없습니다. 배포하거나 버전·이력에서 지정합니다.</div>
        </section>

        <section class="panel">
          <div class="panel-head" style="padding-bottom: 0; border: 0"><h2>등록 파일</h2></div>
          <div class="tabs" role="tablist">
            <button v-for="t in tabs" :key="t.k" role="tab" :aria-selected="tab === t.k" :class="{ on: tab === t.k }" @click="tab = t.k">{{ t.label }} <span class="num xs">{{ t.items.length }}</span></button>
          </div>
          <ul class="files" v-if="tabItems.length">
            <li v-for="f in tabItems" :key="f.id"><span class="mono xs" style="overflow-wrap: anywhere">{{ f.name }}</span><span class="xs muted">{{ f.user?.name }} · {{ fmtDate(f.at) }}<template v-if="f.note"> · {{ f.note }}</template></span></li>
          </ul>
          <div v-else class="empty">파일이 없습니다.</div>
        </section>
      </div>
    </div>

    <div class="cols">
      <section class="panel">
        <div class="panel-head"><h2>최근 활동</h2></div>
        <div class="panel-body">
          <ul class="timeline" v-if="p.activity.length">
            <li v-for="(a, i) in p.activity" :key="i" :class="{ 'k-complete': a.change }"><div><div class="num xs muted">{{ fmtDateTime(a.at) }} · {{ a.user?.name }}</div>{{ a.text }}</div></li>
          </ul>
          <p v-else class="muted small">활동이 없습니다.</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Rev. 이력</h2></div>
        <div class="table-wrap" v-if="p.revs.length">
          <table class="list">
            <thead><tr><th>Rev.</th><th>주요 변경사항</th><th>배포일</th></tr></thead>
            <tbody><tr v-for="r in p.revs" :key="r.rev"><td class="mono">{{ fmtRev(r.rev) }}</td><td>{{ r.summary }}</td><td class="num">{{ fmtDate(r.at) }}</td></tr></tbody>
          </table>
        </div>
        <div v-else class="empty">배포 이력이 없습니다.</div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.tabs { display: flex; gap: 2px; padding: 10px 12px 0; border-bottom: 1px solid var(--line); overflow-x: auto; }
.tabs button { font: inherit; font-size: var(--fs-sm); background: none; border: 0; padding: 8px 10px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.tabs button.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
.files { list-style: none; margin: 0; padding: 14px 18px; display: grid; gap: 10px; }
.files li { display: grid; gap: 2px; }
</style>
