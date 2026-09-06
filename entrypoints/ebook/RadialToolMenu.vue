<template>
  <div
    ref="root"
    class="ot-radial"
    :class="{ 'ot-radial--open': isOpen, 'ot-radial--l3': activeToolId }"
    :style="rootStyle"
    @pointerdown.stop
  >
    <svg class="ot-radial__svg" :viewBox="`0 0 ${canvasSize} ${canvasSize}`" aria-hidden="true">
      <defs>
        <filter id="ot-radial-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="ot-radial-spectrum" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#60a5fa" /><stop offset=".48" stop-color="#a855f7" /><stop offset="1" stop-color="#ec4899" />
        </linearGradient>
      </defs>
      <circle :cx="center" :cy="center" r="l2Radius" class="ot-radial__orbit" />
      <circle :cx="center" :cy="center" r="l2Radius + 11" class="ot-radial__orbit ot-radial__orbit--outer" />
      <g v-if="activeTool" class="ot-radial__arc" :style="{ '--accent': activeTool.color }">
        <path :d="arcPath" class="ot-radial__arc-fill" />
        <path :d="arcGuidePath" class="ot-radial__arc-guide" />
      </g>
    </svg>

    <button
      class="ot-radial__core"
      type="button"
      :aria-expanded="isOpen"
      aria-label="工具"
      @click="toggleOpen"
    >
      <span class="ot-radial__core-icon">{{ isOpen ? '×' : '🛠' }}</span>
      <span class="ot-radial__core-label">工具</span>
    </button>

    <button
      v-for="item in tools"
      :key="item.id"
      class="ot-radial__node"
      :class="{ 'is-active': activeToolId === item.id }"
      :style="nodeStyle(item)"
      type="button"
      :aria-label="item.label"
      @pointerenter="showTip(item.label, $event)"
      @pointerleave="hideTip"
      @click="selectTool(item)"
    >
      <span aria-hidden="true">{{ item.icon }}</span>
    </button>

    <div v-if="activeTool" class="ot-radial__l3" :style="l3Style">
      <button
        v-for="(action, index) in activeTool.actions"
        :key="action.id"
        class="ot-radial__action"
        :class="{ 'is-disabled': action.id === 'stop' && !isReading, 'is-reading': action.id === 'play' && isReading }"
        :style="actionStyle(index, activeTool.actions.length)"
        type="button"
        :disabled="action.id === 'stop' && !isReading"
        :aria-label="action.label"
        @pointerenter="showTip(action.label, $event)"
        @pointerleave="hideTip"
        @click="runAction(action)"
      >
        <span aria-hidden="true">{{ action.icon }}</span>
      </button>
    </div>

    <div v-if="tooltip.visible" class="ot-radial__tooltip" :style="tooltipStyle">{{ tooltip.label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

type ToolAction = { id: string; label: string; icon: string };
type Tool = { id: string; label: string; icon: string; color: string; actions: ToolAction[] };

const tools: Tool[] = [
  { id: 'web', label: '网页工具', icon: '🌐', color: '#06b6d4', actions: [
    { id: 'save', label: '保存网页', icon: '💾' }, { id: 'capture', label: '截取屏幕', icon: '▣' },
  ] },
  { id: 'speech', label: '朗读工具', icon: '🔊', color: '#a855f7', actions: [
    { id: 'play', label: '朗读', icon: '▶' }, { id: 'position', label: '从当前位置', icon: '📍' },
    { id: 'selection', label: '朗读选中内容', icon: '📝' }, { id: 'pause', label: '暂停 / 继续', icon: 'Ⅱ' },
    { id: 'stop', label: '停止朗读', icon: '■' }, { id: 'settings', label: '语音设置', icon: '⚙' },
  ] },
  { id: 'note', label: '笔记工具', icon: '📝', color: '#10b981', actions: [
    { id: 'add-note', label: '添加笔记', icon: '＋' }, { id: 'bookmark', label: '添加书签', icon: '☆' },
  ] },
  { id: 'ai', label: 'AI 工具', icon: '✦', color: '#ec4899', actions: [
    { id: 'summary', label: 'AI 摘要', icon: '✦' }, { id: 'translate', label: 'AI 翻译', icon: '文' },
  ] },
  { id: 'reader', label: '阅读工具', icon: '▤', color: '#3b82f6', actions: [
    { id: 'search', label: '搜索', icon: '⌕' }, { id: 'toc', label: '目录', icon: '☰' },
  ] },
  { id: 'more', label: '更多工具', icon: '•••', color: '#94a3b8', actions: [
    { id: 'more', label: '更多', icon: '•••' },
  ] },
];

const root = ref<HTMLElement>();
const isOpen = ref(false);
const activeToolId = ref<string | null>(null);
const isReading = ref(false);
const anchorAngle = ref(-Math.PI / 2);
const tooltip = reactive({ visible: false, label: '', x: 0, y: 0 });
const center = 330;
const canvasSize = 660;
const l2Radius = 145;
const l3Radius = 238;
const buttonRadius = 36;
let hideTimer: number | undefined;

const activeTool = computed(() => tools.find(tool => tool.id === activeToolId.value) ?? null);
const rootStyle = computed(() => ({ '--accent': activeTool.value?.color ?? '#8b5cf6' }));

function polar(radius: number, angle: number) {
  return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
}
function nodeStyle(item: Tool) {
  const index = tools.indexOf(item);
  const step = (Math.PI * 2) / tools.length;
  const point = polar(l2Radius, -Math.PI / 2 + index * step);
  return { left: `${point.x}px`, top: `${point.y}px`, '--glow': item.color };
}
function toolAngle(item: Tool) {
  const index = tools.indexOf(item);
  return -Math.PI / 2 + index * ((Math.PI * 2) / tools.length);
}

const l3Style = computed(() => {
  const p = polar(l3Radius, anchorAngle.value);
  const x = Math.min(window.innerWidth - 80, Math.max(80, p.x));
  const y = Math.min(window.innerHeight - 80, Math.max(80, p.y));
  return { left: `${x}px`, top: `${y}px` };
});

const arcPath = computed(() => {
  const half = Math.min(0.62, Math.max(0.38, (activeTool.value?.actions.length ?? 4) * 0.075));
  const r1 = 174;
  const r2 = 296;
  const a1 = anchorAngle.value - half;
  const a2 = anchorAngle.value + half;
  const p = (r: number, a: number) => ({ x: center + r * Math.cos(a), y: center + r * Math.sin(a) });
  const A = p(r1, a1), B = p(r2, a1), C = p(r2, a2), D = p(r1, a2);
  return `M ${A.x} ${A.y} L ${B.x} ${B.y} A ${r2} ${r2} 0 0 1 ${C.x} ${C.y} L ${D.x} ${D.y} A ${r1} ${r1} 0 0 0 ${A.x} ${A.y} Z`;
});
const arcGuidePath = computed(() => {
  const a1 = anchorAngle.value - 0.72, a2 = anchorAngle.value + 0.72, r = 305;
  const A = polar(r, a1), B = polar(r, a2);
  return `M ${A.x} ${A.y} A ${r} ${r} 0 0 1 ${B.x} ${B.y}`;
});

function actionStyle(index: number, count: number) {
  const spread = Math.min(1.08, Math.max(0.7, count * 0.16));
  const angle = anchorAngle.value + (index - (count - 1) / 2) * (spread / Math.max(1, count - 1));
  const p = polar(l3Radius, angle);
  return { left: `${p.x}px`, top: `${p.y}px`, '--delay': `${index * 22}ms`, '--glow': activeTool.value?.color ?? '#a855f7' };
}

function toggleOpen() {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) activeToolId.value = null;
}
function selectTool(tool: Tool) {
  activeToolId.value = activeToolId.value === tool.id ? null : tool.id;
  if (activeToolId.value) anchorAngle.value = toolAngle(tool);
}
function runAction(action: ToolAction) {
  if (action.id === 'play' || action.id === 'position' || action.id === 'selection') startReading();
  else if (action.id === 'pause') togglePause();
  else if (action.id === 'stop') stopReading();
  else if (action.id === 'settings') window.dispatchEvent(new CustomEvent('onlytranslate:ebook:voice-settings'));
  else window.dispatchEvent(new CustomEvent('onlytranslate:ebook:tool-action', { detail: { toolId: activeToolId.value, actionId: action.id } }));
}
function getReaderText(): string {
  const iframe = document.querySelector<HTMLIFrameElement>('.epub-viewer iframe');
  return iframe?.contentDocument?.body?.innerText?.trim() || document.querySelector<HTMLElement>('.epub-viewer')?.innerText?.trim() || '';
}
function startReading() {
  const text = getReaderText();
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 12000));
  utterance.lang = /[\u4e00-\u9fff]/.test(text) ? 'zh-CN' : 'en-US';
  utterance.onstart = () => { isReading.value = true; };
  utterance.onend = () => { isReading.value = false; };
  utterance.onerror = () => { isReading.value = false; };
  speechSynthesis.speak(utterance);
}
function togglePause() {
  if (!speechSynthesis.speaking) return;
  if (speechSynthesis.paused) speechSynthesis.resume(); else speechSynthesis.pause();
}
function stopReading() {
  speechSynthesis.cancel();
  isReading.value = false;
}
function showTip(label: string, event: PointerEvent) {
  window.clearTimeout(hideTimer);
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  tooltip.label = label; tooltip.x = rect.left + rect.width / 2; tooltip.y = rect.top - 10; tooltip.visible = true;
}
function hideTip() {
  hideTimer = window.setTimeout(() => { tooltip.visible = false; }, 90);
}
const tooltipStyle = computed(() => ({ left: `${tooltip.x}px`, top: `${tooltip.y}px` }));

