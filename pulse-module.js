/* ONIT Digital Pulse v0.32.0 — unified leadership authority + signed-in read access */
(function(){
'use strict';
const state={cap:null,tab:'today',data:null,candidates:null,lastAt:0,lastCapAt:0,busy:false,dirty:false,dirtyGroups:new Set(),draftsLoaded:false,lastSavedAt:0,lastQuietSyncAt:0,quietSyncBusy:false,dataFingerprint:''};
const esc=v=>typeof escapeHTML==='function'?escapeHTML(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const val=(o,...ks)=>{for(const k of ks){if(o&&o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k]}return ''};
const api=(action,data={})=>apiPost(action,data,true).then(r=>r.data||r);
const root=()=>document.getElementById('pulseRoot');
const nav=()=>document.getElementById('navPulse');
const currentUserObj=()=>typeof currentUser!=='undefined'&&currentUser?currentUser:null;
const currentDepartment=()=>{const u=currentUserObj();return String((u&&((typeof rowVal==='function'&&rowVal(u,'Department'))||u['Department']||u.department))||'')};
const currentPosition=()=>{const u=currentUserObj();return String((u&&((typeof rowVal==='function'&&rowVal(u,'Position'))||u['Position']||u.position))||'')};
const currentIdentity=()=>{const u=currentUserObj();return String((u&&(((typeof rowVal==='function'&&rowVal(u,'Full Name'))||u['Full Name']||u.fullName)||'')+' '+(((typeof rowVal==='function'&&rowVal(u,'Email'))||u['Email']||u.email)||'')))};
const fallbackCap=()=>{const active=typeof SESSION_TOKEN!=='undefined'&&!!SESSION_TOKEN&&typeof CURRENT_USER_ID!=='undefined'&&!!CURRENT_USER_ID&&!!currentUserObj(),digital=/digital/i.test(currentDepartment()),ownerFlag=typeof isOwner==='function'?!!isOwner(currentUserObj()):false,leadership=ownerFlag||(typeof isAgencyLeadership==='function'&&isAgencyLeadership(currentUserObj()))||(typeof isCreativeLeadership==='function'&&isCreativeLeadership(currentUserObj()))||(typeof isManagingDirector==='function'&&isManagingDirector(currentUserObj()))||(typeof isDrKunbiUser==='function'&&isDrKunbiUser(currentUserObj()))||(typeof canApprove==='function'&&canApprove(currentUserObj()))||/^(creative director|deputy creative director|cd|dcd|md|managing director)$/i.test(currentPosition().trim())||/\b(kunbi|kumbi)\b/i.test(currentIdentity());return{canUse:active,canWrite:active&&digital,canPromoteToCases:active&&(digital||leadership||ownerFlag),canBuildOnePageCase:active&&(leadership||ownerFlag),canDownloadReport:active&&(leadership||ownerFlag),isOwner:ownerFlag,isDigital:digital,isLeadership:leadership,department:currentDepartment(),fallback:true}};
const allowed=()=>!!(fallbackCap().canUse||state.cap?.canUse);
const owner=()=>!!(state.cap?.isOwner||fallbackCap().isOwner);
const canWrite=()=>!!(state.cap?.canWrite||fallbackCap().canWrite);
const canPromote=()=>!!(state.cap?.canPromoteToCases||fallbackCap().canPromoteToCases);
const canBuildOnePageCase=()=>!!(state.cap?.canBuildOnePageCase||fallbackCap().canBuildOnePageCase);
const canDownloadReport=()=>!!(state.cap?.canDownloadReport||fallbackCap().canDownloadReport);

const DRAFT_GROUPS={
 readiness:['pulseInbox','pulseOvernight','pulseUrgent','pulseScheduled','pulseHealth','pulseReadinessNote'],
 engagement:['peBrand','peCampaign','pePlatform','peBrief','peComments','peDms','peWelcomes','peTopics','peNotes','peCase'],
 content:['pcTitle','pcBrand','pcCampaign','pcPlatform','pcType','pcStatus','pcSchedule','pcBrief','pcUrl','pcNotes','pcCase'],
 insight:['piBrand','piCampaign','piSource','piType','piSentiment','piBrief','piInsight','piCase'],
 escalation:['pxBrand','pxCampaign','pxSource','pxSeverity','pxType','pxBrief','pxSummary','pxCase'],
 metric:['pmBrand','pmCampaign','pmName','pmValue','pmUnit','pmPlatform','pmPeriod','pmBrief','pmSource','pmCase']
};
const ACTION_GROUP={PULSE_SAVE_READINESS:'readiness',PULSE_LOG_ENGAGEMENT:'engagement',PULSE_ADD_CONTENT:'content',PULSE_ADD_INSIGHT:'insight',PULSE_ADD_ESCALATION:'escalation',PULSE_ADD_METRIC:'metric'};
function groupForId(id){return Object.keys(DRAFT_GROUPS).find(g=>DRAFT_GROUPS[g].includes(id))||''}
function draftStoreKey(){const org=typeof ORG_ID!=='undefined'?ORG_ID:'org',uid=typeof CURRENT_USER_ID!=='undefined'?CURRENT_USER_ID:'user';return `onit-pulse-drafts:${org}:${uid}`}
function readDraftStore(){try{const x=JSON.parse(localStorage.getItem(draftStoreKey())||'null');return x&&typeof x==='object'?x:{tabs:{},lastTab:'today'}}catch(e){return{tabs:{},lastTab:'today'}}}
function writeDraftStore(d){try{localStorage.setItem(draftStoreKey(),JSON.stringify(d||{tabs:{},lastTab:'today'}))}catch(e){}}
function storeHasDrafts(d){return !!Object.values((d&&d.tabs)||{}).some(t=>Array.isArray(t.groups)&&t.groups.length)}
function syncGlobalDirty(){
 const d=readDraftStore(),dirty=storeHasDrafts(d);
 state.dirty=dirty;
 if(typeof uiDirtySections!=='undefined'){
   if(dirty)uiDirtySections.add('pulse');else uiDirtySections.delete('pulse');
 }
 if(typeof window!=='undefined'&&window.uiDirtySections){
   if(dirty)window.uiDirtySections.add('pulse');else window.uiDirtySections.delete('pulse');
 }
 updateDraftStatus();
}
function saveDraftNow(){
 if(!canWrite())return;
 const r=root();if(!r)return;
 const values={},groups=[...state.dirtyGroups];
 groups.forEach(g=>(DRAFT_GROUPS[g]||[]).forEach(id=>{
   const el=document.getElementById(id);if(!el)return;
   values[id]=el.type==='checkbox'?!!el.checked:el.value;
 }));
 const d=readDraftStore();d.tabs=d.tabs||{};d.lastTab=state.tab;
 if(groups.length)d.tabs[state.tab]={values,groups,savedAt:Date.now()};else delete d.tabs[state.tab];
 writeDraftStore(d);syncGlobalDirty();
}
function restoreDraft(){
 if(!canWrite())return;
 const d=readDraftStore(),tab=d.tabs&&d.tabs[state.tab];
 state.dirtyGroups=new Set((tab&&tab.groups)||[]);
 Object.entries((tab&&tab.values)||{}).forEach(([id,v])=>{
   const el=document.getElementById(id);if(!el)return;
   if(el.type==='checkbox')el.checked=!!v;else el.value=v==null?'':v;
 });
 syncGlobalDirty();
}
function clearDraftGroup(action){
 const g=ACTION_GROUP[action];if(!g)return;
 const d=readDraftStore();d.tabs=d.tabs||{};const tab=d.tabs[state.tab]||{values:{},groups:[]};
 tab.groups=(tab.groups||[]).filter(x=>x!==g);(DRAFT_GROUPS[g]||[]).forEach(id=>{if(tab.values)delete tab.values[id]});
 if(tab.groups.length)d.tabs[state.tab]=tab;else delete d.tabs[state.tab];
 d.lastTab=state.tab;writeDraftStore(d);state.dirtyGroups=new Set((d.tabs[state.tab]&&d.tabs[state.tab].groups)||[]);syncGlobalDirty();
}
function markDraftFromEvent(e){
 const el=e.target;if(!el||!root()?.contains(el)||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||!el.id)return;
 const g=groupForId(el.id);if(!g)return;
 state.dirtyGroups.add(g);saveDraftNow();
}
function restoreLastTab(){
 if(!canWrite()||state.draftsLoaded)return;
 const d=readDraftStore();state.draftsLoaded=true;
 if(d.lastTab&&['today','engagement','content','listening','reports','cases'].includes(d.lastTab))state.tab=d.lastTab;
 syncGlobalDirty();
}
function updateDraftStatus(){
 const el=document.getElementById('pulseSaveState');if(!el)return;
 const d=readDraftStore(),has=storeHasDrafts(d);
 if(has){el.textContent='UNSAVED DRAFT PROTECTED';el.className='dpSaveState draft';}
 else if(state.lastSavedAt){el.textContent='SAVED TO ONIT';el.className='dpSaveState saved';}
 else {el.textContent=canWrite()?'READY TO SAVE':'';el.className='dpSaveState';}
}
document.addEventListener('input',markDraftFromEvent,true);
document.addEventListener('change',markDraftFromEvent,true);
window.addEventListener('beforeunload',saveDraftNow);
function setNav(){const n=nav();if(!n)return;const signedIn=typeof SESSION_TOKEN!=='undefined'&&!!SESSION_TOKEN&&typeof CURRENT_USER_ID!=='undefined'&&!!CURRENT_USER_ID&&!!currentUserObj();n.classList.toggle('hiddenByRole',!signedIn)}
function fmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}}
function num(v){v=Number(v);return Number.isFinite(v)?v:0}
function tabbar(){const tabs=[['today','Today'],['engagement','Engagement'],['content','Content'],['listening','Listening'],['reports','Reports'],['cases','Case Signals']];return `<div class='pulseTabs'>${tabs.map(([id,l])=>`<button class='${state.tab===id?'active':''}' onclick="DigitalPulse.openTab('${id}')">${l}</button>`).join('')}</div>`}
function shell(body,title='Digital Pulse',sub='Always-on digital operations, listening and campaign evidence.'){
 const reportDownload=(!canWrite()&&state.tab==='reports'&&canDownloadReport())?`<button class='secondary' onclick='DigitalPulse.downloadReport()'>DOWNLOAD REPORT</button>`:'';
 const status=canWrite()?`<span id='pulseSaveState' class='dpSaveState'>READY TO SAVE</span><span class='dpLive editor'><i></i> EDIT MODE</span>`:`<span class='dpLive'><i></i> LIVE VIEW</span>`;
 return `<div class='dpShell'><div class='dpTop'><div><div class='dpEyebrow'>ONIT • DIGITAL</div><h1>${esc(title)}</h1><p class='muted'>${esc(sub)}</p></div><div class='actions'>${status}${reportDownload}<button class='secondary' onclick='DigitalPulse.refresh()'>REFRESH</button></div></div>${tabbar()}${body}</div>`;
}
function loading(label='Digital Pulse'){const r=root();if(r)r.innerHTML=shell(`<div class='dpLoading'><span class='dpSpinner'></span><div><b>Loading ${esc(label)}…</b><div class='tiny'>Your click registered. ONIT is refreshing Pulse.</div></div></div>`,label)}
async function refreshCapabilities(force=false){if(typeof SESSION_TOKEN==='undefined'||!SESSION_TOKEN||typeof CURRENT_USER_ID==='undefined'||!CURRENT_USER_ID){state.cap=null;setNav();return null}if(!force&&state.cap&&Date.now()-state.lastCapAt<300000)return state.cap;try{state.cap=await api('PULSE_CAPABILITIES');state.lastCapAt=Date.now();setNav();return state.cap}catch(e){state.cap=fallbackCap();state.cap.capabilityError=String(e&&e.message||e||'Pulse capability check failed');state.lastCapAt=Date.now();setNav();return state.cap}}
function pulseFingerprint(d){try{return JSON.stringify({today:d?.today||'',daily:d?.daily||null,teamReadiness:d?.teamReadiness||[],summary:d?.summary||{},engagement:d?.engagement||[],content:d?.content||[],insights:d?.insights||[],escalations:d?.escalations||[],metrics:d?.metrics||[]})}catch(e){return String(Date.now())}}
async function load(force=false){if(!force&&state.data)return state.data;state.data=await api('PULSE_DASHBOARD');state.lastAt=Date.now();state.dataFingerprint=pulseFingerprint(state.data);return state.data}
async function quietLeadershipSync(force=false){
 if(canWrite()||state.quietSyncBusy||!allowed()||document.getElementById('pulse')?.classList.contains('hidden'))return false;
 const now=Date.now();if(!force&&now-state.lastQuietSyncAt<55000)return false;
 state.quietSyncBusy=true;state.lastQuietSyncAt=now;
 try{
   const fresh=await api('PULSE_DASHBOARD'),fp=pulseFingerprint(fresh);
   if(fp===state.dataFingerprint)return false;
   const scrollTop=document.scrollingElement?document.scrollingElement.scrollTop:window.scrollY;
   state.data=fresh;state.dataFingerprint=fp;state.lastAt=Date.now();state.candidates=null;
   if(state.tab==='today')today();else if(state.tab==='engagement')engagement();else if(state.tab==='content')content();else if(state.tab==='listening')listening();else if(state.tab==='reports')reports();else if(state.tab==='cases')await cases();
   requestAnimationFrame(()=>{try{window.scrollTo(0,scrollTop)}catch(e){}});
   return true;
 }catch(e){console.warn('Pulse quiet sync:',e&&e.message||e);return false}
 finally{state.quietSyncBusy=false}
}
function metric(label,value,hint=''){return `<div class='dpMetric'><span>${esc(label)}</span><b>${esc(value)}</b>${hint?`<small>${esc(hint)}</small>`:''}</div>`}
function userName(id){const u=(state.data?.digitalUsers||[]).find(x=>val(x,'User ID','userId')===id);return u?val(u,'Full Name','fullName'):id||'Unassigned'}
function teamStatus(){const d=state.data||{},rows=(d.digitalUsers||[]).map(u=>{const id=val(u,'User ID'),latestEsc=(d.escalations||[]).find(x=>val(x,'User ID')===id&&String(val(x,'Status')||'Open').toLowerCase()!=='resolved'),latestEng=(d.engagement||[]).find(x=>val(x,'User ID')===id),latestContent=(d.content||[]).find(x=>val(x,'User ID')===id&&['planned','scheduled'].includes(String(val(x,'Status')).toLowerCase()));let tone='available',status='Available',detail='No active Pulse update';if(latestEsc){tone='alert';status='Escalation';detail=`${val(latestEsc,'Brand')} • ${val(latestEsc,'Severity')}`}else if(latestEng){tone='active';status='Community engagement';detail=`${val(latestEng,'Platform')} • ${val(latestEng,'Brand')}`}else if(latestContent){tone='watch';status='Content operations';detail=`${val(latestContent,'Platform')} • ${val(latestContent,'Brand')}`};return `<div class='dpPerson'><span class='dpDot ${tone}'></span><div><b>${esc(val(u,'Full Name'))}</b><small>${esc(status)} · ${esc(detail)}</small></div></div>`}).join('');return rows||`<div class='empty'>No Digital Strategy users found.</div>`}
function readiness(d){
 if(!canWrite()){
   const team=(d.teamReadiness||[]);
   const rows=team.length?team.map(x=>{
     const r=x.readiness||{},done=['Inbox Cleared','Overnight Reviewed','Urgent Issues Reviewed','Scheduled Content Checked'].filter(k=>String(val(r,k)).toLowerCase()==='true').length;
     const health=val(r,'Community Health')||'No update',note=val(r,'Notes')||'',at=val(r,'Updated At');
     return `<div class='dpReadinessRow'><div><b>${esc(x.fullName||'Digital team member')}</b><small>${done}/4 readiness checks • ${esc(health)}${note?' • '+esc(note):''}</small></div><span class='pill'>${at?esc(fmtDate(at)):'NOT SAVED'}</span></div>`;
   }).join(''):`<div class='empty'>No Digital readiness update has been saved today.</div>`;
   return `<div class='dpCard'><div class='dpCardHead'><div><h3>DIGITAL TEAM READINESS</h3><p>Saved morning status from the Digital team. This view updates automatically for leadership.</p></div><span class='pill'>SAVED STATUS</span></div>${rows}</div>`;
 }
 const x=d.daily||{};const items=[['pulseInbox','Inbox cleared','Inbox Cleared'],['pulseOvernight','Overnight notifications reviewed','Overnight Reviewed'],['pulseUrgent','Urgent issues handled','Urgent Issues Reviewed'],['pulseScheduled','Scheduled content checked','Scheduled Content Checked']];
 return `<div class='dpCard'><div class='dpCardHead'><div><h3>MORNING READINESS</h3><p>This saves your start-of-day operational status — it does not save Engagement, Content, Listening or Reports.</p></div><span class='pill'>${esc(d.today||'TODAY')}</span></div><div class='dpChecklist'>${items.map(([id,l,k])=>`<label><input id='${id}' type='checkbox' ${String(val(x,k)).toLowerCase()==='true'?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div><div class='dpFormRow'><div class='field'><label>COMMUNITY HEALTH</label><select id='pulseHealth'><option ${val(x,'Community Health')==='Normal'?'selected':''}>Normal</option><option ${val(x,'Community Health')==='Watch'?'selected':''}>Watch</option><option ${val(x,'Community Health')==='Issue'?'selected':''}>Issue</option></select></div><div class='field'><label>NOTE</label><input id='pulseReadinessNote' value='${esc(val(x,'Notes'))}' placeholder='Anything the team should know?'></div></div><button class='new' onclick='DigitalPulse.saveReadiness()'>SAVE READINESS</button><div class='tiny dpSaveHint'>Saves this readiness block to ONIT and makes it visible to leadership.</div></div>`;
}
function today(){const d=state.data||{},s=d.summary||{},open=(d.escalations||[]).filter(x=>String(val(x,'Status')||'Open').toLowerCase()!=='resolved').slice(0,5),upcoming=(d.content||[]).filter(x=>['planned','scheduled','blocked'].includes(String(val(x,'Status')).toLowerCase())).slice(0,6);root().innerHTML=shell(`${readiness(d)}<div class='dpMetrics'>${metric('COMMENTS',s.comments||0)}${metric('DMs',s.dms||0)}${metric('PUBLISHED',s.contentPublished||0)}${metric('OPEN ISSUES',s.openEscalations||0)}</div><div class='dpGrid'><div class='dpCard'><div class='dpCardHead'><div><h3>DIGITAL TEAM RIGHT NOW</h3><p>Latest Pulse activity, not brief workload.</p></div></div>${teamStatus()}</div><div class='dpCard'><div class='dpCardHead'><div><h3>OPEN ESCALATIONS</h3><p>What needs attention now.</p></div></div>${open.length?open.map(x=>`<div class='dpRow'><div><b>${esc(val(x,'Brand')||val(x,'Campaign')||'Digital issue')}</b><small>${esc(val(x,'Severity'))} • ${esc(val(x,'Type'))} • ${esc(val(x,'Summary'))}</small></div>${canWrite()?`<button class='secondary' onclick="DigitalPulse.resolveEscalation('${esc(val(x,'Escalation ID'))}')">RESOLVE</button>`:`<span class='pill'>OPEN</span>`}</div>`).join(''):`<div class='empty'>No open escalations.</div>`}</div></div><div class='dpCard'><div class='dpCardHead'><div><h3>CONTENT NEXT UP</h3><p>Planned, scheduled and blocked items.</p></div><button class='secondary' onclick="DigitalPulse.openTab('content')">OPEN CALENDAR</button></div>${upcoming.length?upcoming.map(contentRow).join(''):`<div class='empty'>No upcoming content logged.</div>`}</div>`)}
function engagement(){const d=state.data||{};const form=canWrite()?`<div class='dpCard'><div class='dpCardHead'><div><h3>LOG ENGAGEMENT</h3><p>Log community work in batches — not one comment at a time.</p></div></div><div class='dpFormGrid'><div class='field'><label>BRAND</label><input id='peBrand'></div><div class='field'><label>CAMPAIGN</label><input id='peCampaign'></div><div class='field'><label>PLATFORM</label><select id='pePlatform'><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>X</option><option>YouTube</option><option>LinkedIn</option><option>Community</option><option>Other</option></select></div><div class='field'><label>BRIEF CODE (OPTIONAL)</label><input id='peBrief'></div><div class='field'><label>COMMENTS HANDLED</label><input id='peComments' type='number' min='0' value='0'></div><div class='field'><label>DMs ANSWERED</label><input id='peDms' type='number' min='0' value='0'></div><div class='field'><label>NEWCOMERS WELCOMED</label><input id='peWelcomes' type='number' min='0' value='0'></div><div class='field'><label>DISCUSSION TOPICS</label><input id='peTopics' type='number' min='0' value='0'></div><div class='field wide'><label>NOTE</label><textarea id='peNotes' placeholder='What happened in the community?'></textarea></div></div><label class='dpCandidate'><input id='peCase' type='checkbox'> Flag this activity as possible Case evidence</label><button class='new' onclick='DigitalPulse.logEngagement()'>SAVE ENGAGEMENT UPDATE</button></div>`:`<div class='dpCard'><b>LIVE VIEW</b><p class='muted'>You can see Digital engagement activity as it is logged. Only Digital users can add or edit entries.</p></div>`;root().innerHTML=shell(`${form}<div class='dpCard'><h3>RECENT ENGAGEMENT</h3>${(d.engagement||[]).length?(d.engagement||[]).slice(0,30).map(x=>`<div class='dpRow'><div><b>${esc(val(x,'Platform'))} · ${esc(val(x,'Brand')||'Brand')}</b><small>${num(val(x,'Comments Handled'))} comments • ${num(val(x,'DMs Answered'))} DMs • ${num(val(x,'Newcomers Welcomed'))} welcomed • ${esc(fmtDate(val(x,'Created At')))}</small></div>${String(val(x,'Case Candidate')).toLowerCase()==='true'?`<span class='dpCaseFlag'>CASE</span>`:''}</div>`).join(''):`<div class='empty'>No engagement logs yet.</div>`}</div>`,'Engagement','Batch-log comments, DMs, welcomes and discussion activity.')}
function contentRow(x){const id=esc(val(x,'Content ID')),status=String(val(x,'Status')||'Planned');return `<div class='dpRow'><div><b>${esc(val(x,'Title'))}</b><small>${esc(val(x,'Platform'))} • ${esc(val(x,'Brand'))} • ${esc(status)}${val(x,'Scheduled At')?' • '+esc(fmtDate(val(x,'Scheduled At'))):''}</small></div><div class='dpRowActions'>${canWrite()?(status.toLowerCase()!=='published'?`<button class='secondary' onclick="DigitalPulse.updateContent('${id}','Published')">PUBLISHED</button>`:'')+(status.toLowerCase()!=='blocked'?`<button class='secondary' onclick="DigitalPulse.updateContent('${id}','Blocked')">BLOCK</button>`:''):`<span class='pill'>${esc(status)}</span>`}</div></div>`}
function content(){const d=state.data||{};const gate=canWrite()?'':' hidden';root().innerHTML=shell(`<div class='dpCard${gate}'><div class='dpCardHead'><div><h3>ADD CONTENT</h3><p>Connect approved work to what actually goes live.</p></div></div><div class='dpFormGrid'><div class='field'><label>TITLE</label><input id='pcTitle'></div><div class='field'><label>BRAND</label><input id='pcBrand'></div><div class='field'><label>CAMPAIGN</label><input id='pcCampaign'></div><div class='field'><label>PLATFORM</label><select id='pcPlatform'><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>X</option><option>YouTube</option><option>LinkedIn</option><option>Other</option></select></div><div class='field'><label>CONTENT TYPE</label><input id='pcType' value='Post'></div><div class='field'><label>STATUS</label><select id='pcStatus'><option>Planned</option><option>Scheduled</option><option>Published</option><option>Blocked</option></select></div><div class='field'><label>SCHEDULED AT</label><input id='pcSchedule' type='datetime-local'></div><div class='field'><label>BRIEF CODE</label><input id='pcBrief'></div><div class='field wide'><label>ASSET / LIVE URL</label><input id='pcUrl' placeholder='https://'></div><div class='field wide'><label>NOTE</label><textarea id='pcNotes'></textarea></div></div><label class='dpCandidate'><input id='pcCase' type='checkbox'> Flag as possible Case evidence</label><button class='new' onclick='DigitalPulse.addContent()'>SAVE CONTENT UPDATE</button></div><div class='dpCard'><h3>CONTENT OPERATIONS</h3>${(d.content||[]).length?(d.content||[]).map(contentRow).join(''):`<div class='empty'>No content logged yet.</div>`}</div>`,'Content','A live content operations calendar connected to campaign work.')}
function listening(){const d=state.data||{},open=(d.escalations||[]).filter(x=>String(val(x,'Status')||'Open').toLowerCase()!=='resolved');const gate=canWrite()?'':' hidden';root().innerHTML=shell(`<div class='dpGrid'><div class='dpCard'><h3>ADD INSIGHT</h3><div class='dpFormGrid'><div class='field'><label>BRAND</label><input id='piBrand'></div><div class='field'><label>CAMPAIGN</label><input id='piCampaign'></div><div class='field'><label>SOURCE</label><select id='piSource'><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>X</option><option>YouTube</option><option>Community</option><option>Other</option></select></div><div class='field'><label>TYPE</label><select id='piType'><option>Consumer question</option><option>Complaint</option><option>Opportunity</option><option>Feature request</option><option>Behaviour</option><option>Observation</option></select></div><div class='field'><label>SENTIMENT</label><select id='piSentiment'><option>Positive</option><option selected>Neutral</option><option>Negative</option></select></div><div class='field'><label>BRIEF CODE</label><input id='piBrief'></div><div class='field wide'><label>INSIGHT</label><textarea id='piInsight' placeholder='What are people saying or doing?'></textarea></div></div><label class='dpCandidate'><input id='piCase' type='checkbox'> Save as possible Case evidence</label><button class='new' onclick='DigitalPulse.addInsight()'>SAVE INSIGHT</button></div><div class='dpCard'><h3>ESCALATE ISSUE</h3><div class='dpFormGrid'><div class='field'><label>BRAND</label><input id='pxBrand'></div><div class='field'><label>CAMPAIGN</label><input id='pxCampaign'></div><div class='field'><label>SOURCE</label><input id='pxSource' placeholder='TikTok / Instagram / etc.'></div><div class='field'><label>SEVERITY</label><select id='pxSeverity'><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div><div class='field'><label>TYPE</label><select id='pxType'><option>Client issue</option><option>Creative issue</option><option>Product complaint</option><option>PR issue</option><option>Customer service</option><option>Potential crisis</option></select></div><div class='field'><label>BRIEF CODE</label><input id='pxBrief'></div><div class='field wide'><label>SUMMARY</label><textarea id='pxSummary'></textarea></div></div><label class='dpCandidate'><input id='pxCase' type='checkbox'> Flag for possible Case evidence</label><button class='new' onclick='DigitalPulse.addEscalation()'>SAVE ESCALATION</button></div></div><div class='dpCard'><h3>LIVE LISTENING</h3>${(d.insights||[]).slice(0,25).map(x=>`<div class='dpRow'><div><b>${esc(val(x,'Brand')||val(x,'Campaign')||'Community insight')}</b><small>${esc(val(x,'Sentiment'))} • ${esc(val(x,'Type'))} • ${esc(val(x,'Insight'))}</small></div>${String(val(x,'Case Candidate')).toLowerCase()==='true'?`<span class='dpCaseFlag'>CASE</span>`:''}</div>`).join('')||`<div class='empty'>No insights logged yet.</div>`}</div><div class='dpCard'><h3>OPEN ESCALATIONS</h3>${open.map(x=>`<div class='dpRow'><div><b>${esc(val(x,'Severity'))} · ${esc(val(x,'Brand')||'Issue')}</b><small>${esc(val(x,'Type'))} • ${esc(val(x,'Summary'))} • ${esc(fmtDate(val(x,'Created At')))}</small></div>${canWrite()?`<button class='secondary' onclick="DigitalPulse.resolveEscalation('${esc(val(x,'Escalation ID'))}')">RESOLVE</button>`:`<span class='pill'>OPEN</span>`}</div>`).join('')||`<div class='empty'>No open escalations.</div>`}</div>`,'Listening','Capture sentiment, consumer questions, opportunities and issues before they disappear into chat threads.')}
function reports(){const d=state.data||{},s=d.summary||{},sent=s.sentiment||{},gate=canWrite()?'':' hidden';root().innerHTML=shell(`<div class='dpMetrics'>${metric('COMMENTS',s.comments||0,'Today')}${metric('DMs',s.dms||0,'Today')}${metric('INSIGHTS',s.insightsToday||0,'Today')}${metric('OPEN ISSUES',s.openEscalations||0)}</div><div class='dpGrid'><div class='dpCard'><h3>SENTIMENT TODAY</h3><div class='dpSentiment'><div><b>${num(sent.positive)}</b><span>Positive</span></div><div><b>${num(sent.neutral)}</b><span>Neutral</span></div><div><b>${num(sent.negative)}</b><span>Negative</span></div></div></div><div class='dpCard${gate}'><h3>ADD PERFORMANCE METRIC</h3><div class='dpFormGrid'><div class='field'><label>BRAND</label><input id='pmBrand'></div><div class='field'><label>CAMPAIGN</label><input id='pmCampaign'></div><div class='field'><label>METRIC</label><input id='pmName' placeholder='Engagement rate'></div><div class='field'><label>VALUE</label><input id='pmValue'></div><div class='field'><label>UNIT</label><input id='pmUnit' placeholder='%, views, members'></div><div class='field'><label>PLATFORM</label><input id='pmPlatform'></div><div class='field'><label>PERIOD</label><input id='pmPeriod' placeholder='22 Oct 2026 / campaign period'></div><div class='field'><label>BRIEF CODE</label><input id='pmBrief'></div><div class='field wide'><label>SOURCE</label><input id='pmSource' placeholder='Platform analytics / client report / URL'></div></div><label class='dpCandidate'><input id='pmCase' type='checkbox'> Flag metric for Cases</label><button class='new' onclick='DigitalPulse.addMetric()'>SAVE METRIC</button></div></div><div class='dpCard'><h3>RECENT METRICS</h3>${(d.metrics||[]).length?(d.metrics||[]).map(x=>`<div class='dpRow'><div><b>${esc(val(x,'Name'))}: ${esc(val(x,'Value'))} ${esc(val(x,'Unit'))}</b><small>${esc(val(x,'Brand'))} • ${esc(val(x,'Platform'))} • ${esc(val(x,'Period'))} • ${esc(val(x,'Source'))}</small></div>${String(val(x,'Case Candidate')).toLowerCase()==='true'?`<span class='dpCaseFlag'>CASE</span>`:''}</div>`).join(''):`<div class='empty'>No performance metrics logged yet.</div>`}</div>`,'Reports','Pulse builds the daily digital report from work the team already logs.')}

function downloadPdfPayload(d){
 if(!d||!d.base64)return onitAlert('ONIT could not prepare this PDF.');
 try{
   const raw=atob(d.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const blob=new Blob([bytes],{type:d.mimeType||'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=d.fileName||'ONIT.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }catch(e){onitAlert('Could not download PDF. '+e.message)}
}
async function downloadReport(){
 if(!canDownloadReport()){showToast('Digital Pulse','Report download is available to leadership.');return}
 if(state.busy)return;state.busy=true;
 try{showToast('Digital Pulse','Preparing report…');const d=await api('PULSE_EXPORT_REPORT',{date:state.data?.today||''});downloadPdfPayload(d);showToast('Digital Pulse','Report downloaded.');}
 catch(e){onitAlert(e.message)}finally{state.busy=false}
}

function candidateSummary(x){const r=x.row||{},t=x.sourceType;if(t==='metric')return `${val(r,'Name')}: ${val(r,'Value')} ${val(r,'Unit')}`;if(t==='insight')return val(r,'Insight');if(t==='escalation')return val(r,'Summary');if(t==='content')return `${val(r,'Platform')} — ${val(r,'Title')} (${val(r,'Status')})`;return `${val(r,'Platform')} — ${val(r,'Comments Handled')} comments, ${val(r,'DMs Answered')} DMs`}
async function cases(){
 if(!state.candidates)state.candidates=await api('PULSE_CASE_CANDIDATES');
 const list=state.candidates.candidates||[];
 const rows=list.length?list.map(x=>{
   let action=`<span class='dpCaseFlag'>FLAGGED</span>`;
   if(canBuildOnePageCase())action=`<button class='new' onclick="DigitalPulse.buildOnePageCase('${esc(x.sourceType)}','${esc(x.sourceId)}')">BUILD 1-PAGE CASE</button>`;
   return `<div class='dpRow'><div><b>${esc(x.brand||x.campaign||x.sourceType)}</b><small>${esc(x.sourceType.toUpperCase())} • ${esc(candidateSummary(x))}</small></div>${action}</div>`;
 }).join(''):`<div class='empty'>No items have been flagged for Cases yet.</div>`;
 root().innerHTML=shell(`<div class='dpCard'><div class='dpCardHead'><div><h3>CASE SIGNALS</h3><p>Digital flags strong moments. Leadership decides which signals become a one-page Case draft.</p></div><span class='pill'>${list.length} SIGNAL${list.length===1?'':'S'}</span></div>${rows}</div><div class='dpCard'><h3>HOW THIS CONNECTS</h3><p class='muted'>BUILD 1-PAGE CASE creates a private Case draft, carries the Pulse evidence across, links the brief when available, and downloads a one-page internal PDF. Missing challenge, idea or results stay clearly marked for completion rather than being invented.</p></div>`,'Case Signals','Turn verified Digital evidence into a case draft while the work is still fresh.');
}
async function buildOnePageCase(sourceType,sourceId){
 if(!canBuildOnePageCase()){showToast('Digital Pulse','Only leadership or the System Owner can build a one-page Case.');return}
 if(!await onitConfirm('Build a private 1-page Case draft from this Digital Pulse signal?'))return;
 if(state.busy)return;state.busy=true;
 try{
   showToast('Cases','Building 1-page Case draft…');
   const d=await api('PULSE_BUILD_ONE_PAGE_CASE',{sourceType,sourceId});
   state.candidates=null;state.lastAt=0;await load(true);downloadPdfPayload(d);
   showToast('Cases',`Case ${d.caseId||''} created and the one-page draft downloaded.`);
   await cases();
 }catch(e){onitAlert(e.message)}finally{state.busy=false}
}
async function render(){const r=root();if(!r)return;await refreshCapabilities(false);restoreLastTab();if(!allowed()){r.innerHTML=shell(`<div class='dpLock'><b>Digital Pulse is not available for this account.</b><div class='muted'>Digital Pulse is available to active ONIT users.</div></div>`);return}try{await load();if(state.tab==='today')today();else if(state.tab==='engagement')engagement();else if(state.tab==='content')content();else if(state.tab==='listening')listening();else if(state.tab==='reports')reports();else if(state.tab==='cases')await cases();restoreDraft();updateDraftStatus();}catch(e){r.innerHTML=shell(`<div class='dpLock'><b>Pulse could not load.</b><div class='muted'>${esc(e.message)}</div></div>`)} }
async function openTab(tab){saveDraftNow();state.tab=tab;const d=readDraftStore();d.lastTab=tab;writeDraftStore(d);state.dirtyGroups=new Set((d.tabs&&d.tabs[tab]&&d.tabs[tab].groups)||[]);loading(({today:'Today',engagement:'Engagement',content:'Content',listening:'Listening',reports:'Reports',cases:'Case Signals'})[tab]||'Digital Pulse');await render()}
async function refresh(){
 saveDraftNow();state.lastAt=0;state.candidates=null;
 if(canWrite()&&state.dirty){showToast('Digital Pulse','Draft protected. Refreshing saved data without discarding what you typed.');}
 if(!state.dirty)loading();
 await load(true);await render();
}
async function mutate(action,payload,msg){
 if(!canWrite()){showToast('Digital Pulse','View only. Only users in the Digital department can update Pulse.');return}
 if(state.busy)return;state.busy=true;saveDraftNow();
 try{
   await api(action,payload);
   clearDraftGroup(action);state.lastSavedAt=Date.now();state.lastAt=0;state.candidates=null;
   await load(true);
   showToast('Saved to ONIT',`${msg} Leadership live view will update automatically.`);
   await render();
 }catch(e){saveDraftNow();onitAlert(e.message)}
 finally{state.busy=false;updateDraftStatus()}
}
function byId(id){return document.getElementById(id)}
function checked(id){return !!byId(id)?.checked}
function text(id){return byId(id)?.value||''}
function saveReadiness(){return mutate('PULSE_SAVE_READINESS',{inbox:checked('pulseInbox'),overnight:checked('pulseOvernight'),urgent:checked('pulseUrgent'),scheduled:checked('pulseScheduled'),communityHealth:text('pulseHealth'),notes:text('pulseReadinessNote')},'Morning readiness saved.')}
function logEngagement(){return mutate('PULSE_LOG_ENGAGEMENT',{brand:text('peBrand'),campaign:text('peCampaign'),platform:text('pePlatform'),briefCode:text('peBrief'),comments:num(text('peComments')),dms:num(text('peDms')),welcomes:num(text('peWelcomes')),topics:num(text('peTopics')),notes:text('peNotes'),caseCandidate:checked('peCase')},'Engagement update saved.')}
function addContent(){return mutate('PULSE_ADD_CONTENT',{title:text('pcTitle'),brand:text('pcBrand'),campaign:text('pcCampaign'),platform:text('pcPlatform'),contentType:text('pcType'),status:text('pcStatus'),scheduledAt:text('pcSchedule'),briefCode:text('pcBrief'),assetUrl:text('pcUrl'),notes:text('pcNotes'),caseCandidate:checked('pcCase')},'Content update saved.')}
function updateContent(contentId,status){return mutate('PULSE_UPDATE_CONTENT',{contentId,status},`Content marked ${status}.`)}
function addInsight(){return mutate('PULSE_ADD_INSIGHT',{brand:text('piBrand'),campaign:text('piCampaign'),source:text('piSource'),type:text('piType'),sentiment:text('piSentiment'),briefCode:text('piBrief'),insight:text('piInsight'),caseCandidate:checked('piCase')},'Insight saved.')}
function addEscalation(){return mutate('PULSE_ADD_ESCALATION',{brand:text('pxBrand'),campaign:text('pxCampaign'),source:text('pxSource'),severity:text('pxSeverity'),type:text('pxType'),briefCode:text('pxBrief'),summary:text('pxSummary'),caseCandidate:checked('pxCase')},'Escalation saved.')}
async function resolveEscalation(escalationId){if(!await onitConfirm('Mark this escalation as resolved?'))return;return mutate('PULSE_RESOLVE_ESCALATION',{escalationId},'Escalation resolved.')}
function addMetric(){return mutate('PULSE_ADD_METRIC',{brand:text('pmBrand'),campaign:text('pmCampaign'),name:text('pmName'),value:text('pmValue'),unit:text('pmUnit'),platform:text('pmPlatform'),period:text('pmPeriod'),briefCode:text('pmBrief'),source:text('pmSource'),caseCandidate:checked('pmCase')},'Performance metric saved.')}
async function sendToCases(sourceType,sourceId){if(!canPromote()){showToast('Digital Pulse','You do not have permission to send Pulse evidence to Cases.');return}const caseId=(await onitPrompt('Enter the ONIT Case ID to receive this evidence:','')||'').trim();if(!caseId)return;try{await api('PULSE_SEND_TO_CASES',{sourceType,sourceId,caseId});state.candidates=null;state.lastAt=0;showToast('Digital Pulse','Evidence sent to Cases Data Vault.');await render()}catch(e){onitAlert(e.message)}}
const originalApply=window.applyPermissions;if(typeof originalApply==='function')window.applyPermissions=function(){const r=originalApply.apply(this,arguments);setTimeout(()=>refreshCapabilities(false),3200);return r};
const originalShow=window.show;if(typeof originalShow==='function')window.show=function(id,btn){const r=originalShow.apply(this,arguments);if(id==='pulse'){restoreLastTab();loading();render()}return r};
const originalLoad=window.loadFromGoogle;if(typeof originalLoad==='function')window.loadFromGoogle=async function(){return await originalLoad.apply(this,arguments)};
// Editors never auto-refresh underneath active work. Leadership uses quiet polling: no spinner, no redraw unless saved Pulse data actually changed.
setInterval(()=>{quietLeadershipSync(false)},90000);
window.DigitalPulse={render,refresh,openTab,saveReadiness,logEngagement,addContent,updateContent,addInsight,addEscalation,resolveEscalation,addMetric,sendToCases,downloadReport,buildOnePageCase,refreshCapabilities,quietLeadershipSync};
setTimeout(()=>{if(typeof SESSION_TOKEN!=='undefined'&&SESSION_TOKEN)refreshCapabilities(false);syncGlobalDirty()},11000);
})();
