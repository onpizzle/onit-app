/* ONIT Global Command + Search v1.0 */
(function(){
'use strict';
const VERSION='1.0.0';let overlay,input,results,items=[],active=0;
function esc(v){return typeof escapeHTML==='function'?escapeHTML(v):String(v||'')}
function authority(name,fallback=false){try{return window.ONITAuthority?ONITAuthority.allowed(name,fallback):!!fallback}catch(e){return !!fallback}}
function close(){if(overlay)overlay.classList.add('hidden')}
function open(seed=''){if(!overlay)mount();overlay.classList.remove('hidden');input.value=seed;active=0;render();setTimeout(()=>input.focus(),20)}
function run(item){close();try{item.run()}catch(e){console.warn('ONIT command',e)}}
function commands(){
 const out=[
  {group:'Go to',icon:'⌂',title:'Home',sub:'Action Centre and work health',type:'PAGE',keys:'home radar dashboard',run:()=>show('home')},
  {group:'Go to',icon:'B',title:'Briefs / Approval',sub:'Search work and approvals',type:'PAGE',keys:'brief work approval',run:()=>show('briefs')},
  {group:'Go to',icon:'T',title:'Team',sub:'Live workload and capacity',type:'PAGE',keys:'team capacity people',run:()=>show('team')},
  {group:'Go to',icon:'M',title:'Memory',sub:'Search organisational memory',type:'PAGE',keys:'memory history archive knowledge',run:()=>show('memory')},
  {group:'Go to',icon:'P',title:'Digital Pulse',sub:'Digital Strategy operations',type:'PAGE',keys:'digital pulse social',run:()=>show('pulse')},
  {group:'Go to',icon:'C',title:'Cases',sub:'Case studies and evidence',type:'PAGE',keys:'cases casemode evidence',run:()=>show('cases')},
  {group:'Go to',icon:'⚙',title:'Settings',sub:'Profile, access and System Health',type:'PAGE',keys:'settings health autocare profile',run:()=>show('more')}
 ];
 if(authority('createBrief',typeof canCreateBrief==='function'&&canCreateBrief()))out.unshift({group:'Quick actions',icon:'+',title:'New Brief',sub:'Create and send a new brief',type:'ACTION',keys:'new create send brief',run:()=>openNew()});
 if(authority('trafficManager',typeof isTrafficManagerUser==='function'&&isTrafficManagerUser())&&typeof openTrafficManager==='function')out.unshift({group:'Quick actions',icon:'↔',title:'Open Traffic Control',sub:'Queue, schedule and release work',type:'ACTION',keys:'traffic schedule queue',run:()=>openTrafficManager()});
 if(window.AutoCare)out.push({group:'Quick actions',icon:'✓',title:'System Health',sub:'Open AutoCare diagnostics',type:'ACTION',keys:'system health autocare diagnostics repair',run:()=>{show('more');setTimeout(()=>window.openAutoCareHealth?.(),80)}});
 return out;
}
function dataItems(){
 const out=[];
 ((typeof briefs!=='undefined'&&briefs)||[]).forEach(b=>out.push({group:'Briefs',icon:(b.client||'B').charAt(0).toUpperCase(),title:`${b.client||'Brief'} — ${b.project||b.code}`,sub:`${b.code||''} • ${b.status||''} • ${b.assignee||'Unassigned'}`,type:'BRIEF',keys:[b.code,b.client,b.project,b.status,b.assignee].join(' '),run:()=>detail(b.code)}));
 ((typeof users!=='undefined'&&users)||[]).forEach(u=>{const name=typeof rowVal==='function'?rowVal(u,'Full Name','fullName'):u['Full Name'];const id=typeof rowVal==='function'?rowVal(u,'User ID','userId'):u['User ID'];const dep=typeof departmentOf==='function'?departmentOf(u):u.Department;const pos=typeof positionOf==='function'?positionOf(u):u.Position;out.push({group:'People',icon:(name||'P').charAt(0).toUpperCase(),title:name||'Team member',sub:[pos,dep].filter(Boolean).join(' • '),type:'PERSON',keys:[name,pos,dep].join(' '),run:()=>show('team')})});
 ((typeof clients!=='undefined'&&clients)||[]).forEach(c=>{const name=typeof rowVal==='function'?(rowVal(c,'Client Name','Name','Brand')||rowVal(c,'Account Name')):(c.Name||c.Brand);if(name)out.push({group:'Clients',icon:name.charAt(0).toUpperCase(),title:name,sub:'Client / brand',type:'CLIENT',keys:name,run:()=>{show('briefs');const s=document.getElementById('briefSearch');if(s){s.value=name;renderBriefs()}}})});
 return out;
}
function build(q){const query=String(q||'').trim().toLowerCase(),all=[...commands(),...dataItems()];if(!query)return all.slice(0,12);return all.map(x=>{const hay=(x.title+' '+x.sub+' '+x.keys).toLowerCase();let score=0;if(x.title.toLowerCase().startsWith(query))score+=30;if(x.title.toLowerCase().includes(query))score+=18;if(hay.includes(query))score+=8;query.split(/\s+/).forEach(t=>{if(t&&hay.includes(t))score+=2});return{x,score}}).filter(y=>y.score>0).sort((a,b)=>b.score-a.score).slice(0,24).map(y=>y.x)}
function render(){items=build(input?.value||'');active=Math.min(active,Math.max(0,items.length-1));if(!results)return;let group='';results.innerHTML=items.length?items.map((x,i)=>{let h='';if(x.group!==group){group=x.group;h=`<div class="onitCommandGroup">${esc(group)}</div>`}return h+`<button class="onitCommandItem ${i===active?'active':''}" data-i="${i}"><span class="onitCommandIcon">${esc(x.icon)}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub||'')}</small></span><span class="onitCommandType">${esc(x.type)}</span></button>`}).join(''):`<div class="onitCommandEmpty">No ONIT result matches that search.</div>`;results.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>run(items[Number(b.dataset.i)])))}
function key(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();overlay&&!overlay.classList.contains('hidden')?close():open();return}if(!overlay||overlay.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(items.length-1,active+1);render()}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);render()}else if(e.key==='Enter'&&items[active]){e.preventDefault();run(items[active])}}
function mount(){
 overlay=document.createElement('div');overlay.className='onitCommandOverlay hidden';overlay.innerHTML=`<div class="onitCommandBox" role="dialog" aria-modal="true" aria-label="Search ONIT"><div class="onitCommandInputWrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input class="onitCommandInput" placeholder="Search briefs, people, clients or commands…" autocomplete="off"><span class="onitCommandEsc">ESC</span></div><div class="onitCommandResults"></div></div>`;document.body.appendChild(overlay);input=overlay.querySelector('input');results=overlay.querySelector('.onitCommandResults');input.addEventListener('input',()=>{active=0;render()});overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 const top=document.querySelector('.top');if(top&&!document.getElementById('onitCommandTrigger')){const btn=document.createElement('button');btn.id='onitCommandTrigger';btn.className='onitCommandTrigger';btn.type='button';btn.innerHTML='<span>Search ONIT…</span><kbd>⌘K</kbd>';btn.addEventListener('click',()=>open());top.insertBefore(btn,top.firstChild)}
 const host=document.querySelector('.top .userwrap');if(host&&!document.getElementById('onitEnvBadge')){const badge=document.createElement('span');badge.id='onitEnvBadge';badge.className='onitEnvBadge';const staging=/test|staging|preview/i.test(location.hostname);if(staging){badge.textContent='STAGING';badge.classList.add('show')}host.insertBefore(badge,host.firstChild)}
}
document.addEventListener('keydown',key);document.addEventListener('DOMContentLoaded',mount,{once:true});window.ONITCommand={version:VERSION,open,close};
})();
