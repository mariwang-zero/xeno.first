<script setup>
import { ref } from 'vue'

// 문서 미리보기 한 페이지. 요청이 걸린 문장은 밑줄, 영역은 테두리로 표시한다.
// areaMode 일 때는 페이지 위에서 끌어 사각형을 그리고 'area' 로 알린다.
const props = defineProps({ page: Object, anchors: { type: Array, default: () => [] }, activeId: String, areaMode: Boolean })
const emit = defineEmits(['area', 'pick'])
const el = ref(null)
const drag = ref(null)

function segs(text, blockId) {
  const marks = props.anchors
    .filter(r => r.anchor?.type === 'text' && r.anchor.blockId === blockId)
    .map(r => ({ r, i: text.indexOf(r.anchor.quote) }))
    .filter(m => m.i >= 0 && m.r.anchor.quote)
    .sort((a, b) => a.i - b.i)
  const out = []
  let pos = 0
  for (const m of marks) {
    if (m.i < pos) continue
    if (m.i > pos) out.push({ t: text.slice(pos, m.i) })
    out.push({ t: m.r.anchor.quote, r: m.r })
    pos = m.i + m.r.anchor.quote.length
  }
  if (pos < text.length) out.push({ t: text.slice(pos) })
  return out
}
const areas = () => props.anchors.filter(r => r.anchor?.type === 'area')
const markCls = r => ['mark', 'k-' + r.kind, 's-' + r.status, { active: r.id === props.activeId }]

function pt(e) {
  const b = el.value.getBoundingClientRect()
  return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }
}
function down(e) {
  if (!props.areaMode) return
  e.preventDefault()
  el.value.setPointerCapture?.(e.pointerId)
  const p = pt(e)
  drag.value = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
}
function move(e) {
  if (!drag.value) return
  const p = pt(e)
  drag.value.x1 = p.x
  drag.value.y1 = p.y
}
function up() {
  if (!drag.value) return
  const d = drag.value
  drag.value = null
  const rect = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }
  if (rect.w > 0.03 && rect.h > 0.02) emit('area', { page: props.page.no, rect })
}
const box = d => ({ left: Math.min(d.x0, d.x1) * 100 + '%', top: Math.min(d.y0, d.y1) * 100 + '%', width: Math.abs(d.x1 - d.x0) * 100 + '%', height: Math.abs(d.y1 - d.y0) * 100 + '%' })
</script>

<template>
  <section class="paper" :class="{ picking: areaMode }" ref="el" :data-page="page.no" :id="'page-' + page.no"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="drag = null">
    <template v-for="b in page.blocks" :key="b.id">
      <h4 v-if="b.type === 'h'" :data-block="b.id">{{ b.text }}<span v-if="b.cert" class="tag cert">인증 문구</span></h4>
      <p v-else-if="b.type === 'p'" :data-block="b.id"><template v-for="(s, k) in segs(b.text, b.id)" :key="k"><mark v-if="s.r" :class="markCls(s.r)" :data-req="s.r.id" @click.stop="emit('pick', s.r.id)">{{ s.t }}</mark><template v-else>{{ s.t }}</template></template></p>
      <table v-else-if="b.type === 'table'" :data-block="b.id">
        <tr v-for="(row, ri) in b.rows" :key="ri">
          <component :is="ri === 0 ? 'th' : 'td'" v-for="(c, ci) in row" :key="ci"><template v-for="(s, k) in segs(c, b.id)" :key="k"><mark v-if="s.r" :class="markCls(s.r)" :data-req="s.r.id" @click.stop="emit('pick', s.r.id)">{{ s.t }}</mark><template v-else>{{ s.t }}</template></template></component>
        </tr>
      </table>
      <div v-else-if="b.type === 'img'" class="img" :data-block="b.id"><span>이미지 · {{ b.text }}</span></div>
    </template>
    <button v-for="r in areas()" :key="r.id" class="area-mark" :class="markCls(r)" :style="box({ x0: r.anchor.rect.x, y0: r.anchor.rect.y, x1: r.anchor.rect.x + r.anchor.rect.w, y1: r.anchor.rect.y + r.anchor.rect.h })"
      :aria-label="'#' + r.no + ' ' + (r.title || '메모')" @click.stop="emit('pick', r.id)"><span class="num">#{{ r.no }}</span></button>
    <div v-if="drag" class="drag" :style="box(drag)"></div>
    <span class="pno num">{{ page.no }}</span>
  </section>
</template>

<style scoped>
.paper { position: relative; background: #fff; color: #1b1b1b; aspect-ratio: 1 / 1.414; padding: 8% 10%; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06); font-size: 13.5px; line-height: 1.7; display: flex; flex-direction: column; gap: 10px; user-select: text; }
.paper.picking { cursor: crosshair; user-select: none; touch-action: none; }
.paper.picking > *:not(.drag):not(.area-mark) { pointer-events: none; }
h4 { margin: 8px 0 0; font-size: 15px; font-weight: 700; display: flex; gap: 8px; align-items: center; }
p { margin: 0; }
table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
th, td { border: 1px solid #c9ccd3; padding: 4px 8px; text-align: left; }
th { background: #f1f2f5; font-weight: 600; }
.img { flex: 1; min-height: 80px; max-height: 42%; border: 1px dashed #b9bcc6; background: repeating-linear-gradient(45deg, #f6f7f9 0 10px, #eef0f3 10px 20px); display: grid; place-items: center; color: #6b7080; font-size: 12px; border-radius: 3px; }
mark { background: transparent; color: inherit; cursor: pointer; border-radius: 2px; text-decoration: underline 2px; text-underline-offset: 3px; }
mark.s-requested, .area-mark.s-requested { text-decoration-color: #d08a12; }
mark.s-checking, .area-mark.s-checking { text-decoration-color: #2d6fd0; }
mark.s-done, .area-mark.s-done { text-decoration-color: #1f8a5c; }
mark.s-closed { text-decoration-color: #b9bcc6; }
mark.k-memo { text-decoration-style: dotted; text-decoration-color: #7a5fd0; }
mark.k-ai { text-decoration-style: dashed; text-decoration-color: #7a8090; }
mark.active { background: #fff1c2; }
.area-mark { position: absolute; border: 2px solid #d08a12; background: rgba(208, 138, 18, .08); border-radius: 3px; padding: 0; cursor: pointer; font: inherit; }
.area-mark.s-checking { border-color: #2d6fd0; background: rgba(45, 111, 208, .08); }
.area-mark.s-done { border-color: #1f8a5c; background: rgba(31, 138, 92, .08); }
.area-mark.s-closed { border-color: #b9bcc6; background: transparent; }
.area-mark.active { box-shadow: 0 0 0 4px rgba(255, 210, 80, .6); }
.area-mark span { position: absolute; top: -1px; left: -1px; background: inherit; font-size: 11px; padding: 0 4px; color: #333; background: #fff; border-radius: 0 0 3px 0; }
.drag { position: absolute; border: 2px dashed #2b4ea6; background: rgba(43, 78, 166, .1); pointer-events: none; }
.pno { position: absolute; bottom: 3%; left: 0; right: 0; text-align: center; font-size: 11px; color: #8a8f9c; }
.tag.cert { font-size: 10.5px; font-weight: 500; color: #9a5800; border: 1px solid currentColor; padding: 0 5px; border-radius: 3px; }
@media (max-width: 720px) { .paper { font-size: 11.5px; padding: 7% 7%; gap: 6px; } h4 { font-size: 13px; } table { font-size: 11px; } }
</style>
