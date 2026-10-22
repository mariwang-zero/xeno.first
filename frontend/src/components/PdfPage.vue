<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { pdfLib } from '../lib/pdf.js'

// PDF 한 쪽. 워드에서 만든 PDF 를 그대로 그리고, 그 위에 글자 층(드래그 선택용)과 요청 표시를 얹는다.
// 문장 요청은 선택한 줄들의 위치(rects, 쪽 크기에 대한 비율)로, 영역 요청은 DocPage 와 같은 rect 로 표시한다.
const props = defineProps({ pdf: { type: Object, required: true }, no: Number, anchors: { type: Array, default: () => [] }, activeId: String, areaMode: Boolean })
const emit = defineEmits(['area', 'pick', 'text'])
const el = ref(null)
const canvas = ref(null)
const layer = ref(null)
const ratio = ref(1.414)
const drag = ref(null)
let page = null
let shownWidth = 0
let busy = null
let io = null
let ro = null

async function draw() {
  const w = el.value?.clientWidth
  if (!page || !w || Math.abs(w - shownWidth) < 2) return
  if (busy) { busy.cancel(); busy = null }
  shownWidth = w
  const lib = await pdfLib()
  const base = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: w / base.width })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const c = canvas.value
  c.width = Math.floor(vp.width * dpr)
  c.height = Math.floor(vp.height * dpr)
  busy = page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null })
  try { await busy.promise } catch { return } finally { busy = null }
  el.value.style.setProperty('--scale-factor', vp.scale)
  el.value.style.setProperty('--total-scale-factor', vp.scale)
  layer.value.replaceChildren()
  await new lib.TextLayer({ textContentSource: page.streamTextContent(), container: layer.value, viewport: vp }).render()
}

onMounted(async () => {
  page = await props.pdf.getPage(props.no)
  const v = page.getViewport({ scale: 1 })
  ratio.value = v.height / v.width
  page.getTextContent().then(t => emit('text', { no: props.no, text: t.items.map(i => i.str).join(' ') }))
  // 화면 가까이 왔을 때만 그린다 (쪽이 많아도 가볍게)
  io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) draw() }, { rootMargin: '600px 0px' })
  io.observe(el.value)
  ro = new ResizeObserver(() => { if (shownWidth) draw() })
  ro.observe(el.value)
})
onBeforeUnmount(() => { io?.disconnect(); ro?.disconnect(); busy?.cancel() })
watch(() => props.pdf, () => { shownWidth = 0 })

const texts = () => props.anchors.filter(r => r.anchor?.type === 'text' && r.anchor.rects?.length)
const areas = () => props.anchors.filter(r => r.anchor?.type === 'area')
const markCls = r => ['k-' + r.kind, 's-' + r.status, { active: r.id === props.activeId }]
const pct = rc => ({ left: rc.x * 100 + '%', top: rc.y * 100 + '%', width: rc.w * 100 + '%', height: rc.h * 100 + '%' })

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
  if (rect.w > 0.03 && rect.h > 0.02) emit('area', { page: props.no, rect })
}
const box = d => ({ left: Math.min(d.x0, d.x1) * 100 + '%', top: Math.min(d.y0, d.y1) * 100 + '%', width: Math.abs(d.x1 - d.x0) * 100 + '%', height: Math.abs(d.y1 - d.y0) * 100 + '%' })
</script>

<template>
  <section class="sheet" :class="{ picking: areaMode }" ref="el" :data-page="no" data-pdf-page :id="'page-' + no" :style="{ aspectRatio: '1 / ' + ratio }"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="drag = null">
    <canvas ref="canvas"></canvas>
    <div ref="layer" class="textLayer"></div>
    <template v-for="r in texts()" :key="r.id">
      <button v-for="(rc, i) in r.anchor.rects" :key="i" class="text-mark" :class="markCls(r)" :style="pct(rc)" :data-req="i === 0 ? r.id : null"
        :aria-label="'#' + r.no + ' ' + (r.title || '메모')" @click.stop="emit('pick', r.id)"></button>
    </template>
    <button v-for="r in areas()" :key="r.id" class="area-mark" :class="markCls(r)" :style="pct(r.anchor.rect)" :data-req="r.id"
      :aria-label="'#' + r.no + ' ' + (r.title || '메모')" @click.stop="emit('pick', r.id)"><span class="num">#{{ r.no }}</span></button>
    <div v-if="drag" class="drag" :style="box(drag)"></div>
  </section>
</template>

<style scoped>
.sheet { position: relative; width: 100%; background: #fff; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06); overflow: hidden; user-select: text; }
.sheet canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.sheet.picking { cursor: crosshair; user-select: none; touch-action: none; }
.sheet.picking > *:not(.drag):not(.area-mark) { pointer-events: none; }
.text-mark { position: absolute; z-index: 3; padding: 0; border: 0; border-bottom: 2px solid #d08a12; background: rgba(208, 138, 18, .12); cursor: pointer; }
.text-mark.s-checking { border-bottom-color: #2d6fd0; background: rgba(45, 111, 208, .12); }
.text-mark.s-done { border-bottom-color: #1f8a5c; background: rgba(31, 138, 92, .12); }
.text-mark.s-closed { border-bottom-color: #b9bcc6; background: transparent; }
.text-mark.k-memo { border-bottom-style: dotted; border-bottom-color: #7a5fd0; background: rgba(122, 95, 208, .1); }
.text-mark.k-ai { border-bottom-style: dashed; border-bottom-color: #7a8090; background: rgba(122, 128, 144, .1); }
.text-mark.active { background: rgba(255, 210, 80, .45); }
.area-mark { position: absolute; z-index: 3; border: 2px solid #d08a12; background: rgba(208, 138, 18, .08); border-radius: 3px; padding: 0; cursor: pointer; font: inherit; }
.area-mark.s-checking { border-color: #2d6fd0; background: rgba(45, 111, 208, .08); }
.area-mark.s-done { border-color: #1f8a5c; background: rgba(31, 138, 92, .08); }
.area-mark.s-closed { border-color: #b9bcc6; background: transparent; }
.area-mark.active { box-shadow: 0 0 0 4px rgba(255, 210, 80, .6); }
.area-mark span { position: absolute; top: -1px; left: -1px; font-size: 11px; padding: 0 4px; color: #333; background: #fff; border-radius: 0 0 3px 0; }
.drag { position: absolute; z-index: 4; border: 2px dashed #2b4ea6; background: rgba(43, 78, 166, .1); pointer-events: none; }

/* pdf.js 글자 층 (pdf_viewer.css 에서 필요한 부분만) */
.textLayer { position: absolute; text-align: initial; inset: 0; overflow: clip; opacity: 1; line-height: 1; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; caret-color: CanvasText; z-index: 2; }
.textLayer :deep(:is(span, br)) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.textLayer :deep(span.markedContent) { top: 0; height: 0; }
.textLayer :deep(.endOfContent) { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }
.textLayer:global(.selecting) :deep(.endOfContent) { top: 0; }
.textLayer :deep(::selection) { background: rgba(0, 90, 255, .25); }
.textLayer :deep(br::selection) { background: transparent; }
</style>
