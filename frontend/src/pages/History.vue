<script setup>
import { ref, onMounted } from 'vue'
import { api, isDemo } from '../api/index.js'
import { session, attempt, notify } from '../store.js'
import Chip from '../components/Chip.vue'
import { VERSION_KIND, can, fmtDate, fmtDateTime, fmtRev } from '../lib/status.js'

// S09 버전·변경 이력
const props = defineProps({ id: String })
const h = ref(null)
const tab = ref('versions')
async function load() { h.value = await api.history(props.id) }
onMounted(load)
async function makeCurrent(v) {
  if (!window.confirm(`${v.name}을(를) 현재 사용본으로 지정할까요?`)) return
  if (await attempt(() => api.setCurrent(v.id), '현재 사용본을 바꿨습니다.')) await load()
}
const download = () => notify(isDemo ? '데모라서 실제 파일은 내려받지 않습니다.' : '내려받는 중입니다.')
</script>

<template>
  <main class="page" v-if="h">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">제품</router-link> / <router-link :to="'/products/' + h.doc.product.id">{{ h.doc.product.name }}</router-link> / <router-link :to="'/docs/' + h.doc.id">문서 검토</router-link> / <span>버전·이력</span></div>
        <h1>버전·변경 이력</h1>
        <div class="row small"><Chip kind="doc" :status="h.doc.status" :held="h.doc.held" /><span class="muted">{{ h.doc.title }}</span></div>
      </div>
    </div>

    <div class="tabs-bar" role="tablist">
      <button role="tab" :aria-selected="tab === 'versions'" :class="{ on: tab === 'versions' }" @click="tab = 'versions'">버전 <span class="num xs">{{ h.versions.length }}</span></button>
      <button role="tab" :aria-selected="tab === 'changes'" :class="{ on: tab === 'changes' }" @click="tab = 'changes'">변경 이력 <span class="num xs">{{ h.changes.length }}</span></button>
      <button role="tab" :aria-selected="tab === 'revs'" :class="{ on: tab === 'revs' }" @click="tab = 'revs'">Rev. 이력 <span class="num xs">{{ h.revs.length }}</span></button>
    </div>

    <section v-if="tab === 'versions'" class="panel">
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>종류</th><th>파일</th><th>올린 사람</th><th>날짜</th><th>메모</th><th></th></tr></thead>
          <tbody>
            <tr v-for="v in h.versions" :key="v.id">
              <td><span class="tag">{{ VERSION_KIND[v.kind] }}</span></td>
              <td><span class="mono small">{{ v.name }}</span> <span v-if="v.id === h.currentVersionId" class="chip doc-deploy">현재 사용본</span></td>
              <td class="small">{{ v.user?.name }}</td>
              <td class="num small">{{ fmtDateTime(v.at) }}</td>
              <td class="small">{{ v.note }}</td>
              <td class="row nowrap">
                <button class="btn sm" @click="download">내려받기</button>
                <button v-if="can.setCurrent(session.user) && v.id !== h.currentVersionId && ['final', 'original'].includes(v.kind)" class="btn sm" @click="makeCurrent(v)">현재 사용본으로</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!h.versions.length" class="empty">아직 올린 버전이 없습니다.</p>
    </section>

    <section v-else-if="tab === 'changes'" class="panel">
      <div class="panel-body">
        <ul class="timeline">
          <li v-for="(c, i) in h.changes" :key="i" :class="{ 'k-complete': c.change }">
            <span></span>
            <div><div>{{ c.text }}</div><div class="xs muted"><span class="num">{{ fmtDateTime(c.at) }}</span> · {{ c.user?.name }}</div></div>
          </li>
        </ul>
        <p v-if="!h.changes.length" class="empty">기록이 없습니다.</p>
      </div>
    </section>

    <section v-else class="panel">
      <div class="panel-head"><h2>{{ h.doc.product.docNo }}</h2><span class="muted small">배포할 때마다 한 줄씩 쌓입니다.</span></div>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Rev.</th><th>날짜</th><th>주요 변경사항</th><th>배포한 사람</th></tr></thead>
          <tbody>
            <tr v-for="r in h.revs" :key="r.rev"><td class="mono">{{ fmtRev(r.rev) }}</td><td class="num small">{{ fmtDate(r.at) }}</td><td class="small">{{ r.summary }}</td><td class="small">{{ r.user?.name }}</td></tr>
          </tbody>
        </table>
      </div>
      <p v-if="!h.revs.length" class="empty">아직 배포한 적이 없습니다.</p>
    </section>
  </main>
</template>

<style scoped>
.tabs-bar { display: flex; gap: 2px; border-bottom: 1px solid var(--line); }
.tabs-bar button { font: inherit; background: none; border: 0; padding: 8px 14px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.tabs-bar button.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
.nowrap { flex-wrap: nowrap; justify-content: flex-end; }
</style>
