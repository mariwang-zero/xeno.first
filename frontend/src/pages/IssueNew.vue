<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/index.js'
import { attempt } from '../store.js'
import { DEPARTMENTS } from '../lib/status.js'

const props = defineProps({ id: String })
const route = useRoute()
const router = useRouter()
const m = ref(null)
const users = ref([])
const reasons = ref([])
const form = ref({ sectionId: route.query.section || '', title: '', reason: '', body: '', doneWhen: '', refs: '', due: '', assigneeId: '' })

onMounted(async () => {
  m.value = await api.getManual(props.id)
  users.value = await api.users()
  reasons.value = (await api.getSettings()).reasons
  if (!form.value.sectionId) form.value.sectionId = m.value.sections[0].id
})

const section = computed(() => m.value?.sections.find(s => s.id === form.value.sectionId))
const byDept = computed(() => DEPARTMENTS.map(d => ({ dept: d, people: users.value.filter(u => u.dept === d) })).filter(g => g.people.length))

async function submit() {
  const r = await attempt(() => api.createIssue(props.id, form.value), '수정 요청을 등록했습니다.')
  if (r) router.push('/issues/' + r.id)
}
</script>

<template>
  <main class="page" v-if="m" style="max-width: 860px">
    <div class="page-head">
      <div class="grow">
        <div class="eyebrow crumbs"><router-link to="/">홈</router-link> / <router-link :to="'/manuals/' + m.id">{{ m.product }}</router-link> / 새 수정 요청</div>
        <h1>새 수정 요청</h1>
        <p class="muted small">무엇을, 왜, 어디까지 고치면 끝인지 적어 주세요. 수정자는 이 요청마다 지정합니다.</p>
      </div>
    </div>

    <form class="panel panel-body stack" @submit.prevent="submit">
      <div class="grid-2">
        <label class="field"><span class="req">대상 절
          </span><select id="n-section" v-model="form.sectionId">
            <option v-for="s in m.sections" :key="s.id" :value="s.id">{{ s.no }}. {{ s.title }}</option>
          </select>
        </label>
        <label class="field"><span class="req">수정 사유
          </span><select id="n-reason" v-model="form.reason">
            <option value="" disabled>고르세요</option>
            <option v-for="r in reasons" :key="r">{{ r }}</option>
          </select>
        </label>
      </div>
      <p v-if="section?.cert" class="small" style="color: var(--st-req-fg); background: var(--st-req-bg); padding: 8px 12px; border-radius: 6px">
        이 절에는 인증 기관이 요구하는 필수 문구가 있습니다. 한글판은 식약처, 영문판은 해외 인증 기준을 확인하고 고쳐 주세요.
      </p>
      <label class="field"><span class="req">제목
        </span><input id="n-title" type="text" v-model="form.title" placeholder="예: EMI 시험 FAIL에 따른 페라이트 사양 수정" />
      </label>
      <label class="field">요청 내용
        <textarea id="n-body" v-model="form.body" placeholder="무엇이 바뀌었고 어디를 고쳐야 하는지"></textarea>
      </label>
      <label class="field"><span class="req">완료 조건 </span><span class="hint">이 조건이 채워지면 수정 완료로 봅니다. 시험 결과에 따른 변경은 최종 PASS 후 확정된 사양만 반영합니다.</span>
        <input id="n-done" type="text" v-model="form.doneWhen" placeholder="예: 최종 PASS 후 확정된 사양을 7장 표에 반영" />
      </label>
      <label class="field">참고 문서·도면
        <input id="n-refs" type="text" v-model="form.refs" placeholder="문서 이름이나 NAS 경로" />
      </label>
      <div class="grid-2">
        <label class="field"><span class="req">수정자
          </span><select id="n-assignee" v-model="form.assigneeId">
            <option value="" disabled>고르세요</option>
            <optgroup v-for="g in byDept" :key="g.dept" :label="g.dept">
              <option v-for="u in g.people" :key="u.id" :value="u.id">{{ u.name }}</option>
            </optgroup>
          </select>
        </label>
        <label class="field">기한 <span class="hint">비워 두면 기한 없음</span>
          <input id="n-due" type="date" v-model="form.due" />
        </label>
      </div>
      <div class="row" style="justify-content: flex-end">
        <router-link :to="'/manuals/' + m.id" class="btn ghost">취소</router-link>
        <button class="btn primary" type="submit">수정 요청 등록</button>
      </div>
    </form>
  </main>
</template>
