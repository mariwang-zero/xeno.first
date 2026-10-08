<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/index.js'
import { session } from '../store.js'
import Chip from '../components/Chip.vue'
import { fmtDate } from '../lib/status.js'

// S02 메인: 대분류 아래 제품을 항상 펼쳐 두고 바로 고른다 (과제계획서 3.1, 그림 1)
const cats = ref([])
const todo = ref([])
const q = ref('')

onMounted(async () => {
  const [c, mine] = await Promise.all([api.catalog(), api.myRequests()])
  cats.value = c
  todo.value = mine.todo
})
const shown = computed(() => {
  const k = q.value.trim().toLowerCase()
  return cats.value.map(c => ({ ...c, products: c.products.filter(p => !k || p.name.toLowerCase().includes(k)) }))
})
const whatToDo = r => (r.assigneeId === session.user.id ? (r.status === 'requested' ? '확인 시작' : '수정 완료') : '결과 확인')
</script>

<template>
  <main class="page">
    <div class="page-head">
      <div class="grow"><h1>제품</h1><p class="muted small">제품을 고르면 그 제품의 매뉴얼 작업 화면으로 갑니다.</p></div>
      <label class="search"><span class="sr">제품 검색</span><input id="m-search" type="text" v-model="q" placeholder="제품명 검색" /></label>
    </div>

    <div class="cats">
      <section v-for="c in shown" :key="c.id" class="cat">
        <h2>{{ c.name }}</h2>
        <ul>
          <li v-for="p in c.products" :key="p.id">
            <router-link :to="'/products/' + p.id" class="prod">
              <span class="pname">{{ p.name }}</span>
              <span class="meta">
                <Chip v-if="p.active" kind="doc" :status="p.active.status" :held="p.active.held" />
                <span v-else-if="p.rev" class="num xs muted">Rev.{{ String(p.rev).padStart(2, '0') }}</span>
                <span v-if="p.mine" class="badge" :title="'내가 처리할 요청 ' + p.mine + '건'">{{ p.mine }}</span>
              </span>
            </router-link>
          </li>
          <li v-if="!c.products.length" class="muted small none">맞는 제품이 없습니다.</li>
        </ul>
      </section>
    </div>

    <section class="panel" v-if="todo.length">
      <div class="panel-head"><h2>내가 처리할 요청</h2><span class="muted small">{{ todo.length }}건</span><span class="spacer"></span><router-link to="/requests" class="small">내 요청함 전체 보기</router-link></div>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>제품</th><th>요청</th><th>요청자 → 담당자</th><th>상태</th><th>할 일</th><th>기한</th></tr></thead>
          <tbody>
            <tr v-for="r in todo.slice(0, 5)" :key="r.id" class="click" :class="{ stalled: r.overdue }" @click="$router.push('/docs/' + r.docId + '?req=' + r.id)">
              <td>{{ r.product.name }}</td>
              <td><span class="num muted">#{{ r.no }}</span> <a class="t-title">{{ r.title }}</a> <span class="num xs muted">p.{{ r.page }}</span></td>
              <td class="small">{{ r.requester.name }} → {{ r.assignee.name }}</td>
              <td><Chip :status="r.status" /></td>
              <td class="small">{{ whatToDo(r) }}</td>
              <td class="num" :class="{ late: r.overdue }">{{ fmtDate(r.due) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.search { width: min(260px, 100%); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.cats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.cat { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px 18px 10px; box-shadow: var(--shadow); }
.cat h2 { font-size: var(--fs-xl); letter-spacing: -.01em; margin-bottom: 8px; }
.cat ul { list-style: none; margin: 0; padding: 0; }
.prod { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 9px 8px; margin: 0 -8px; border-radius: var(--radius); color: var(--ink); border-top: 1px solid var(--line); }
li:first-child .prod { border-top-color: transparent; }
.prod:hover { background: var(--surface-2); text-decoration: none; }
.pname { font-weight: 500; }
.meta { display: flex; gap: 6px; align-items: center; }
.none { padding: 8px 0; }
.late { color: var(--danger); }
</style>
