<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session } from '../store.js'
import Chip from '../components/Chip.vue'
import { fmtDate } from '../lib/status.js'

// S08 내 요청함: 처리할 것 / 보낸 것 / 닫힌 것
const data = ref({ todo: [], sent: [], closed: [] })
const tab = ref('todo')
const loaded = ref(false)
onMounted(async () => {
  data.value = await api.myRequests()
  loaded.value = true
})
const TABS = { todo: '처리할 것', sent: '보낸 것', closed: '닫힌 것' }
const list = computed(() => [...data.value[tab.value]].sort((a, b) => (b.overdue - a.overdue) || (a.due || '9999').localeCompare(b.due || '9999')))
const whatToDo = r => {
  if (r.status === 'closed') return '끝남'
  if (r.assigneeId === session.user.id && r.status === 'requested') return '확인 시작'
  if (r.assigneeId === session.user.id && r.status === 'checking') return '수정 완료'
  if (r.requesterId === session.user.id && r.status === 'done') return '결과 확인'
  return r.assignee.name + '님 처리 대기'
}
</script>

<template>
  <main class="page">
    <div class="page-head">
      <div class="grow"><h1>내 요청함</h1><p class="muted small">나에게 온 요청과 내가 보낸 요청을 모아 봅니다. 줄을 누르면 문서의 그 위치로 갑니다.</p></div>
    </div>
    <div class="stats" role="tablist">
      <button v-for="(l, k) in TABS" :key="k" role="tab" :aria-selected="tab === k" class="stat" :class="{ on: tab === k, alert: k === 'todo' && data.todo.some(r => r.overdue) }" @click="tab = k">
        <span class="n">{{ data[k].length }}</span><span class="l">{{ l }}</span>
      </button>
    </div>
    <section class="panel">
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>상태</th><th>요청</th><th>제품 · 문서</th><th>요청자 → 담당자</th><th>할 일</th><th>기한</th></tr></thead>
          <tbody>
            <tr v-for="r in list" :key="r.id" class="click" :class="{ stalled: r.overdue }" @click="$router.push('/docs/' + r.docId + '?req=' + r.id)">
              <td><Chip :status="r.status" /></td>
              <td><span class="num muted">#{{ r.no }}</span> <a class="t-title">{{ r.title }}</a> <span class="num xs muted">p.{{ r.page }}</span></td>
              <td class="small">{{ r.product.name }}</td>
              <td class="small">{{ r.requester.name }} → {{ r.assignee.name }}</td>
              <td class="small">{{ whatToDo(r) }}</td>
              <td class="num" :class="{ late: r.overdue }">{{ fmtDate(r.due) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="loaded && !list.length" class="empty">{{ tab === 'todo' ? '지금 처리할 요청이 없습니다.' : tab === 'sent' ? '보낸 요청 중 열려 있는 것이 없습니다.' : '닫힌 요청이 없습니다.' }}</p>
    </section>
  </main>
</template>

<style scoped>
.late { color: var(--danger); }
</style>
