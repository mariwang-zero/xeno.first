<script setup>
import { DOC_STEPS, DOC_STATUS } from '../lib/status.js'

// 문서 단계 한 줄 (과제계획서 3.2). 보류면 지금 단계 옆에 사유를 붙인다.
const props = defineProps({ status: String, held: Object, reviewFlow: { type: Boolean, default: true } })
const idx = s => DOC_STEPS.indexOf(s)
</script>

<template>
  <ol class="steps" :aria-label="'문서 단계: ' + DOC_STATUS[status]">
    <li v-for="s in DOC_STEPS" :key="s" :class="{ done: idx(s) < idx(status), now: s === status, off: !reviewFlow && idx(s) > 1, held: held && s === status }">
      <span class="dot"></span><span class="lbl">{{ DOC_STATUS[s] }}</span>
      <span v-if="held && s === status" class="chip hold">보류 · {{ held.reason }}</span>
    </li>
  </ol>
</template>

<style scoped>
.steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 0; flex-wrap: wrap; }
.steps li { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 0; font-size: var(--fs-sm); color: var(--muted); position: relative; }
.steps li:not(:last-child)::after { content: ''; width: 18px; height: 1px; background: var(--line); margin-left: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--line); background: var(--surface); flex: none; }
.done .dot { background: var(--accent); border-color: var(--accent); }
.done { color: var(--ink); }
.now .dot { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.now .lbl { color: var(--ink); font-weight: 600; }
.held .dot { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-bg); }
.off { opacity: .45; }
</style>
