<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session, refreshMe } from '../store.js'
import StatusChip from '../components/StatusChip.vue'
import IssueTable from '../components/IssueTable.vue'
import { fmtRev } from '../lib/status.js'

const manuals = ref([])
const stallDays = ref(3)
onMounted(async () => {
  await refreshMe()
  manuals.value = await api.listManuals()
  stallDays.value = (await api.getSettings()).stallDays
})
</script>

<template>
  <main class="page">
    <div class="page-head">
      <div class="grow">
        <h1>{{ session.user.name }}님이 처리할 이슈 {{ session.todo.assigned.length + session.todo.toReview.length }}건</h1>
        <p class="muted small">수정자로 지정된 이슈와, 내가 요청해서 수정이 끝난 이슈입니다.</p>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>내가 수정할 이슈</h2><span class="muted small">{{ session.todo.assigned.length }}건</span></div>
      <IssueTable :issues="session.todo.assigned" show-manual :stall-days="stallDays" empty-text="지금 수정할 이슈가 없습니다." />
    </section>

    <section class="panel">
      <div class="panel-head"><h2>내가 확인할 이슈</h2><span class="muted small">요청한 수정이 끝났습니다. 확인하거나 재요청하세요. {{ session.todo.toReview.length }}건</span></div>
      <IssueTable :issues="session.todo.toReview" show-manual :stall-days="stallDays" empty-text="확인을 기다리는 이슈가 없습니다." />
    </section>

    <section class="stack">
      <div class="row">
        <h2>매뉴얼</h2>
        <span class="spacer"></span>
        <router-link to="/manuals/new" class="btn primary">새 매뉴얼</router-link>
      </div>
      <div class="table-wrap panel">
        <table class="list">
          <thead>
            <tr>
              <th>제품</th><th>문서번호</th><th>Rev.</th><th>상태</th>
              <th>수정 요청 중</th><th>수정 중</th><th>검토 대기</th><th>멈춤</th><th class="hide-sm">초안 작성자</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in manuals" :key="m.id" class="click" @click="$router.push('/manuals/' + m.id)">
              <td><router-link :to="'/manuals/' + m.id" class="t-title" @click.stop>{{ m.product }}</router-link> <span class="muted xs">{{ m.lang }}</span></td>
              <td class="mono small">{{ m.docNo }}</td>
              <td class="mono small">{{ fmtRev(m.rev) }}</td>
              <td><StatusChip kind="manual" :status="m.status" /></td>
              <td class="num">{{ m.counts.requested || '' }}</td>
              <td class="num">{{ m.counts.fixing || '' }}</td>
              <td class="num">{{ m.counts.review || '' }}</td>
              <td class="num" :style="m.counts.stalled ? 'color: var(--danger); font-weight: 600' : ''">{{ m.counts.stalled || '' }}</td>
              <td class="small hide-sm">{{ m.drafter?.name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
