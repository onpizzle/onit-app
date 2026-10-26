/* ONIT Authority Engine v1.0 — backend-first role and capability contract */
(function(){
'use strict';
const VERSION='1.0.0';
let contract=Object.freeze({});
function normalise(input){
  const c=(input&&typeof input==='object')?input:{};
  return Object.freeze({...c,engineVersion:String(c.engineVersion||VERSION),dashboardMode:String(c.dashboardMode||'').toUpperCase()});
}
function set(next){
  contract=normalise(next);
  try{window.dispatchEvent(new CustomEvent('onit:authority-changed',{detail:contract}))}catch(e){}
  return contract;
}
function get(){return contract}
function has(name){return Object.prototype.hasOwnProperty.call(contract,name)}
function allowed(name,fallback=false){
  if(has(name))return !!contract[name];
  try{return typeof fallback==='function'?!!fallback():!!fallback}catch(e){return false}
}
function value(name,fallback=null){return has(name)?contract[name]:fallback}
function mode(fallback='STAFF'){
  const m=String(contract.dashboardMode||'').toUpperCase();
  return ['OWNER','LEADERSHIP','TRAFFIC','ACCOUNT','TEAM_LEAD','STAFF'].includes(m)?m:String(fallback||'STAFF').toUpperCase();
}
function scope(){return (contract.scope&&typeof contract.scope==='object')?contract.scope:{} }
function summary(){
  return {version:VERSION,mode:mode('UNKNOWN'),owner:allowed('owner'),leadership:allowed('agencyLeadership'),traffic:allowed('trafficManager'),teamLead:allowed('teamLead'),canCreateBrief:allowed('createBrief'),canApproveFinal:allowed('approveFinal'),canViewAllBriefs:allowed('canViewAllBriefs'),scope:scope()};
}
window.ONITAuthority={version:VERSION,set,get,has,allowed,value,mode,scope,summary};
})();
