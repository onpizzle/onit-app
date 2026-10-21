const APP_VERSION='0.18.7';
const BACKEND_DATASETS=['USERS','CLIENTS','BRIEFS','ASSIGNMENTS','ITERATIONS','ACTIVITY_LOG','NOTIFICATIONS','REPORTS'];
const API_URL='https://script.google.com/macros/s/AKfycbyY98jKIh2ls8jKsB5w2H7YG3Okj61AoIkt3-2x0LBnvRVwDgBhrQnVr1Ghfu04J7YB/exec';
let ORG_ID=localStorage.getItem('onit-org')||'';
const MAX_FILE_BYTES=8*1024*1024;
let CURRENT_USER_ID=localStorage.getItem('onit-user')||'';
let SESSION_TOKEN=localStorage.getItem('onit-session')||'';
let briefs=[],users=[],clients=[],allAssignments=[],notifications=[],teamWorkload=[],reports=[],reportSummary=null,homeAnalytics=null,organisations=[],pendingUsers=[],securityInfo=null,accessDirectory=[],permissions={},dataExports=[];
let utilisationMode='weekly';
let selectedAccessEmail='',activeBackendDataset='',currentBroadcast=null;
const profilePhotoCache=new Map();
let current=null,currentUser=null,apiOnline=false,mutationBusy=false,backendVersion='',serverOffset=0,loadGeneration=0,lastListSection='home',briefFilter='ALL',refreshInFlight=false,lastStateVersion='';
const FIREBASE_CONFIG={apiKey:'AIzaSyAmpqFDMfo6zAorD-f14hTQnSNFDFU6VHM',authDomain:'onit-backend-api.firebaseapp.com',projectId:'onit-backend-api',storageBucket:'onit-backend-api.firebasestorage.app',messagingSenderId:'1052909191157',appId:'1:1052909191157:web:392c4a50b453deb5ebeabc'};
let firebaseApp=null,firebaseDb=null,firebaseRealtimeHealthy=false,firebaseStarting=false,firebaseUnsubs=[],firebaseActivityRows=new Map(),lastFallbackPulseAt=0;
let audioReady=false,currentDetailTab='brief';
const uiDirtySections=new Set();
function uiSectionId(el){const s=el&&el.closest?el.closest('main>section'):null;return s?s.id:''}
function markUiDirty(el){const id=uiSectionId(el);if(id)uiDirtySections.add(id)}
function clearUiDirty(id){if(id)uiDirtySections.delete(id)}
function uiSectionIsDirty(id){return uiDirtySections.has(id)}
function trackUiEdit(e){
  const el=e.target;
  if(!el||!el.matches||!el.matches('input, textarea, select'))return;
  if(el.type==='button'||el.type==='submit'||el.type==='reset')return;
  markUiDirty(el);
}
document.addEventListener('input',trackUiEdit,true);
document.addEventListener('change',trackUiEdit,true);
const submissionRequests=new Map();
const announcedKey=id=>'onit-announced-'+id;
let announcedNotifications=new Set(JSON.parse(localStorage.getItem(announcedKey(CURRENT_USER_ID||'guest'))||'[]'));

