<template>
  <div class="radial-host" :style="hostStyle">
    <button ref="rootEl" class="radial-root" type="button" :aria-expanded="open" aria-label="打开径向菜单" @mousedown.stop="$emit('root-mousedown', $event)" @click.stop="toggleOpen">
      <span v-for="n in 4" :key="n" class="radial-root-dot" />
    </button>
    <Teleport to="body">
      <div v-if="open" class="radial-overlay" @mousedown.self="close">
        <svg class="radial-svg" :viewBox="`0 0 ${viewport.w} ${viewport.h}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="ot-radial-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
          </defs>
          <path v-if="activeParent" :d="sectorPath" :fill="rgba(activeParent.color,.10)" :stroke="rgba(activeParent.color,.48)" stroke-width="1" filter="url(#ot-radial-blur)" />
          <path v-if="activeParent" :d="tunnelPath" fill="transparent" stroke="transparent" :stroke-width="tunnelWidth" stroke-linecap="round" pointer-events="stroke" @mouseenter="cancelClose" @mouseleave="scheduleClose" />
        </svg>
        <div class="radial-layer">
          <button v-for="item in items" :key="item.id" class="radial-l2" :class="{active: activeId === item.id}" :style="buttonStyle(item.position,48,item.color,item.id)" type="button" @mouseenter="activate(item.id)" @mouseleave="scheduleClose" @focus="activate(item.id)" @click.stop="clickItem(item)">
            <span class="radial-icon" v-html="item.icon" />
            <span class="radial-tip">{{ item.label }}</span>
          </button>
          <button v-for="child in children" :key="child.id" class="radial-l3" :style="buttonStyle(child.position,42,child.color,child.id)" type="button" @mouseenter="cancelClose" @mouseleave="scheduleClose" @click.stop="clickChild(child)">
            <span class="radial-icon" v-html="child.icon" />
            <span class="radial-tip">{{ child.label }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Point={x:number;y:number};
type Child={id:string;label:string;icon:string;color:string;action:string};
type Item={id:string;label:string;icon:string;color:string;action:string;children?:Child[]};
type Positioned<T>=T&{position:Point;angle:number};

const props=withDefaults(defineProps<{
  open:boolean; position:'left'|'right'; offsetY:number|null; activeScope:'smart'|'full'; activeService:string;
  services:Array<{value:string;label:string}>; pdfSource?:string;
}>(),{pdfSource:''});
const emit=defineEmits<{
  (e:'update:open',v:boolean):void;(e:'root-mousedown',v:MouseEvent):void;(e:'toggle-scope'):void;
  (e:'select-service',v:string):void;(e:'open-reading'):void;(e:'open-settings'):void;(e:'open-pdf'):void;(e:'action',a:string,id:string):void;
}>();

const R2=94,R3=78,TANGENT=48,TUNNEL=58;
const viewport=ref({w:window.innerWidth,h:window.innerHeight});
const center=ref<Point>({x:window.innerWidth-32,y:window.innerHeight-102});
const rootEl=ref<HTMLElement|null>(null);const activeId=ref<string|null>(null);let closeTimer:number|null=null;let raf=0;
const targets=ref<Record<string,Point>>({});const positions=ref<Record<string,Point>>({});const velocity=new Map<string,Point>();
const svg=(body:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const data:Item[]=[
 {id:'read',label:'朗读工具',color:'#a855f7',action:'reading',icon:svg('<path d="M4 5h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5z"/>'),children:[
  {id:'reading',label:'打开阅读器',color:'#a855f7',action:'reading',icon:svg('<path d="M4 5h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5z"/>')},
  {id:'tts-play',label:'朗读',color:'#c084fc',action:'tts-play',icon:svg('<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9a5 5 0 0 1 0 6"/>')},
  {id:'tts-stop',label:'停止朗读',color:'#ef4444',action:'tts-stop',icon:svg('<path d="M7 7h10v10H7z"/>')}]},
 {id:'web',label:'网页工具',color:'#06b6d4',action:'web',icon:svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/>'),children:[
  {id:'scope',label:'翻译范围',color:'#06b6d4',action:'scope',icon:svg('<path d="M4 6h16M7 10h10M10 14h4M12 14v6"/>')},
  {id:'service',label:'翻译服务',color:'#22d3ee',action:'service',icon:svg('<path d="M5 6h14M8 3v3M8 11h8M12 11v10"/>')},
  {id:'settings',label:'更多设置',color:'#0891b2',action:'settings',icon:svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l1.4-1.1-2-2-1.1 1.4A7 7 0 0 0 15.6 8L15 6h-3l-.6 2a7 7 0 0 0-1.5.7L8.8 7.3l-2 2 1.4 1.1A7 7 0 0 0 8 12c0 .6.1 1.1.2 1.6l-1.4 1.1 2 2 1.1-1.4c.5.3 1 .5 1.5.7l.6 2h3l.6-2a7 7 0 0 0 1.5-.7l1.1 1.4 2-2-1.4-1.1c.2-.5.2-1 .2-1.6z"/>')}]},
 {id:'book',label:'打开书本',color:'#3b82f6',action:'reading',icon:svg('<path d="M4 5h6a2 2 0 0 1 2 2v13a3 3 0 0 0-3-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v13a3 3 0 0 1 3-2h5z"/>')},
 {id:'edit',label:'知识工具',color:'#f59e0b',action:'settings',icon:svg('<path d="M4 20h4L19 9l-4-4L4 16zM13 6l4 4"/>')},
 {id:'note',label:'笔记列表',color:'#10b981',action:'settings',icon:svg('<path d="M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h5"/>')}
];

const hostStyle=computed(()=>({position:'fixed',left:props.position==='left'?'18px':'auto',right:props.position==='right'?'18px':'auto',top:props.offsetY==null?'auto':`${props.offsetY+7}px`,bottom:props.offsetY==null?'102px':'auto',zIndex:10002}));
const items=computed<Positioned<Item>[]>(()=>{const n=data.length,inward=props.position==='right'?270:90,spread=Math.min(300,Math.max(220,(n-1)*58));return data.map((x,i)=>{const a=(inward-spread/2+(n===1?0:i/(n-1)*spread))*Math.PI/180;return {...x,angle:a,position:polar(a,R2)};});});
const active=computed(()=>items.value.find(x=>x.id===activeId.value)||null);
const children=computed<Positioned<Child>[]>(()=>{if(!active.value?.children)return[];const ray=unit(active.value.position),tan={x:-ray.y,y:ray.x},m=(active.value.children.length-1)/2;return active.value.children.map((x,i)=>{const off=(i-m)*TANGENT;return {...x,angle:active.value!.angle,position:{x:active.value!.position.x+ray.x*R3+tan.x*off,y:active.value!.position.y+ray.y*R3+tan.y*off}};});});
const activeParent=active;
const tunnelWidth=TUNNEL;
const rgba=(hex:string,a:number)=>{const h=hex.slice(1);const v=h.length===3?h.split('').map(x=>x+x).join(''):h;return`rgba(${parseInt(v.slice(0,2),16)},${parseInt(v.slice(2,4),16)},${parseInt(v.slice(4,6),16)},${a})`;};
const polar=(a:number,r:number):Point=>({x:Math.sin(a)*r,y:-Math.cos(a)*r});
const unit=(p:Point)=>{const l=Math.hypot(p.x,p.y)||1;return{x:p.x/l,y:p.y/l};};
const sectorPath=computed(()=>{if(!active.value)return'';const a=active.value.angle,s=Math.min(.78,Math.max(.3,(active.value.children?.length||1)*.24)),ir=R2-32,or=R2+R3+36,p0=polar(a-s,ir),p1=polar(a-s,or),p2=polar(a+s,or),p3=polar(a+s,ir),c=center.value;return`M${c.x+p0.x} ${c.y+p0.y}L${c.x+p1.x} ${c.y+p1.y}A${or} ${or} 0 0 1 ${c.x+p2.x} ${c.y+p2.y}L${c.x+p3.x} ${c.y+p3.y}A${ir} ${ir} 0 0 0 ${c.x+p0.x} ${c.y+p0.y}Z`;});
const tunnelPath=computed(()=>{if(!active.value)return'';const ray=unit(active.value.position),tan={x:-ray.y,y:ray.x},half=Math.max(34,((active.value.children?.length||1)-1)*TANGENT/2+24),s={x:center.value.x+active.value.position.x+ray.x*4,y:center.value.y+active.value.position.y+ray.y*4},e={x:center.value.x+active.value.position.x+ray.x*(R3+20),y:center.value.y+active.value.position.y+ray.y*(R3+20)},a={x:s.x+tan.x*half,y:s.y+tan.y*half},b={x:s.x-tan.x*half,y:s.y-tan.y*half},c={x:e.x+tan.x*half,y:e.y+tan.y*half},d={x:e.x-tan.x*half,y:e.y-tan.y*half};return`M${a.x} ${a.y}L${c.x} ${c.y}Q${e.x} ${e.y} ${d.x} ${d.y}L${b.x} ${b.y}Q${s.x} ${s.y} ${a.x} ${a.y}Z`;});
const buttonStyle=(p:Point,size:number,color:string,id:string)=>{const q=positions.value[id]||p;return{left:`${center.value.x+q.x-size/2}px`,top:`${center.value.y+q.y-size/2}px`,width:`${size}px`,height:`${size}px`,'--radial-color':color};};
function measure(){viewport.value={w:innerWidth,h:innerHeight};const r=rootEl.value?.getBoundingClientRect();if(r)center.value={x:r.left+r.width/2,y:r.top+r.height/2};}
function activate(id:string){cancelClose();if(activeId.value!==id){activeId.value=id;nextTick(()=>spring());}}
function scheduleClose(){cancelClose();closeTimer=window.setTimeout(()=>activeId.value=null,180);}
function cancelClose(){if(closeTimer!=null){clearTimeout(closeTimer);closeTimer=null;}}
function toggleOpen(){cancelClose();emit('update:open',!props.open);}
function close(){activeId.value=null;emit('update:open',false);}
function clickItem(item:Positioned<Item>){if(item.children?.length){activate(item.id);return;}dispatch(item.action,item.id);}
function clickChild(item:Positioned<Child>){dispatch(item.action,item.id);}
function dispatch(action:string,id:string){if(action==='scope'){emit('toggle-scope');}else if(action==='service'){const i=props.services.findIndex(x=>x.value===props.activeService);emit('select-service',props.services[(i+1+props.services.length)%Math.max(1,props.services.length)]?.value||props.activeService);}else if(action==='reading'){props.pdfSource?emit('open-pdf'):emit('open-reading');}else if(action==='settings'){emit('open-settings');}else emit('action',action,id);close();}
function spring(){const next:Record<string,Point>={};items.value.forEach(x=>next[x.id]=x.position);children.value.forEach(x=>next[x.id]=x.position);targets.value=next;Object.keys(next).forEach(k=>{positions.value[k]??={...next[k]};velocity.has(k)||velocity.set(k,{x:0,y:0});});if(!raf)raf=requestAnimationFrame(step);}
function step(){let moving=false;for(const [k,g] of Object.entries(targets.value)){const p=positions.value[k]||(positions.value[k]={...g}),v=velocity.get(k)||{x:0,y:0};v.x+=(g.x-p.x)*.16-v.x*.72;v.y+=(g.y-p.y)*.16-v.y*.72;p.x+=v.x;p.y+=v.y;velocity.set(k,v);if(Math.abs(g.x-p.x)>.35||Math.abs(g.y-p.y)>.35||Math.abs(v.x)>.25||Math.abs(v.y)>.25)moving=true;}raf=moving?requestAnimationFrame(step):0;}
watch(()=>props.open,v=>{if(v)nextTick(()=>{measure();spring();});else activeId.value=null;});watch(activeId,()=>nextTick(spring));
onMounted(()=>{measure();addEventListener('resize',measure,{passive:true});addEventListener('scroll',measure,{passive:true});});onBeforeUnmount(()=>{cancelClose();removeEventListener('resize',measure);removeEventListener('scroll',measure);if(raf)cancelAnimationFrame(raf);});
</script>

<style scoped>
.radial-host{display:contents}.radial-root{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid #d8e2ee;border-radius:50%;color:#4c586d;background:rgba(255,255,255,.96);box-shadow:0 8px 20px rgba(23,32,51,.1);cursor:pointer;transition:.18s ease}.radial-root:hover,.radial-root[aria-expanded=true]{border-color:#8acaf2;color:#258ed8;box-shadow:0 0 24px rgba(91,181,245,.28);transform:translateY(-1px)}.radial-root-dot{width:5px;height:5px;border-radius:1.5px;background:currentColor}.radial-root{grid-template-columns:repeat(2,5px);gap:2px}.radial-overlay{position:fixed;inset:0;z-index:10001;pointer-events:none}.radial-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.radial-svg path:nth-child(2){pointer-events:stroke}.radial-layer{position:absolute;inset:0;pointer-events:none}.radial-l2,.radial-l3{position:absolute;display:grid;place-items:center;padding:0;border-radius:50%;cursor:pointer;pointer-events:auto;transform-origin:center;color:var(--radial-color);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.radial-l2{border:1px solid rgba(255,255,255,.35);background:rgba(30,41,59,.94);box-shadow:0 10px 28px rgba(23,32,51,.16);backdrop-filter:blur(12px)}.radial-l3{border:2px solid var(--radial-color);background:rgba(255,255,255,.98);box-shadow:0 10px 28px rgba(23,32,51,.16);color:#172033}.radial-l2:hover,.radial-l2.active{transform:scale(1.08);border-color:var(--radial-color);box-shadow:0 0 24px color-mix(in srgb,var(--radial-color) 48%,transparent)}.radial-l3:hover{transform:scale(1.08);box-shadow:0 0 24px color-mix(in srgb,var(--radial-color) 60%,transparent)}.radial-icon{display:grid;place-items:center;width:20px;height:20px}.radial-icon :deep(svg){width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.radial-tip{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translate(-50%,4px);padding:4px 8px;border-radius:999px;color:#172033;background:rgba(255,255,255,.96);box-shadow:0 8px 22px rgba(23,32,51,.15);font-size:11px;font-weight:650;white-space:nowrap;opacity:0;pointer-events:none;transition:.15s ease}.radial-l2:hover .radial-tip,.radial-l3:hover .radial-tip{opacity:1;transform:translate(-50%,0)}@media(prefers-reduced-motion:reduce){.radial-root,.radial-l2,.radial-l3,.radial-tip{transition:none}}
</style>
