<script setup>
// 영역 선택 요청의 위치를 작은 페이지 그림으로 보여 준다. (실제 서버는 잘라낸 이미지를 저장)
defineProps({ rect: Object, page: Number, wide: Boolean })
</script>

<template>
  <span class="thumb" :class="{ wide }" :title="page + '페이지 선택 영역'">
    <span class="lines"></span>
    <span class="area" :style="{ left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' }"></span>
    <span class="pg num">p.{{ page }}</span>
  </span>
</template>

<style scoped>
.thumb { position: relative; display: inline-block; width: 46px; aspect-ratio: 1 / 1.414; background: var(--surface); border: 1px solid var(--line); border-radius: 3px; flex: none; overflow: hidden; }
.thumb.wide { width: 120px; }
.lines { position: absolute; inset: 12% 14%; background: repeating-linear-gradient(to bottom, var(--line) 0 2px, transparent 2px 9%); opacity: .8; }
.area { position: absolute; border: 2px solid var(--st-req-fg); background: color-mix(in srgb, var(--st-req-fg) 18%, transparent); border-radius: 2px; }
.pg { position: absolute; right: 3px; bottom: 1px; font-size: 9px; color: var(--muted); }
</style>
