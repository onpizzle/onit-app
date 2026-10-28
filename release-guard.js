/* ONIT Production Release Guard v1.0.1 */
(function(){
'use strict';
const VERSION='1.0.1';let last={status:'CHECKING',checkedAt:0,issues:[],published:null,worker:null};
function extract(text,re){const m=String(text||'').match(re);return m?m[1]:''}
async function check(){
 const issues=[];let published=null,worker=null;
 try{published=await fetch('./version.json?_rg='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('version.json '+r.status);return r.json()});}catch(e){issues.push('version.json unavailable')}
 try{const txt=await fetch('./service-worker.js?_rg='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('worker '+r.status);return r.text()});worker={version:extract(txt,/UI_VERSION=['"]([^'"]+)/),uiRevision:Number(extract(txt,/UI_REVISION=(\d+)/)||0),dashboardUiRevision:Number(extract(txt,/DASHBOARD_UI_REVISION=(\d+)/)||0)};}catch(e){issues.push('service worker unavailable')}
 try{if(published&&String(published.version)!==String(window.APP_VERSION||APP_VERSION))issues.push(`index ${APP_VERSION} ≠ published ${published.version}`)}catch(e){}
 try{if(published&&Number(published.uiRevision||0)!==Number(window.UI_REVISION||UI_REVISION))issues.push('UI revision mismatch')}catch(e){}
 try{if(published&&Number(published.dashboardUiRevision||0)!==Number(window.DASHBOARD_UI_REVISION||DASHBOARD_UI_REVISION))issues.push('Dashboard revision mismatch')}catch(e){}
 if(published&&worker&&String(published.version)!==String(worker.version))issues.push('Service worker version mismatch');
 if(published&&worker&&Number(published.dashboardUiRevision||0)!==Number(worker.dashboardUiRevision||0))issues.push('Service worker dashboard revision mismatch');
 last={status:issues.length?'MISMATCH':'OK',checkedAt:Date.now(),issues,published,worker,version:VERSION,environment:/test|staging|preview/i.test(location.hostname)?'STAGING':'PRODUCTION'};
 try{window.dispatchEvent(new CustomEvent('onit:release-health',{detail:last}))}catch(e){}
 return last;
}
function diagnostics(){return last}
window.ONITReleaseGuard={version:VERSION,check,diagnostics};
document.addEventListener('DOMContentLoaded',()=>{setTimeout(check,800);setInterval(()=>{if(!document.hidden)check()},5*60*1000)},{once:true});
})();
