<script setup>
import { computed } from 'vue'
import { DOC_STATUS, REQ_STATUS } from '../lib/status.js'

// kind: doc(문서 단계) | req(수정 요청 상태)
const props = defineProps({ status: String, kind: { type: String, default: 'req' }, held: [Object, Boolean] })
const label = computed(() => (props.kind === 'doc' ? (props.held ? DOC_STATUS.hold : DOC_STATUS[props.status]) : REQ_STATUS[props.status]))
const cls = computed(() => (props.held ? 'hold' : props.kind + '-' + props.status))
</script>

<template>
  <span class="chip" :class="cls">{{ label }}</span>
</template>
