/* ONIT AutoCare v1.1.0 — conservative self-healing, diagnostics and health monitoring */
(function(){
'use strict';
const AUTOCARE_VERSION='1.3.0';
const ISSUE_KEY='onit-autocare-issues-v1';
const REPAIR_KEY='onit-autocare-repairs-v1';
const LAST_GOOD_KEY='onit-autocare-last-good-version';
const HEALTH_INTERVAL_MS=180000;
const REALTIME_REPAIR_COOLDOWN_MS=60000;
const PERMISSION_REPAIR_COOLDOWN_MS=60000;
const MAX_LOG=24;
let timer=null,checking=false,lastRealtimeRepairAt=0,lastPermissionRepairAt=0,lastBackendOkAt=0,lastFrontendCheckAt=0,lastPulseCapabilitySyncAt=0;
let lastHealth={network:'UNKNOWN',backend:'UNKNOWN',frontend:'UNKNOWN',dashboardUi:'UNKNOWN',realtime:'UNKNOWN',session:'UNKNOWN',permissions:'UNKNOWN',serviceWorker:'UNKNOWN',release:'UNKNOWN',sync:'UNKNOWN',checkedAt:0,backendAutoCare:false};

function now(){return Date.now()}
function safeJsonParse(v,fallback){try{return JSON.parse(v)}catch(e){return fallback}}
function readLog(key){try{return safeJsonParse(localStorage.getItem(key)||'[]',[])}catch(e){return[]}}
function writeLog(key,rows){try{localStorage.setItem(key,JSON.stringify(rows.slice(0,MAX_LOG)))}catch(e){}}
function shortMessage(err){return String(err&&err.message||err||'Unknown issue').replace(/\s+/g,' ').trim().slice(0,220)}
function recordIssue(code,err,severity='warning'){
  const msg=shortMessage(err), rows=readLog(ISSUE_KEY), t=now(), same=rows.find(x=>x.code===code&&x.message===msg&&t-Number(x.at||0)<30000);
  if(same){same.count=Number(same.count||1)+1;same.at=t}else rows.unshift({code,message:msg,severity,at:t,count:1});
  writeLog(ISSUE_KEY,rows);
  return msg;
}
function recordRepair(code,detail){const rows=readLog(REPAIR_KEY);rows.unshift({code,detail:String(detail||'').slice(0,220),at:now()});writeLog(REPAIR_KEY,rows)}
function online(){return typeof navigator==='undefined'||navigator.onLine!==false}
function signedIn(){try{return !!SESSION_TOKEN&&!!CURRENT_USER_ID&&!!ORG_ID}catch(e){return false}}
function safeForRepair(){try{return !mutationBusy&&(!window.uiDirtySections||uiDirtySections.size===0)}catch(e){return true}}
function timeLabel(ts){if(!ts)return'Never';try{return new Date(ts).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'})}catch(e){return new Date(ts).toLocaleString()}}
function statusClass(v){return v==='OK'||v==='CURRENT'||v==='CONNECTED'||v==='SYNCED'||v==='VALID'||v==='ACTIVE'?'ok':(v==='UNKNOWN'||v==='CHECKING'?'neutral':'warn')}
function currentFrontendStatus(release){try{const remote=String(release&&release.version||release||'');if(!remote)return'UNKNOWN';if(typeof remoteUiIsNewer==='function'&&typeof release==='object'&&remoteUiIsNewer(release))return'UPDATE READY';if(typeof compareUiVersions==='function')return compareUiVersions(remote,APP_VERSION)>0?'UPDATE READY':'CURRENT';return remote!==APP_VERSION?'UPDATE READY':'CURRENT'}catch(e){return'UNKNOWN'}}
function currentDashboardUiStatus(release){try{const local=typeof window.getDashboardUiHealth==='function'?window.getDashboardUiHealth():null,published=Number(release&&release.dashboardUiRevision||0),running=typeof DASHBOARD_UI_REVISION!=='undefined'?Number(DASHBOARD_UI_REVISION):0;if(published&&published>running)return'UPDATE READY';if(local&&local.healthy===false)return'MISMATCH';return running?'CURRENT':'UNKNOWN'}catch(e){return'UNKNOWN'}}
function currentRealtimeStatus(){try{if(!signedIn())return'IDLE';if(!online())return'OFFLINE';return firebaseRealtimeHealthy?'CONNECTED':'FALLBACK'}catch(e){return'UNKNOWN'}}
function currentSessionStatus(){return signedIn()?'VALID':'SIGNED OUT'}
function currentServiceWorkerStatus(){if(!('serviceWorker'in navigator))return'UNAVAILABLE';if(!location.protocol.startsWith('http'))return'LOCAL';return navigator.serviceWorker.controller?'ACTIVE':'STARTING'}
function frontendDashboardMode(){try{return typeof dashboardMode==='function'?dashboardMode():'UNKNOWN'}catch(e){return'UNKNOWN'}}
function backendModeFromPermissions(){try{return String((authority&&authority.dashboardMode)||(permissions&&permissions.dashboardMode)||'').toUpperCase()||'UNKNOWN'}catch(e){return'UNKNOWN'}}
function refreshLocalSnapshot(){lastHealth.network=online()?'OK':'OFFLINE';lastHealth.realtime=currentRealtimeStatus();lastHealth.session=currentSessionStatus();lastHealth.serviceWorker=currentServiceWorkerStatus();if(typeof window.getDashboardUiHealth==='function'&&signedIn()){const d=window.getDashboardUiHealth();if(d&&d.healthy===false&&d.mountedRevision)lastHealth.dashboardUi='MISMATCH';else if(d&&d.revision)lastHealth.dashboardUi='CURRENT'}try{const rg=window.ONITReleaseGuard&&ONITReleaseGuard.diagnostics?ONITReleaseGuard.diagnostics():null;lastHealth.release=rg?(rg.status==='OK'?'OK':rg.status):lastHealth.release}catch(e){}try{lastHealth.sync=window.ONITSync?'ACTIVE':'UNKNOWN'}catch(e){}if(!lastHealth.checkedAt)lastHealth.checkedAt=now();return lastHealth}

async function backendHealth(){
  if(!signedIn())return null;
  try{if(typeof lastSuccessfulSyncAt!=='undefined'&&lastSuccessfulSyncAt&&now()-lastSuccessfulSyncAt<120000){lastBackendOkAt=now();lastHealth.backend='OK';lastHealth.permissions='SYNCED';return{recentSync:true}}}catch(e){}
  try{if(typeof currentUser!=='undefined'&&!currentUser)return null}catch(e){}
  try{
    let data;
    try{data=await apiGet('autocare')}catch(e){
      if(/Unknown GET action/i.test(shortMessage(e))){data=await apiGet('pulse');data.autocareFallback=true}else throw e;
    }
    lastBackendOkAt=now();lastHealth.backend='OK';lastHealth.backendAutoCare=!data.autocareFallback;
    if(data.authority&&window.ONITAuthority){try{authority=data.authority;permissions=data.authority;ONITAuthority.set(data.authority)}catch(e){recordIssue('AUTHORITY_APPLY',e)}}
    const backendMode=String((data.authority&&data.authority.dashboardMode)||(data.permissions&&data.permissions.dashboardMode)||backendModeFromPermissions()).toUpperCase();
    const frontendMode=String(frontendDashboardMode()).toUpperCase();
    if(backendMode&&backendMode!=='UNKNOWN'&&frontendMode&&frontendMode!=='UNKNOWN'&&backendMode!==frontendMode){
      lastHealth.permissions='MISMATCH';
      recordIssue('PERMISSION_MISMATCH',`Frontend ${frontendMode}; backend ${backendMode}`,'warning');
      await repairPermissions('Authority mismatch detected');
    }else lastHealth.permissions='SYNCED';
    if(data.modules&&data.modules.digitalPulse&&window.DigitalPulse&&typeof window.DigitalPulse.refreshCapabilities==='function'&&now()-lastPulseCapabilitySyncAt>300000){try{lastPulseCapabilitySyncAt=now();await window.DigitalPulse.refreshCapabilities(true)}catch(e){recordIssue('PULSE_CAPABILITY_SYNC',e)}}
    if(data.stateVersion&&typeof lastStateVersion!=='undefined'&&lastStateVersion&&String(data.stateVersion)!==String(lastStateVersion)&&safeForRepair()){
      recordRepair('STATE_RESYNC','Backend state changed; Unified Sync is refreshing ONIT data.');
      if(window.ONITSync)ONITSync.emit('STATE_CHANGED',{reason:'autocare-state-version'});else await loadFromGoogle(false,true);
    }
    return data;
  }catch(e){lastHealth.backend='DEGRADED';recordIssue('BACKEND_HEALTH',e);signalApiFailure('autocare',e,true);return null}
}

async function frontendHealth(){
  if(!online()||typeof fetchFrontendRelease!=='function')return null;
  try{
    const release=await fetchFrontendRelease(),remote=String(release&&release.version||'').trim();
    lastFrontendCheckAt=now();lastHealth.frontend=currentFrontendStatus(release);lastHealth.dashboardUi=currentDashboardUiStatus(release);if(window.ONITReleaseGuard&&ONITReleaseGuard.check){const rg=await ONITReleaseGuard.check();lastHealth.release=rg.status==='OK'?'OK':'MISMATCH';if(rg.issues&&rg.issues.length)recordIssue('RELEASE_GUARD',rg.issues.join(' • '),'warning')}
    if(remote&&typeof APP_VERSION!=='undefined'&&((typeof remoteUiIsNewer==='function'&&remoteUiIsNewer(release))||(typeof remoteUiIsNewer!=='function'&&remote!==APP_VERSION))){const dashboardOnly=Number(release.dashboardUiRevision||0)>(typeof DASHBOARD_UI_REVISION!=='undefined'?DASHBOARD_UI_REVISION:0)&&typeof compareUiVersions==='function'&&compareUiVersions(remote,APP_VERSION)===0;recordIssue(dashboardOnly?'DASHBOARD_UI_STALE':'FRONTEND_STALE',dashboardOnly?`Dashboard UI r${DASHBOARD_UI_REVISION||0}; published r${release.dashboardUiRevision}`:`Installed ${APP_VERSION}; published ${remote}`,'warning');if(typeof checkFrontendRelease==='function')await checkFrontendRelease(false)}
    if(lastHealth.dashboardUi==='MISMATCH'&&typeof checkFrontendRelease==='function'){recordIssue('DASHBOARD_UI_MISMATCH','Dashboard renderer did not mount the current universal dashboard shell.','warning');await checkFrontendRelease(false)}
    return release;
  }catch(e){lastHealth.frontend='CHECK FAILED';recordIssue('FRONTEND_VERSION',e);return null}
}

async function repairPermissions(reason){
  if(!signedIn()||!online()||!safeForRepair()||now()-lastPermissionRepairAt<PERMISSION_REPAIR_COOLDOWN_MS)return false;
  lastPermissionRepairAt=now();
  try{await loadFromGoogle(false,true);recordRepair('PERMISSION_RESYNC',reason||'Permissions refreshed from backend.');lastHealth.permissions='SYNCED';return true}catch(e){recordIssue('PERMISSION_REPAIR',e);return false}
}
async function repairRealtime(reason){
  try{if(typeof firebaseStarting!=='undefined'&&firebaseStarting)return false}catch(e){}
  if(!signedIn()||!online()||typeof stopFirebaseRealtime!=='function'||typeof startFirebaseRealtime!=='function'||now()-lastRealtimeRepairAt<REALTIME_REPAIR_COOLDOWN_MS)return false;
  lastRealtimeRepairAt=now();
  try{stopFirebaseRealtime();await new Promise(r=>setTimeout(r,350));await startFirebaseRealtime();recordRepair('REALTIME_RECONNECT',reason||'Realtime listeners restarted.');refreshLocalSnapshot();return true}catch(e){recordIssue('REALTIME_REPAIR',e);return false}
}
async function repairServiceWorker(reason){
  if(!('serviceWorker'in navigator)||!online())return false;
  try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.update().catch(()=>null)));try{navigator.serviceWorker.controller&&navigator.serviceWorker.controller.postMessage({type:'AUTOCARE_REFRESH_STATIC'})}catch(e){}recordRepair('SERVICE_WORKER_REFRESH',reason||'Service worker update and static-cache refresh requested.');lastHealth.serviceWorker=currentServiceWorkerStatus();return true}catch(e){recordIssue('SERVICE_WORKER_REPAIR',e);return false}
}
async function repairKnownIssue(kind,detail){
  if(kind==='realtime')return repairRealtime(detail);
  if(kind==='permissions')return repairPermissions(detail);
  if(kind==='service-worker')return repairServiceWorker(detail);
  if(kind==='frontend'&&typeof checkFrontendRelease==='function'){try{await checkFrontendRelease(false);recordRepair('FRONTEND_CHECK',detail||'Frontend release checked.');return true}catch(e){recordIssue('FRONTEND_REPAIR',e);return false}}
  if(kind==='data'&&signedIn()&&online()&&safeForRepair()){try{await loadFromGoogle(false,true);recordRepair('DATA_RESYNC',detail||'ONIT data refreshed.');return true}catch(e){recordIssue('DATA_REPAIR',e);return false}}
  return false;
}

function signalApiFailure(action,err,readOnly){
  recordIssue('API_'+String(action||'UNKNOWN').toUpperCase(),err);
  if(!readOnly||!online()||!signedIn())return;
  if(/timed out|failed to fetch|network|load failed/i.test(shortMessage(err))){setTimeout(()=>{if(!document.hidden&&online())runCheck(false)},60000)}
}
function signalRealtimeFailure(err){try{firebaseRealtimeHealthy=false}catch(e){}recordIssue('REALTIME_FALLBACK',err,'warning');lastHealth.realtime='FALLBACK'}
function signalRealtimeHealthy(){try{firebaseRealtimeHealthy=true}catch(e){}lastHealth.realtime='CONNECTED'}
function markHealthy(){try{localStorage.setItem(LAST_GOOD_KEY,String(APP_VERSION))}catch(e){}lastHealth.backend='OK';lastHealth.session=currentSessionStatus();lastHealth.permissions='SYNCED';lastHealth.checkedAt=now();refreshLocalSnapshot()}

async function runCheck(manual=false){
  if(checking)return lastHealth;checking=true;lastHealth.checkedAt=now();refreshLocalSnapshot();
  try{
    if(!online()){lastHealth.backend='OFFLINE';lastHealth.frontend='OFFLINE';return lastHealth}
    const tasks=[];
    if(signedIn())tasks.push(backendHealth());
    if(manual||now()-lastFrontendCheckAt>300000)tasks.push(frontendHealth());
    await Promise.allSettled(tasks);
    if('serviceWorker'in navigator&&isHttpsApp&&isHttpsApp()&&!navigator.serviceWorker.controller)await repairServiceWorker('AutoCare found no active service-worker controller.');
    refreshLocalSnapshot();
    if(lastBackendOkAt&&now()-lastBackendOkAt<HEALTH_INTERVAL_MS*2&&lastHealth.backend!=='DEGRADED')lastHealth.backend='OK';
    if(manual){showToast('ONIT AutoCare',healthHeadline())}
    if(document.getElementById('autoCareHealthModal')&&!document.getElementById('autoCareHealthModal').classList.contains('hidden'))renderHealthModal();
    return lastHealth;
  }finally{checking=false}
}
function healthHeadline(){refreshLocalSnapshot();const bad=[lastHealth.network,lastHealth.backend,lastHealth.frontend,lastHealth.dashboardUi,lastHealth.realtime,lastHealth.permissions,lastHealth.release].filter(v=>!['OK','CURRENT','CONNECTED','SYNCED','VALID','IDLE'].includes(v));return bad.length?'AutoCare found something to watch. Open System Health for details.':'All core ONIT checks are healthy.'}
function overallStatus(){refreshLocalSnapshot();if(!online())return'OFFLINE';if(['DEGRADED','MISMATCH','CHECK FAILED'].includes(lastHealth.backend)||lastHealth.dashboardUi==='MISMATCH'||lastHealth.dashboardUi==='UPDATE READY'||lastHealth.permissions==='MISMATCH'||lastHealth.release==='MISMATCH')return'NEEDS ATTENTION';return'ACTIVE'}
function autoCareMoreCardMarkup(){const status=overallStatus();return `<div class='morecard autocareCard' style='grid-column:1/-1'><div class='autocareCardTop'><div><h3>ONIT AUTOCARE <span class='autoCareBadge ${status==='ACTIVE'?'ok':status==='OFFLINE'?'neutral':'warn'}'>${escapeHTML(status)}</span></h3><div class='bigTiny'>Automatic health checks, safe retries, realtime recovery, permission resync and Global UI Sync across browser, mobile and desktop installs. It never rewrites production logic by itself.</div></div><div class='autoCarePulse ${status==='ACTIVE'?'ok':''}'></div></div><div class='autocareMini'><span>Frontend <b>${escapeHTML(lastHealth.frontend||'CHECKING')}</b></span><span>Dashboard UI <b>${escapeHTML(lastHealth.dashboardUi||'CHECKING')}</b></span><span>Backend <b>${escapeHTML(lastHealth.backend||'CHECKING')}</b></span><span>Realtime <b>${escapeHTML(currentRealtimeStatus())}</b></span><span>Permissions <b>${escapeHTML(lastHealth.permissions||'CHECKING')}</b></span><span>Release <b>${escapeHTML(lastHealth.release||'CHECKING')}</b></span></div><div class='actions'><button class='secondary linkbtn' onclick='runAutoCareCheck(true)'>RUN HEALTH CHECK</button><button class='secondary linkbtn' onclick='openAutoCareHealth()'>OPEN SYSTEM HEALTH</button></div></div>`}
function healthRow(label,value,detail){return `<div class='autoCareHealthRow'><div><b>${escapeHTML(label)}</b>${detail?`<div class='bigTiny'>${escapeHTML(detail)}</div>`:''}</div><span class='autoCareState ${statusClass(value)}'>${escapeHTML(value)}</span></div>`}
function ensureModal(){let el=document.getElementById('autoCareHealthModal');if(el)return el;el=document.createElement('div');el.id='autoCareHealthModal';el.className='modal hidden';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.onclick=e=>{if(e.target===el)closeAutoCareHealth()};el.innerHTML=`<div class='modalBox autoCareModalBox'><div class='modalTop'><div><div class='tiny'>ONIT AUTOCARE v${AUTOCARE_VERSION}</div><h2>SYSTEM HEALTH</h2></div><button class='secondary' onclick='closeAutoCareHealth()'>CLOSE</button></div><div id='autoCareHealthBody'></div></div>`;document.body.appendChild(el);return el}
function renderHealthModal(){const body=document.getElementById('autoCareHealthBody');if(!body)return;refreshLocalSnapshot();const issues=readLog(ISSUE_KEY).slice(0,8),repairs=readLog(REPAIR_KEY).slice(0,8);body.innerHTML=`<div class='autoCareHealthGrid'>${healthRow('Network',lastHealth.network,online()?'Device is online.':'ONIT will stay on last synced data until connection returns.')}${healthRow('Frontend',lastHealth.frontend,`Running v${typeof APP_VERSION!=='undefined'?APP_VERSION:'—'} • last known good ${localStorage.getItem(LAST_GOOD_KEY)||'—'}`)}${healthRow('Dashboard UI',lastHealth.dashboardUi,`Universal dashboard revision ${typeof DASHBOARD_UI_REVISION!=='undefined'?DASHBOARD_UI_REVISION:'—'} • applies to Owner, CD/DCD, Traffic, Account, Team Lead and Staff shells.`)}${healthRow('Backend',lastHealth.backend,`Backend ${typeof backendVersion!=='undefined'&&backendVersion?backendVersion:'checking'} • AutoCare endpoint ${lastHealth.backendAutoCare?'available':'compatibility mode'}`)}${healthRow('Realtime',currentRealtimeStatus(),firebaseRealtimeHealthy?'Firebase listeners are healthy.':'ONIT polling fallback remains available; AutoCare will attempt a reconnect.')}${healthRow('Session',currentSessionStatus(),signedIn()?'Authenticated session is present.':'No active ONIT session.')}${healthRow('Permissions',lastHealth.permissions,`Authority Engine ${window.ONITAuthority?.version||'—'} • frontend ${frontendDashboardMode()} • backend ${backendModeFromPermissions()}`)}${healthRow('Unified Sync',lastHealth.sync,window.ONITSync?`Sync Engine ${ONITSync.version} • full syncs ${ONITSync.diagnostics().fullSyncs}`:'Sync Engine not loaded.')}${healthRow('Release Guard',lastHealth.release,window.ONITReleaseGuard?`Release Guard ${ONITReleaseGuard.version} • ${ONITReleaseGuard.diagnostics().environment||'checking'}`:'Release Guard not loaded.')}${healthRow('Installed app',currentServiceWorkerStatus(),`Global UI Sync automatically checks the published release and retires stale UI caches on browser, mobile and desktop installs.`)}</div><div class='actions autoCareActions'><button class='new' onclick='runAutoCareCheck(true)'>CHECK & REPAIR</button><button class='secondary' onclick='autoCareRepairData()'>RESYNC DATA</button><button class='secondary' onclick='autoCareRepairRealtime()'>RECONNECT REALTIME</button><button class='secondary' onclick='forceFrontendUpdate()'>REPAIR INSTALLED APP</button><button class='secondary' onclick='copyAutoCareDiagnostics()'>COPY DIAGNOSTICS</button></div><div class='autoCareLogGrid'><div><h3>RECENT ISSUES</h3>${issues.length?issues.map(x=>`<div class='autoCareLog'><b>${escapeHTML(x.code)}</b><span>${escapeHTML(x.message)}</span><small>${escapeHTML(timeLabel(x.at))}${x.count>1?' • ×'+x.count:''}</small></div>`).join(''):`<div class='empty'>No recent AutoCare issues on this device.</div>`}</div><div><h3>AUTO REPAIRS</h3>${repairs.length?repairs.map(x=>`<div class='autoCareLog repair'><b>${escapeHTML(x.code)}</b><span>${escapeHTML(x.detail)}</span><small>${escapeHTML(timeLabel(x.at))}</small></div>`).join(''):`<div class='empty'>No repairs have been needed recently.</div>`}</div></div><div class='bigTiny autoCareFoot'>AutoCare only performs predefined safe repairs. It does not change briefs, approvals, user data or write new application code.</div>`}
async function openHealth(){ensureModal().classList.remove('hidden');renderHealthModal();await runCheck(false);renderHealthModal()}
function closeHealth(){document.getElementById('autoCareHealthModal')?.classList.add('hidden')}
async function repairData(){await repairKnownIssue('data','Manual System Health resync.');renderHealthModal();showToast('ONIT AutoCare','Data resync completed.')}
async function repairRealtimeManual(){await repairRealtime('Manual System Health reconnect.');renderHealthModal();showToast('ONIT AutoCare','Realtime reconnect requested.')}
async function copyDiagnostics(){
  refreshLocalSnapshot();
  const payload={autoCareVersion:AUTOCARE_VERSION,frontendVersion:typeof APP_VERSION!=='undefined'?APP_VERSION:'',dashboardUiRevision:typeof DASHBOARD_UI_REVISION!=='undefined'?DASHBOARD_UI_REVISION:0,backendVersion:typeof backendVersion!=='undefined'?backendVersion:'',health:lastHealth,authority:window.ONITAuthority?.summary?.()||null,sync:window.ONITSync?.diagnostics?.()||null,release:window.ONITReleaseGuard?.diagnostics?.()||null,recentIssues:readLog(ISSUE_KEY).slice(0,8),recentRepairs:readLog(REPAIR_KEY).slice(0,8)};
  const value=JSON.stringify(payload,null,2);
  try{await navigator.clipboard.writeText(value);showToast('ONIT AutoCare','Diagnostics copied.');return true}catch(e){recordIssue('DIAGNOSTIC_COPY',e);return false}
}
function start(){if(timer)return;refreshLocalSnapshot();timer=setInterval(()=>{if(!document.hidden)runCheck(false)},HEALTH_INTERVAL_MS);setTimeout(()=>runCheck(false),30000)}
function stop(){if(timer){clearInterval(timer);timer=null}}

window.addEventListener('error',e=>{
  const target=e.target;
  if(target&&target!==window&&(target.tagName==='SCRIPT'||target.tagName==='LINK')){const src=target.src||target.href||'asset';recordIssue('ASSET_LOAD',src);repairKnownIssue('service-worker','A local asset failed to load.');repairKnownIssue('frontend','Checking published frontend after an asset load failure.');return}
  if(e.error)recordIssue('WINDOW_ERROR',e.error);
},true);
window.addEventListener('unhandledrejection',e=>recordIssue('PROMISE_REJECTION',e.reason||'Unhandled promise rejection'));
window.addEventListener('online',()=>setTimeout(()=>runCheck(false),900));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&signedIn()&&now()-lastHealth.checkedAt>HEALTH_INTERVAL_MS)runCheck(false)});
document.addEventListener('DOMContentLoaded',start,{once:true});

window.AutoCare={version:AUTOCARE_VERSION,recordIssue,recordRepair,signalApiFailure,signalRealtimeFailure,signalRealtimeHealthy,repairKnownIssue,markHealthy,runCheck,start,stop,get health(){return Object.assign({},lastHealth)}};
window.autoCareMoreCardMarkup=autoCareMoreCardMarkup;
window.runAutoCareCheck=runCheck;
window.openAutoCareHealth=openHealth;
window.closeAutoCareHealth=closeHealth;
window.autoCareRepairData=repairData;
window.autoCareRepairRealtime=repairRealtimeManual;
window.copyAutoCareDiagnostics=copyDiagnostics;
})();
