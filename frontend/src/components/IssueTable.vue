<script setup>
import { useRouter } from 'vue-router'
import StatusChip from './StatusChip.vue'
import { fmtDate, stallReason } from '../lib/status.js'

defineProps({ issues: Array, showManual: Boolean, stallDays: { type: Number, default: 3 }, emptyText: { type: String, default: '해당하는 이슈가 없습니다.' } })
const router = useRouter()
</script>

<template>
  <div class="table-wrap">
    <table class="list" v-if="issues.length">
      <thead>
        <tr>
          <th>#</th>
          <th>제목</th>
          <th v-if="showManual">매뉴얼</th>
          <th>절</th>
          <th>상태</th>
          <th>수정자</th>
          <th class="hide-sm">요청자</th>
          <th class="hide-sm">요청일</th>
          <th class="hide-sm">기한</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="i in issues" :key="i.id" class="click" :class="{ stalled: i.stalled }" @click="router.push('/issues/' + i.id)">
          <td class="num muted">{{ i.no }}</td>
          <td>
            <router-link :to="'/issues/' + i.id" class="t-title" @click.stop>{{ i.title }}</router-link>
            <div v-if="i.stalled" class="xs" style="color: var(--danger)">{{ stallReason(i, stallDays) }}</div>
          </td>
          <td v-if="showManual" class="small">{{ i.manual.product }} <span class="muted mono xs">{{ i.manual.docNo }}</span></td>
          <td class="small"><span class="muted num">{{ i.section?.no }}.</span> {{ i.section?.title }}</td>
          <td><StatusChip :status="i.status" :confirmed="!!i.confirmedAt" /></td>
          <td class="small">{{ i.assignee?.name }}</td>
          <td class="small hide-sm">{{ i.requester?.name }}</td>
          <td class="num small hide-sm">{{ fmtDate(i.requestedAt) }}</td>
          <td class="num small hide-sm">{{ fmtDate(i.due) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">{{ emptyText }}</p>
  </div>
</template>
