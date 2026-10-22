<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { renderAsync } from 'docx-preview'
import { readStored } from '../lib/pdf.js'

// 데모 전용: 워드→PDF 변환기가 없는 데모에서 올린 .docx 를 브라우저에서 바로 쪽 단위로 그린다(docx-preview).
// 워드와 아주 같지는 않다. 사내 서버는 워드로 만든 PDF 를 보여 준다.
// 쪽마다 data-pdf-page 를 달아 PDF 쪽과 같은 방식(위치 비율)으로 문장·영역 요청을 단다.
const props = defineProps({ src: String, anchors: { type: Array, default: () => [] }, activeId: String, areaMode: Boolean })
const emit = defineEmits(['area', 'pick', 'text', 'pages', 'error'])
const host = ref(null)
const secs = shallowRef([])
const drag = ref(null) // { page, x0, y0, x1, y1 }
let dragSec = null // 끌고 있는 쪽 요소 (반응형에 넣지 않는다)

async function render() {
  try {
    const blob = await readStored(props.src)
    if (!blob) throw new Error('no file')
    host.value.replaceChildren()
    await renderAsync(blob, host.value, undefined, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, experimental: true, className: 'docx' })
    const list = [...host.value.querySelectorAll('section.docx')]
    list.forEach((s, i) => {
      s.dataset.page = i + 1
      s.setAttribute('data-pdf-page', '')
      s.id = 'page-' + (i + 1)
      s.addEventListener('pointerdown', e => down(e, s, i + 1))
      emit('text', { no: i + 1, text: s.innerText })
    })
    secs.value = list
    emit('pages', list.length)
    fit()
  } catch {
    emit('error')
  }
}
// 쪽 너비(워드 용지)를 미리보기 칸에 맞춘다
function fit() {
  const first = secs.value[0]
  if (!first || !host.value) return
  host.value.style.zoom = ''
  const w = host.value.parentElement.clientWidth
  host.value.style.zoom = Math.min(1, w / first.offsetWidth)
}
let ro = null
onMounted(() => {
  render()
  ro = new ResizeObserver(fit)
  ro.observe(host.value.parentElement)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => props.src, render)

const on = no => props.anchors.filter(r => r.page === no)
const markCls = r => ['k-' + r.kind, 's-' + r.status, { active: r.id === props.activeId }]
const pct = rc => ({ left: rc.x * 100 + '%', top: rc.y * 100 + '%', width: rc.w * 100 + '%', height: rc.h * 100 + '%' })

function pt(e, sec) {
  const b = sec.getBoundingClientRect()
  return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }
}
function down(e, sec, page) {
  if (!props.areaMode) return
  e.preventDefault()
  const p = pt(e, sec)
  dragSec = sec
  drag.value = { page, x0: p.x, y0: p.y, x1: p.x, y1: p.y }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}
function move(e) {
  if (!drag.value) return
  const p = pt(e, dragSec)
  drag.value = { ...drag.value, x1: p.x, y1: p.y }
}
function up() {
  window.removeEventListener('pointermove', move)
  const d = drag.value
  drag.value = null
  if (!d) return
  const rect = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }
  if (rect.w > 0.03 && rect.h > 0.02) emit('area', { page: d.page, rect })
}
const box = d => ({ left: Math.min(d.x0, d.x1) * 100 + '%', top: Math.min(d.y0, d.y1) * 100 + '%', width: Math.abs(d.x1 - d.x0) * 100 + '%', height: Math.abs(d.y1 - d.y0) * 100 + '%' })
</script>

<template>
  <div class="docx-view" :class="{ picking: areaMode }">
    <div ref="host" class="host"></div>
    <Teleport v-for="(s, i) in secs" :key="src + i" :to="s">
      <template v-for="r in on(i + 1)" :key="r.id">
        <template v-if="r.anchor?.type === 'text' && r.anchor.rects">
          <button v-for="(rc, k) in r.anchor.rects" :key="k" class="text-mark" :class="markCls(r)" :style="pct(rc)" :data-req="k === 0 ? r.id : null"
            :aria-label="'#' + r.no + ' ' + (r.title || '메모')" @click.stop="emit('pick', r.id)"></button>
        </template>
        <button v-else-if="r.anchor?.type === 'area'" class="area-mark" :class="markCls(r)" :style="pct(r.anchor.rect)" :data-req="r.id"
          :aria-label="'#' + r.no + ' ' + (r.title || '메모')" @click.stop="emit('pick', r.id)"><span class="num">#{{ r.no }}</span></button>
      </template>
      <div v-if="drag && drag.page === i + 1" class="drag" :style="box(drag)"></div>
    </Teleport>
  </div>
</template>

<style scoped>
.docx-view { min-width: 0; }
.host :deep(section.docx) { position: relative; background: #fff; margin: 0 auto 20px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06); }
.picking .host :deep(section.docx) { cursor: crosshair; user-select: none; touch-action: none; }
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
</style>