function keepWithinViewport() {
  if (!root.value) return;
  const rect = root.value.getBoundingClientRect();
  const pad = 30;
  const dx = rect.right > window.innerWidth - pad ? -(rect.right - (window.innerWidth - pad)) : rect.left < pad ? pad - rect.left : 0;
  const dy = rect.bottom > window.innerHeight - pad ? -(rect.bottom - (window.innerHeight - pad)) : rect.top < pad ? pad - rect.top : 0;
  root.value.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
}
function onResize() { requestAnimationFrame(keepWithinViewport); }

onMounted(() => {
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('beforeunload', stopReading);
  requestAnimationFrame(keepWithinViewport);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('beforeunload', stopReading);
  stopReading();
});
</script>

<style scoped>
.ot-radial{position:fixed;right:28px;bottom:28px;width:660px;height:660px;z-index:2147483000;pointer-events:none;transform:translate3d(0,0,0);transition:transform .18s ease}.ot-radial>*{pointer-events:auto}.ot-radial__svg{position:absolute;inset:0;width:660px;height:660px;overflow:visible;pointer-events:none}.ot-radial__orbit{fill:none;stroke:#6ea5ff55;stroke-width:2}.ot-radial__orbit--outer{stroke:#6ea5ff22;stroke-dasharray:2 7}.ot-radial__arc-fill{fill:var(--accent);fill-opacity:.13;stroke:var(--accent);stroke-opacity:.75;stroke-width:2;filter:url(#ot-radial-glow)}.ot-radial__arc-guide{fill:none;stroke:url(#ot-radial-spectrum);stroke-width:2.5;stroke-dasharray:8 9;stroke-linecap:round;filter:url(#ot-radial-glow)}
.ot-radial__core{position:absolute;left:276px;top:276px;width:108px;height:108px;border-radius:50%;border:2px solid #ffffff99;color:#fff;background:radial-gradient(circle at 35% 25%,#4d4a8f,#161a32 65%);box-shadow:0 0 18px #8b5cf6,0 0 45px #38bdf877,inset 0 0 25px #ffffff18;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.ot-radial__core:hover{transform:scale(1.06)}.ot-radial__core-icon{font-size:30px}.ot-radial__core-label{font-size:12px;font-weight:800}
.ot-radial__node{position:absolute;width:72px;height:72px;margin:-36px;border-radius:50%;border:2px solid #fff;background:#151a31;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 0 14px var(--glow),0 8px 24px #0007;transition:transform .2s,box-shadow .2s,opacity .2s;opacity:0;transform:scale(.45)}.ot-radial--open .ot-radial__node{opacity:1;transform:scale(1)}.ot-radial__node:hover,.ot-radial__node.is-active{transform:scale(1.16)!important;box-shadow:0 0 28px var(--glow),0 0 50px var(--glow)}
.ot-radial__l3{position:absolute;inset:0;z-index:4;pointer-events:none}.ot-radial__action{position:absolute;width:58px;height:58px;margin:-29px;border-radius:50%;border:1px solid #ffffff66;background:linear-gradient(145deg,#ffffffee,#e9ecffff);color:#182454;font-size:23px;cursor:pointer;box-shadow:0 0 17px var(--glow),0 8px 24px #0007;opacity:0;transform:scale(.45);transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .18s,box-shadow .18s}.ot-radial--l3 .ot-radial__action{opacity:1;transform:scale(1);transition-delay:var(--delay)}.ot-radial__action:hover{transform:scale(1.16);box-shadow:0 0 30px var(--glow),0 8px 28px #0008}.ot-radial__action.is-reading{background:linear-gradient(145deg,#e9d5ff,#c084fc);color:#35105f}.ot-radial__action.is-disabled{opacity:.35!important;filter:grayscale(1);cursor:not-allowed;box-shadow:none}
.ot-radial__tooltip{position:fixed;transform:translate(-50%,-100%);padding:6px 9px;border:1px solid #ffffff33;border-radius:8px;background:#111522f2;color:#fff;font-size:11px;white-space:nowrap;box-shadow:0 8px 24px #0006;pointer-events:none}.ot-radial:not(.ot-radial--open) .ot-radial__orbit{opacity:0;transition:opacity .2s}.ot-radial--open .ot-radial__orbit{opacity:1}
@media (max-width:900px){.ot-radial{right:8px;bottom:8px;transform:scale(.82);transform-origin:bottom right}.ot-radial__tooltip{font-size:10px}}@media (max-width:620px){.ot-radial{transform:scale(.66);transform-origin:bottom right}}
</style>