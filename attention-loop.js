/* ONIT v0.36.3 — Persistent Brief Attention Loop */
(function(){
  const VERSION='0.1.0',SNOOZE_MS=10*60*1000,CHECK_MS=60*1000;
  let promptBusy=false,bootDeepLinkHandled=false,lastVisualSignature='';
  const val=(row,...keys)=>{for(const k of keys){if(row&&row[k]!==undefined&&row[k]!==null)return row[k]}return''};
  const truth=v=>v===true||String(v||'').toLowerCase()==='true';
  const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function activeAssignment(code){
    try{return (allAssignments||[]).find(a=>String(val(a,'Brief Code','briefCode'))===String(code)&&String(val(a,'User ID','userId'))===String(CURRENT_USER_ID)&&String(val(a,'Assignment Type','assignmentType')).toUpperCase()==='TO'&&String(val(a,'Active','active')).toLowerCase()!=='false')||null}catch(e){return null}
  }
  function briefByCode(code){try{return (briefs||[]).find(b=>String(b.code)===String(code))||null}catch(e){return null}}
  function isUnattendedBrief(b){
    if(!b||['Closed','Approved','Team Lead Review','In Review'].includes(String(b.status||'')))return false;
    const a=activeAssignment(b.code);return !!a&&!val(a,'Acknowledged At','acknowledgedAt');
  }
  function unattendedBriefs(){
    try{return (briefs||[]).filter(isUnattendedBrief).sort((a,b)=>{const aa=activeAssignment(a.code),bb=activeAssignment(b.code);return new Date(val(aa,'Assigned At','assignedAt')||0)-new Date(val(bb,'Assigned At','assignedAt')||0)})}catch(e){return[]}
  }
  function snoozeKey(code){return `onit-attention-snooze:${CURRENT_USER_ID||'user'}:${code}`}
  function snoozed(code){try{return Number(localStorage.getItem(snoozeKey(code))||0)>Date.now()}catch(e){return false}}
  function snooze(code){try{localStorage.setItem(snoozeKey(code),String(Date.now()+SNOOZE_MS))}catch(e){}}
  function currentBriefVisible(code){try{return current&&String(current.code)===String(code)&&!document.getElementById('detail')?.classList.contains('hidden')}catch(e){return false}}
  function syncAttentionVisuals(){
    const sig=unattendedBriefs().map(b=>b.code).sort().join('|');if(sig===lastVisualSignature)return;lastVisualSignature=sig;
    try{if(!document.getElementById('home')?.classList.contains('hidden'))renderHome()}catch(e){}
    try{if(!document.getElementById('briefs')?.classList.contains('hidden'))renderBriefs()}catch(e){}
  }
  function notificationNeedsAction(n){
    const type=String(val(n,'Type','type')||'').toUpperCase(),code=val(n,'Brief Code','briefCode');
    if(type==='NEW_BRIEF'&&code)return isUnattendedBrief(briefByCode(code));
    if(type==='APPROVAL_REQUIRED'&&code){const b=briefByCode(code);return !!b&&String(b.status)==='In Review'&&!b.finalApproved}
    if(type==='TEAM_LEAD_APPROVAL_REQUIRED'&&code){const b=briefByCode(code);return !!b&&String(b.status)==='Team Lead Review'}
    return truth(val(n,'Action Required','actionRequired'));
  }
  function notificationRoute(n){
    const code=String(val(n,'Brief Code','briefCode')||''),type=String(val(n,'Type','type')||'').toUpperCase();
    if(code&&briefByCode(code))return()=>detail(code);
    if(/PULSE|DIGITAL/.test(type))return()=>show('pulse');
    if(/CASE/.test(type))return()=>show('cases');
    if(/ACTIVATION/.test(type))return()=>show('activation');
    if(/IDEA|SIGNAL|PROACTIVE/.test(type))return()=>show('ideas');
    if(type==='OWNER_BROADCAST')return()=>{try{showNextBroadcast()}catch(e){show('home')}};
    return()=>show('home');
  }
  async function openNotification(id){
    const n=(notifications||[]).find(x=>String(val(x,'Notification ID','notificationId'))===String(id));if(!n)return;
    const nid=val(n,'Notification ID','notificationId');n['Read']=true;n['Read At']=new Date().toISOString();
    try{renderNotifications()}catch(e){}
    document.getElementById('notifPanel')?.classList.add('hidden');
    if(nid)apiPost('markNotificationsRead',{notificationIds:[nid]}).catch(e=>console.warn('Notification read receipt:',e));
    const go=notificationRoute(n);setTimeout(go,0);
  }
  window.openOnitNotification=openNotification;
  function notifLevel(n){try{return typeof notificationLevel==='function'?notificationLevel(n):(notificationNeedsAction(n)?'loud':'normal')}catch(e){return notificationNeedsAction(n)?'loud':'normal'}}
  function renderNotifGroup(title,rows,cls){
    if(!rows.length)return'';
    return `<div class='onitNotifHead'><span>${esc(title)}</span><span>${rows.filter(n=>!truth(val(n,'Read'))).length} unread</span></div><div class='onitNotifGroup'>${rows.slice(0,30).map(n=>{const id=encodeURIComponent(String(val(n,'Notification ID','notificationId')||'')),level=notifLevel(n),pending=notificationNeedsAction(n),code=val(n,'Brief Code','briefCode');return `<button type='button' class='notifItem onitNotifClickable ${truth(val(n,'Read'))?'':'unread'} ${cls} ${pending?'onitNotifPending':''}' onclick="openOnitNotification(decodeURIComponent('${id}'))"><b>${esc(val(n,'Title','title'))}<span class='onitNotifLevel ${level}'>${level==='loud'?'LOUD':level==='normal'?'NORMAL':'SILENT'}</span></b><div class='muted'>${esc(val(n,'Message','message'))}</div><div class='tiny'>${esc(code)}${pending?' • NEEDS YOUR ATTENTION':''}${String(val(n,'Type','type'))==='OWNER_BROADCAST'?' • MANAGEMENT ANNOUNCEMENT':''} • ${esc(typeof formatDateTime==='function'?formatDateTime(val(n,'Created At','createdAt')):val(n,'Created At','createdAt'))}</div></button>`}).join('')}</div>`
  }
  function enhancedRenderNotifications(){
    syncAttentionVisuals();
    const list=(notifications||[]).slice().sort((a,b)=>new Date(val(b,'Created At','createdAt')||0)-new Date(val(a,'Created At','createdAt')||0));
    const action=list.filter(notificationNeedsAction),updates=list.filter(n=>!notificationNeedsAction(n));
    const unreadUpdates=updates.filter(n=>!truth(val(n,'Read'))).length,badgeCount=action.length+unreadUpdates,badge=document.getElementById('notifBadge');
    if(badge){badge.textContent=badgeCount;badge.classList.toggle('hidden',!badgeCount);badge.classList.toggle('attentionPulse',action.length>0)}
    const panel=document.getElementById('notifPanel');if(panel)panel.innerHTML=`<b>Action Centre</b>${renderNotifGroup('ACTION REQUIRED',action,'actionRequired')}${renderNotifGroup('UPDATES / FYI',updates,'fyi')}${!list.length?`<p class='muted'>No notifications yet.</p>`:''}`;
    try{
      const fresh=list.filter(n=>!truth(val(n,'Read'))&&!announcedNotifications.has(val(n,'Notification ID','notificationId')));if(fresh.length){const important=fresh.find(notificationNeedsAction)||fresh[0],level=notifLevel(important),type=String(val(important,'Type','type')||'');if(type!=='OWNER_BROADCAST'&&type!=='BUZZER')showToast?.(val(important,'Title','title'),val(important,'Message','message'));if(typeof playLevel==='function')playLevel(level,important);if(level!=='silent')showSystemNotification?.(notificationNeedsAction(important)?'ONIT • ACTION REQUIRED':val(important,'Title','title'),val(important,'Message','message'),important);fresh.forEach(n=>announcedNotifications.add(val(n,'Notification ID','notificationId')));try{localStorage.setItem(announcedKey(CURRENT_USER_ID),JSON.stringify([...announcedNotifications]))}catch(e){}}
    }catch(e){console.warn('Attention notifications:',e)}
  }
  window.renderNotifications=enhancedRenderNotifications;
  window.toggleNotifications=async function(){const panel=document.getElementById('notifPanel');if(!panel)return;panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))enhancedRenderNotifications()};
  window.showSystemNotification=function(title,message,note){
    try{if(!('Notification'in window)||Notification.permission!=='granted')return;const sys=new Notification(title,{body:message,data:{notificationId:val(note,'Notification ID','notificationId')||'',briefCode:val(note,'Brief Code','briefCode')||''}});sys.onclick=()=>{try{window.focus()}catch(e){}const id=sys.data?.notificationId;if(id)openNotification(id);else if(sys.data?.briefCode&&briefByCode(sys.data.briefCode))detail(sys.data.briefCode);sys.close()}}catch(e){}
  };
  if(typeof briefMarkup==='function'){
    const baseBriefMarkup=briefMarkup;
    window.briefMarkup=function(b){
      let html=baseBriefMarkup(b);if(!isUnattendedBrief(b))return html;
      html=html.replace("class='brief'", "class='brief onitUnattendedBrief'");
      html=html.replace("<div class='briefTags'>", "<div class='briefTags'><span class='miniChip onitNeedsAckChip'>NEW • ACKNOWLEDGE</span>");
      return html;
    }
  }
  if(typeof acknowledgeTask==='function'){
    const baseAcknowledgeTask=acknowledgeTask;
    window.acknowledgeTask=async function(button){const r=await baseAcknowledgeTask(button);lastVisualSignature='';setTimeout(cycle,100);return r}
  }
  if(typeof buildRadarItems==='function'){
    const baseBuildRadarItems=buildRadarItems;
    window.buildRadarItems=function(mode){
      const base=baseBuildRadarItems(mode)||[];if(mode==='OWNER')return base;
      const mine=unattendedBriefs().slice(0,2).map(b=>{const a=activeAssignment(b.code),when=val(a,'Assigned At','assignedAt'),age=when&&typeof hoursSince==='function'?hoursSince(when):0,encoded=encodeURIComponent(b.code||'');return{key:`unattended:${b.code}`,level:'high',code:b.code,title:`${b.client||b.project} is waiting for you`,copy:`This brief was assigned directly to you${age>=1?' about '+Math.round(age)+'h ago':''} and has not been acknowledged yet.`,actionLabel:'OPEN & ACKNOWLEDGE',onclick:`radarOpenBrief('${encoded}')`}});
      const codes=new Set(mine.map(x=>x.code));return mine.concat(base.filter(x=>!x.code||!codes.has(x.code))).slice(0,3)
    }
  }
  async function reminderPrompt(){
    if(promptBusy||document.hidden||!CURRENT_USER_ID||typeof onitConfirm!=='function')return;const b=unattendedBriefs().find(x=>!snoozed(x.code)&&!currentBriefVisible(x.code));if(!b)return;
    if(document.querySelector('.onitDialogLayer,.modal:not(.hidden)'))return;
    promptBusy=true;try{const open=await onitConfirm(`${b.client||'A client'} — ${b.project||b.code} is still waiting for your acknowledgement. Open the brief now?`,{title:'Brief needs your attention',okLabel:'OPEN BRIEF',cancelLabel:'REMIND ME IN 10 MIN'});if(open){detail(b.code)}else{snooze(b.code)}}finally{promptBusy=false}
  }
  function handleStartupDeepLink(){
    if(bootDeepLinkHandled)return;let code='';try{code=new URL(location.href).searchParams.get('brief')||''}catch(e){}if(!code)return;
    if(briefByCode(code)){bootDeepLinkHandled=true;detail(code);try{const u=new URL(location.href);u.searchParams.delete('brief');history.replaceState({},'',u.pathname+u.search+u.hash)}catch(e){}}
  }
  function cycle(){try{enhancedRenderNotifications();handleStartupDeepLink();reminderPrompt()}catch(e){console.warn('ONIT attention loop:',e)}}
  let warmChecks=0;const warmTimer=setInterval(()=>{cycle();warmChecks++;if(warmChecks>=12||(typeof briefs!=='undefined'&&briefs.length))clearInterval(warmTimer)},1500);setTimeout(cycle,500);setInterval(cycle,CHECK_MS);window.addEventListener('focus',()=>setTimeout(cycle,250));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(cycle,250)});
  window.ONITAttention={version:VERSION,unattendedBriefs,isUnattendedBrief,openNotification,cycle};
})();