function rowVal(r,...names){for(const n of names){if(r&&r[n]!==undefined&&r[n]!==null)return r[n]}return ''}
function truthy(v){return v===true||String(v).toLowerCase()==='true'}
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function positionOf(u){return String(rowVal(u,'Position','position')||rowVal(u,'Role','role')||'').trim()}
function departmentOf(u){return String(rowVal(u,'Department','department')||'').trim()}
function permissionProfile(u){return String(rowVal(u,'Permission Profile','permissionProfile')||'').toUpperCase()}
function isOwner(u=currentUser){return !!u&&(permissionProfile(u)==='ORG_OWNER'||String(rowVal(u,'Role')).toLowerCase()==='system owner')}
function backendAccess(u=currentUser){if(isOwner(u))return BACKEND_DATASETS.slice();const v=String(rowVal(u,'Backend Data Access')||'').trim().toUpperCase();return v?v.split(',').map(x=>x.trim()).filter(x=>BACKEND_DATASETS.includes(x)):[]}
function isManagingDirector(u=currentUser){const p=positionOf(u).toLowerCase();return p==='md'||p==='managing director'}
function isDrKunbiUser(u=currentUser){return !!u&&(String(rowVal(u,'User ID'))==='USR-TIOLUWALOGO-OLAKUN'||String(rowVal(u,'Email')).toLowerCase()==='kunbi@spice360.com.ng'||positionOf(u).toLowerCase()==='group head, brands & accounts management')}
function isAccountManagerUser(u=currentUser){return !!u&&(permissionProfile(u)==='ACCOUNT_MANAGER'||departmentOf(u).toLowerCase()==='account management')&&!isManagingDirector(u)}
function canCreateBrief(u=currentUser){if(!u||isOwner(u))return false;const roleAllowed=permissionProfile(u)==='ACCOUNT_MANAGER'||departmentOf(u).toLowerCase()==='account management'||isCreativeLeadership(u)||isManagingDirector(u);if(u===currentUser&&permissions&&typeof permissions.createBrief!=='undefined')return !!permissions.createBrief||roleAllowed;return roleAllowed}
function canApprove(u=currentUser){if(!u)return false;const p=positionOf(u).toLowerCase();return truthy(rowVal(u,'Can Approve Final'))||['creative director','deputy creative director','md','managing director'].includes(p)}
function canReview(u=currentUser){return !!u&&(canApprove(u)||['ceo','chief executive officer'].includes(positionOf(u).toLowerCase()))}
function isTeamLeadUser(u=currentUser){return !!u&&truthy(rowVal(u,'Team Lead'))}
function isCreativeLeadership(u){const p=positionOf(u).toLowerCase();return p==='creative director'||p==='deputy creative director'}
function userById(id){if(!id)return null;if(currentUser&&rowVal(currentUser,'User ID')===id)return currentUser;return users.find(u=>rowVal(u,'User ID')===id)||null}
function leadershipAssigneeBrief(b){return isCreativeLeadership(userById(b?.assigneeUserId))}
function exportApprovalRole(){return String(permissions.exportApprovalRole||'')}
function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?'}
function isSenior(u=currentUser){return !!u&&['CREATIVE_LEADERSHIP','EXECUTIVE','ORG_ADMIN','ORG_OWNER'].includes(permissionProfile(u))}
function isHR(u=currentUser){return !!u&&(departmentOf(u).toLowerCase()==='hr'||permissionProfile(u)==='HR_ADMIN')}
function canManagePeople(u=currentUser){return isOwner(u)||isHR(u)||isSenior(u)}
function canManageClients(u=currentUser){return !!u&&(isAccountManagerUser(u)||isManagingDirector(u)||isOwner(u))}
function canSeeReports(u=currentUser){return isOwner(u)||backendAccess(u).includes('REPORTS')}
function currentUserName(){return rowVal(currentUser,'Full Name','fullName')||'User'}
function greetingText(){
  const parts=new Intl.DateTimeFormat('en-GB',{hour:'numeric',hour12:false,timeZone:'Africa/Lagos'}).formatToParts(new Date());
  const hour=Number(parts.find(p=>p.type==='hour')?.value||0)%24;
  if(hour<12)return 'Good morning';
  if(hour<17)return 'Good afternoon';
  return 'Good evening';
}
function currentUserAssignment(code,type='TO'){return allAssignments.find(a=>sameBrief(a,code)&&rowVal(a,'User ID','userId')===CURRENT_USER_ID&&String(rowVal(a,'Assignment Type','assignmentType')).toUpperCase()===type&&String(rowVal(a,'Active','active')).toLowerCase()!=='false')}
function activeToAssignment(code){return allAssignments.find(a=>sameBrief(a,code)&&String(rowVal(a,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(rowVal(a,'Active','active')).toLowerCase()!=='false')||null}
function taskAcknowledged(code){return !!rowVal(activeToAssignment(code),'Acknowledged At','acknowledgedAt')}
function sameBrief(r,code){return String(rowVal(r,'Brief Code','briefCode','code'))===String(code)}
function parseJsonArray(v){try{const a=JSON.parse(v||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function versionAtLeast(actual,min){const a=String(actual||'').split('.').map(Number),b=String(min).split('.').map(Number);for(let i=0;i<3;i++){const x=a[i]||0,y=b[i]||0;if(x>y)return true;if(x<y)return false}return true}
function setBusy(on){document.getElementById('loadbar').classList.toggle('hidden',!on)}
function connectionNotice(message){let el=document.getElementById('connectionNotice');if(!el){el=document.createElement('div');el.id='connectionNotice';el.className='notice';el.setAttribute('role','status');const main=document.querySelector('#appShell main');if(main)main.prepend(el)}if(el){el.textContent=message||'';el.hidden=!message}}

function sheetBriefToUI(r){return {
  code:rowVal(r,'Brief Code','briefCode','code'),clientId:rowVal(r,'Client ID','clientId'),client:rowVal(r,'Client Name','clientName','client')||'Client',brand:rowVal(r,'Brand','brand')||'',project:rowVal(r,'Project Title','projectTitle','project')||'Untitled Brief',description:rowVal(r,'Description','description')||'',deliverables:rowVal(r,'Deliverables','deliverables')||'',priority:rowVal(r,'Priority','priority')||'Normal',
  createdByUserId:rowVal(r,'Created By User ID'),createdAt:rowVal(r,'Created At'),approvalRequestedAt:rowVal(r,'Approval Requested At'),approvalDueAt:rowVal(r,'Approval Due At'),deadline:rowVal(r,'Current Deadline','currentDeadline','deadline'),originalDeadline:rowVal(r,'Original Deadline'),pauseStartedAt:rowVal(r,'Pause Started At'),pauseRemainingMs:rowVal(r,'Pause Remaining Ms'),finalApproved:truthy(rowVal(r,'Final Approved')),approvedBy:rowVal(r,'Approved By User ID'),approvedByPosition:rowVal(r,'Approved By Position'),approvedAt:rowVal(r,'Approved At'),clientSent:truthy(rowVal(r,'Client Sent')),clientSentBy:rowVal(r,'Client Sent By User ID'),clientSentAt:rowVal(r,'Client Sent At'),status:rowVal(r,'Status','status')||'Assigned',paused:truthy(rowVal(r,'Paused','paused')),iteration:Number(rowVal(r,'Current Iteration','currentIteration','iteration')||0),
  attachmentIds:parseJsonArray(rowVal(r,'Brief Attachment IDs')),attachmentNames:parseJsonArray(rowVal(r,'Brief Attachment Names')),attachmentTypes:parseJsonArray(rowVal(r,'Brief Attachment Types')),attachmentUrls:parseJsonArray(rowVal(r,'Brief Attachment URLs')),
  iterations:[],activity:[],activityRows:[],assignee:'Assigned team',assigneeUserId:'',assigneeFullName:''
}}

async function fetchWithTimeout(url,options={},timeoutMs=25000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  catch(e){if(e&&e.name==='AbortError')throw new Error('Request timed out. Please retry.');throw e}
  finally{clearTimeout(timer)}
}
async function apiGet(action='bootstrap'){
  if(!SESSION_TOKEN)throw new Error('AUTH_REQUIRED');
  const url=API_URL+'?action='+encodeURIComponent(action)+'&token='+encodeURIComponent(SESSION_TOKEN);
  const r=await fetchWithTimeout(url,{},20000);if(!r.ok)throw new Error('API '+r.status);const data=await r.json();if(data.success!==true)throw new Error(data.error||'Could not load ONIT backend.');return data
}
async function apiPost(action,payload={},requiresAuth=true){const data={...payload};if(requiresAuth){if(!SESSION_TOKEN)throw new Error('AUTH_REQUIRED');data.sessionToken=SESSION_TOKEN}const r=await fetchWithTimeout(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,data})},30000);if(!r.ok)throw new Error('API '+r.status);const result=await r.json();if(!result.success)throw new Error(result.error||result.message||'API request failed');return result}
function table(data,name){if(name==='ACTIVITY_LOG'&&Array.isArray(data.activity))return data.activity;return data[name]||data[name.toLowerCase()]||data.data?.[name]||data.data?.[name.toLowerCase()]||[]}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function firebasePlain_(value){if(value&&typeof value.toDate==='function')return value.toDate().toISOString();if(Array.isArray(value))return value.map(firebasePlain_);if(value&&typeof value==='object'){const out={};Object.keys(value).forEach(k=>out[k]=firebasePlain_(value[k]));return out}return value}
function stopFirebaseRealtime(){firebaseUnsubs.forEach(fn=>{try{fn()}catch(e){}});firebaseUnsubs=[];firebaseRealtimeHealthy=false;firebaseStarting=false;firebaseActivityRows=new Map();}
function firebaseRenderLive_(){
  if(!document.getElementById('home').classList.contains('hidden'))renderHome();
  if(!document.getElementById('briefs').classList.contains('hidden'))renderBriefs();
  if(!document.getElementById('archive').classList.contains('hidden'))renderArchive();
  if(current&&!document.getElementById('detail').classList.contains('hidden')){current=briefs.find(b=>b.code===current.code)||current;renderDetail();}
}
function applyFirebaseBriefChange_(change){
  const data=firebasePlain_(change.doc.data()||{}),row=data.row||{},code=rowVal(row,'Brief Code')||data.briefCode||change.doc.id;if(!code)return;
  if(change.type==='removed'){briefs=briefs.filter(b=>b.code!==code);allAssignments=allAssignments.filter(a=>!sameBrief(a,code));if(current&&current.code===code){current=null;show('home')}firebaseRenderLive_();return;}
  const old=briefs.find(b=>b.code===code),b=sheetBriefToUI(row);b.iterations=old?.iterations||[];b.activityRows=old?.activityRows||[];b.activity=old?.activity||[];
  const as=Array.isArray(data.assignments)?data.assignments:[];allAssignments=allAssignments.filter(a=>!sameBrief(a,code)).concat(as);
  const tos=as.filter(a=>String(rowVal(a,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(rowVal(a,'Active','active')).toLowerCase()!=='false');if(tos.length){b.assignee=tos.map(a=>rowVal(a,'Full Name','fullName')||'Assigned team').join(' + ');b.assigneeUserId=rowVal(tos[0],'User ID','userId');b.assigneeFullName=rowVal(tos[0],'Full Name','fullName')||b.assignee;}
  const liveActs=[...firebaseActivityRows.values()].filter(a=>sameBrief(a,code)).sort((a,z)=>new Date(rowVal(a,'Timestamp','timestamp')||0)-new Date(rowVal(z,'Timestamp','timestamp')||0));if(liveActs.length){b.activityRows=liveActs;b.activity=liveActs.map(r=>`${formatTime(rowVal(r,'Timestamp','timestamp'))} — ${rowVal(r,'Action','action')}${rowVal(r,'Reason','reason')?' — '+rowVal(r,'Reason','reason'):''}`);}
  const i=briefs.findIndex(x=>x.code===code);if(i>=0)briefs[i]=b;else briefs.push(b);if(current&&current.code===code)current=b;firebaseRenderLive_();
}
function applyFirebaseActivityChange_(change){const data=firebasePlain_(change.doc.data()||{}),row=data.row||{},id=rowVal(row,'Activity ID')||data.activityId||change.doc.id;if(change.type==='removed')firebaseActivityRows.delete(id);else firebaseActivityRows.set(id,row);briefs.forEach(b=>{const rows=[...firebaseActivityRows.values()].filter(a=>sameBrief(a,b.code)).sort((a,z)=>new Date(rowVal(a,'Timestamp','timestamp')||0)-new Date(rowVal(z,'Timestamp','timestamp')||0));if(rows.length){b.activityRows=rows;b.activity=rows.map(r=>`${formatTime(rowVal(r,'Timestamp','timestamp'))} — ${rowVal(r,'Action','action')}${rowVal(r,'Reason','reason')?' — '+rowVal(r,'Reason','reason'):''}`)}});firebaseRenderLive_();}
function applyFirebaseNotificationSnapshot_(snap){
  const live=snap.docs.map(d=>{const x=firebasePlain_(d.data()||{});return x.row||x||{}}),byId=new Map(notifications.map(n=>[rowVal(n,'Notification ID'),n]));live.forEach(n=>byId.set(rowVal(n,'Notification ID'),n));notifications=[...byId.values()];renderNotifications();showNextBroadcast();
}
async function startFirebaseRealtime(){
  if(firebaseStarting||firebaseUnsubs.length||!SESSION_TOKEN||!CURRENT_USER_ID||!ORG_ID||typeof firebase==='undefined')return;firebaseStarting=true;
  try{
    if(!firebase.apps.length)firebaseApp=firebase.initializeApp(FIREBASE_CONFIG);else firebaseApp=firebase.app();firebaseDb=firebase.firestore();
    let authUser=firebase.auth().currentUser;if(!authUser){const cred=await firebase.auth().signInAnonymously();authUser=cred.user;}
    await apiPost('bindFirebaseIdentity',{firebaseUid:authUser.uid});
    const briefsQ=firebaseDb.collection('organisations').doc(ORG_ID).collection('briefs').where('viewerUserIds','array-contains',CURRENT_USER_ID);
    firebaseUnsubs.push(briefsQ.onSnapshot(snap=>{snap.docChanges().forEach(applyFirebaseBriefChange_);firebaseRealtimeHealthy=true;connectionNotice('')},err=>{firebaseRealtimeHealthy=false;console.warn('Firebase briefs:',err)}));
    const activityQ=firebaseDb.collection('organisations').doc(ORG_ID).collection('activity').where('viewerUserIds','array-contains',CURRENT_USER_ID);
    firebaseUnsubs.push(activityQ.onSnapshot(snap=>{snap.docChanges().forEach(applyFirebaseActivityChange_);firebaseRealtimeHealthy=true},err=>{firebaseRealtimeHealthy=false;console.warn('Firebase activity:',err)}));
    const notifQ=firebaseDb.collection('organisations').doc(ORG_ID).collection('users').doc(CURRENT_USER_ID).collection('notifications');
    firebaseUnsubs.push(notifQ.onSnapshot(snap=>{applyFirebaseNotificationSnapshot_(snap);firebaseRealtimeHealthy=true},err=>{firebaseRealtimeHealthy=false;console.warn('Firebase notifications:',err)}));
  }catch(e){firebaseRealtimeHealthy=false;console.warn('Firebase realtime unavailable; ONIT fallback remains active.',e);}finally{firebaseStarting=false;}
}

function saveSession(result){const d=result.data||result;if(!d.sessionToken)throw new Error('No session token returned.');SESSION_TOKEN=d.sessionToken;CURRENT_USER_ID=rowVal(d.user,'User ID');ORG_ID=rowVal(d.organisation,'Organisation ID');localStorage.setItem('onit-session',SESSION_TOKEN);localStorage.setItem('onit-user',CURRENT_USER_ID);localStorage.setItem('onit-org',ORG_ID);announcedNotifications=new Set(JSON.parse(localStorage.getItem(announcedKey(CURRENT_USER_ID))||'[]'));}
function clearSession(){stopFirebaseRealtime();try{if(typeof firebase!=='undefined'&&firebase.auth().currentUser)firebase.auth().signOut().catch(()=>{})}catch(e){}SESSION_TOKEN='';CURRENT_USER_ID='';ORG_ID='';currentUser=null;current=null;localStorage.removeItem('onit-session');localStorage.removeItem('onit-user');localStorage.removeItem('onit-org');}
function showAuthMessage(message,type=''){const el=document.getElementById('authMessage');el.textContent=message||'';el.className='authMessage'+(message?' '+type:' hidden')}
function showAuthMode(mode){showAuthMessage('');['signInForm','signUpForm','resetForm'].forEach(id=>document.getElementById(id).classList.add('hidden'));document.getElementById('signInTab').classList.toggle('active',mode==='signin');document.getElementById('signUpTab').classList.toggle('active',mode==='signup');document.getElementById('signInForm').classList.toggle('hidden',mode!=='signin');document.getElementById('signUpForm').classList.toggle('hidden',mode!=='signup');if(mode==='signup')updateSignupMode();if(mode==='reset')document.getElementById('resetForm').classList.remove('hidden')}
function updateSignupMode(){const code=(document.getElementById('signupCode')?.value||'').trim(),owner=/^OWNER-/i.test(code),fields=document.getElementById('staffIdentityFields'),hint=document.getElementById('ownerSignupHint'),position=document.getElementById('signupPosition');if(fields)fields.classList.toggle('hidden',owner);if(hint)hint.classList.toggle('hidden',!owner);if(position)position.required=!owner}
function showReset(){showAuthMode('reset');document.getElementById('resetCodeFields').classList.add('hidden');document.getElementById('resetSubmit').textContent='SEND RESET CODE';document.getElementById('resetSubmit').dataset.stage='request'}
async function handleSignIn(e){e.preventDefault();const button=e.submitter||e.target.querySelector('button[type=submit]');button.disabled=true;setBusy(true);showAuthMessage('Signing you in…');try{const res=await apiPost('signIn',{email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value,organisation:document.getElementById('loginOrganisation').value,deviceLabel:navigator.userAgent},false);saveSession(res);document.getElementById('authGate').classList.add('hidden');document.getElementById('appShell').classList.remove('hidden');await loadFromGoogle(false);show('home')}catch(err){showAuthMessage(err.message,'error')}finally{button.disabled=false;setBusy(false)}}
async function handleSignUp(e){e.preventDefault();const password=document.getElementById('signupPassword').value;if(password!==document.getElementById('signupConfirm').value)return showAuthMessage('The passwords do not match.','error');const button=e.submitter||e.target.querySelector('button[type=submit]');button.disabled=true;setBusy(true);showAuthMessage('Creating your account…');try{const res=await apiPost('signUp',{fullName:document.getElementById('signupName').value,email:document.getElementById('signupEmail').value,department:document.getElementById('signupDepartment').value,position:document.getElementById('signupPosition').value,organisationCode:document.getElementById('signupCode').value,password,deviceLabel:navigator.userAgent},false),d=res.data||res;if(d.pending){showAuthMode('signin');document.getElementById('loginEmail').value=document.getElementById('signupEmail').value;showAuthMessage(d.message||'Account request submitted.','ok')}else{saveSession(res);document.getElementById('authGate').classList.add('hidden');document.getElementById('appShell').classList.remove('hidden');await loadFromGoogle(false);show('home')}}catch(err){showAuthMessage(err.message,'error')}finally{button.disabled=false;setBusy(false)}}
async function handleReset(e){e.preventDefault();const button=e.submitter||document.getElementById('resetSubmit'),stage=button.dataset.stage||'request';button.disabled=true;setBusy(true);try{if(stage==='request'){const res=await apiPost('requestPasswordReset',{email:document.getElementById('resetEmail').value,organisation:document.getElementById('resetOrganisation').value},false);showAuthMessage(((res.data||res).message||'If the account exists, a code was sent.')+' If it does not arrive within 2 minutes, ask your System Owner to confirm the exact email saved on your ONIT account.','ok');document.getElementById('resetCodeFields').classList.remove('hidden');button.textContent='RESET PASSWORD';button.dataset.stage='reset'}else{await apiPost('resetPassword',{email:document.getElementById('resetEmail').value,organisation:document.getElementById('resetOrganisation').value,code:document.getElementById('resetCode').value,password:document.getElementById('resetPassword').value},false);showAuthMode('signin');showAuthMessage('Password reset. You can sign in now.','ok')}}catch(err){showAuthMessage(err.message,'error')}finally{button.disabled=false;setBusy(false)}}
async function handleSignOut(){try{if(SESSION_TOKEN)await apiPost('signOut',{})}catch(e){}clearSession();document.getElementById('appShell').classList.add('hidden');document.getElementById('authGate').classList.remove('hidden');showAuthMode('signin');showAuthMessage('Signed out.','ok')}
function authError(err){return /session has expired|AUTH_REQUIRED|Session token/i.test(String(err&&err.message||err))}

async function loadFromGoogle(strict=false,silent=false){
  if(!SESSION_TOKEN)return;
  if(refreshInFlight&&silent)return;
  const generation=++loadGeneration;refreshInFlight=true;
  if(!silent)setBusy(true);
  let lastError=null;
  try{
    for(let attempt=0;attempt<3;attempt++){
      try{
        const data=await apiGet('bootstrap');if(generation!==loadGeneration)return;
        backendVersion=data.version||'';serverOffset=data.serverTime?new Date(data.serverTime).getTime()-Date.now():0;
        if(!versionAtLeast(backendVersion,'0.15.5'))throw new Error('Backend '+backendVersion+' is older than the ONIT V0.15.5 Firebase backend required by this frontend. Deploy backend V0.15.5 first.');
        lastStateVersion=String(data.stateVersion||lastStateVersion||'');organisations=data.organisations||[];users=table(data,'USERS');pendingUsers=data.pendingUsers||[];accessDirectory=data.accessDirectory||[];securityInfo=data.security||null;permissions=data.permissions||{};clients=table(data,'CLIENTS');allAssignments=table(data,'ASSIGNMENTS');notifications=table(data,'NOTIFICATIONS');reports=table(data,'REPORTS');dataExports=data.dataExports||[];teamWorkload=data.teamWorkload||[];reportSummary=data.reportSummary||null;homeAnalytics=data.homeAnalytics||null;currentUser=data.currentUser||users.find(u=>rowVal(u,'User ID','userId')===CURRENT_USER_ID)||null;
        if(!currentUser)throw new Error('Your signed-in profile is not available.');CURRENT_USER_ID=rowVal(currentUser,'User ID');ORG_ID=rowVal(currentUser,'Organisation ID');localStorage.setItem('onit-user',CURRENT_USER_ID);localStorage.setItem('onit-org',ORG_ID);
        const rows=table(data,'BRIEFS'),iterations=table(data,'ITERATIONS'),activities=table(data,'ACTIVITY_LOG');briefs=rows.map(sheetBriefToUI);briefs.forEach(b=>{const as=allAssignments.filter(r=>sameBrief(r,b.code)&&String(rowVal(r,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(rowVal(r,'Active','active')).toLowerCase()!=='false');if(as.length){b.assignee=as.map(r=>rowVal(r,'Full Name','fullName')||'Assigned team').join(' + ');b.assigneeUserId=rowVal(as[0],'User ID','userId');b.assigneeFullName=rowVal(as[0],'Full Name','fullName')||b.assignee}b.iterations=iterations.filter(r=>sameBrief(r,b.code)).sort((a,z)=>Number(rowVal(a,'Version Number','versionNumber')||0)-Number(rowVal(z,'Version Number','versionNumber')||0)).map(r=>({v:Number(rowVal(r,'Version Number','versionNumber')||0),file:rowVal(r,'File Name','fileName')||'Submission',fileType:rowVal(r,'File Type','fileType')||'',driveFileId:rowVal(r,'Drive File ID','driveFileId')||'',driveFileUrl:rowVal(r,'Drive File URL','driveFileUrl')||'',note:rowVal(r,'Submission Note')||'',clientSent:truthy(rowVal(r,'Client Sent')),clientSentAt:rowVal(r,'Client Sent At'),state:rowVal(r,'Status','status')||'Submitted',id:rowVal(r,'Iteration ID','iterationId'),feedback:rowVal(r,'Feedback'),submittedAt:rowVal(r,'Submitted At'),approvedBy:rowVal(r,'Approved By User ID'),approvedAt:rowVal(r,'Approved At'),teamLeadRequired:truthy(rowVal(r,'Team Lead Required')),teamLeadApproved:truthy(rowVal(r,'Team Lead Approved')),teamLeadApprovedBy:rowVal(r,'Team Lead Approved By User ID'),teamLeadApprovedAt:rowVal(r,'Team Lead Approved At')}));b.activityRows=activities.filter(r=>sameBrief(r,b.code)).sort((a,z)=>new Date(rowVal(a,'Timestamp','timestamp')||0)-new Date(rowVal(z,'Timestamp','timestamp')||0));b.activity=b.activityRows.map(r=>`${formatTime(rowVal(r,'Timestamp','timestamp'))} — ${rowVal(r,'Action','action')}${rowVal(r,'Reason','reason')?' — '+rowVal(r,'Reason','reason'):''}`)});
        apiOnline=true;connectionNotice('');applyPermissions();
        const preserve=silent?new Set(uiDirtySections):new Set();
        if(!preserve.has('newbrief')){populateClients();populateAssignees();}
        if(!preserve.has('home'))renderHome();
        renderBriefFilters();
        if(!preserve.has('briefs'))renderBriefs();
        if(!preserve.has('archive'))renderArchive();
        if(!preserve.has('team'))renderTeam();
        if(!preserve.has('more'))renderMore();
        renderNotifications();hydrateProfilePhotos();showNextBroadcast();startFirebaseRealtime();
        if(!document.getElementById('data').classList.contains('hidden')&&!preserve.has('data'))renderDataPage();
        if(current){current=briefs.find(b=>b.code===current.code)||null;if(current){if(!preserve.has('detail'))renderDetail()}else show('home')}
        if(!silent)uiDirtySections.clear();
        return;
      }catch(e){lastError=e;if(authError(e))throw e;if(attempt<2){await sleep(650*(attempt+1));continue}throw e}
    }
  }catch(e){
    console.error(e);apiOnline=false;
    if(authError(e)){clearSession();document.getElementById('appShell').classList.add('hidden');document.getElementById('authGate').classList.remove('hidden');showAuthMode('signin');showAuthMessage('Your session expired. Please sign in again.','error');return}
    if(!silent)connectionNotice('ONIT could not refresh right now. Retrying automatically.');
    if(strict)throw e;
  }finally{refreshInFlight=false;if(!silent)setBusy(false)}
}
function show(id,btn){document.querySelectorAll('main>section').forEach(x=>x.classList.add('hidden'));document.getElementById(id).classList.remove('hidden');if(['home','briefs','team','archive','data','more'].includes(id))lastListSection=id;const keep=uiSectionIsDirty(id);if(id==='home'&&!keep)renderHome();if(id==='briefs'&&!keep)renderBriefs();if(id==='team'&&!keep)renderTeam();if(id==='archive'&&!keep)renderArchive();if(id==='data'&&!keep)renderDataPage();if(id==='more'&&!keep)renderMore();if(btn){document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}else{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.section===id))}}
function applyPermissions(){
  if(!currentUser)return;
  const org=organisations[0],mode=dashboardMode();
  const orgName=rowVal(org,'Organisation Name')||'Spice360', roleText=[departmentOf(currentUser),positionOf(currentUser)].filter(Boolean).join(' • ')+(isOwner()?' • SYSTEM OWNER':'');
  document.getElementById('orgLabel').textContent=orgName;
  document.getElementById('userRoleLabel').textContent=roleText;
  document.getElementById('userEmailLabel').textContent=rowVal(currentUser,'Email')||'';
  const sideOrg=document.getElementById('sideOrgLabel');if(sideOrg)sideOrg.textContent=orgName;
  const sideRole=document.getElementById('sideRoleLabel');if(sideRole)sideRole.textContent=isOwner()?'System Owner':(positionOf(currentUser)||departmentOf(currentUser)||'Workspace');
  const av=document.getElementById('topAvatar');if(av){av.dataset.avatarUser=CURRENT_USER_ID;av.textContent=initials(currentUserName())}
  document.querySelectorAll('.createBriefBtn').forEach(b=>b.classList.toggle('hiddenByRole',!canCreateBrief()));
  const navBriefs=document.getElementById('navBriefs');navBriefs.classList.toggle('hiddenByRole',isOwner());const navBriefLabel=navBriefs?.querySelector('.navLabel');if(navBriefLabel)navBriefLabel.textContent=canApprove()?'Briefs / Approval':(canCreateBrief()?'Briefs':'My Work');
  document.getElementById('navData').classList.toggle('hiddenByRole',!(isOwner()||backendAccess().length));
  const bt=document.getElementById('briefsTitle'),bs=document.getElementById('briefsSub');if(bt&&bs){if(canApprove()){bt.textContent='Briefs / Approval';bs.textContent='Your assigned work, briefs you have sent, and work available for leadership review.'}else if(canCreateBrief()){bt.textContent='Briefs';bs.textContent='Work you have sent into the organisation and its current status.'}else{bt.textContent='My Work';bs.textContent='Briefs assigned to you and work waiting for your action.'}}
  renderMore();hydrateProfilePhotos();
}
function workloadForBrief(b){return teamWorkload.find(w=>w.userId===b.assigneeUserId)||null}
function hoursSince(value){const t=new Date(value||0).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()+serverOffset-t)/3600000):0}
function riskForBrief(b){
  if(['Closed','Approved'].includes(b.status))return{score:0,level:'LOW',reasons:[]};
  let score=0,reasons=[],ms=b.paused?(Number(b.pauseRemainingMs)||0):new Date(b.deadline).getTime()-(Date.now()+serverOffset);
  if(Number.isFinite(ms)){if(ms<0){score+=70;reasons.push('Deadline already passed')}else if(ms<=3600000){score+=45;reasons.push('Less than 1 hour left')}else if(ms<=4*3600000){score+=30;reasons.push('Deadline within 4 hours')}else if(ms<=8*3600000){score+=20;reasons.push('Deadline within 8 hours')}}
  if(['High','Urgent'].includes(String(b.priority))){score+=10;reasons.push(`${b.priority} priority`)}
  if(b.paused){score+=10;reasons.push('Work is paused')}
  if(['Team Lead Review','In Review'].includes(b.status)&&!b.finalApproved){const latest=b.iterations[b.iterations.length-1],h=hoursSince(latest?.submittedAt||b.createdAt);if(h>=6){score+=25;reasons.push(`Approval waiting ${Math.round(h)}h`)}else if(h>=2){score+=12;reasons.push('Approval has been waiting')}}
  if(b.iteration>=4){score+=20;reasons.push(`Already at V${b.iteration}`)}else if(b.iteration>=2){score+=10;reasons.push(`Already at V${b.iteration}`)}
  const w=workloadForBrief(b);if(w){const open=Number(w.totalOpenCount||0);if(open>=5){score+=25;reasons.push(`${w.fullName} has ${open} open briefs`)}else if(open>=3){score+=15;reasons.push(`${w.fullName} has ${open} open briefs`)}if(w.timelineClash){score+=10;reasons.push('Timeline clash detected')}}
  if(!b.assigneeUserId){score+=25;reasons.push('No active assignee')}
  score=Math.min(100,score);return{score,level:score>=60?'HIGH':score>=35?'WATCH':'LOW',reasons:[...new Set(reasons)].slice(0,3)}
}
function riskMarkup(b){const r=riskForBrief(b),code=encodeURIComponent(b.code).replace(/'/g,'%27');return `<div class='riskCard' onclick="detail(decodeURIComponent('${code}'))"><div class='riskScore ${r.level.toLowerCase()}'>${r.score}</div><div><span class='code'>${escapeHTML(b.code)}</span><b>${escapeHTML(b.client)} — ${escapeHTML(b.project)}</b><div class='riskReasons'>${escapeHTML(r.reasons.join(' • ')||'No immediate risk signal')}</div></div><div><span class='riskLabel ${r.level==='HIGH'?'high':''}'>${r.level}</span></div></div>`}
function renderPulse(active,risks){
  const awaiting=active.filter(b=>['Team Lead Review','In Review'].includes(b.status)&&!b.finalApproved).length,paused=active.filter(b=>b.paused||b.status==='Paused').length,high=risks.filter(x=>x.r.level==='HIGH').length,watch=risks.filter(x=>x.r.level==='WATCH').length;
  const busiest=teamWorkload.slice().sort((a,b)=>Number(b.totalOpenCount||0)-Number(a.totalOpenCount||0))[0];
  const pressure=busiest&&Number(busiest.totalOpenCount||0)>0?`${busiest.fullName} carries the highest load (${busiest.totalOpenCount} open)`:'Team capacity looks clear';
  document.getElementById('pulseSummary').innerHTML=`<div class='pulseCard'><div class='pulseTop'><div><div class='pulseTitle'>ONIT PULSE</div><div class='pulseSentence'>${high?`${high} high-risk brief${high===1?'':'s'} need attention.`:watch?`${watch} brief${watch===1?'':'s'} need watching.`:'Operations look stable right now.'}</div><div class='muted'>${escapeHTML(pressure)}</div></div><span class='pill'>LIVE OPERATIONAL VIEW</span></div><div class='pulseMini'><div><span class='muted'>MOVING</span><b>${active.length}</b></div><div><span class='muted'>AT RISK</span><b>${high+watch}</b></div><div><span class='muted'>AWAITING APPROVAL</span><b>${awaiting}</b></div><div><span class='muted'>PAUSED</span><b>${paused}</b></div></div></div>`
}
function dashboardMode(){const serverMode=String(permissions.dashboardMode||'').toUpperCase();if(['OWNER','ACCOUNT','LEADERSHIP','TEAM_LEAD','STAFF'].includes(serverMode))return serverMode;if(isOwner())return 'OWNER';if(canApprove())return 'LEADERSHIP';if(canCreateBrief())return 'ACCOUNT';if(isTeamLeadUser())return 'TEAM_LEAD';return 'STAFF'}
function isAssignedToCurrent(b){return allAssignments.some(a=>sameBrief(a,b.code)&&rowVal(a,'User ID','userId')===CURRENT_USER_ID&&String(rowVal(a,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(rowVal(a,'Active','active')).toLowerCase()!=='false')}
function myAssignedBriefs(){return briefs.filter(isAssignedToCurrent)}
function myManagedBriefs(){return briefs.filter(b=>b.createdByUserId===CURRENT_USER_ID)}
function myAccounts(){return clients.filter(c=>(isDrKunbiUser()||String(rowVal(c,'Account Manager User ID'))===String(CURRENT_USER_ID))&&String(rowVal(c,'Status')||'Active').toLowerCase()!=='inactive')}
function briefsForAccount(c){const id=rowVal(c,'Client ID'),name=String(rowVal(c,'Client Name')||'').toLowerCase(),brand=String(rowVal(c,'Brand')||'').toLowerCase();return myManagedBriefs().filter(b=>String(b.clientId||'')===String(id)||(String(b.client||'').toLowerCase()===name&&(!brand||String(b.brand||'').toLowerCase()===brand)))}
function myTeamLeadQueue(){return briefs.filter(b=>b.status==='Team Lead Review'&&!b.finalApproved)}
function myFinalApprovalQueue(){return briefs.filter(b=>b.status==='In Review'&&!b.finalApproved)}
function homeCardList(list,empty){return list.length?list.slice().sort((a,b)=>attentionRank(a)-attentionRank(b)).slice(0,8).map(briefMarkup).join(''):`<div class='empty'>${escapeHTML(empty)}</div>`}
function homeRelative(value){
  const t=new Date(value||0).getTime(),now=Date.now()+serverOffset;if(!Number.isFinite(t))return '';
  const diff=Math.max(0,now-t),mins=Math.floor(diff/60000),hours=Math.floor(diff/3600000),days=Math.floor(diff/86400000);
  if(mins<1)return 'Just now';if(mins<60)return `${mins}m ago`;if(hours<24)return `${hours}h ago`;if(days<7)return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Africa/Lagos'});
}
function renderDashboardActivity(scope){
  const host=document.getElementById('homeRecentActivity');if(!host)return;
  const rows=scope.flatMap(b=>(b.activityRows||[]).map(r=>({b,r}))).sort((a,z)=>new Date(rowVal(z.r,'Timestamp','timestamp')||0)-new Date(rowVal(a.r,'Timestamp','timestamp')||0)).slice(0,5);
  host.innerHTML=rows.length?rows.map(({b,r})=>{
    const actor=rowVal(r,'Actor Name','actorName')||'ONIT',uid=rowVal(r,'Actor User ID','actorUserId','User ID','userId')||'',action=replayLabel(rowVal(r,'Action','action')),ts=rowVal(r,'Timestamp','timestamp');
    return `<button class='feedRow' onclick="detail('${escapeHTML(b.code).replace(/'/g,'&#39;')}')"><span class='avatar feedAvatar' data-avatar-user='${escapeHTML(uid)}'>${escapeHTML(initials(actor))}</span><span class='feedCopy'><b>${escapeHTML(b.client||b.project||b.code)}</b><small>${escapeHTML(action)} by ${escapeHTML(actor)}</small></span><span class='feedTime'>${escapeHTML(homeRelative(ts))}</span></button>`
  }).join(''):`<div class='empty compactEmpty'>No recent activity yet.</div>`;
}
function renderDashboardDeadlines(scope){
  const host=document.getElementById('homeUpcomingDeadlines');if(!host)return;
  const rows=scope.filter(b=>!['Closed','Approved'].includes(b.status)&&b.deadline).slice().sort((a,z)=>new Date(a.deadline)-new Date(z.deadline)).slice(0,5);
  host.innerHTML=rows.length?rows.map(b=>{
    const t=timeInfo(b),dot=t.cls==='red'?'red':t.cls==='orange'?'orange':'green',date=new Date(b.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Africa/Lagos'});
    return `<button class='deadlineRow' onclick="detail('${escapeHTML(b.code).replace(/'/g,'&#39;')}')"><span class='deadlineDot ${dot}'></span><span class='feedCopy'><b>${escapeHTML(b.client||b.project)}</b><small>${escapeHTML(b.project||b.status)}</small></span><span class='deadlineWhen ${dot}'>${escapeHTML(t.cls==='red'?'Overdue':date)}</span><span class='rowArrow'>›</span></button>`
  }).join(''):`<div class='empty compactEmpty'>No upcoming deadlines.</div>`;
}
function globalSearchKey(e){
  if(e.key!=='Enter')return;
  const q=String(e.currentTarget.value||'').trim().toLowerCase();if(!q)return;
  const hit=briefs.find(b=>[b.code,b.client,b.project,b.assignee,b.status].join(' ').toLowerCase().includes(q));
  if(hit){e.currentTarget.blur();detail(hit.code);return}
  const person=teamWorkload.find(w=>[w.fullName,w.position,w.department].join(' ').toLowerCase().includes(q));
  if(person){show('team');e.currentTarget.blur();return}
  showToast('No matching brief or team member was found.');
}
function approvalClockInfo(b){if(!b||b.status!=='In Review'||b.finalApproved||!b.approvalDueAt)return null;const due=new Date(b.approvalDueAt).getTime(),ms=due-(Date.now()+serverOffset);if(!Number.isFinite(due))return null;return{ms,text:ms>=0?'APPROVE '+duration(ms):'APPROVAL OVERDUE '+duration(ms),cls:ms<0?'overdue':''}}
function renderApprovalClocks(){document.querySelectorAll('[data-approval-due]').forEach(el=>{const due=new Date(el.dataset.approvalDue).getTime(),ms=due-(Date.now()+serverOffset);if(!Number.isFinite(due))return;el.textContent=ms>=0?'APPROVE '+duration(ms):'APPROVAL OVERDUE '+duration(ms);el.classList.toggle('overdue',ms<0)})}
function accountBriefMarkup(b){const code=encodeURIComponent(b.code).replace(/'/g,'%27'),clock=approvalClockInfo(b),t=timeInfo(b);return `<button class='accountBrief' onclick="detail(decodeURIComponent('${code}'))"><b>${escapeHTML(b.project)}</b><div class='accountBriefMeta'><span>${escapeHTML(b.assignee||'Unassigned')}</span><span>${escapeHTML(b.status)}</span></div><div class='accountBriefMeta' style='margin-top:7px'><span>${escapeHTML(b.code)}</span><span class='${t.cls}'>${escapeHTML(t.text)}</span></div>${clock?`<div style='margin-top:7px'><span class='approvalClock ${clock.cls}' data-approval-due='${escapeHTML(b.approvalDueAt)}'>${escapeHTML(clock.text)}</span></div>`:''}</button>`}
function renderAccountPortfolio(){const sec=document.getElementById('accountPortfolioSection'),board=document.getElementById('accountPortfolioBoard');if(!sec||!board)return;const accountMode=dashboardMode()==='ACCOUNT';sec.classList.toggle('hidden',!accountMode);document.getElementById('addAccountBtn')?.classList.toggle('hidden',!accountMode);if(!accountMode)return;const accounts=myAccounts();board.innerHTML=accounts.length?accounts.map(c=>{const jobs=briefsForAccount(c).filter(b=>b.status!=='Closed').sort((a,z)=>new Date(z.createdAt||0)-new Date(a.createdAt||0));const id=encodeURIComponent(rowVal(c,'Client ID'));return `<div class='accountColumn'><div class='accountColumnHead'><div><h3>${escapeHTML(rowVal(c,'Brand')||rowVal(c,'Client Name')||'Account')}</h3><div class='tiny'>${jobs.length} active / recent brief${jobs.length===1?'':'s'}</div></div><button class='mini' onclick="openNewForAccount('${id}')">+ BRIEF</button></div>${jobs.length?jobs.map(accountBriefMarkup).join(''):`<div class='accountEmpty'>No briefs yet.<br>Send the first brief for this account.</div>`}</div>`}).join(''):`<div class='accountColumn'><div class='accountColumnHead'><h3>Start your portfolio</h3></div><div class='accountEmpty'>Create your first account / brand. Every brief you send for it will appear here automatically.</div><button class='new' style='width:100%' onclick='quickAddAccount()'>+ ADD ACCOUNT</button></div>`;renderApprovalClocks()}
async function quickAddAccount(){if(!isAccountManagerUser())return alert('Accounts / brands are created by Account Management.');const name=prompt('Account / brand name:');if(!name?.trim())return;try{setBusy(true);await apiPost('createClient',{clientName:name.trim(),brand:name.trim()});await loadFromGoogle(true);renderAccountPortfolio();showToast('Account created',name.trim())}catch(e){alert('Could not create account. '+e.message)}finally{setBusy(false)}}
function openNewForAccount(encodedId){openNew();const id=decodeURIComponent(encodedId||'');const i=(window.clientChoices||[]).findIndex(c=>String(c.id)===String(id));if(i>=0)document.getElementById('client').value=String(i)}
function setUtilisationMode(mode){
  utilisationMode=mode==='daily'?'daily':'weekly';
  renderHomeAnalytics();
}
function renderHomeAnalytics(){
  const host=document.getElementById('homeAnalytics');if(!host)return;
  const overview=homeAnalytics?.briefOverview||{total:0,overdue:0,buckets:[]};
  const buckets=(overview.buckets||[]),maxCount=Math.max(1,...buckets.map(b=>Number(b.count||0)));
  const bars=buckets.map(b=>{
    const count=Number(b.count||0),pct=Number(b.percentage||0),height=count?Math.max(10,Math.round(count/maxCount*100)):0;
    return `<div class='overviewBarCell'><div class='overviewBarBubble'><b>${count}</b>${pct.toFixed(pct%1?1:0)}%</div><div class='overviewBarTrack'><div class='overviewBarFill' style='height:${height}%'></div></div><div class='overviewBarLabel'>${escapeHTML(b.label||'')}</div></div>`;
  }).join('');
  const util=homeAnalytics?.utilisation||{},metric=util[utilisationMode]||{percentage:0,trackedHours:0,averageHours:0,targetHours:utilisationMode==='daily'?8:40,capacityHours:0},teamSize=Number(util.staffCount||0);
  const generated=new Date(util.generatedAt||homeAnalytics?.generatedAt||0).getTime(),elapsedHours=Number.isFinite(generated)?Math.max(0,(Date.now()+serverOffset-generated)/3600000):0,workingNow=Number(util.currentlyWorkingCount||0);
  const liveTracked=Number(metric.trackedHours||0)+(workingNow*elapsedHours),capacity=Number(metric.capacityHours||0),liveAverage=teamSize?liveTracked/teamSize:0,pct=Math.max(0,capacity?liveTracked/capacity*100:Number(metric.percentage||0)),fill=Math.min(100,pct),over=pct>100;
  const periodLabel=utilisationMode==='daily'?'Today':'This week';
  host.innerHTML=`
    <section class='analyticsCard'>
      <div class='analyticsHead'><div><div class='analyticsEyebrow'>LIVE BRIEF OVERVIEW</div><div class='analyticsTitle'>Where all ONIT briefs are right now</div></div><div class='analyticsMeta'><span class='analyticsChip'>${Number(overview.total||0)} TOTAL</span>${Number(overview.overdue||0)?`<span class='analyticsChip alert'>${Number(overview.overdue)} OVERDUE</span>`:''}</div></div>
      <div class='briefOverviewBars'>${bars||`<div class='empty compactEmpty'>No briefs yet.</div>`}</div>
    </section>
    <section class='analyticsCard utilCard'>
      <div class='analyticsHead'><div><div class='analyticsEyebrow'>TEAM WORK UTILISATION</div><div class='analyticsTitle'>${periodLabel}</div></div><div class='utilMode'><button class='${utilisationMode==='daily'?'active':''}' onclick="setUtilisationMode('daily')">DAILY</button><button class='${utilisationMode==='weekly'?'active':''}' onclick="setUtilisationMode('weekly')">WEEKLY</button></div></div>
      <div class='utilRingWrap'><div class='utilRing ${over?'over':''}' style='--fill:${fill}'><div class='utilRingValue'><b>${pct.toFixed(pct%1?1:0)}%</b><span>${over?'ABOVE TARGET':'OF TARGET'}</span></div></div></div>
      <div class='utilStats'><div><span>AVG / PERSON</span><b>${liveAverage.toFixed(1)}h / ${Number(metric.targetHours||0)}h</b></div><div><span>TEAM TRACKED</span><b>${liveTracked.toFixed(1)}h</b></div></div>
      <div class='analyticsFoot'>${teamSize} active staff • ${escapeHTML(homeAnalytics?.note||'Based on ONIT-tracked work activity.')}</div>
    </section>`;
}
function renderHome(){
  if(!currentUser)return;
  const orgName=rowVal(organisations[0],'Organisation Name')||'your organisation';
  document.getElementById('todayLabel').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'});
  document.getElementById('greeting').textContent=`${greetingText()}, ${currentUserName().split(' ')[0]} 👋`;
  const mode=dashboardMode(),queueSection=document.getElementById('homeQueueSection'),queueTitle=document.getElementById('homeQueueTitle'),queueCopy=document.getElementById('homeQueueCopy'),queueList=document.getElementById('homeQueueList'),primaryTitle=document.getElementById('homePrimaryTitle'),primaryCopy=document.getElementById('homePrimaryCopy'),home=document.getElementById('home');
  let scope=[],queue=[];
  renderHomeAnalytics();
  home.classList.toggle('homeStaffSimple',mode==='STAFF');
  queueSection.classList.add('hidden');
  if(mode==='ACCOUNT'){
    scope=myManagedBriefs();
    document.getElementById('homeSub').textContent=`Here’s what’s happening across the work you manage at ${orgName} today.`;
    primaryTitle.textContent="WORK I'M MANAGING";primaryCopy.textContent='Your briefs, deadlines and current approval status.';
  }else if(mode==='LEADERSHIP'){
    scope=[...new Map([...myAssignedBriefs(),...myManagedBriefs()].map(b=>[b.code,b])).values()];queue=myFinalApprovalQueue();
    document.getElementById('homeSub').textContent=`Here’s what needs your attention at ${orgName} today.`;
    primaryTitle.textContent="MY WORK / BRIEFS I'M MANAGING";primaryCopy.textContent='Briefs assigned to you and briefs you have sent to the team.';
    queueTitle.textContent='WAITING FOR FINAL APPROVAL';queueCopy.textContent='Team Lead-cleared work waiting for CD/DCD/MD final decision.';queueSection.classList.remove('hidden');
  }else if(mode==='TEAM_LEAD'){
    scope=myAssignedBriefs();queue=myTeamLeadQueue();
    document.getElementById('homeSub').textContent=`Here’s what’s moving in your queue at ${orgName} today.`;
    primaryTitle.textContent='MY WORK';primaryCopy.textContent='Briefs assigned directly to you.';
    queueTitle.textContent='WAITING FOR MY REVIEW';queueCopy.textContent='Review first, then send good work forward for final CD/DCD approval.';queueSection.classList.remove('hidden');
  }else if(mode==='OWNER'){
    scope=briefs;
    document.getElementById('homeSub').textContent=`Here’s what’s happening across ${orgName} today.`;
    primaryTitle.textContent='ORGANISATION RISK RADAR';primaryCopy.textContent='Early warning across active briefs — not a staff performance score.';
  }else{
    scope=myAssignedBriefs();
    document.getElementById('homeSub').textContent=`Here’s what’s happening in your ONIT workspace today.`;
    primaryTitle.textContent='MY BRIEFS / INBOX';primaryCopy.textContent='Open a brief to read it, start the job, and reply with your completed work.';
  }
  renderAccountPortfolio();
  document.getElementById('homePrimarySection').classList.toggle('hidden',mode==='ACCOUNT');
  const active=scope.filter(b=>!['Closed','Approved'].includes(b.status));
  const review=active.filter(b=>['Team Lead Review','In Review','Revision'].includes(b.status)).length;
  const projects=mode==='ACCOUNT'?myAccounts().length:new Set(active.map(b=>String(b.project||'').trim()).filter(Boolean)).size;
  const weekEnd=Date.now()+7*86400000,dueWeek=active.filter(b=>{const t=new Date(b.deadline).getTime();return Number.isFinite(t)&&t>=Date.now()-86400000&&t<=weekEnd}).length;
  document.getElementById('homeStats').innerHTML=`
    <div class='statCard'><span class='statIcon orange'>▣</span><div><b>${active.length}</b><small>Active Briefs</small></div></div>
    <div class='statCard'><span class='statIcon green'>◫</span><div><b>${projects}</b><small>${mode==='ACCOUNT'?'Accounts':'Projects'}</small></div></div>
    <div class='statCard'><span class='statIcon amber'>◷</span><div><b>${review}</b><small>In Review</small></div></div>
    <div class='statCard'><span class='statIcon coral'>◉</span><div><b>${dueWeek}</b><small>Due This Week</small></div></div>`;
  renderDashboardActivity(scope.length?scope:briefs);
  renderDashboardDeadlines(active.length?active:briefs);
  const risks=active.map(b=>({b,r:riskForBrief(b)})).sort((a,z)=>z.r.score-a.r.score);renderPulse(active,risks);
  if(mode==='OWNER'){const attention=risks.filter(x=>x.r.score>=35).slice(0,8).map(x=>x.b);document.getElementById('homeBriefList').innerHTML=attention.length?attention.map(riskMarkup).join(''):`<div class='empty'>No immediate risk detected.</div>`}
  else document.getElementById('homeBriefList').innerHTML=homeCardList(active,mode==='ACCOUNT'?'No briefs currently being managed by you.':'No active briefs assigned to you.');
  if(!queueSection.classList.contains('hidden'))queueList.innerHTML=homeCardList(queue,'Nothing is waiting for your review right now.');
  document.getElementById('homeTeam').innerHTML=teamWorkload.slice().sort((a,b)=>(b.overdueCount-a.overdueCount)||(Number(b.totalOpenCount||0)-Number(a.totalOpenCount||0))).slice(0,6).map(teamMarkup).join('')||`<div class='empty'>No team data yet.</div>`;
  hydrateProfilePhotos();
}
function attentionRank(b){return -riskForBrief(b).score}

function renderBriefFilters(){const filters=['ALL','ACTIVE','PAUSED','REVIEW','OVERDUE','CLOSED'];document.getElementById('briefFilters').innerHTML=filters.map(f=>`<button class='${briefFilter===f?'active':''}' onclick="setBriefFilter('${f}')">${f}</button>`).join('')}
function setBriefFilter(f){briefFilter=f;renderBriefFilters();renderBriefs()}
function filteredBriefs(){const q=(document.getElementById('briefSearch')?.value||'').trim().toLowerCase();return briefs.filter(b=>{let ok=true;if(briefFilter==='ACTIVE')ok=!['Closed','Approved'].includes(b.status);else if(briefFilter==='PAUSED')ok=b.status==='Paused';else if(briefFilter==='REVIEW')ok=['Team Lead Review','In Review','Revision'].includes(b.status);else if(briefFilter==='OVERDUE')ok=timeInfo(b).cls==='red'&&!['Closed','Approved'].includes(b.status);else if(briefFilter==='CLOSED')ok=b.status==='Closed';if(q)ok=ok&&[b.code,b.client,b.project,b.assignee,b.status].join(' ').toLowerCase().includes(q);return ok})}
function renderBriefs(){const list=filteredBriefs();document.getElementById('briefList').innerHTML=list.length?list.map(briefMarkup).join(''):`<div class='empty'>No matching briefs.</div>`}
function briefMarkup(b){const t=timeInfo(b),r=riskForBrief(b),clock=approvalClockInfo(b),code=encodeURIComponent(b.code).replace(/'/g,'%27'),s=String(b.status||''),statusClass=/Approved|Closed/i.test(s)?'ok':/Review/i.test(s)?'review':/Revision|Paused/i.test(s)?'warn':'active';return `<div class='brief' onclick="detail(decodeURIComponent('${code}'))"><div class='briefIdentity'><span class='briefThumb'>${escapeHTML((b.client||'O').charAt(0).toUpperCase())}</span><span class='briefCopy'><b>${escapeHTML(b.client)} — ${escapeHTML(b.project)}</b><small>${escapeHTML(b.code)} • ${escapeHTML(b.assignee||'Unassigned')}</small></span></div><div class='briefTags'><span class='statusChip ${statusClass}'>${escapeHTML(b.status)}</span>${b.iteration?`<span class='miniChip'>V${b.iteration}</span>`:`<span class='miniChip'>NEW</span>`}${clock?`<span class='approvalClock ${clock.cls}' data-approval-due='${escapeHTML(b.approvalDueAt)}'>${escapeHTML(clock.text)}</span>`:''}${r.score>=35?`<span class='miniChip risk ${r.level==='HIGH'?'high':''}'>Risk ${r.score}</span>`:''}</div><div class='timer ${t.cls}'>${escapeHTML(t.text)}</div><span class='rowArrow'>›</span></div>`}
function renderArchive(){const q=(document.getElementById('archiveSearch')?.value||'').toLowerCase();const closed=briefs.filter(b=>b.status==='Closed'&&[b.code,b.client,b.project,b.assignee].join(' ').toLowerCase().includes(q));document.getElementById('archiveList').innerHTML=closed.length?closed.map(briefMarkup).join(''):`<div class='empty'>No matching closed briefs.</div>`}

function teamMarkup(w){const open=Number(w.totalOpenCount??((w.activeCount||0)+(w.assignedCount||0)+(w.reviewCount||0))),working=Number(w.activeCount||0),assigned=Number(w.assignedCount||0),review=Number(w.reviewCount||0);const cls=w.overdueCount?'redbg':working?'':open?'orangebg':'gray';let right='AVAILABLE',rightCls='';if(w.overdueCount){right=`${w.overdueCount} overdue`;rightCls='red'}else if(w.nextDeadline){const ms=new Date(w.nextDeadline)-Date.now();right=ms<0?'OVERDUE':duration(ms);rightCls=ms<0?'red':ms<3600000?'orange':'green'}const labels=[];if(working)labels.push(`${working} ONIT`);if(assigned)labels.push(`${assigned} ASSIGNED`);if(review)labels.push(`${review} IN REVIEW`);if(!labels.length)labels.push('AVAILABLE');if(w.timelineClash)labels.push('CLASH');return `<div class='card person'><div class='personInfo'><div class='avatar' data-avatar-user='${escapeHTML(w.userId||'')}'>${escapeHTML(initials(w.fullName||'Member'))}</div><div><b><span class='dot ${cls}'></span>${escapeHTML(w.fullName||'Member')}</b><div class='muted'>${escapeHTML(w.position||'')} ${w.department?'• '+escapeHTML(w.department):''}</div><span class='pill'>${labels.join(' • ')}</span></div></div><b class='${rightCls}'>${escapeHTML(right)}</b></div>`}
function renderTeam(){document.getElementById('teamGrid').innerHTML=teamWorkload.length?teamWorkload.map(teamMarkup).join(''):`<div class='empty'>No team data yet.</div>`;hydrateProfilePhotos()}

function populateClients(){const known=new Map(),source=(isAccountManagerUser()&&!isDrKunbiUser())?myAccounts():clients;source.forEach(c=>{const name=rowVal(c,'Client Name')||rowVal(c,'Brand');if(name)known.set(String(rowVal(c,'Client ID')||name).toLowerCase(),{id:rowVal(c,'Client ID'),name,brand:rowVal(c,'Brand')||name})});if(!isAccountManagerUser()||isDrKunbiUser())briefs.forEach(b=>{if(b.client&&!known.has(String(b.clientId||b.client).toLowerCase()))known.set(String(b.clientId||b.client).toLowerCase(),{id:b.clientId||'',name:b.client,brand:b.brand||b.client})});window.clientChoices=[...known.values()];const el=document.getElementById('client');el.innerHTML=window.clientChoices.length?window.clientChoices.map((c,i)=>`<option value='${i}'>${escapeHTML(c.name)}${c.brand!==c.name?' — '+escapeHTML(c.brand):''}</option>`).join(''):`<option value=''>Create an account / brand first</option>`}
function populateAssignees(){const el=document.getElementById('assignee');if(!el)return;const leadershipSender=isCreativeLeadership(currentUser);el.innerHTML=users.filter(u=>leadershipSender||rowVal(u,'User ID')!==CURRENT_USER_ID).map(u=>`<option value="${escapeHTML(rowVal(u,'User ID'))}">${escapeHTML(rowVal(u,'Full Name'))} — ${escapeHTML(positionOf(u)||departmentOf(u))} • ${escapeHTML(departmentOf(u))}</option>`).join('');clash()}
function openNew(){if(!canCreateBrief())return alert('Only Account Management, Dr. Kunbi, the Creative Director, Deputy Creative Director or Managing Director can create and send briefs.');document.getElementById('deadline').value=lagosInput(new Date(Date.now()+4*3600000));document.getElementById('project').value='';document.getElementById('brieftext').value='';document.getElementById('deliverables').value='';document.getElementById('briefAttachments').value='';document.getElementById('briefFileList').innerHTML='';populateClients();if(isAccountManagerUser()&&!isDrKunbiUser()&&!window.clientChoices.length){show('home');return alert('Create an account / brand first. Then send the brief from that account.')}populateAssignees();show('newbrief')}
function clash(){const id=document.getElementById('assignee')?.value,w=teamWorkload.find(x=>x.userId===id),el=document.getElementById('clash');if(!w){el.classList.add('hidden');return}const deadlineVal=document.getElementById('deadline')?.value;let close=false;if(deadlineVal&&w.nextDeadline){try{close=Math.abs(parseLagos(deadlineVal).getTime()-new Date(w.nextDeadline).getTime())<=4*3600000}catch(e){}}if(w.activeCount>=2||close){el.textContent=`⚠ TIMELINE CLASH: ${w.fullName} currently has ${w.activeCount} active brief(s)${w.nextDeadline?' • next deadline '+formatDateTime(w.nextDeadline):''}. You can still assign this brief.`;el.classList.remove('hidden')}else if(w.activeCount){el.textContent=`Heads-up: ${w.fullName} already has ${w.activeCount} active brief(s).`;el.classList.remove('hidden')}else el.classList.add('hidden')}

function previewBriefFiles(input){const host=document.getElementById('briefFileList'),files=[...(input?.files||[])];host.innerHTML=files.map(f=>`<div class='selectedFile'><span>${escapeHTML(f.name)}</span><span>${Math.ceil(f.size/1024)} KB</span></div>`).join('')}

async function sent(button){
  if(mutationBusy)return;
  if(!canCreateBrief())return alert('Only Account Management, Dr. Kunbi, the Creative Director, Deputy Creative Director or Managing Director can create and send briefs.');
  const client=window.clientChoices?.[Number(document.getElementById('client').value)]||{id:'',name:'Client',brand:'Client'},
        project=document.getElementById('project').value.trim(),
        deadline=document.getElementById('deadline').value;
  if(!project)return alert('Please enter a project title.');
  if(!deadline)return alert('Please set a deadline.');
  let attachments;
  try{attachments=await filesToPayload(document.getElementById('briefAttachments').files,MAX_FILE_BYTES)}catch(e){return alert(e.message)}
  let requestId=sessionStorage.getItem('onit-create-request');
  if(!requestId){requestId=makeId();sessionStorage.setItem('onit-create-request',requestId)}
  const assigneeId=document.getElementById('assignee').value,
        assigneeUser=users.find(u=>rowVal(u,'User ID')===assigneeId),
        person=rowVal(assigneeUser,'Full Name')||assigneeId,
        original=button.textContent;
  mutationBusy=true;button.disabled=true;button.textContent=attachments.length?'UPLOADING & SENDING…':'SENDING…';setBusy(true);
  try{
    const d=parseLagos(deadline),
          payload={requestId,organisationId:ORG_ID,clientId:client.id||'',clientName:client.name,brand:client.brand||client.name,projectTitle:project,description:document.getElementById('brieftext').value,deliverables:document.getElementById('deliverables').value,priority:document.getElementById('priority').value,createdByUserId:CURRENT_USER_ID,createdByName:currentUserName(),deadline:d.toISOString(),attachments,assigneeUserId:assigneeId,assigneeFullName:person};
    let created;
    try{created=await apiPost('createBrief',payload)}
    catch(firstError){
      if(!/Failed to fetch|timed out|NetworkError/i.test(String(firstError?.message||firstError)))throw firstError;
      await sleep(900);
      created=await apiPost('createBrief',payload);
    }
    const code=created.data?.['Brief Code']||created.data?.briefCode||created['Brief Code']||created.briefCode;
    if(!code)throw new Error('The server returned no brief code.');
    sessionStorage.removeItem('onit-create-request');
    await loadFromGoogle(true);
    alert(`Brief ${code} created and assigned.`);
    show('briefs');
  }catch(e){
    console.error(e);
    alert('ONIT could not complete this brief. '+e.message+' You can retry; ONIT will reuse the same request instead of creating a duplicate.');
  }finally{mutationBusy=false;button.disabled=false;button.textContent=original;setBusy(false)}
}

function detail(code){current=briefs.find(b=>b.code===code);if(!current)return;currentDetailTab='brief';renderDetail();show('detail')}
function setDetailTab(name,btn){currentDetailTab=name;document.querySelectorAll('#detailTabs button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');document.querySelectorAll('.detailPanel').forEach(p=>p.classList.add('hidden'));document.getElementById(name+'Panel').classList.remove('hidden')}
function renderDetail(){if(!current)return;document.getElementById('dcode').textContent=current.code;document.getElementById('dtitle').textContent=current.client;document.getElementById('dproject').textContent=current.project;document.getElementById('dstatus').textContent=current.status;document.getElementById('diter').textContent=current.iteration?`V${current.iteration}`:'NO SUBMISSION';const sent=document.getElementById('dclientsent');sent.classList.toggle('hidden',!current.clientSent);sent.textContent=current.clientSent?'CLIENT SEND RECORDED':'';document.getElementById('ddeadline').textContent='Deadline: '+formatDateTime(current.deadline)+' (Africa/Lagos)';const t=timeInfo(current),x=document.getElementById('dtimer');x.textContent=t.text;x.className='num '+t.cls;renderApprovalNotice();renderBriefPanel();renderWorkPanel();renderActivityPanel();renderDetailButtons();setDetailTab(currentDetailTab,document.querySelector(`#detailTabs button:nth-child(${currentDetailTab==='brief'?1:currentDetailTab==='work'?2:3})`))}
function renderApprovalNotice(){
  const notice=document.getElementById('approvalNotice'),quick=document.getElementById('approvalQuickActions'),last=current.iterations[current.iterations.length-1];
  quick.innerHTML='';quick.classList.add('hidden');

  if(current.iteration&&current.status==='Team Lead Review'){
    notice.className='approvalWarning';
    notice.textContent='DO NOT SEND TO CLIENT — this work is awaiting Team Lead review before CD/DCD final approval.';
    if(isTeamLeadUser()&&last?.teamLeadRequired&&!last?.teamLeadApproved){
      quick.innerHTML=`<button class="secondary" onclick="teamLeadRework(this)">REQUEST REWORK</button><button class="new" onclick="teamLeadApprove(this)">APPROVE FOR FINAL REVIEW</button>`;
      quick.classList.remove('hidden');
    }
  }else if(current.iteration&&current.status==='In Review'&&!current.finalApproved){
    notice.className='approvalWarning';
    const clock=approvalClockInfo(current),baseText=last?.teamLeadApproved?'TEAM LEAD APPROVED — final approval is now required from CD/DCD.':'DO NOT SEND TO CLIENT — this work is awaiting final creative approval.';
    notice.innerHTML=`${escapeHTML(baseText)}${clock?` <span class='approvalClock ${clock.cls}' data-approval-due='${escapeHTML(current.approvalDueAt)}'>${escapeHTML(clock.text)}</span>`:''}`;
    if(canReview()||canApprove()){
      quick.innerHTML=`${canReview()?'<button class="secondary" onclick="requestRevision(this)">DECLINE / REQUEST REVISION</button>':''}${canApprove()?'<button class="new" onclick="approveFinal(this)">APPROVE FINAL</button>':''}<button class="secondary" onclick="setDetailTab('work',document.querySelector('#detailTabs button:nth-child(2)'))">VIEW SUBMISSION</button>`;
      quick.classList.remove('hidden');
    }
  }else if(current.finalApproved){
    notice.className='approvalWarning approvalOk';
    notice.textContent=`APPROVED${current.approvedByPosition?' BY '+current.approvedByPosition.toUpperCase():''} — this work may be sent to the client.`;
  }else{
    notice.className='approvalWarning hidden';
  }
}
function workerReplyMarkup(){
  if(!current||!currentUserAssignment(current.code,'TO'))return '';
  const creator=users.find(u=>rowVal(u,'User ID')===current.createdByUserId),toName=rowVal(creator,'Full Name')||'the Account Manager / sender',last=current.iterations[current.iterations.length-1],feedback=last?.feedback?`<div class="replyFeedback"><b>CHANGES REQUESTED</b><br>${escapeHTML(last.feedback)}</div>`:'';
  let body='';
  if(current.status==='Assigned'||current.status==='Revision'){
    const assignment=currentUserAssignment(current.code,'TO'),ack=rowVal(assignment,'Acknowledged At','acknowledgedAt');
    body=`${feedback}<div class="replyState"><strong>${current.status==='Revision'?'REWORK READY':'BRIEF RECEIVED'}</strong>${current.status==='Revision'?'Review the note above, then restart the revision when ready.':'Read/download the brief files first. Confirm receipt so the sender knows the task reached you.'}<div class="stageGuide"><span class="active">1. RECEIVE / DOWNLOAD</span><span>2. WORK</span><span>3. UPLOAD FINAL</span></div><div class="actions">${ack?`<span class='receiptBadge ok'>✓ RECEIPT CONFIRMED</span><button class="new" onclick="startWork(this)">${current.status==='Revision'?'START REVISION':'START WORKING'}</button>`:`<button class="new" onclick="acknowledgeTask(this)">ACKNOWLEDGE TASK</button>`}</div></div>`;
  }else if(current.paused||current.status==='Paused'){
    body=`<div class="replyState"><strong>WORK PAUSED</strong>Resume the job before sending work back.<div class="actions"><button class="new" onclick="pauseBrief(this)">RESUME WORK</button></div></div>`;
  }else if(current.status==='In Progress'){
    body=`<div class="replyReady"><div class="stageGuide"><span>1. RECEIVE / DOWNLOAD</span><span>2. WORK</span><span class="active">3. UPLOAD FINAL</span></div><input id="submissionFile" type="file" onchange="previewSelectedFile(this)"><div id="localPreview" class="previewLocal"></div><label class="replyLabel">MESSAGE</label><textarea id="submissionNote" placeholder="Add a short note with your work…">Work completed and ready for review.</textarea><p class="tiny">Upload the completed work only when it is ready for review. JPG, PNG, video, PDF or other file types are accepted. Current upload limit: 8 MB per file.</p><div class="actions"><button class="new" id="submitBtn" onclick="submitWork(this)">UPLOAD & SEND FINAL WORK</button></div></div>`;
  }else if(current.status==='Team Lead Review'){
    body=`<div class="replyState"><strong>WORK SENT</strong>Your reply has been received and is waiting for Team Lead review. You will be notified if changes are requested.</div>`;
  }else if(current.status==='In Review'){
    body=`<div class="replyState"><strong>WORK SENT</strong>Your latest reply is with Creative Leadership for final approval. You will be notified if changes are requested.</div>`;
  }else if(current.status==='Approved'){
    body=`<div class="replyState success"><strong>APPROVED</strong>Your latest work has final approval and is ready for client delivery.</div>`;
  }else if(current.status==='Closed'){
    body=`<div class="replyState success"><strong>JOB CLOSED</strong>This brief is complete and its approved files remain in the archive.</div>`;
  }
  return `<div class="replyComposer"><h2>REPLY / SEND WORK</h2><div class="replyRoute">TO: ${escapeHTML(toName)} • ONIT automatically routes review copies to the relevant Team Lead and Creative Leadership.</div>${body}</div>`;
}
function renderBriefPanel(){
  const creator=users.find(u=>rowVal(u,'User ID')===current.createdByUserId),assignment=activeToAssignment(current.code),ack=rowVal(assignment,'Acknowledged At','acknowledgedAt'),canDownloadSource=['Assigned','In Progress','Revision','Paused'].includes(current.status)&&(current.createdByUserId===CURRENT_USER_ID||rowVal(assignment,'User ID')===CURRENT_USER_ID),leadership=leadershipAssigneeBrief(current);
  const attachments=current.attachmentNames.map((name,i)=>`<div class='attachmentItem'><div><b>${escapeHTML(name)}</b><div class='tiny'>${escapeHTML(current.attachmentTypes[i]||'file')}</div></div><div><button class='mini' onclick="openBriefAttachmentPreview(${i},'${encodeURIComponent(name)}')">PREVIEW</button>${canDownloadSource?`<button class='mini downloadBriefBtn' onclick="downloadBriefAttachment(${i},'${encodeURIComponent(name)}')">DOWNLOAD</button>`:''}</div></div>`).join('');
  const copyText=isAccountManagerUser(creator)?'Creative Director • Deputy Creative Director • Managing Director • Dr. Kunbi':'Creative Director • Deputy Creative Director';
  document.getElementById('briefPanel').innerHTML=`<div class='detailMeta'><div class='metaBlock'><b>ASSIGNED TEAM</b>${escapeHTML(current.assignee)}${leadership?`<div class='leadershipNote'>Leadership assignment: this CD/DCD submission does not need a separate final approval.</div>`:''}</div><div class='metaBlock'><b>CC — AUTOMATIC</b>${escapeHTML(copyText)}</div><div class='metaBlock'><b>TASK RECEIPT</b>${ack?`<span class='receiptBadge ok'>✓ ACKNOWLEDGED ${escapeHTML(formatDateTime(ack))}</span>`:`<span class='receiptBadge'>AWAITING ACKNOWLEDGEMENT</span>`}</div><div class='metaBlock'><b>PRIORITY</b>${escapeHTML(current.priority)}</div><div class='metaBlock'><b>FROM</b>${escapeHTML(rowVal(creator,'Full Name')||'Account Management')}</div><div class='metaBlock'><b>CURRENT DEADLINE</b>${current.deadline?escapeHTML(formatDateTime(current.deadline)):'—'}</div></div><div class='section'><h2>BRIEF</h2><p>${escapeHTML(current.description||'No brief text supplied.').replace(/\n/g,'<br>')}</p></div><div class='section'><h2>DELIVERABLES</h2><p>${escapeHTML(current.deliverables||'No deliverables listed.').replace(/\n/g,'<br>')}</p></div><div class='section'><h2>INITIAL BRIEF FILES</h2>${attachments||`<div class='empty'>No brief attachments.</div>`}<div class='tiny'>Original brief files are downloadable during the active work stage. Submitted work remains preview-only until final approval.</div></div>${workerReplyMarkup()}`
}
function renderWorkPanel(){
  document.getElementById('iterations').innerHTML=current.iterations.length?current.iterations.map(i=>`<div class='iterationCard'><b>V${i.v}</b> — ${escapeHTML(i.file||'Submission')} <span class='pill'>${escapeHTML(i.state)}</span>${i.teamLeadApproved?`<span class='pill'>TEAM LEAD ✓</span>`:''}${i.note?`<div class='muted'>${escapeHTML(i.note)}</div>`:''}${i.feedback?`<div class='muted'><b>Feedback:</b> ${escapeHTML(i.feedback)}</div>`:''}${i.submittedAt?`<div class='tiny'>Submitted ${escapeHTML(formatDateTime(i.submittedAt))}</div>`:''}<div class='fileActions'>${i.driveFileId?`<button class='mini' onclick="openIterationPreview('${encodeURIComponent(i.id)}','${encodeURIComponent(i.file)}')">PREVIEW</button>${current.finalApproved?`<button class='mini' onclick="downloadIteration('${encodeURIComponent(i.id)}')">DOWNLOAD APPROVED FILE</button>`:''}`:''}${i.clientSent?`<span class='pill'>RECORDED AS SENT TO CLIENT</span>`:''}</div></div>`).join(''):`<div class='empty'>No work submitted yet.</div>`;
  const mine=!!currentUserAssignment(current.code,'TO'),last=current.iterations[current.iterations.length-1],tlStage=current.status==='Team Lead Review'&&isTeamLeadUser()&&last?.teamLeadRequired&&!last?.teamLeadApproved,finalStage=current.status==='In Review';
  document.getElementById('teamLeadReworkBtn').classList.toggle('hidden',!tlStage);
  document.getElementById('teamLeadApproveBtn').classList.toggle('hidden',!tlStage);
  document.getElementById('revisionBtn').classList.toggle('hidden',!(canReview()&&finalStage));
  document.getElementById('approveBtn').classList.toggle('hidden',!(canApprove()&&finalStage));
  document.getElementById('closeBtn').classList.toggle('hidden',!((current.createdByUserId===CURRENT_USER_ID||mine)&&current.status==='Approved'&&current.finalApproved));
  document.getElementById('reviewActions').classList.toggle('hidden',[...document.querySelectorAll('#reviewActions button')].every(b=>b.classList.contains('hidden')))
}
function replayLabel(action){const labels={BRIEF_CREATED:'Brief created',USER_ASSIGNED:'Assigned',TASK_ACKNOWLEDGED:'Task receipt acknowledged',MANDATORY_CC_ADDED:'Leadership copied',WORK_STARTED:'Work started',REVISION_WORK_STARTED:'Revision work started',BRIEF_PAUSED:'Work paused',BRIEF_RESUMED:'Work resumed',DEADLINE_CHANGED:'Deadline changed',ITERATION_SUBMITTED:'Work submitted',TEAM_LEAD_APPROVED:'Team Lead approved',TEAM_LEAD_REVISION_REQUESTED:'Team Lead requested rework',REVISION_REQUESTED:'Final review requested changes',FINAL_APPROVED:'Final approved',FILE_DOWNLOADED_ASSUMED_CLIENT_SENT:'File downloaded / client send recorded',BRIEF_CLOSED:'Brief closed',BRIEF_HANDOVER:'Brief handed over',LEADERSHIP_SUBMISSION_AUTO_APPROVED:'Leadership submission cleared'};return labels[action]||String(action||'Update').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
function renderActivityPanel(){const rows=current.activityRows||[];document.getElementById('activity').innerHTML=rows.length?rows.map(r=>{const action=rowVal(r,'Action','action'),actor=rowVal(r,'Actor Name','actorName')||'ONIT',reason=rowVal(r,'Reason','reason'),prev=rowVal(r,'Previous Value','previousValue'),next=rowVal(r,'New Value','newValue'),ts=rowVal(r,'Timestamp','timestamp');let meta='';try{const m=JSON.parse(rowVal(r,'Metadata','metadata')||'{}');if(m.version)meta+=`${m.version} • `;if(m.submissionNote)meta+=m.submissionNote}catch(e){}const detail=[prev&&next&&prev!==next?`${prev} → ${next}`:'',reason,meta].filter(Boolean).join(' • ');return `<div class='replayItem'><div class='replayTime'>${escapeHTML(formatDateTime(ts))}</div><div class='replayDot'></div><div class='replayBody'><b>${escapeHTML(replayLabel(action))}</b><div class='replayMeta'>${escapeHTML(actor)}${detail?' • '+escapeHTML(detail):''}</div></div></div>`}).join(''):`<div class='empty'>No activity yet.</div>`}
function canHandoverCurrent(){if(!current||isOwner()||['Approved','Closed','In Review'].includes(current.status))return false;const mine=!!currentUserAssignment(current.code,'TO');return mine||current.createdByUserId===CURRENT_USER_ID||canCreateBrief()||isSenior()}
function renderDetailButtons(){const mine=!!currentUserAssignment(current.code,'TO'),start=document.getElementById('startBtn'),canStart=mine&&taskAcknowledged(current.code)&&['Assigned','Revision','In Progress'].includes(current.status)&&!current.paused;start.classList.toggle('hidden',!canStart);start.textContent=current.status==='In Progress'?'WORKING…':'START WORKING';start.disabled=current.status==='In Progress';document.getElementById('pauseBtn').classList.toggle('hidden',!mine||!['In Progress','Paused'].includes(current.status));document.getElementById('pauseBtn').textContent=current.paused?'RESUME':'PAUSE';document.getElementById('deadlineBtn').classList.toggle('hidden',!(canCreateBrief()&&current.createdByUserId===CURRENT_USER_ID&&!['Approved','Closed'].includes(current.status)));document.getElementById('handoverBtn').classList.toggle('hidden',!canHandoverCurrent())}


function openHandover(){
  if(!current||!canHandoverCurrent())return alert('You are not authorised to hand over this brief.');
  const select=document.getElementById('handoverUser'),available=users.filter(u=>rowVal(u,'User ID')!==current.assigneeUserId&&rowVal(u,'User ID')!==CURRENT_USER_ID&&permissionProfile(u)!=='ORG_OWNER');
  if(!available.length)return alert('No other active team member is available in ONIT yet.');
  select.innerHTML=available.map(u=>`<option value="${escapeHTML(rowVal(u,'User ID'))}">${escapeHTML(rowVal(u,'Full Name'))} — ${escapeHTML(positionOf(u)||departmentOf(u))}</option>`).join('');
  document.getElementById('handoverReason').value='';document.getElementById('handoverModal').classList.remove('hidden');updateHandoverClash();select.onchange=updateHandoverClash;
}
function closeHandover(){document.getElementById('handoverModal').classList.add('hidden')}
function updateHandoverClash(){const id=document.getElementById('handoverUser')?.value,w=teamWorkload.find(x=>x.userId===id),el=document.getElementById('handoverClash');if(!el)return;if(w&&(Number(w.totalOpenCount||0)>=2||w.timelineClash)){el.textContent=`Heads-up: ${w.fullName} already has ${w.totalOpenCount||0} open brief(s)${w.nextDeadline?' • next deadline '+formatDateTime(w.nextDeadline):''}. Handover is still allowed.`;el.classList.remove('hidden')}else el.classList.add('hidden')}
async function confirmHandover(button){const toUserId=document.getElementById('handoverUser').value,reason=document.getElementById('handoverReason').value.trim();if(!reason)return alert('Please add a short handover reason.');if(!confirm('Hand this brief over now? The new assignee will need to press START WORKING.'))return;const old=button.textContent;button.disabled=true;button.textContent='HANDING OVER…';try{await apiPost('handoverBrief',{briefCode:current.code,toUserId,reason});closeHandover();await loadFromGoogle(true);showToast('Handover complete','The brief history is intact and the new assignee has been notified.')}catch(e){alert('ONIT could not complete the handover. '+e.message)}finally{button.disabled=false;button.textContent=old}}

async function runAction(button,action,payload,ok){if(!current||mutationBusy)return false;if(!apiOnline){alert('Refresh ONIT before making changes.');return false}if(!versionAtLeast(backendVersion,'0.14.0')){alert('Deploy ONIT Backend V0.14.0 before using this frontend.');return false}const snapshot=current,old=button?.textContent;mutationBusy=true;setBusy(true);if(button){button.disabled=true;button.textContent='WORKING…'}let saved=false;try{await apiPost(action,{briefCode:snapshot.code,organisationId:ORG_ID,userId:CURRENT_USER_ID,userName:currentUserName(),...payload});saved=true;await loadFromGoogle(true);if(ok)showToast('ONIT',ok);return true}catch(e){console.error(e);alert(saved?'Saved, but the refreshed data could not be confirmed. Refresh before trying again.':'ONIT could not complete this action. '+e.message);return false}finally{mutationBusy=false;setBusy(false);if(button){button.disabled=false;button.textContent=old}}}
async function acknowledgeTask(button){if(!current)return;const ok=await runAction(button,'acknowledgeTask',{},'Task receipt confirmed. The sender has been notified.');if(ok)renderDetail()}
async function startWork(button){if(!current)return;if(!current.assigneeUserId)return alert('This brief needs a TO assignment before work can start.');if(CURRENT_USER_ID!==current.assigneeUserId)return alert('Only the person assigned TO this brief can start the work.');if(!taskAcknowledged(current.code))return alert('Acknowledge receipt of the task before starting work.');await runAction(button,'startWork',{},'Work started. Account Management and management visibility have been updated.')}
async function pauseBrief(button){const mine=!!currentUserAssignment(current.code,'TO');if(!mine)return alert('Only the person assigned TO this brief can pause or resume their work.');if(current.status==='Closed')return;const action=current.paused?'resumeBrief':'pauseBrief';await runAction(button,action,{},current.paused?'Work resumed. The deadline and timeline have been adjusted.':'Work paused. Account Management and senior management have been notified.')}
async function changeDeadline(button){if(!canCreateBrief()||current.createdByUserId!==CURRENT_USER_ID)return alert('Only the person who sent this brief can change its deadline.');const v=prompt('New deadline in Nigeria time: YYYY-MM-DD HH:MM',lagosInput(current.deadline).replace('T',' '));if(!v)return;let d;try{d=parseLagos(v.trim())}catch(e){return alert(e.message)}const reason=prompt('Reason for deadline change:');if(!reason?.trim())return alert('A reason is required.');await runAction(button,'changeDeadline',{newDeadline:d.toISOString(),reason:reason.trim()},'Deadline updated, logged and communicated.')}

async function filesToPayload(fileList,totalLimit){const files=[...(fileList||[])];const total=files.reduce((s,f)=>s+f.size,0);if(total>totalLimit)throw new Error(`Total selected files must be under ${Math.floor(totalLimit/1024/1024)} MB in this build.`);const out=[];for(const f of files){out.push({name:f.name,type:f.type||'application/octet-stream',size:f.size,base64:await fileToBase64(f)})}return out}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('Could not read '+file.name));r.readAsDataURL(file)})}
function previewSelectedFile(input){const f=input.files&&input.files[0],el=document.getElementById('localPreview');if(!el)return;el.innerHTML='';if(!f)return;const url=URL.createObjectURL(f);if(f.type.startsWith('image/'))el.innerHTML=`<img src="${url}" alt="Selected preview">`;else if(f.type.startsWith('video/'))el.innerHTML=`<video src="${url}" controls playsinline></video>`;else if(f.type==='application/pdf')el.innerHTML=`<iframe src="${url}" style="width:100%;height:320px;border:1px solid #ddd;border-radius:10px;background:#fff"></iframe>`;else el.innerHTML=`<div class='tiny'>Selected: ${escapeHTML(f.name)} (${Math.round(f.size/1024)} KB) • This file type will be attached without an inline preview.</div>`}
async function submitWork(button){if(!current||mutationBusy)return;if(current.paused||current.status!=='In Progress')return alert('Click START WORKING first, or resume the work before sending it for review.');if(CURRENT_USER_ID!==current.assigneeUserId)return alert('Only the assigned person can send this work.');const f=document.getElementById('submissionFile').files[0];if(!f)return alert('Choose the JPG, video or other work file you want to send.');if(f.size>MAX_FILE_BYTES)return alert(`Choose a file under ${MAX_FILE_BYTES/1024/1024} MB in this build.`);const note=(document.getElementById('submissionNote').value||'Work completed and ready for review.').trim(),key=JSON.stringify([current.code,current.iteration,current.assigneeUserId,f.name,f.size,f.lastModified]);let requestId=submissionRequests.get(key)||sessionStorage.getItem('onit-submit:'+key);if(!requestId){requestId=makeId();submissionRequests.set(key,requestId);sessionStorage.setItem('onit-submit:'+key,requestId)}let base64;try{button.disabled=true;button.textContent='UPLOADING…';base64=await fileToBase64(f)}catch(e){button.disabled=false;return alert(e.message)}finally{button.disabled=false}const leadershipNoApproval=leadershipAssigneeBrief(current),ok=await runAction(button,'submitIteration',{requestId,expectedIteration:current.iteration,fileName:f.name,fileType:f.type||'',fileSize:f.size,fileBase64:base64,submissionNote:note},leadershipNoApproval?'Work submitted and cleared for client delivery. No additional approval is required for a CD/DCD assignment.':'Work submitted. ONIT will route it to the Team Lead first where one is assigned, then to CD/DCD for final approval.');if(ok){document.getElementById('submissionFile').value='';document.getElementById('localPreview').innerHTML='';document.getElementById('submissionNote').value='Work completed and ready for review.';sessionStorage.removeItem('onit-submit:'+key)}}
async function teamLeadApprove(button){if(!isTeamLeadUser())return alert('Only an assigned Team Lead can do this.');if(current.status!=='Team Lead Review')return alert('This work is not waiting for Team Lead review.');const last=current.iterations[current.iterations.length-1];if(!last)return alert('There is no submission to review.');await runAction(button,'teamLeadReview',{iterationId:last.id,decision:'approve'},'Team Lead approval recorded. CD/DCD have been notified for final review.')}
async function teamLeadRework(button){if(!isTeamLeadUser())return alert('Only an assigned Team Lead can do this.');if(current.status!=='Team Lead Review')return alert('This work is not waiting for Team Lead review.');const last=current.iterations[current.iterations.length-1];if(!last)return alert('There is no submission to review.');const feedback=prompt('Rework note for the assigned team member:','Please rework this submission.');if(!feedback?.trim())return;await runAction(button,'teamLeadReview',{iterationId:last.id,decision:'rework',feedback:feedback.trim()},'Rework requested. The assigned team member and Account Management have been notified.')}
async function requestRevision(button){if(!canReview())return alert('Your position is not authorised to review work.');if(current.status!=='In Review')return alert('This brief is not awaiting review.');const last=current.iterations[current.iterations.length-1];if(!last)return alert('There is no submission to revise yet.');const feedback=prompt('Reason / note for decline:','Please revise this submission.');if(!feedback?.trim())return;await runAction(button,'requestRevision',{iterationId:last.id,feedback:feedback.trim()},'Changes requested. The Team Lead and assigned team member have been notified.')}
async function approveFinal(button){if(!canApprove())return alert('Final approval can only be given by the Creative Director, Deputy Creative Director or MD.');if(current.status!=='In Review')return alert('This brief is not awaiting approval.');const last=current.iterations[current.iterations.length-1];if(!last)return alert('There is no submission to approve yet.');await runAction(button,'approveBrief',{iterationId:last.id},'Final creative approval recorded. Account Management may now send the work to the client.')}
async function closeBrief(button){const mine=!!currentUserAssignment(current.code,'TO');if(!(current.createdByUserId===CURRENT_USER_ID||mine))return alert('Only the responsible Account Manager or assigned team member can close this brief.');if(current.status!=='Approved'||!current.finalApproved)return alert('Final approval is required before closure.');await runAction(button,'closeBrief',{},'Brief closed and moved to Archive.')}

async function downloadBriefAttachment(index,encodedName){if(!current)return;const name=decodeURIComponent(encodedName||'Brief attachment');try{setBusy(true);const res=await apiPost('getBriefAttachmentDownload',{briefCode:current.code,attachmentIndex:index}),d=res.data||res;if(!d.base64)throw new Error('No downloadable file was returned.');const url=URL.createObjectURL(base64ToBlob(d.base64,d.mimeType||'application/octet-stream')),a=document.createElement('a');a.href=url;a.download=d.fileName||name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){alert('Could not download this brief file. '+e.message)}finally{setBusy(false)}}

async function openIterationPreview(encodedId,encodedName){if(!current)return;const id=decodeURIComponent(encodedId),name=decodeURIComponent(encodedName||'Preview');openPreviewShell(name);try{const res=await apiPost('getFilePreview',{briefCode:current.code,organisationId:ORG_ID,userId:CURRENT_USER_ID,iterationId:id});renderPreview(res.data||res,name)}catch(e){renderPreviewError(e)}}
async function openBriefAttachmentPreview(index,encodedName){if(!current)return;const name=decodeURIComponent(encodedName||'Brief attachment');openPreviewShell(name);try{const res=await apiPost('getBriefAttachmentPreview',{briefCode:current.code,organisationId:ORG_ID,userId:CURRENT_USER_ID,attachmentIndex:index});renderPreview(res.data||res,name)}catch(e){renderPreviewError(e)}}
function openPreviewShell(name){document.getElementById('previewTitle').textContent=name;document.getElementById('previewBody').innerHTML="<div class='muted'>Loading preview…</div>";document.getElementById('previewModal').classList.remove('hidden')}
function renderPreview(d,name){const body=document.getElementById('previewBody'),mime=d.mimeType||'application/octet-stream';if(!d.base64)throw new Error('No preview data returned.');const src='data:'+mime+';base64,'+d.base64;if(mime.startsWith('image/'))body.innerHTML=`<img src="${src}" alt="${escapeHTML(name)}">`;else if(mime.startsWith('video/'))body.innerHTML=`<video src="${src}" controls autoplay playsinline></video>`;else if(mime==='application/pdf')body.innerHTML=`<iframe src="${src}"></iframe>`;else body.innerHTML=`<div class='previewMessage'><b>Preview is not available for this file type.</b><div class='muted'>${escapeHTML(mime)}</div>${d.driveUrl?`<button class='secondary' onclick="window.open('${d.driveUrl}','_blank')">OPEN IN GOOGLE DRIVE</button>`:''}</div>`}
function renderPreviewError(e){document.getElementById('previewBody').innerHTML=`<div class='previewMessage'><b>Preview could not be loaded.</b><div class='muted'>${escapeHTML(e.message)}</div><button class='secondary' onclick="closePreview()">CLOSE</button></div>`}
function closePreview(){document.getElementById('previewBody').innerHTML="<div class='muted'>Select a file to preview.</div>";document.getElementById('previewModal').classList.add('hidden')}
async function downloadIteration(encodedId){if(!current)return;const id=decodeURIComponent(encodedId),it=current.iterations.find(x=>x.id===id);if(!it)return;if(!current.finalApproved)return alert('Submitted work is preview-only until final approval.');const msg='Download this approved file? ONIT will record the download as sent to the client.';if(!confirm(msg))return;try{setBusy(true);const res=await apiPost('recordFileDownload',{briefCode:current.code,organisationId:ORG_ID,userId:CURRENT_USER_ID,userName:currentUserName(),iterationId:id}),d=res.data||res;if(d.inline&&d.base64){const blob=base64ToBlob(d.base64,d.mimeType||'application/octet-stream'),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=d.fileName||it.file||'ONIT-file';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}else if(d.driveUrl){window.open(d.driveUrl,'_blank')}else throw new Error('No downloadable file was returned.');await loadFromGoogle(true);showToast('Download recorded','ONIT recorded this approved file as sent to the client.')}catch(e){alert('Could not download this file. '+e.message)}finally{setBusy(false)}}
function base64ToBlob(base64,type){const bytes=atob(base64),arrays=[];for(let offset=0;offset<bytes.length;offset+=1024){const slice=bytes.slice(offset,offset+1024),nums=new Array(slice.length);for(let i=0;i<slice.length;i++)nums[i]=slice.charCodeAt(i);arrays.push(new Uint8Array(nums))}return new Blob(arrays,{type})}

async function hydrateProfilePhotos(){
  const nodes=[...document.querySelectorAll('[data-avatar-user]')].filter(n=>n.dataset.avatarUser);
  const ids=[...new Set(nodes.map(n=>n.dataset.avatarUser))];
  await Promise.all(ids.map(async id=>{
    let dataUrl=profilePhotoCache.get(id);
    if(dataUrl===undefined){
      const u=userById(id),has=id===CURRENT_USER_ID?!!rowVal(currentUser,'Profile Photo Drive ID'):truthy(rowVal(u,'Has Profile Photo'));
      if(!has){profilePhotoCache.set(id,'');dataUrl=''}
      else{try{const res=await apiPost('getProfilePhoto',{targetUserId:id}),d=res.data||res;dataUrl=d.hasProfilePhoto&&d.base64?`data:${d.mimeType||'image/jpeg'};base64,${d.base64}`:'';profilePhotoCache.set(id,dataUrl)}catch(e){profilePhotoCache.set(id,'');dataUrl=''}}
    }
    document.querySelectorAll(`[data-avatar-user="${CSS.escape(id)}"]`).forEach(n=>{n.innerHTML=dataUrl?`<img src="${dataUrl}" alt="">`:escapeHTML(initials(rowVal(userById(id),'Full Name')||currentUserName()))})
  }))
}
async function prepareProfilePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Please choose a JPG, PNG or WebP image.');
  if(file.size>12*1024*1024)throw new Error('Please choose an image under 12 MB.');
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Could not read the selected image.'));r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Could not open the selected image.'));i.src=dataUrl});
  const maxSide=720,scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
  let quality=.84,blob=null;
  while(quality>=.5){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=650*1024)break;quality-=.08}
  if(!blob)throw new Error('Could not prepare the profile picture.');
  return{blob,fileName:(file.name||'profile').replace(/\.[^.]+$/,'')+'.jpg',fileType:'image/jpeg',fileSize:blob.size};
}
async function uploadProfilePhoto(input){
  const f=input.files?.[0];if(!f)return;
  try{setBusy(true);const prepared=await prepareProfilePhoto(f),base64=await fileToBase64(prepared.blob);await apiPost('updateProfilePhoto',{fileName:prepared.fileName,fileType:prepared.fileType,fileSize:prepared.fileSize,fileBase64:base64});profilePhotoCache.delete(CURRENT_USER_ID);await loadFromGoogle(true);showToast('Profile photo','Your profile picture has been updated.')}catch(e){alert('Could not update profile photo. '+e.message)}finally{setBusy(false);input.value=''}
}

function renderNotifications(){
  const list=notifications.slice().sort((a,b)=>new Date(rowVal(b,'Created At')||0)-new Date(rowVal(a,'Created At')||0));
  const unread=list.filter(n=>!truthy(rowVal(n,'Read')));
  const badge=document.getElementById('notifBadge');
  badge.textContent=unread.length;
  badge.classList.toggle('hidden',!unread.length);
  const items=list.length
    ? list.map(n=>`<div class='notifItem ${truthy(rowVal(n,'Read'))?'':'unread'}'><b>${escapeHTML(rowVal(n,'Title'))}</b><div class='muted'>${escapeHTML(rowVal(n,'Message'))}</div><div class='tiny'>${escapeHTML(rowVal(n,'Brief Code'))}${truthy(rowVal(n,'Action Required'))?' • ACTION REQUIRED':''}${rowVal(n,'Type')==='OWNER_BROADCAST'?' • MANAGEMENT ANNOUNCEMENT':''} • ${escapeHTML(formatDateTime(rowVal(n,'Created At')))}</div></div>`).join('')
    : `<p class='muted'>No notifications yet.</p>`;
  document.getElementById('notifPanel').innerHTML=`<b>Notifications</b>${items}`;
  const fresh=unread.filter(n=>!announcedNotifications.has(rowVal(n,'Notification ID')));
  if(fresh.length){
    const newest=fresh[0];
    if(rowVal(newest,'Type')!=='OWNER_BROADCAST')showToast(rowVal(newest,'Title'),rowVal(newest,'Message'));
    playNotificationSound();
    showSystemNotification(rowVal(newest,'Title'),rowVal(newest,'Message'));
    fresh.forEach(n=>announcedNotifications.add(rowVal(n,'Notification ID')));
    localStorage.setItem(announcedKey(CURRENT_USER_ID),JSON.stringify([...announcedNotifications]));
  }
}
async function toggleNotifications(){const panel=document.getElementById('notifPanel'),opening=panel.classList.contains('hidden');panel.classList.toggle('hidden');if(opening){const ids=notifications.filter(n=>!truthy(rowVal(n,'Read'))&&rowVal(n,'Type')!=='OWNER_BROADCAST').map(n=>rowVal(n,'Notification ID')).filter(Boolean);if(ids.length){try{await apiPost('markNotificationsRead',{notificationIds:ids});notifications.forEach(n=>{if(ids.includes(rowVal(n,'Notification ID')))n['Read']=true});renderNotifications();panel.classList.remove('hidden')}catch(e){console.warn(e)}}}}
async function showNextBroadcast(){
  if(currentBroadcast||!SESSION_TOKEN)return;
  const n=notifications.filter(x=>rowVal(x,'Type')==='OWNER_BROADCAST'&&!truthy(rowVal(x,'Read'))).sort((a,b)=>new Date(rowVal(a,'Created At'))-new Date(rowVal(b,'Created At')))[0];
  if(!n)return;currentBroadcast=n;
  const modal=document.getElementById('broadcastModal'),title=rowVal(n,'Title')||'Announcement',message=rowVal(n,'Message')||'';
  document.getElementById('broadcastTitle').textContent=title;
  document.getElementById('broadcastMessage').textContent=message;
  const box=document.getElementById('broadcastAttachment');box.innerHTML='';
  const fileName=rowVal(n,'File Name'),type=String(rowVal(n,'File Type')||'');
  if(fileName){
    box.innerHTML=`<div class='broadcastLoading'>Loading announcement…</div>`;
    try{
      const res=await apiPost('getBroadcastFile',{notificationId:rowVal(n,'Notification ID')}),d=res.data||res;
      if(type.startsWith('image/')&&d.base64){
        box.innerHTML=`<div class='broadcastMedia'><img class='broadcastImage' src='data:${d.mimeType||type};base64,${d.base64}' alt='${escapeHTML(title)}'></div>`;
      }else{
        box.innerHTML=`<div class='broadcastMediaFallback'><div><b>${escapeHTML(fileName)}</b><div class='tiny' style='margin:8px 0 12px'>Announcement attachment</div><button class='secondary' onclick='downloadBroadcastAttachment()'>DOWNLOAD FILE</button></div></div>`;
      }
    }catch(e){
      box.innerHTML=`<div class='broadcastMediaFallback'>The announcement image could not be loaded.</div>`;
    }
  }
  modal.classList.remove('hidden');
  setTimeout(()=>modal.querySelector('.broadcastClose')?.focus(),40);
  playNotificationSound();
}
async function downloadBroadcastAttachment(){
  if(!currentBroadcast)return;
  try{const res=await apiPost('getBroadcastFile',{notificationId:rowVal(currentBroadcast,'Notification ID')}),d=res.data||res;if(!d.base64)throw new Error('No file returned.');const url=URL.createObjectURL(base64ToBlob(d.base64,d.mimeType||'application/octet-stream')),a=document.createElement('a');a.href=url;a.download=d.fileName||rowVal(currentBroadcast,'File Name')||'ONIT-attachment';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){alert('Could not download attachment. '+e.message)}
}
async function ackBroadcast(){
  if(!currentBroadcast)return document.getElementById('broadcastModal').classList.add('hidden');
  const id=rowVal(currentBroadcast,'Notification ID');try{await apiPost('markNotificationsRead',{notificationIds:[id]});const n=notifications.find(x=>rowVal(x,'Notification ID')===id);if(n)n['Read']=true}catch(e){console.warn(e)}
  document.getElementById('broadcastModal').classList.add('hidden');currentBroadcast=null;renderNotifications();setTimeout(showNextBroadcast,200);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&currentBroadcast&&!document.getElementById('broadcastModal').classList.contains('hidden'))ackBroadcast()});
