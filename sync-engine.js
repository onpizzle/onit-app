/* ONIT Unified Sync Engine v1.2 — single owner for background full hydration */
(function(){
'use strict';
const VERSION='1.2.0';
const RENDER_DELAY=120;
const FULL_SYNC_COOLDOWN=60000;
const RETRY_BLOCKED_MS=15000;
let renderTimer=null,fullSyncTimer=null,fullSyncDueAt=0,lastFullSyncAt=0,fullSyncQueued=false,pendingReason='',pendingStateVersion='';
const pendingSections=new Set();
const stats={renders:0,fullSyncs:0,stateSignals:0,coalescedSignals:0,lastEvent:'',lastEventAt:0,lastFullSyncReason:'',lastFullSyncAt:0,lastStateVersion:'',nextFullSyncAt:0};
function visible(id){const el=document.getElementById(id);return !!el&&!el.classList.contains('hidden')}
function dirty(id){try{return !!window.uiDirtySections&&window.uiDirtySections.has(id)}catch(e){return false}}
function renderSection(id){
  if(dirty(id))return;
  try{
    if(id==='home'&&visible('home')&&typeof renderHome==='function')renderHome();
    else if(id==='briefs'&&visible('briefs')&&typeof renderBriefs==='function')renderBriefs();
    else if(id==='archive'&&visible('archive')&&typeof renderArchive==='function')renderArchive();
    else if(id==='memory'&&visible('memory')){if(typeof memoryUpdateDynamic==='function')memoryUpdateDynamic();else if(typeof renderMemory==='function')renderMemory(false);}
    else if(id==='team'&&visible('team')&&typeof renderTeam==='function')renderTeam();
    else if(id==='detail'&&visible('detail')&&typeof current!=='undefined'&&current&&typeof renderDetail==='function'){current=((typeof briefs!=='undefined'&&briefs)||[]).find(b=>b.code===current.code)||current;renderDetail();}
    stats.renders++;
  }catch(e){console.warn('ONIT Sync render',id,e)}
}
function flush(){renderTimer=null;const list=[...pendingSections];pendingSections.clear();list.forEach(renderSection)}
function requestRender(sections){(Array.isArray(sections)?sections:[sections]).filter(Boolean).forEach(s=>pendingSections.add(s));clearTimeout(renderTimer);renderTimer=setTimeout(flush,RENDER_DELAY)}
function canFullSync(){try{return document.hidden!==true&&!(typeof mutationBusy!=='undefined'&&mutationBusy)&&(!window.uiDirtySections||window.uiDirtySections.size===0)&&navigator.onLine!==false}catch(e){return true}}
function userJitter(max=15000){try{const s=String(typeof CURRENT_USER_ID!=='undefined'?CURRENT_USER_ID:'ONIT');let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%max}catch(e){return 0}}
function latestSuccessfulSync(){try{return typeof lastSuccessfulSyncAt!=='undefined'?Number(lastSuccessfulSyncAt||0):0}catch(e){return 0}}
function clearFullTimer(){if(fullSyncTimer){clearTimeout(fullSyncTimer);fullSyncTimer=null}fullSyncDueAt=0;stats.nextFullSyncAt=0}
function schedule(reason,delayMs){const due=Date.now()+Math.max(0,Number(delayMs||0));pendingReason=String(reason||pendingReason||'state-change');if(fullSyncTimer&&fullSyncDueAt&&fullSyncDueAt<=due){stats.coalescedSignals++;return}clearFullTimer();fullSyncDueAt=due;stats.nextFullSyncAt=due;fullSyncTimer=setTimeout(runFullSync,Math.max(0,due-Date.now()))}
async function runFullSync(){
  clearFullTimer();if(fullSyncQueued)return;
  if(!canFullSync()){schedule(pendingReason||'blocked',RETRY_BLOCKED_MS);return}
  const baseline=Math.max(lastFullSyncAt,latestSuccessfulSync()),now=Date.now();if(now-baseline<FULL_SYNC_COOLDOWN){schedule(pendingReason||'cooldown',FULL_SYNC_COOLDOWN-(now-baseline));return}
  if(typeof loadFromGoogle!=='function')return;
  fullSyncQueued=true;lastFullSyncAt=Date.now();stats.fullSyncs++;stats.lastFullSyncAt=lastFullSyncAt;stats.lastFullSyncReason=pendingReason||'state-change';
  try{await loadFromGoogle(false,true);pendingStateVersion='';pendingReason=''}catch(e){console.warn('ONIT Sync full refresh',e);schedule('retry-after-sync-failure',60000)}finally{fullSyncQueued=false}
}
function requestFullSync(reason='state-change',opts={}){const urgent=!!opts.urgent,healthy=typeof firebaseRealtimeHealthy!=='undefined'&&firebaseRealtimeHealthy;const delay=urgent?1200:(healthy?10000:5000)+userJitter(20000);schedule(reason,delay)}
function noteStateVersion(version,reason='state-version'){const v=String(version||'');stats.stateSignals++;stats.lastStateVersion=v;if(v&&pendingStateVersion===v){stats.coalescedSignals++;return}pendingStateVersion=v;requestFullSync(reason,{urgent:false})}
function emit(type,payload={}){stats.lastEvent=String(type||'');stats.lastEventAt=Date.now();switch(type){case 'BRIEF_CHANGED':case 'ACTIVITY_CHANGED':requestRender(['home','briefs','archive','memory','detail']);break;case 'NOTIFICATIONS_CHANGED':try{renderNotifications();showNextBroadcast()}catch(e){}break;case 'TEAM_CHANGED':requestRender(['home','team']);break;case 'STATE_CHANGED':noteStateVersion(payload.stateVersion||'',payload.reason||'state-version');break;case 'PERMISSIONS_CHANGED':requestFullSync(payload.reason||'permissions',{urgent:true});break;case 'PULSE_CHANGED':try{if(visible('pulse')&&window.DigitalPulse?.refresh)window.DigitalPulse.refresh()}catch(e){}break;default:if(payload.sections)requestRender(payload.sections)}}
function diagnostics(){return {...stats,pending:[...pendingSections],pendingReason,pendingStateVersion,version:VERSION}}
window.ONITSync={version:VERSION,emit,requestRender,requestFullSync,noteStateVersion,diagnostics};
})();
