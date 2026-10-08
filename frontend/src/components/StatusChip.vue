<script setup>
import { computed } from 'vue'
import { ISSUE_STATUS, MANUAL_STATUS, SECTION_STATUS_LABEL } from '../lib/status.js'

// kind: issue | manual | section
const props = defineProps({ status: String, kind: { type: String, default: 'issue' }, confirmed: Boolean })
const label = computed(() => {
  if (props.kind === 'issue') return props.confirmed ? '확인함' : ISSUE_STATUS[props.status]
  if (props.kind === 'manual') return MANUAL_STATUS[props.status]
  return SECTION_STATUS_LABEL[props.status]
})
const cls = computed(() => (props.kind === 'issue' && props.confirmed ? 'confirmed' : props.status))
</script>

<template>
  <span class="chip" :class="cls">{{ label }}</span>
</template>