function enableAudio(){audioReady=true;try{const C=window.AudioContext||window.webkitAudioContext;if(C){const c=new C();c.resume();c.close()}}catch(e){}}
document.addEventListener('pointerdown',enableAudio,{once:true});
document.addEventListener('keydown',enableAudio,{once:true});
function notificationSoundEnabled(){
  const raw=rowVal(currentUser,'Notification Sound');
  if(raw===undefined||raw===null||String(raw).trim()==='')return true;
  return truthy(raw);
}
function playNotificationSound(force=false){
  if(!force&&(!audioReady||!notificationSoundEnabled()))return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const ctx=new C(),master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();
    master.gain.setValueAtTime(.98,ctx.currentTime);
    compressor.threshold.setValueAtTime(-18,ctx.currentTime);
    compressor.knee.setValueAtTime(12,ctx.currentTime);
    compressor.ratio.setValueAtTime(8,ctx.currentTime);
    compressor.attack.setValueAtTime(.003,ctx.currentTime);
    compressor.release.setValueAtTime(.18,ctx.currentTime);
    master.connect(compressor);compressor.connect(ctx.destination);
    const notes=[[740,0,.28],[988,.18,.30],[1318,.44,.40]];
    notes.forEach(([freq,delay,dur])=>{
      const o1=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain();
      o1.type='sine';o2.type='triangle';o1.frequency.value=freq;o2.frequency.value=freq*2;
      o1.connect(g);o2.connect(g);g.connect(master);
      const t=ctx.currentTime+delay;
      g.gain.setValueAtTime(.001,t);
      g.gain.exponentialRampToValueAtTime(.62,t+.018);
      g.gain.exponentialRampToValueAtTime(.001,t+dur);
      o1.start(t);o2.start(t);o1.stop(t+dur+.03);o2.stop(t+dur+.03);
    });
    setTimeout(()=>ctx.close(),1400);
  }catch(e){console.warn('ONIT notification sound:',e)}
}
function testNotificationSound(){enableAudio();playNotificationSound(true);showToast('Notification sound','This is the ONIT alert sound. Device volume still controls the final loudness.')}
function showToast(title,message){const el=document.getElementById('toast');el.innerHTML=`<b>${escapeHTML(title)}</b><span class='muted'>${escapeHTML(message||'')}</span>`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),5200)}
function showSystemNotification(title,message){try{if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body:message})}catch(e){}}
async function enableBrowserNotifications(){if(!('Notification'in window))return alert('Browser notifications are not supported here.');const result=await Notification.requestPermission();alert(result==='granted'?'Browser notifications enabled.':'Browser notifications were not enabled.')}
async function toggleSoundPreference(box){const desired=!!box.checked;try{await apiPost('updateUserPreference',{organisationId:ORG_ID,userId:CURRENT_USER_ID,notificationSound:desired});await loadFromGoogle(true);showToast('Notification sound',desired?'Sound is on. New alerts will use the louder ONIT chime.':'Sound is off.')}catch(e){box.checked=!desired;alert('Could not update notification setting. '+e.message)}}

