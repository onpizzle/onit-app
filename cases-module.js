/* ONIT Cases module v0.20.0 — private pilot, default deny */
(function(){
'use strict';
const state={cap:null,cases:[],selected:null,tab:'library',grants:[],busy:false,lastCapabilityAt:0};
const esc=v=>typeof escapeHTML==='function'?escapeHTML(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const val=(o,...k)=>{for(const x of k){if(o&&o[x]!==undefined&&o[x]!==null&&o[x]!=='')return o[x]}return ''};
const api=(action,data={})=>apiPost(action,data,true).then(r=>r.data||r);
const owner=()=>!!state.cap?.isOwner;
const allowed=()=>!!state.cap?.canUse;
const enabled=()=>!!state.cap?.enabled;
function root(){return document.getElementById('casesRoot')}
function nav(){return document.getElementById('navCases')}
function setNav(){const n=nav();if(!n)return;n.classList.toggle('hiddenByRole',!allowed())}
async function refreshCapabilities(force=false){
  if(typeof SESSION_TOKEN==='undefined'||!SESSION_TOKEN||typeof CURRENT_USER_ID==='undefined'||!CURRENT_USER_ID)return clear();
  if(!force&&Date.now()-state.lastCapabilityAt<20000)return state.cap;
  try{state.cap=await api('CASES_CAPABILITIES');state.lastCapabilityAt=Date.now();setNav();
    if(!allowed()&&!document.getElementById('cases')?.classList.contains('hidden')){show('home');showToast('Cases access','Your Cases access is not active.');}
    return state.cap;
  }catch(e){state.cap=null;setNav();return null}
}
function clear(){state.cap=null;state.cases=[];state.selected=null;state.grants=[];setNav()}
function subnav(){
  const items=[['library','Campaign Library'],['vault','Data Vault'],['intelligence','Intelligence'],['studio','Case Studio'],['approvals','Approvals']];
  if(owner())items.push(['access','Access Control']);
  return `<div class='casesSubnav'>${items.map(([id,label])=>`<button class='${state.tab===id?'active':''}' onclick="CasesModule.openTab('${id}')">${label}</button>`).join('')}</div>`;
}
function shell(body,title='Cases',sub='Turn completed ONIT work into evidence-backed case studies.'){
  return `<div class='casesShell'><div class='casesTop'><div><div class='casesTestFlag'>PRIVATE TEST • NOT PUBLIC</div><h1>${esc(title)}</h1><p class='muted'>${esc(sub)}</p></div>${allowed()?`<div class='actions'><button class='secondary' onclick='CasesModule.refresh()'>REFRESH</button>${state.tab==='library'?`<button class='new' onclick='CasesModule.newCase()'>+ NEW CASE</button>`:''}</div>`:''}</div>${subnav()}${body}</div>`;
}
async function render(){
  const el=root();if(!el)return;
  await refreshCapabilities();
  if(!state.cap){el.innerHTML=shell(`<div class='caseLock'><b>Cases is locked.</b><div class='muted'>ONIT could not verify the private Cases entitlement. No Cases data has been loaded.</div></div>`);return}
  if(!allowed()){el.innerHTML=shell(`<div class='caseLock'><b>Cases is not enabled for this account.</b><div class='muted'>Access is denied by default and must be granted by the verified System Owner.</div></div>`);return}
  try{
    if(state.tab==='library')await renderLibrary();
    else if(state.tab==='access')await renderAccess();
    else if(!state.selected){await loadCases();el.innerHTML=shell(`<div class='caseEmpty'>Select a campaign in Campaign Library first.</div>`);}
    else if(state.tab==='vault')await renderVault();
    else if(state.tab==='intelligence')await renderIntelligence();
    else if(state.tab==='studio')await renderStudio();
    else if(state.tab==='approvals')await renderApprovals();
  }catch(e){el.innerHTML=shell(`<div class='caseLock'><b>Cases could not load.</b><div class='muted'>${esc(e.message)}</div></div>`)}
}
async function loadCases(){const d=await api('CASES_LIST');state.cases=d.cases||[];if(state.selected){const fresh=state.cases.find(c=>val(c,'Case ID','caseId')===val(state.selected,'Case ID','caseId'));if(fresh)state.selected=fresh}return state.cases}
async function getCase(id){const d=await api('CASES_GET',{caseId:id});state.selected=d.case||null;return d}
function caseId(){return val(state.selected,'Case ID','caseId')}
function statusPill(c){return `<span class='caseStatus'>${esc(val(c,'Status','status')||'draft')}</span>`}
async function renderLibrary(){
  await loadCases();
  const list=state.cases;
  const body=list.length?`<div class='casesGrid'>${list.map(c=>`<div class='caseCard' onclick="CasesModule.selectCase('${esc(val(c,'Case ID','caseId'))}')"><div class='caseHead'><div><span class='code'>${esc(val(c,'Client Name','clientName','Brand','brand')||'Campaign')}</span><h3>${esc(val(c,'Title','title')||'Untitled Case')}</h3><div class='muted'>${esc(val(c,'Description','description')||'No description yet.')}</div></div><div class='caseScore'>${Number(val(c,'Readiness Score','readinessScore')||0)}</div></div><div class='caseMeta'>${statusPill(c)}<span class='pill'>${esc(val(c,'Campaign Start','campaignStart')||'DATE TBD')}</span><span class='pill'>${esc(val(c,'Owner Name','ownerName')||'')}</span></div></div>`).join('')}</div>`:`<div class='caseEmpty'><b>No Cases yet.</b><br>Create the first case only for work worth documenting.</div>`;
  root().innerHTML=shell(`${owner()?`<div class='ownerCasesBar'><b>Owner-controlled pilot</b><div class='tiny'>Organisation pilot: ${enabled()?'ENABLED':'OFF'} • ${state.cap.grantCount||0} approved user(s). Cases remains hidden from everyone else.</div></div>`:''}${body}`);
}
async function newCase(){
  if(!allowed())return;
  const title=(prompt('Campaign / case title:','')||'').trim();if(!title)return;
  const client=(prompt('Client / brand:','')||'').trim();
  const description=(prompt('Short description:','')||'').trim();
  try{const d=await api('CASES_CREATE',{title,clientName:client,brand:client,description});await loadCases();await selectCase(d.caseId);showToast('Cases','New case created as a private draft.')}catch(e){alert(e.message)}
}
async function selectCase(id){await getCase(id);state.tab='vault';await render()}
function selectedHeader(d){const c=d.case||state.selected||{};return `<div class='casePanel'><div class='caseHead'><div><span class='code'>${esc(val(c,'Case ID','caseId'))}</span><h3 style='font-size:19px'>${esc(val(c,'Title','title'))}</h3><div class='muted'>${esc(val(c,'Client Name','clientName','Brand','brand'))} • ${esc(val(c,'Status','status'))}</div></div><button class='secondary' onclick="CasesModule.openTab('library')">BACK TO LIBRARY</button></div></div>`}
async function renderVault(){
  const d=await getCase(caseId()), ev=d.evidence||[], metrics=d.metrics||[], links=d.briefLinks||[];
  const body=`${selectedHeader(d)}<div class='casesGrid'><div class='casePanel'><h3>LINKED ONIT WORK</h3>${links.length?links.map(x=>`<div class='caseEvidence'><div><b>${esc(val(x,'Brief Code','briefCode'))}</b><div class='tiny'>${esc(val(x,'Brief Title','briefTitle','Source Visibility','sourceVisibility'))}</div></div><span class='pill'>LINKED</span></div>`).join(''):`<div class='empty'>No briefs linked yet.</div>`}<div class='actions'><button class='secondary' onclick='CasesModule.linkBrief()'>+ LINK ACCESSIBLE BRIEF</button></div><h3 style='margin-top:18px'>CASE TEAM</h3>${(d.members||[]).map(m=>`<div class='caseEvidence'><div><b>${esc(val(m,'Member Name','memberName'))}</b><div class='tiny'>${esc(val(m,'Case Role','caseRole'))}</div></div><span class='pill'>MEMBER</span></div>`).join('')}<div class='actions'><button class='secondary' onclick='CasesModule.addMember()'>+ ADD CASE MEMBER</button></div></div><div class='casePanel'><h3>EVIDENCE</h3>${ev.length?ev.map(x=>`<div class='caseEvidence'><div><b>${esc(val(x,'Title','title','Source Type','sourceType'))}</b><div class='tiny'>${esc(val(x,'Source URL','sourceUrl','Source File ID','sourceFileId','Notes','notes'))}</div></div><span class='pill'>${esc(val(x,'Permission Status','permissionStatus')||'internal')}</span></div>`).join(''):`<div class='empty'>No evidence captured yet.</div>`}<div class='actions'><button class='secondary' onclick='CasesModule.addEvidence()'>+ ADD EVIDENCE</button></div></div></div><div class='casePanel'><h3>PERFORMANCE METRICS</h3>${metrics.length?`<table class='caseTable'><thead><tr><th>Metric</th><th>Value</th><th>Period</th><th>Source</th><th>Clearance</th></tr></thead><tbody>${metrics.map(m=>`<tr><td><b>${esc(val(m,'Name','name'))}</b><div class='tiny'>${esc(val(m,'Platform','platform','Scope','scope'))}</div></td><td>${esc(val(m,'Value','value'))} ${esc(val(m,'Unit','unit'))}</td><td>${esc(val(m,'Period','period'))}</td><td>${esc(val(m,'Source Description','sourceDescription','Source ID','sourceId'))}</td><td>${esc(val(m,'Clearance','clearance')||'pending')}</td></tr>`).join('')}</tbody></table>`:`<div class='empty'>No campaign metrics yet.</div>`}<div class='actions'><button class='secondary' onclick='CasesModule.addMetric()'>+ ADD METRIC</button><button class='secondary' onclick='CasesModule.importMetrics()'>IMPORT CSV / TSV</button><button class='secondary' onclick='CasesModule.importClientJson()'>IMPORT CLIENT JSON</button></div></div>`;
  root().innerHTML=shell(body,'Data Vault','Collect only sourced evidence, results and publication clearance.');
}
async function linkBrief(){
  if(typeof briefs==='undefined'||!briefs.length)return alert('No accessible ONIT briefs are available to link.');
  const options=briefs.map((b,i)=>`${i+1}. ${b.code} — ${b.client} — ${b.project}`).join('\n');const pick=Number(prompt('Choose an accessible ONIT brief by number:\n\n'+options,''));if(!pick||!briefs[pick-1])return;const b=briefs[pick-1];
  try{await api('CASES_LINK_BRIEF',{caseId:caseId(),briefCode:b.code});showToast('Cases','Brief linked without copying restricted discussions or drafts.');await renderVault()}catch(e){alert(e.message)}
}
async function addMember(){
  const d=await api('CASES_OWNER_GRANTS');const candidates=(d.members||[]).filter(x=>x.granted);if(!candidates.length)return alert('No other staff member currently has Cases module access. Grant access first in Access Control.');const options=candidates.map((u,i)=>`${i+1}. ${val(u,'Full Name','fullName')} — ${val(u,'Position','position')||val(u,'Department','department')}`).join('\n');const pick=Number(prompt('Choose a granted Cases user by number:\n\n'+options,''));if(!pick||!candidates[pick-1])return;const role=(prompt('Case role: contributor, reviewer or exporter','contributor')||'contributor').trim().toLowerCase();try{await api('CASES_ADD_MEMBER',{caseId:caseId(),targetUserId:val(candidates[pick-1],'User ID','userId'),caseRole:role});showToast('Cases','Case member added.');await renderVault()}catch(e){alert(e.message)}}
async function addEvidence(){
  const title=(prompt('Evidence title:','Campaign report / approved execution')||'').trim();if(!title)return;const sourceType=(prompt('Type: image, video, pdf, screenshot, link, script, note','link')||'link').trim();const url=(prompt('Private Drive/file reference or URL (optional):','')||'').trim();const notes=(prompt('Supporting note:','')||'').trim();const permission=(prompt('Usage status: internal_only, pending, external_allowed','pending')||'pending').trim();
  try{await api('CASES_ADD_EVIDENCE',{caseId:caseId(),title,sourceType,sourceUrl:url,notes,permissionStatus:permission});await renderVault()}catch(e){alert(e.message)}
}
async function addMetric(){
  const name=(prompt('Metric name:','Reach')||'').trim();if(!name)return;const value=(prompt('Value:','')||'').trim();const unit=(prompt('Unit (people, %, impressions, sales etc.):','')||'').trim();const platform=(prompt('Platform / channel:','')||'').trim();const period=(prompt('Measurement period:','')||'').trim();const sourceDescription=(prompt('Source / report reference:','')||'').trim();const clearance=(prompt('Publication clearance: pending, internal_only, external_allowed','pending')||'pending').trim();
  try{await api('CASES_ADD_METRIC',{caseId:caseId(),name,value,unit,platform,period,scope:'campaign',sourceDescription,clearance,validationStatus:'reviewed'});await renderVault()}catch(e){alert(e.message)}
}
function parseDelimited(text){const lines=text.trim().split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const delim=lines[0].includes('\t')?'\t':',';const headers=lines[0].split(delim).map(x=>x.trim().toLowerCase());return lines.slice(1).map(line=>{const cells=line.split(delim).map(x=>x.trim());const o={};headers.forEach((h,i)=>o[h]=cells[i]||'');return o})}
async function importMetrics(){const text=(prompt('Paste CSV or TSV. Required columns: name,value,period,source. Optional: unit,platform,scope,clearance','name,value,unit,platform,period,source,clearance\nReach,100000,people,Instagram,1-31 Oct 2026,Client report,pending')||'').trim();if(!text)return;const rows=parseDelimited(text).map(r=>({name:r.name||r.metric,value:r.value,unit:r.unit||'',platform:r.platform||'',period:r.period||'',scope:r.scope||'campaign',sourceDescription:r.source||r.sourcedescription||'',clearance:r.clearance||'pending',validationStatus:'reviewed'}));if(!rows.length)return alert('No valid rows found.');try{const d=await api('CASES_IMPORT_METRICS',{caseId:caseId(),metrics:rows});showToast('Cases',`${d.imported||0} metric(s) imported after validation.`);await renderVault()}catch(e){alert(e.message)}}
async function importClientJson(){const text=(prompt('Paste the CASEMODE client-response JSON:','')||'').trim();if(!text)return;try{const d=await api('CASES_IMPORT_CLIENT_JSON',{caseId:caseId(),json:text});showToast('Cases',`${d.imported||0} client metric(s) imported for review.`);await renderVault()}catch(e){alert(e.message)}}
async function renderIntelligence(){
  const d=await api('CASES_INTELLIGENCE',{caseId:caseId()}),a=d.assessment||{};state.selected=d.case||state.selected;
  const stats=a.stats||{};const body=`${selectedHeader(d)}<div class='casePanel'><div class='caseHead'><div><h3>READINESS</h3><div class='muted'>Documentation completeness only — not a campaign quality or award score.</div></div><div class='caseScore'>${a.score||0}</div></div><div class='caseProgress'><span style='width:${Math.max(0,Math.min(100,a.score||0))}%'></span></div></div><div class='caseStatGrid'><div class='caseStat'><b>${stats.metrics||0}</b><span>METRICS</span></div><div class='caseStat'><b>${stats.sourced||0}</b><span>SOURCED</span></div><div class='caseStat'><b>${stats.cleared||0}</b><span>CLEARED</span></div><div class='caseStat'><b>${stats.evidence||0}</b><span>EVIDENCE</span></div></div><div class='casePanel'><h3>MISSING ITEMS</h3>${(a.missing||[]).length?(a.missing||[]).map(i=>`<div class='caseIssue ${i.severity==='high'?'caseDanger':'caseWarn'}'><div><b>${esc(i.label)}</b><div class='tiny'>${esc(i.action)}</div></div><span class='pill'>${esc(i.severity||'medium')}</span></div>`).join(''):`<div class='caseIssue caseGood'><div><b>Core documentation is complete.</b><div class='tiny'>Final external export still checks every selected asset and metric for clearance.</div></div></div>`}</div><div class='casePanel'><h3>POSSIBLE STORY ANGLES</h3>${(d.angles||[]).map(x=>`<div class='caseIssue'><div><b>${esc(x.title)}</b><div class='tiny'>${esc(x.guidance)}</div></div><span class='pill'>POSSIBLE ANGLE</span></div>`).join('')||`<div class='empty'>More evidence is needed before ONIT can suggest a supported angle.</div>`}</div>`;
  root().innerHTML=shell(body,'Intelligence','A deterministic evidence check. No paid AI and no invented performance claims.');
}
async function renderStudio(){
  const d=await getCase(caseId()),s=d.studio||{};const body=`${selectedHeader(d)}<div class='caseHeroPreview'><div class='code' style='color:#bbb'>WORKING CASE DRAFT</div><h2>${esc(val(d.case,'Title','title'))}</h2><p>${esc(val(s,'Idea','idea')||'Build the evidence first, then sharpen the story.')}</p></div><div class='casePanel'><h3>CASE STORY</h3><div class='caseStudioGrid'><div class='field wide'><label>CHALLENGE</label><textarea id='caseChallenge'>${esc(val(s,'Challenge','challenge'))}</textarea></div><div class='field wide'><label>OBJECTIVE</label><textarea id='caseObjective'>${esc(val(s,'Objective','objective'))}</textarea></div><div class='field wide'><label>INSIGHT</label><textarea id='caseInsight'>${esc(val(s,'Insight','insight'))}</textarea></div><div class='field wide'><label>BIG IDEA</label><textarea id='caseIdea'>${esc(val(s,'Idea','idea'))}</textarea></div><div class='field wide'><label>EXECUTION</label><textarea id='caseExecution'>${esc(val(s,'Execution','execution'))}</textarea></div><div class='field wide'><label>CASE SUMMARY</label><textarea id='caseSummary'>${esc(val(s,'Summary','summary'))}</textarea></div></div><div class='actions'><button class='new' onclick='CasesModule.saveStudio()'>SAVE CASE STORY</button><button class='secondary' onclick="CasesModule.exportCase('draft')">EXPORT INTERNAL DRAFT</button><button class='secondary' onclick="CasesModule.exportCase('final')">EXPORT FINAL</button></div></div>`;root().innerHTML=shell(body,'Case Studio','Turn authorised evidence into an editable case narrative.');
}
async function saveStudio(){const payload={caseId:caseId(),challenge:document.getElementById('caseChallenge').value,objective:document.getElementById('caseObjective').value,insight:document.getElementById('caseInsight').value,idea:document.getElementById('caseIdea').value,execution:document.getElementById('caseExecution').value,summary:document.getElementById('caseSummary').value};try{await api('CASES_SAVE_STUDIO',payload);showToast('Cases','Case story saved.');await renderStudio()}catch(e){alert(e.message)}}
async function exportCase(mode){if(mode==='final'&&!confirm('Create a FINAL case export? ONIT will block any metric or evidence without external publication clearance.'))return;try{const d=await api('CASES_EXPORT',{caseId:caseId(),mode});showToast('Cases',mode==='final'?'Final case export created.':'Internal draft export created.');if(d.url&&confirm('Export created in the organisation Drive. Open it now?'))window.open(d.url,'_blank','noopener')}catch(e){alert(e.message)}}
async function renderApprovals(){
  const d=await getCase(caseId()),r=d.reviews||[];const body=`${selectedHeader(d)}<div class='casePanel'><h3>CASE REVIEW</h3>${r.length?r.map(x=>`<div class='caseApproval ${String(val(x,'Decision','decision')).toLowerCase()==='approved'?'approved':'revision'}'><b>${esc(val(x,'Decision','decision'))}</b><div class='tiny'>${esc(val(x,'Reviewer Name','reviewerName'))} • ${esc(val(x,'At','at'))}</div><div>${esc(val(x,'Comment','comment'))}</div></div>`).join(''):`<div class='empty'>No review decisions yet.</div>`}<div class='actions'><button class='secondary' onclick="CasesModule.review('corrections')">REQUEST CORRECTIONS</button><button class='new' onclick="CasesModule.review('approved')">APPROVE CASE OUTPUT</button></div></div>`;root().innerHTML=shell(body,'Approvals','Case approval is separate from the underlying brief approval.');
}
async function review(decision){const comment=(prompt(decision==='approved'?'Approval note:':'Correction request:','')||'').trim();if(!comment&&decision!=='approved')return;try{await api('CASES_REVIEW',{caseId:caseId(),decision,comment});await renderApprovals();showToast('Cases',decision==='approved'?'Case approved.':'Corrections requested.')}catch(e){alert(e.message)}}
async function renderAccess(){
  if(!owner()){state.tab='library';return render()}
  const d=await api('CASES_OWNER_GRANTS');state.grants=d.members||[];state.cap.enabled=!!d.enabled;
  const rows=state.grants.map(m=>`<div class='caseMemberRow'><div><b>${esc(val(m,'Full Name','fullName'))}</b><div class='tiny'>${esc(val(m,'Email','email'))} • ${esc(val(m,'Department','department'))} • ${esc(val(m,'Position','position'))}</div></div><button class='secondary ${m.granted?'dangerAction':''}' onclick="CasesModule.toggleGrant('${esc(val(m,'User ID','userId'))}',${m.granted?'false':'true'})">${m.granted?'REVOKE':'GRANT'}</button></div>`).join('')||`<div class='empty'>No active staff accounts available.</div>`;
  root().innerHTML=shell(`<div class='ownerCasesBar'><b>Cases pilot is ${enabled()?'ENABLED':'OFF'}</b><div class='tiny'>Module entitlement remains per-user. Role, department or Organisation Admin status never grants Cases automatically.</div><div class='actions'><button class='${enabled()?'secondary dangerAction':'new'}' onclick='CasesModule.togglePilot()'>${enabled()?'TURN PILOT OFF':'ENABLE PRIVATE PILOT'}</button></div></div><div class='casePanel'><h3>INDIVIDUAL ACCESS</h3>${rows}</div>`,'Access Control','Only the backend-verified System Owner can grant or revoke Cases access.');
}
async function togglePilot(){const next=!enabled();if(!confirm(next?'Enable the private Cases pilot for individually granted users in this organisation?':'Turn Cases off for all non-owner users immediately?'))return;try{const d=await api('CASES_OWNER_ENABLE',{enabled:next});state.cap.enabled=!!d.enabled;await renderAccess()}catch(e){alert(e.message)}}
async function toggleGrant(userId,grant){const reason=(prompt(grant?'Optional reason for grant:':'Optional reason for revoke:','Private Cases pilot')||'').trim();try{await api(grant?'CASES_OWNER_GRANT':'CASES_OWNER_REVOKE',{targetUserId:userId,reason});await refreshCapabilities(true);await renderAccess()}catch(e){alert(e.message)}}
async function openTab(tab){state.tab=tab;await render()}
async function refresh(){await refreshCapabilities(true);await render()}
function applyCapabilities(){refreshCapabilities(true).then(()=>setNav())}
const originalApply=window.applyPermissions;if(typeof originalApply==='function')window.applyPermissions=function(){const r=originalApply.apply(this,arguments);setTimeout(()=>refreshCapabilities(true),0);return r};
const originalShow=window.show;if(typeof originalShow==='function')window.show=function(id,btn){if(id==='cases'&&!allowed()){refreshCapabilities(true).then(()=>{if(allowed())originalShow.call(window,id,btn);else showToast('Cases','Cases is locked for this account.')});return}const r=originalShow.apply(this,arguments);if(id==='cases')render();return r};
window.addEventListener('focus',()=>{if(typeof SESSION_TOKEN!=='undefined'&&SESSION_TOKEN)refreshCapabilities()});setInterval(()=>{if(typeof SESSION_TOKEN!=='undefined'&&SESSION_TOKEN)refreshCapabilities()},60000);
window.CasesModule={render,refresh,refreshCapabilities,applyCapabilities,openTab,newCase,selectCase,linkBrief,addMember,addEvidence,addMetric,importMetrics,importClientJson,saveStudio,exportCase,review,togglePilot,toggleGrant};
setTimeout(()=>refreshCapabilities(true),250);
})();
