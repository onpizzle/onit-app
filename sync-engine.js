/* ONIT Unified Sync Engine v1.0 — one render/update coordinator */
(function(){
'use strict';
const VERSION='1.0.0';
const RENDER_DELAY=120;
const FULL_SYNC_COOLDOWN=5000;
let renderTimer=null,fullSyncTimer=null,lastFullSyncAt=0,fullSyncQueued=false;
const pendingSections=new Set();
const stats={renders:0,fullSyncs:0,lastEvent:'',lastEventAt:0,lastFullSyncReason:'',lastFullSyncAt:0};
function visible(id){const el=document.getElementById(id);return !!el&&!el.classList.contains('hidden')}
function dirty(id){try{return !!window.uiDirtySections&&window.uiDirtySections.has(id)}catch(e){return false}}
function renderSection(id){
  if(dirty(id))return;
  try{
    if(id==='home'&&visible('home')&&typeof renderHome==='function')renderHome();
    else if(id==='briefs'&&visible('briefs')&&typeof renderBriefs==='function')renderBriefs();
    else if(id==='archive'&&visible('archive')&&typeof renderArchive==='function')renderArchive();
    else if(id==='memory'&&visible('memory')&&typeof renderMemory==='function')renderMemory(false);
    else if(id==='team'&&visible('team')&&typeof renderTeam==='function')renderTeam();
    else if(id==='detail'&&visible('detail')&&typeof current!=='undefined'&&current&&typeof renderDetail==='function'){current=((typeof briefs!=='undefined'&&briefs)||[]).find(b=>b.code===current.code)||current;renderDetail();}
    stats.renders++;
  }catch(e){console.warn('ONIT Sync render',id,e)}
}
function flush(){renderTimer=null;const list=[...pendingSections];pendingSections.clear();list.forEach(renderSection)}
function requestRender(sections){
  (Array.isArray(sections)?sections:[sections]).filter(Boolean).forEach(s=>pendingSections.add(s));
  clearTimeout(renderTimer);renderTimer=setTimeout(flush,RENDER_DELAY);
}
function canFullSync(){try{return !(typeof mutationBusy!=='undefined'&&mutationBusy)&&(!window.uiDirtySections||window.uiDirtySections.size===0)&&navigator.onLine!==false}catch(e){return true}}
async function runFullSync(reason){
  fullSyncTimer=null;
  if(fullSyncQueued||!canFullSync()){fullSyncQueued=true;fullSyncTimer=setTimeout(()=>{fullSyncQueued=false;runFullSync(reason)},1200);return}
  const now=Date.now();if(now-lastFullSyncAt<FULL_SYNC_COOLDOWN){fullSyncTimer=setTimeout(()=>runFullSync(reason),FULL_SYNC_COOLDOWN-(now-lastFullSyncAt));return}
  if(typeof loadFromGoogle!=='function')return;
  lastFullSyncAt=Date.now();stats.fullSyncs++;stats.lastFullSyncAt=lastFullSyncAt;stats.lastFullSyncReason=String(reason||'state-change');
  try{await loadFromGoogle(false,true)}catch(e){console.warn('ONIT Sync full refresh',e)}
}
function requestFullSync(reason='state-change'){clearTimeout(fullSyncTimer);fullSyncTimer=setTimeout(()=>runFullSync(reason),80)}
function emit(type,payload={}){
  stats.lastEvent=String(type||'');stats.lastEventAt=Date.now();
  switch(type){
    case 'BRIEF_CHANGED':case 'ACTIVITY_CHANGED':requestRender(['home','briefs','archive','memory','detail']);break;
    case 'NOTIFICATIONS_CHANGED':try{renderNotifications();showNextBroadcast()}catch(e){}break;
    case 'TEAM_CHANGED':requestRender(['home','team']);break;
    case 'STATE_CHANGED':requestFullSync(payload.reason||'state-version');break;
    case 'PERMISSIONS_CHANGED':requestFullSync(payload.reason||'permissions');break;
    case 'PULSE_CHANGED':try{if(visible('pulse')&&window.DigitalPulse?.refresh)window.DigitalPulse.refresh()}catch(e){}break;
    default:if(payload.sections)requestRender(payload.sections);
  }
}
function diagnostics(){return {...stats,pending:[...pendingSections],version:VERSION}}
window.ONITSync={version:VERSION,emit,requestRender,requestFullSync,diagnostics};
})();