function renderDataPage(){const datasets=backendAccess(),admin=document.getElementById('dataAdmin'),toolbar=document.getElementById('dataToolbar'),viewer=document.getElementById('dataViewer');admin.innerHTML=isOwner()?ownerAccessAdminMarkup():'';toolbar.innerHTML=datasets.map(n=>`<button class='${activeBackendDataset===n?'active':''}' onclick="loadBackendDataset('${n}')">${escapeHTML(n.replaceAll('_',' '))}</button>`).join('');hydrateProfilePhotos();if(!datasets.length){viewer.innerHTML=`<div class='empty'>No backend data access has been granted to this account.</div>`;return}if(activeBackendDataset&&!datasets.includes(activeBackendDataset))activeBackendDataset='';if(!activeBackendDataset)viewer.innerHTML=`<div class='empty'>Choose a data area above. Access is read-only. CD, DCD and MD can download directly; other staff need one approval from any one of them.</div>`}
function ownerAccessAdminMarkup(){return `<div class='morecard' style='margin-bottom:14px'><h3>DATA ACCESS CONTROL <span class='ownerBadge'>OWNER ONLY</span></h3><div class='bigTiny'>Enter a staff email, then tick only the backend data areas that person genuinely needs. Seniority does not automatically grant backend data access.</div><div class='searchbar'><input id='accessEmail' type='email' placeholder='staff@email.com' value='${escapeHTML(selectedAccessEmail)}'><button class='secondary' onclick='loadAccessTarget()'>LOAD STAFF</button></div><div id='accessTargetPanel'>${selectedAccessEmail?renderAccessTargetMarkup(selectedAccessEmail):`<div class='empty'>No staff member selected.</div>`}</div></div><div class='morecard' style='margin-bottom:14px'><h3>TEAM LEAD CONTROL <span class='ownerBadge'>OWNER ONLY</span></h3><div class='bigTiny'>Team Lead status is operational only. It does not appear as a title on the member’s profile. A Team Lead reviews work from their own department before CD/DCD final approval.</div><div class='teamLeadAdmin'>${teamLeadAdminMarkup()}</div></div>`}
function renderAccessTargetMarkup(email){const u=accessDirectory.find(x=>String(rowVal(x,'Email')).toLowerCase()===String(email).toLowerCase());if(!u)return `<div class='empty'>No ONIT member found with that email.</div>`;const uid=rowVal(u,'User ID'),person=`<div class='profileRow'><div class='avatar' data-avatar-user='${escapeHTML(uid)}'>${escapeHTML(initials(rowVal(u,'Full Name')))}</div><div><b>${escapeHTML(rowVal(u,'Full Name'))}</b><div class='bigTiny'>${escapeHTML(rowVal(u,'Email'))} • ${escapeHTML(departmentOf(u))} • ${escapeHTML(positionOf(u))} • ${escapeHTML(rowVal(u,'Status'))}</div></div></div>`;if(permissionProfile(u)==='ORG_OWNER')return `<div class='accessTarget'>${person}<div class='bigTiny'>System Owner always has full backend access.</div></div>`;const current=String(rowVal(u,'Backend Data Access')||'').toUpperCase().split(',').map(x=>x.trim()).filter(Boolean);return `<div class='accessTarget'>${person}<div class='accessGrid'>${BACKEND_DATASETS.map(n=>`<label class='accessCheck'><input type='checkbox' data-backend-access='${n}' ${current.includes(n)?'checked':''}> ${escapeHTML(n.replaceAll('_',' '))}</label>`).join('')}</div><div class='actions'><button class='new' onclick='saveBackendAccess()'>SAVE DATA ACCESS</button><button class='secondary' onclick='clearBackendAccessChecks()'>CLEAR ALL</button></div></div>`}
function teamLeadAdminMarkup(){const rows=(accessDirectory||[]).filter(u=>String(rowVal(u,'Status')).toLowerCase()==='active'&&permissionProfile(u)!=='ORG_OWNER').sort((a,b)=>String(rowVal(a,'Department')).localeCompare(String(rowVal(b,'Department')))||String(rowVal(a,'Full Name')).localeCompare(String(rowVal(b,'Full Name'))));if(!rows.length)return `<div class='empty'>No active staff accounts yet.</div>`;return rows.map(u=>{const id=encodeURIComponent(rowVal(u,'User ID')),on=truthy(rowVal(u,'Team Lead'));return `<div class='accessTarget' style='display:flex;justify-content:space-between;align-items:center;gap:12px'><div><b>${escapeHTML(rowVal(u,'Full Name'))}</b><div class='bigTiny'>${escapeHTML(rowVal(u,'Department')||'—')} • ${escapeHTML(rowVal(u,'Position')||'—')}</div></div><button class='secondary' onclick="toggleTeamLead('${id}',${on?'false':'true'})">${on?'REMOVE TEAM LEAD':'MAKE TEAM LEAD'}</button></div>`}).join('')}
async function toggleTeamLead(encodedId,enabled){if(!isOwner())return alert('Only the System Owner can assign Team Leads.');const id=decodeURIComponent(encodedId);try{setBusy(true);await apiPost('setTeamLead',{targetUserId:id,enabled:!!enabled});await loadFromGoogle(true);renderDataPage();showToast('Team Lead updated',enabled?'The member is now part of the first approval stage.':'Team Lead responsibility removed.')}catch(e){alert('Could not update Team Lead. '+e.message)}finally{setBusy(false)}}
function loadAccessTarget(){const email=(document.getElementById('accessEmail')?.value||'').trim().toLowerCase();selectedAccessEmail=email;document.getElementById('accessTargetPanel').innerHTML=renderAccessTargetMarkup(email);hydrateProfilePhotos()}
function clearBackendAccessChecks(){document.querySelectorAll('[data-backend-access]').forEach(x=>x.checked=false)}
async function saveBackendAccess(){if(!isOwner())return alert('Only the System Owner can change backend data access.');const target=accessDirectory.find(x=>String(rowVal(x,'Email')).toLowerCase()===selectedAccessEmail);if(!target)return alert('Load a valid staff email first.');const datasets=[...document.querySelectorAll('[data-backend-access]:checked')].map(x=>x.dataset.backendAccess);try{setBusy(true);await apiPost('setBackendDataAccess',{targetEmail:selectedAccessEmail,datasets});clearUiDirty('data');await loadFromGoogle(true);selectedAccessEmail=String(rowVal(target,'Email')).toLowerCase();renderDataPage();showToast('Data access updated',`${rowVal(target,'Full Name')} can view ${datasets.length?datasets.join(', '):'no backend datasets'}.`)}catch(e){alert('Could not update data access. '+e.message)}finally{setBusy(false)}}
async function loadBackendDataset(name){if(!backendAccess().includes(name))return alert('You do not have access to '+name+'.');activeBackendDataset=name;renderDataPage();const viewer=document.getElementById('dataViewer');viewer.innerHTML=`<div class='loadingState'>Loading ${escapeHTML(name)}…</div>`;try{const res=await apiPost('getBackendDataset',{dataset:name}),d=res.data||res,cols=d.columns||[],rows=d.rows||[];const shown=rows.slice(0,250),management=!!exportApprovalRole(),buttonLabel=management?'DOWNLOAD BRANDED PDF':'REQUEST PDF DOWNLOAD',policy=management?'As CD, DCD or MD, you may download datasets already granted to your account without a separate approval.':'PDF downloads are branded by ONIT. One approval from any CD, DCD or MD releases the PDF.';viewer.innerHTML=`<div class='hello dataViewerHead' style='align-items:center'><div class='bigTiny'><b>${escapeHTML(name.replaceAll('_',' '))}</b> • ${rows.length} row(s) • Read only${rows.length>250?' • Showing first 250 rows':''}</div><button class='secondary' onclick="requestPdfExport('${name}')">${buttonLabel}</button></div><div class='dataSensitive'>${escapeHTML(policy)}</div><div class='dataTableWrap'><table class='dataTable'><thead><tr>${cols.map(c=>`<th>${escapeHTML(c)}</th>`).join('')}</tr></thead><tbody>${shown.map(r=>`<tr>${cols.map(c=>`<td title='${escapeHTML(rowVal(r,c))}'>${escapeHTML(rowVal(r,c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;renderDataPageToolbarOnly()}catch(e){viewer.innerHTML=`<div class='empty dangerText'>Could not load ${escapeHTML(name)}: ${escapeHTML(e.message)}</div>`}}
function renderDataPageToolbarOnly(){const toolbar=document.getElementById('dataToolbar'),datasets=backendAccess();toolbar.innerHTML=datasets.map(n=>`<button class='${activeBackendDataset===n?'active':''}' onclick="loadBackendDataset('${n}')">${escapeHTML(n.replaceAll('_',' '))}</button>`).join('')}

function ownerBroadcastMarkup(){
  const staff=(users||[]).filter(u=>!isOwner(u)&&String(rowVal(u,'Status')||'').toLowerCase()==='active')
    .sort((a,b)=>String(rowVal(a,'Full Name')).localeCompare(String(rowVal(b,'Full Name'))));
  const opts=staff.map(u=>`<option value='${escapeHTML(rowVal(u,'User ID'))}'>${escapeHTML(rowVal(u,'Full Name'))} — ${escapeHTML(positionOf(u)||departmentOf(u))}${rowVal(u,'Email')?' • '+escapeHTML(rowVal(u,'Email')):''}</option>`).join('');
  return `<div class='morecard ownerBroadcastCard' style='grid-column:1/-1'>
    <div class='ownerToolHead'><div><h3>STAFF BROADCAST <span class='ownerBadge'>OWNER ONLY</span></h3><div class='bigTiny'>Send a management announcement to selected active staff or everyone. It appears as a centre-screen popup while ONIT is open. JPG, PNG and WebP images preview inside the popup.</div></div><div class='ownerToolCount'>${staff.length} ACTIVE STAFF</div></div>
    <div class='broadcastGrid'>
      <div>
        <div class='field'><label>TITLE</label><input id='broadcastComposeTitle' placeholder='e.g. Management update'></div>
        <div class='field'><label>MESSAGE</label><textarea id='broadcastComposeMessage' placeholder='Write the announcement here...'></textarea></div>
        <div class='field'><label>ATTACH IMAGE — OPTIONAL</label><input id='broadcastComposeFile' type='file' accept='image/jpeg,image/png,image/webp'><div class='tiny'>JPG, PNG or WebP • maximum ${MAX_FILE_BYTES/1024/1024} MB</div></div>
      </div>
      <div>
        <label class='accessCheck broadcastAllCheck'><input id='broadcastAll' type='checkbox' onchange='toggleBroadcastTargets()'> SEND TO ALL ACTIVE STAFF</label>
        <div class='field'><label>OR SELECT STAFF</label><select id='broadcastTargets' class='broadcastTargets' multiple ${staff.length?'':'disabled'}>${opts}</select><div class='tiny'>Hold Command on Mac or Ctrl on Windows to select more than one person.</div></div>
      </div>
    </div>
    <div class='actions'><button class='new' onclick='sendOwnerBroadcast(this)' ${staff.length?'':'disabled'}>SEND ANNOUNCEMENT</button></div>
  </div>`
}
function toggleBroadcastTargets(){const all=document.getElementById('broadcastAll')?.checked,sel=document.getElementById('broadcastTargets');if(sel)sel.disabled=!!all}
async function sendOwnerBroadcast(button){
  if(!isOwner())return alert('Only the System Owner can send broadcasts.');
  const title=(document.getElementById('broadcastComposeTitle')?.value||'').trim(),message=(document.getElementById('broadcastComposeMessage')?.value||'').trim(),sendToAll=!!document.getElementById('broadcastAll')?.checked,
    targetUserIds=[...(document.getElementById('broadcastTargets')?.selectedOptions||[])].map(o=>o.value),f=document.getElementById('broadcastComposeFile')?.files?.[0];
  if(!title||!message)return alert('Add a title and message.');if(!sendToAll&&!targetUserIds.length)return alert('Choose staff members or select SEND TO ALL STAFF.');
  const payload={title,message,sendToAll,targetUserIds};if(f){if(f.size>MAX_FILE_BYTES)return alert(`Attachment must be under ${MAX_FILE_BYTES/1024/1024} MB.`);payload.fileName=f.name;payload.fileType=f.type||'application/octet-stream';payload.fileSize=f.size;payload.fileBase64=await fileToBase64(f)}
  if(!confirm(`Send this announcement to ${sendToAll?'all staff':targetUserIds.length+' selected staff member(s)'}?`))return;
  const old=button.textContent;try{button.disabled=true;button.textContent='SENDING…';const res=await apiPost('createOwnerBroadcast',payload),d=res.data||res;document.getElementById('broadcastComposeTitle').value='';document.getElementById('broadcastComposeMessage').value='';document.getElementById('broadcastComposeFile').value='';document.getElementById('broadcastAll').checked=false;const targetSelect=document.getElementById('broadcastTargets');if(targetSelect)[...targetSelect.options].forEach(o=>o.selected=false);toggleBroadcastTargets();clearUiDirty('more');showToast('Announcement sent',`${d.recipients||0} staff member(s) will receive the popup.`)}catch(e){alert('Could not send announcement. '+e.message)}finally{button.disabled=false;button.textContent=old}
}
async function requestPdfExport(dataset){
  if(!backendAccess().includes(dataset))return alert('You do not have access to '+dataset+'.');
  const management=!!exportApprovalRole(),label=dataset.replaceAll('_',' ');
  if(!confirm(management?`Download a branded PDF export of ${label} now?`:`Request a branded PDF export of ${label}? One approval from CD, DCD or MD will release the download.`))return;
  try{
    const res=await apiPost('requestDataExport',{dataset}),d=res.data||res;
    if(management){
      showToast('PDF ready','Your management download is authorised.');
      await downloadDataExport(encodeURIComponent(rowVal(d,'Export ID')));
    }else{
      showToast('PDF request sent','CD, DCD and MD have been notified. Any one of them can approve the download.');
    }
    await loadFromGoogle(true);renderMore();
  }catch(e){alert(e.message)}
}
function exportApprovalStatusMarkup(e){
  const roles=['MD','CD','DCD'],approved=roles.find(r=>!!rowVal(e,r+' Approved By User ID'));
  return approved?`<div class='approvalDots'><span class='approvalDot ok'>APPROVED — ${approved}</span></div>`:`<div class='approvalDots'><span class='approvalDot'>WAITING — ONE OF CD / DCD / MD</span></div>`
}
function dataExportRequestsMarkup(){
  if(!dataExports.length)return '';
  const role=exportApprovalRole(),mine=dataExports.filter(e=>rowVal(e,'Requested By User ID')===CURRENT_USER_ID),approvals=role?dataExports.filter(e=>rowVal(e,'Status')!=='Approved'):[];
  let html='';
  if(mine.length||isOwner()){const list=(isOwner()?dataExports:mine).slice().sort((a,b)=>new Date(rowVal(b,'Requested At'))-new Date(rowVal(a,'Requested At')));html+=`<div class='morecard' style='grid-column:1/-1'><h3>DATA PDF REQUESTS</h3>${list.map(e=>`<div class='exportCard'><b>${escapeHTML(rowVal(e,'Dataset').replaceAll('_',' '))}</b><div class='bigTiny'>Requested by ${escapeHTML(rowVal(e,'Requested By Name'))} • ${escapeHTML(formatDateTime(rowVal(e,'Requested At')))} • ${escapeHTML(rowVal(e,'Status'))}</div>${exportApprovalStatusMarkup(e)}${rowVal(e,'Status')==='Approved'&&(rowVal(e,'Requested By User ID')===CURRENT_USER_ID||isOwner())?`<button class='secondary linkbtn' onclick="downloadDataExport('${encodeURIComponent(rowVal(e,'Export ID'))}')">DOWNLOAD BRANDED PDF</button>`:''}</div>`).join('')}</div>`}
  if(approvals.length){html+=`<div class='morecard' style='grid-column:1/-1'><h3>DATA EXPORT APPROVALS — ${escapeHTML(role)}</h3>${approvals.map(e=>`<div class='exportCard'><b>${escapeHTML(rowVal(e,'Dataset').replaceAll('_',' '))}</b><div class='bigTiny'>Requested by ${escapeHTML(rowVal(e,'Requested By Name'))} • ${escapeHTML(formatDateTime(rowVal(e,'Requested At')))}</div>${exportApprovalStatusMarkup(e)}<button class='new linkbtn' onclick="approveDataExportRequest('${encodeURIComponent(rowVal(e,'Export ID'))}')">APPROVE AS ${escapeHTML(role)}</button></div>`).join('')}</div>`}
  return html
}
async function approveDataExportRequest(id){if(!confirm('Approve this ONIT data PDF export?'))return;try{await apiPost('approveDataExport',{exportId:decodeURIComponent(id)});await loadFromGoogle(true);renderMore();showToast('Export approved','The PDF has been released to the requester.')}catch(e){alert(e.message)}}
async function downloadDataExport(id){
  try{setBusy(true);const res=await apiPost('getDataExportPdf',{exportId:decodeURIComponent(id)}),d=res.data||res;if(!d.base64)throw new Error('No PDF was returned.');const url=URL.createObjectURL(base64ToBlob(d.base64,d.mimeType||'application/pdf')),a=document.createElement('a');a.href=url;a.download=d.fileName||'ONIT-data-export.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){alert('Could not download PDF. '+e.message)}finally{setBusy(false)}
}
function renderMore(){if(!currentUser)return;const names=backendAccess();let html=`<div class='moregrid'><div class='morecard'><h3>MY PROFILE</h3><div class='profileRow'><div class='avatar large' data-avatar-user='${escapeHTML(CURRENT_USER_ID)}'>${escapeHTML(initials(currentUserName()))}</div><div><b>${escapeHTML(currentUserName())}${isOwner()?` <span class='ownerBadge'>SYSTEM OWNER</span>`:''}</b><div class='bigTiny'>${escapeHTML(positionOf(currentUser)||'Position not set')}<br>${escapeHTML(departmentOf(currentUser)||'Department not set')}<br>${escapeHTML(rowVal(currentUser,'Email')||'Email not added yet')}</div></div></div><div class='field'><label>PROFILE PICTURE</label><input type='file' accept='image/jpeg,image/png,image/webp' onchange='uploadProfilePhoto(this)'><div class='tiny'>JPG, PNG or WebP • ONIT optimises the image automatically</div></div><button class='secondary linkbtn' onclick='handleSignOut()'>SIGN OUT</button></div><div class='morecard'><h3>NOTIFICATIONS</h3><div class='switchrow'><div><b>Notification sound</b><div class='bigTiny'>A louder ONIT chime plays for new alerts while ONIT is open. Sound is ON by default unless you switch it off.</div></div><input type='checkbox' ${notificationSoundEnabled()?'checked':''} onchange='toggleSoundPreference(this)'></div><div class='actions'><button class='secondary linkbtn' onclick='testNotificationSound()'>TEST SOUND</button><button class='secondary linkbtn' onclick='enableBrowserNotifications()'>ENABLE BROWSER NOTIFICATIONS</button></div></div><div class='morecard'><h3>ORGANISATION</h3><b>${escapeHTML(rowVal(organisations[0],'Organisation Name')||'Organisation')}</b><div class='bigTiny'>Creative • Account Management • Strategy • Digital • Activation • HR • Accounts</div></div><div class='morecard'><h3>ACCESS</h3><div class='bigTiny'>Create briefs: <b>${canCreateBrief()?'YES':'NO'}</b><br>Review work: <b>${canReview()?'YES':'NO'}</b><br>Final approval: <b>${canApprove()?'YES':'NO'}</b><br>Backend datasets: <b>${isOwner()?'ALL':names.length}</b></div></div>`;
  if(isOwner()&&securityInfo){html+=`<div class='morecard' style='grid-column:1/-1'><h3>ORGANISATION SECURITY <span class='ownerBadge'>OWNER ONLY</span></h3><div class='bigTiny'>Share the Join Code only with authorised staff. Backend data is never granted automatically by this code.</div><div class='securityCode'>${escapeHTML(securityInfo.inviteCode||'—')}</div><div class='actions'><button class='secondary' onclick='regenerateJoinCode()'>REGENERATE JOIN CODE</button><button class='secondary' onclick='toggleSignupAccess()'>${securityInfo.signupsEnabled?'DISABLE':'ENABLE'} SIGNUPS</button></div></div>`}
  if(isOwner()){html+=ownerBroadcastMarkup()}
  if(isOwner()){
    const staffAccounts=(accessDirectory||[]).filter(u=>permissionProfile(u)!=='ORG_OWNER').sort((a,b)=>String(rowVal(a,'Full Name')).localeCompare(String(rowVal(b,'Full Name')))||String(rowVal(a,'User ID')).localeCompare(String(rowVal(b,'User ID'))));
    html+=`<div class='morecard' style='grid-column:1/-1'><h3>STAFF ACCOUNT MANAGEMENT <span class='ownerBadge'>OWNER ONLY</span></h3><div class='bigTiny'>Correct a staff email, send a reset code, or offboard someone without deleting their work history. Deactivated staff cannot sign in or receive new assignments, but their old briefs, approvals, comments and files remain intact.</div><div class='field' style='margin-top:12px'><label>SELECT STAFF MEMBER</label><select id='ownerRecoveryUser' onchange='populateRecoveryEmail()'><option value=''>Choose staff member…</option>${staffAccounts.map(u=>`<option value='${escapeHTML(rowVal(u,'User ID'))}'>${escapeHTML(rowVal(u,'Full Name'))} — ${escapeHTML(rowVal(u,'Position')||rowVal(u,'Department')||'Staff')} — ${escapeHTML(rowVal(u,'Email')||'No email')} — ${escapeHTML(rowVal(u,'Status')||'Unknown')}</option>`).join('')}</select></div><div id='ownerStaffAccountPanel'><div class='empty'>Choose a staff member to manage the account.</div></div></div>`;
  }
  if(canManagePeople()){html+=`<div class='morecard' style='grid-column:1/-1'><h3>PENDING SIGNUPS</h3>${pendingUsers.length?pendingUsers.map(u=>`<div class='pendingRow'><div><b>${escapeHTML(rowVal(u,'Full Name'))}</b><div class='bigTiny'>${escapeHTML(rowVal(u,'Email'))} • ${escapeHTML(departmentOf(u))} • ${escapeHTML(positionOf(u))}</div></div><div class='actions'><button class='secondary' onclick="approvePending('${encodeURIComponent(rowVal(u,'User ID'))}')">APPROVE</button><button class='secondary' onclick="rejectPending('${encodeURIComponent(rowVal(u,'User ID'))}')">REJECT</button></div></div>`).join(''):`<div class='empty'>No pending signup requests.</div>`}</div>`}
  if(canManageClients()||canManagePeople()){html+=`<div class='morecard' style='grid-column:1/-1'><h3>MANAGE</h3>${canManageClients()?`<button class='secondary linkbtn' onclick='addClient()'>+ ADD ACCOUNT</button>`:''}${canManagePeople()?`<button class='secondary linkbtn' onclick='addMember()'>+ ADD MEMBER PROFILE</button>`:''}${isOwner()?`<button class='secondary linkbtn' onclick="show('data')">MANAGE DATA ACCESS</button>`:''}</div>`}
  if(canSeeReports()&&reportSummary){html+=`<div class='morecard' style='grid-column:1/-1'><h3>REPORTS — LIVE SUMMARY</h3>${reportSummaryTable()}<button class='secondary linkbtn' onclick='refreshReportsNow()'>REFRESH REPORTS</button><button class='secondary linkbtn' onclick="activeBackendDataset='REPORTS';show('data')">OPEN REPORTS DATA</button></div>`}
  if(names.length){html+=`<div class='morecard' style='grid-column:1/-1'><h3>BACKEND DATA</h3><div class='bigTiny'>Read-only data access is enforced inside ONIT. Raw Google Sheet access is not granted to staff. CD, DCD and MD can download directly. Other staff need one approval from any one of them.</div><div class='bigTiny'>${escapeHTML(names.join(' • '))}</div><button class='secondary linkbtn' onclick="show('data')">OPEN DATA CONSOLE</button></div>`}
  html+=dataExportRequestsMarkup();
  html+=`<div class='morecard' style='grid-column:1/-1'><h3>INSTALL / UPDATE ONIT</h3><div class='bigTiny'>Install ONIT on this device for quick access. ONIT now checks the hosted frontend version automatically and repairs stale installed copies without requiring a reinstall.</div><div class='actions'><button class='secondary linkbtn' onclick='installOnit()'>INSTALL ON THIS DEVICE</button><button class='secondary linkbtn' onclick='forceFrontendUpdate()'>CHECK / REPAIR UPDATE</button></div></div>`;
  html+=`<div class='morecard' style='grid-column:1/-1'><h3>HELP / ABOUT</h3><div class='bigTiny'>ONIT Frontend v${APP_VERSION} • Backend ${backendVersion||'checking…'} • Time + People + Status<br>Every brief has an owner, deadline, status and visible history.<br>Live Brief Overview, Daily/Weekly Team Work Utilisation, ONIT Pulse, Risk Radar, Brief Replay and Handover Mode are active.<br>Profile photos, governed PDF data exports, Owner Broadcasts, Staff Account Management and approved-job staff archives are active.<br>Account Management, Dr. Kunbi, Creative Director, Deputy Creative Director and Managing Director can create/send briefs. Brief visibility is private by workflow: sender, assigned/CC users, relevant Team Lead review, final approver stage and System Owner only.<br>Owner-assigned Team Leads provide first-stage approval before CD/DCD final approval.<br>Installed HTTPS/PWA copies check automatically for frontend updates; backend changes are live immediately.<br>The System Owner account administers data access separately from operational staff roles and can correct staff emails, send password-reset codes, deactivate/reactivate staff and preserve historical work.</div></div></div>`;document.getElementById('moreContent').innerHTML=html;hydrateProfilePhotos()}
async function approvePending(id){
  const targetUserId=decodeURIComponent(id),target=pendingUsers.find(u=>String(rowVal(u,'User ID'))===String(targetUserId)),name=target?rowVal(target,'Full Name'):'The member';
  try{
    const res=await apiPost('approvePendingUser',{targetUserId}),d=res.data||res;
    pendingUsers=pendingUsers.filter(u=>String(rowVal(u,'User ID'))!==String(targetUserId));
    renderMore();
    showToast(d.alreadyProcessed?'Account already active':'Account approved',d.alreadyProcessed?`${name} was already approved. The list has been refreshed.`:`${name} can now sign in.`);
    await loadFromGoogle(false,true);
  }catch(e){
    if(/not awaiting approval|already active/i.test(String(e&&e.message||e))){
      pendingUsers=pendingUsers.filter(u=>String(rowVal(u,'User ID'))!==String(targetUserId));renderMore();await loadFromGoogle(false,true);showToast('Account already processed',`${name} is no longer waiting for approval.`);return;
    }
    alert('Could not approve this account. '+e.message);
  }
}
async function rejectPending(id){
  if(!confirm('Reject this signup request?'))return;
  const targetUserId=decodeURIComponent(id),target=pendingUsers.find(u=>String(rowVal(u,'User ID'))===String(targetUserId)),name=target?rowVal(target,'Full Name'):'The member';
  try{
    const res=await apiPost('rejectPendingUser',{targetUserId}),d=res.data||res;
    pendingUsers=pendingUsers.filter(u=>String(rowVal(u,'User ID'))!==String(targetUserId));renderMore();
    showToast(d.alreadyProcessed?'Signup already closed':'Signup rejected',d.alreadyProcessed?`${name}'s request had already been processed.`:`${name}'s signup request was closed.`);
    await loadFromGoogle(false,true);
  }catch(e){
    if(/not awaiting approval|already inactive|already processed/i.test(String(e&&e.message||e))){pendingUsers=pendingUsers.filter(u=>String(rowVal(u,'User ID'))!==String(targetUserId));renderMore();await loadFromGoogle(false,true);showToast('Signup already processed',`${name} is no longer waiting for approval.`);return;}
    alert('Could not reject this signup. '+e.message);
  }
}
async function regenerateJoinCode(){if(!confirm('Regenerate the organisation join code? The old code will stop working immediately.'))return;try{const res=await apiPost('regenerateInviteCode',{});securityInfo.inviteCode=(res.data||res).inviteCode;renderMore();showToast('Join code updated','Share the new code only with authorised people.')}catch(e){alert(e.message)}}
async function toggleSignupAccess(){try{const res=await apiPost('setSignupsEnabled',{enabled:!securityInfo.signupsEnabled});securityInfo.signupsEnabled=(res.data||res).enabled;renderMore();showToast('Signup access',securityInfo.signupsEnabled?'New signups enabled.':'New signups disabled.')}catch(e){alert(e.message)}}
function ownerAccountRecord(id){
  return (accessDirectory||[]).find(u=>String(rowVal(u,'User ID'))===String(id))||users.find(u=>String(rowVal(u,'User ID'))===String(id))||null;
}
function ownerOpenWorkForUser(id){
  const codes=new Set((allAssignments||[]).filter(a=>String(rowVal(a,'User ID','userId'))===String(id)&&String(rowVal(a,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(rowVal(a,'Active','active')).toLowerCase()!=='false').map(a=>String(rowVal(a,'Brief Code','briefCode'))));
  return (briefs||[]).filter(b=>codes.has(String(b.code||rowVal(b,'Brief Code')))&&!['Closed','Approved'].includes(String(b.status||rowVal(b,'Status'))));
}
function renderOwnerStaffAccountPanel(){
  const select=document.getElementById('ownerRecoveryUser'),id=select?.value||'',panel=document.getElementById('ownerStaffAccountPanel');
  if(!panel)return;
  const target=ownerAccountRecord(id);
  if(!target){panel.innerHTML=`<div class='empty'>Choose a staff member to manage the account.</div>`;return}
  const status=String(rowVal(target,'Status')||'').toLowerCase(),active=status==='active',deactivated=status==='deactivated'||status==='former staff';
  const openWork=ownerOpenWorkForUser(id);
  const handoverOptions=(users||[]).filter(u=>String(rowVal(u,'User ID'))!==String(id)&&permissionProfile(u)!=='ORG_OWNER').map(u=>`<option value='${escapeHTML(rowVal(u,'User ID'))}'>${escapeHTML(rowVal(u,'Full Name'))} — ${escapeHTML(positionOf(u)||departmentOf(u))}</option>`).join('');
  panel.innerHTML=`<div class='accessTarget' style='margin-top:12px'>
    <div class='profileRow'><div class='avatar' data-avatar-user='${escapeHTML(id)}'>${escapeHTML(initials(rowVal(target,'Full Name')))}</div><div><b>${escapeHTML(rowVal(target,'Full Name'))}</b><div class='bigTiny'>${escapeHTML(positionOf(target)||departmentOf(target)||'Staff')} • ${escapeHTML(rowVal(target,'Status')||'Unknown')} • User ID ${escapeHTML(id)}</div></div></div>
    <div class='field'><label>REGISTERED WORK EMAIL</label><input id='ownerRecoveryEmail' type='email' value='${escapeHTML(rowVal(target,'Email')||'')}' placeholder='staff@company.com'><div class='tiny'>Password reset emails go to this exact address. Correcting it does not create a new account or remove history.</div></div>
    ${openWork.length?`<div class='notice'><b>${openWork.length} active brief${openWork.length===1?'':'s'} still linked to this staff member.</b><br>${openWork.slice(0,5).map(b=>escapeHTML((b.client||'')+' — '+(b.project||b.code||''))).join('<br>')}${openWork.length>5?`<br>+ ${openWork.length-5} more`:''}</div>`:`<div class='tiny' style='margin:8px 0'>No active operational briefs need handover.</div>`}
    ${active&&openWork.length?`<div class='field'><label>HAND ACTIVE WORK TO</label><select id='ownerOffboardHandover'><option value=''>Choose team member…</option>${handoverOptions}</select><div class='tiny'>ONIT will transfer active TO assignments before disabling this account.</div></div>`:''}
    <div class='actions'>
      <button class='secondary' onclick='saveRecoveryEmail(this)'>SAVE EMAIL</button>
      ${active?`<button class='secondary' onclick='sendOwnerPasswordReset(this)'>SEND RESET CODE</button><button class='secondary dangerAction' onclick='deactivateStaffAccount(this)'>DEACTIVATE STAFF</button>`:''}
      ${deactivated?`<button class='new' onclick='reactivateStaffAccount(this)'>REACTIVATE STAFF</button>`:''}
    </div>
    <div class='tiny' style='margin-top:8px'>Deactivation immediately blocks sign-in and revokes existing sessions. Historical briefs, files, approvals and activity remain available.</div>
  </div>`;
  hydrateProfilePhotos();
}
function populateRecoveryEmail(){renderOwnerStaffAccountPanel()}
async function saveRecoveryEmail(button){
  if(!isOwner())return alert('Only the System Owner can manage staff accounts.');
  const targetUserId=document.getElementById('ownerRecoveryUser')?.value||'';
  const email=(document.getElementById('ownerRecoveryEmail')?.value||'').trim();
  if(!targetUserId)return alert('Select a staff member first.');
  if(!email)return alert('Enter the staff member’s correct work email.');
  const old=button.textContent;button.disabled=true;button.textContent='SAVING…';
  try{
    const res=await apiPost('ownerUpdateStaffEmail',{targetUserId,email}),d=res.data||res;
    [users,accessDirectory].forEach(list=>{const target=(list||[]).find(u=>String(rowVal(u,'User ID'))===String(targetUserId));if(target)target.Email=d.email||email});
    showToast('Staff email updated',`${d.fullName||'Staff member'} is now registered with ${d.email||email}.`);
    renderOwnerStaffAccountPanel();
  }catch(e){alert('Could not update staff email. '+e.message)}
  finally{button.disabled=false;button.textContent=old}
}
async function sendOwnerPasswordReset(button){
  if(!isOwner())return alert('Only the System Owner can use account recovery.');
  const targetUserId=document.getElementById('ownerRecoveryUser')?.value||'';
  if(!targetUserId)return alert('Select a staff member first.');
  const target=ownerAccountRecord(targetUserId),name=target?rowVal(target,'Full Name'):'this staff member',email=target?rowVal(target,'Email'):'';
  if(String(rowVal(target,'Status')||'').toLowerCase()!=='active')return alert('Reactivate this account before sending a reset code.');
  if(!email)return alert('This account has no registered work email. Add the correct email first.');
  if(!confirm(`Send a password-reset code to ${name} at ${email}?`))return;
  const old=button.textContent;button.disabled=true;button.textContent='SENDING…';
  try{
    const res=await apiPost('ownerSendPasswordReset',{targetUserId}),d=res.data||res;
    showToast('Password reset sent',`${d.fullName||name} will receive a reset code by email. It expires in ${d.expiresInMinutes||10} minutes.`);
  }catch(e){alert('Could not send password reset. '+e.message)}
  finally{button.disabled=false;button.textContent=old}
}
async function deactivateStaffAccount(button){
  if(!isOwner())return alert('Only the System Owner can deactivate staff.');
  const targetUserId=document.getElementById('ownerRecoveryUser')?.value||'',target=ownerAccountRecord(targetUserId);
  if(!target)return alert('Select a staff member first.');
  const openWork=ownerOpenWorkForUser(targetUserId);
  const handoverToUserId=openWork.length?(document.getElementById('ownerOffboardHandover')?.value||''):'';
  if(openWork.length&&!handoverToUserId)return alert(`This staff member still has ${openWork.length} active brief${openWork.length===1?'':'s'}. Choose who should receive the work before deactivation.`);
  const reason=(prompt('Reason for deactivation:','Staff resigned / left the organisation')||'').trim();
  if(!reason)return;
  const name=rowVal(target,'Full Name')||'this staff member';
  if(!confirm(`Deactivate ${name}? They will be signed out immediately and cannot receive new work. Their historical work will remain in ONIT.`))return;
  const old=button.textContent;button.disabled=true;button.textContent='DEACTIVATING…';
  try{
    const res=await apiPost('ownerDeactivateStaff',{targetUserId,handoverToUserId,reason}),d=res.data||res;
    await loadFromGoogle(true);
    renderMore();
    showToast('Staff deactivated',`${d.fullName||name} no longer has ONIT access.${d.handoverCount?` ${d.handoverCount} active brief${d.handoverCount===1?' was':'s were'} handed over.`:''}`);
  }catch(e){alert('Could not deactivate staff. '+e.message)}
  finally{button.disabled=false;button.textContent=old}
}
async function reactivateStaffAccount(button){
  if(!isOwner())return alert('Only the System Owner can reactivate staff.');
  const targetUserId=document.getElementById('ownerRecoveryUser')?.value||'',target=ownerAccountRecord(targetUserId);
  if(!target)return alert('Select a staff member first.');
  const name=rowVal(target,'Full Name')||'this staff member';
  if(!confirm(`Reactivate ${name}? They will be able to sign in again with their existing account.`))return;
  const old=button.textContent;button.disabled=true;button.textContent='REACTIVATING…';
  try{
    await apiPost('ownerReactivateStaff',{targetUserId});
    await loadFromGoogle(true);
    renderMore();
    showToast('Staff reactivated',`${name} can use ONIT again.`);
  }catch(e){alert('Could not reactivate staff. '+e.message)}
  finally{button.disabled=false;button.textContent=old}
}
function reportSummaryTable(){const rows=(reportSummary.metrics||[]).map(m=>`<tr><td>${escapeHTML(m.metric)}</td><td>${m.daily}</td><td>${m.weekly}</td><td>${m.monthly}</td></tr>`).join('');return `<table class='reportTable'><thead><tr><th>ACTIVITY</th><th>DAILY</th><th>WEEKLY</th><th>MONTHLY</th></tr></thead><tbody>${rows}</tbody></table><div class='inlineInfo'><span>Active: <b>${reportSummary.activeBriefs||0}</b></span><span>Avg iterations: <b>${reportSummary.avgIterations||0}</b></span><span>Avg turnaround: <b>${reportSummary.avgTurnaroundHours||0}h</b></span></div>`}
async function refreshReportsNow(){try{setBusy(true);await apiPost('refreshReports',{organisationId:ORG_ID,userId:CURRENT_USER_ID});await loadFromGoogle(true);showToast('Reports','Daily, weekly and monthly reports refreshed.')}catch(e){alert(e.message)}finally{setBusy(false)}}
async function addClient(){const clientName=prompt('Account / brand name:');if(!clientName?.trim())return;const brand=prompt('Brand name:',clientName.trim())||clientName.trim();try{await apiPost('createClient',{organisationId:ORG_ID,userId:CURRENT_USER_ID,clientName:clientName.trim(),brand:brand.trim()});await loadFromGoogle(true);showToast('Client added',clientName.trim())}catch(e){alert('Could not add client. '+e.message)}}
async function addMember(){const fullName=prompt('Member full name:');if(!fullName?.trim())return;const email=prompt('Work email (optional):','')||'';const department=prompt('Department: Creative, Account Management, Strategy, Digital, Activation, HR, or Accounts','Creative');if(!department?.trim())return;const position=prompt('Position / job title:');if(!position?.trim())return;const senior=/^y(es)?$/i.test((prompt('Is this person part of senior management with organisation-wide visibility? Type YES or NO','NO')||'NO').trim());try{await apiPost('registerUser',{fullName:fullName.trim(),email:email.trim(),department:department.trim(),position:position.trim(),seniorManagement:senior});await loadFromGoogle(true);showToast('Member added',fullName.trim())}catch(e){alert('Could not add member. '+e.message)}}

function timeInfo(b){if(b.status==='Closed')return{text:'CLOSED',cls:'green'};if(b.status==='Approved')return{text:'APPROVED',cls:'green'};let ms;if(b.paused)ms=b.pauseRemainingMs!==''&&b.pauseRemainingMs!==undefined?Number(b.pauseRemainingMs):new Date(b.deadline)-new Date(b.pauseStartedAt);else ms=new Date(b.deadline).getTime()-(Date.now()+serverOffset);if(!b.deadline||!Number.isFinite(ms))return{text:b.paused?'PAUSED — time unavailable':'Deadline unavailable',cls:'paused'};const text=duration(ms);if(b.paused)return{text:'PAUSED — '+(ms<0?'Overdue by '+text:text+' remaining'),cls:'paused'};return{text:ms<0?'Overdue by '+text:text,cls:ms<0?'red':ms<3600000?'orange':'green'}}
function duration(ms){let s=Math.floor(Math.abs(ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':')}
function lagosInput(date){return new Date(new Date(date).getTime()+3600000).toISOString().slice(0,16)}
function parseLagos(value){const normalized=value.replace(' ','T');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized))throw new Error('Use YYYY-MM-DD HH:MM in Nigeria time.');const d=new Date(normalized+':00+01:00');if(!Number.isFinite(d.getTime()))throw new Error('That date is invalid.');return d}
function formatDateTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'}):'—'}
function formatTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'}):'--:--'}
function makeId(){return crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-')}



// ===== Self-healing frontend update manager =====
let pendingFrontendVersion='';
async function fetchFrontendRelease(){
  const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!r.ok)throw new Error('Version check '+r.status);
  return r.json();
}
function safeToReloadForUpdate(){
  return !mutationBusy && (!window.uiDirtySections || uiDirtySections.size===0);
}
async function performFrontendRefresh(targetVersion,force){
  if(!force && !safeToReloadForUpdate()){
    pendingFrontendVersion=targetVersion||pendingFrontendVersion;
    showToast('ONIT update ready','Finish your current form/action. ONIT will update automatically afterwards.');
    return false;
  }
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async reg=>{try{await reg.update()}catch(e){}}));
    }
  }catch(e){}
  const url=new URL(location.href);
  url.searchParams.set('onit_v',targetVersion||Date.now());
  url.searchParams.set('_refresh',Date.now());
  location.replace(url.toString());
  return true;
}
async function checkFrontendRelease(force=false){
  if(!isHttpsApp()||navigator.onLine===false)return;
  try{
    const release=await fetchFrontendRelease();
    const remote=String(release.version||'').trim();
    if(remote && remote!==APP_VERSION){
      pendingFrontendVersion=remote;
      await performFrontendRefresh(remote,force);
      return;
    }
    if(pendingFrontendVersion && safeToReloadForUpdate()){
      const target=pendingFrontendVersion;pendingFrontendVersion='';
      await performFrontendRefresh(target,true);
    }
  }catch(e){console.warn('Frontend version check:',e)}
}
async function forceFrontendUpdate(){
  if(window.uiDirtySections && uiDirtySections.size){
    if(!confirm('You have an unfinished form. Reload ONIT and discard those unsaved changes?'))return;
  }
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async reg=>{try{await reg.unregister()}catch(e){}}));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('onit-')).map(k=>caches.delete(k)));
    }
  }catch(e){}
  location.replace('./?repair=1&t='+Date.now());
}

// ===== Installable app / near-real-time shell =====
let deferredInstallPrompt=null,lastFocusRefresh=0;
function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isHttpsApp(){return location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)}
function refreshInstallButton(){const b=document.getElementById('installBtn');if(!b)return;const show=!isStandalone();b.classList.toggle('hidden',!show);b.textContent=isIOS()?'ADD TO HOME':'INSTALL'}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;refreshInstallButton()});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;refreshInstallButton();showToast('ONIT installed','ONIT is now available like an app on this device and will receive updates automatically.')});
async function installOnit(){
  if(isStandalone())return showToast('ONIT','Already installed on this device.');
  if(!isHttpsApp()){
    alert('ONIT can only install directly from its secure online address. This copy is running from a local file. Once ONIT is published to its HTTPS address, this same INSTALL button will install it directly.');
    return;
  }
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    if(choice?.outcome==='accepted')showToast('ONIT','Installation started.');
    deferredInstallPrompt=null;refreshInstallButton();return;
  }
  if(isIOS()){alert('On iPhone/iPad: tap Share in Safari, then choose “Add to Home Screen”.');return}
  alert('Your browser has not offered the install prompt yet. In Chrome or Edge, open the browser menu and choose “Install ONIT” or “Install app”.');
}
async function checkForUpdates(){
  if(!SESSION_TOKEN||mutationBusy||document.hidden||navigator.onLine===false)return;
  try{
    const pulse=await apiGet('pulse');
    backendVersion=pulse.version||backendVersion;
    if(pulse.serverTime)serverOffset=new Date(pulse.serverTime).getTime()-Date.now();
    const next=String(pulse.stateVersion||'');
    if(next&&lastStateVersion&&next!==lastStateVersion){await loadFromGoogle(false,true);return}
    if(next&&!lastStateVersion)lastStateVersion=next;
    if(!document.getElementById('home').classList.contains('hidden'))renderHomeAnalytics();
  }catch(e){
    if(authError(e)){await loadFromGoogle(false,true);return}
    console.warn('ONIT pulse:',e);
  }
}
function refreshWhenActive(){if(document.hidden)return;checkFrontendRelease(false);if(!SESSION_TOKEN||mutationBusy)return;const now=Date.now();if(now-lastFocusRefresh<4000)return;lastFocusRefresh=now;checkForUpdates()}
window.addEventListener('focus',refreshWhenActive);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWhenActive()});
window.addEventListener('online',()=>{connectionNotice('');refreshWhenActive()});
window.addEventListener('offline',()=>connectionNotice('You are offline. ONIT will update when your connection returns.'));
if('serviceWorker' in navigator && isHttpsApp()){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>{
    reg.update().catch(()=>{});
    setInterval(()=>reg.update().catch(()=>{}),30000);
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(reloading)return;
      if(!safeToReloadForUpdate()){
        pendingFrontendVersion=pendingFrontendVersion||'new';
        showToast('ONIT update ready','Finish your current form/action. The app will refresh automatically afterwards.');
        return;
      }
      reloading=true;
      location.reload();
    });
    checkFrontendRelease(false);
    setInterval(()=>checkFrontendRelease(false),30000);
  }).catch(err=>console.warn('Service worker:',err)))
}
refreshInstallButton();

setInterval(()=>{if(!document.getElementById('briefs').classList.contains('hidden'))renderBriefs();if(current&&!document.getElementById('detail').classList.contains('hidden')){const t=timeInfo(current),el=document.getElementById('dtimer');el.textContent=t.text;el.className='num '+t.cls}renderApprovalClocks()},1000);
setInterval(()=>{const now=Date.now(),gap=firebaseRealtimeHealthy?60000:15000;if(now-lastFallbackPulseAt>=gap){lastFallbackPulseAt=now;checkForUpdates()}},5000);
async function boot(){if(SESSION_TOKEN){document.getElementById('authGate').classList.add('hidden');document.getElementById('appShell').classList.remove('hidden');await loadFromGoogle(false);if(SESSION_TOKEN)return}document.getElementById('appShell').classList.add('hidden');document.getElementById('authGate').classList.remove('hidden');showAuthMode('signin')}
boot();
