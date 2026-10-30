/* ONIT Rewards v1.0.0 */
(function(){
  'use strict';
  const state={my:null,owner:null,loading:false,queue:[],showing:false,lastLoad:0};
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=(n,d)=>Math.max(0,Math.min(100,d?Math.round((Number(n||0)/Number(d))*100):0));
  const fmtDate=v=>{try{return typeof formatDateTime==='function'?formatDateTime(v):new Date(v).toLocaleString()}catch(e){return String(v||'')}};
  const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');

  function ensurePopupHost(){
    let host=document.getElementById('onitRewardPopupHost');if(host)return host;
    host=document.createElement('div');host.id='onitRewardPopupHost';host.className='onitRewardPopupHost hidden';host.innerHTML=`<div class="onitRewardPopupBackdrop"></div><div class="onitRewardPopup" role="dialog" aria-modal="true" aria-live="polite"><div class="onitRewardPopupTop"><div class="onitRewardPopupKicker">ONIT REWARDS</div><h2 id="onitRewardHeadline"></h2><p id="onitRewardMessage"></p></div><div class="onitRewardPopupBody"><div class="onitRewardEarned"><span>YOU JUST EARNED</span><strong id="onitRewardCoins"></strong></div><div class="onitRewardPopupProgress"><div class="onitRewardMini"><b id="onitRewardWeek"></b><small>THIS WEEK</small></div><div class="onitRewardMini"><b id="onitRewardMonth"></b><small>THIS MONTH</small></div></div><div class="onitRewardPopupActions"><button class="new" type="button" onclick="ONITRewards.dismissAward()">NICE</button></div></div></div>`;
    document.body.appendChild(host);return host;
  }

  function confetti(level){
    if(typeof onitReducedMotionEnabled==='function'&&onitReducedMotionEnabled())return;
    const layer=document.createElement('div');layer.className='onitConfettiLayer';document.body.appendChild(layer);
    const count=level==='big'?76:level==='medium'?48:28,colors=['#ff5b22','#171717','#f7b44b','#ffffff','#ff8f63'];
    for(let i=0;i<count;i++){
      const p=document.createElement('i');p.className='onitConfettiPiece';const a=Math.random()*Math.PI*2,dist=(level==='big'?330:level==='medium'?240:175)*(0.45+Math.random()*.75);const x=Math.cos(a)*dist,y=Math.sin(a)*dist-40-Math.random()*90;
      p.style.setProperty('--x',x.toFixed(0)+'px');p.style.setProperty('--y',y.toFixed(0)+'px');p.style.setProperty('--r',(Math.random()*900-450).toFixed(0)+'deg');p.style.setProperty('--d',(850+Math.random()*650).toFixed(0)+'ms');p.style.setProperty('--delay',(Math.random()*120).toFixed(0)+'ms');p.style.setProperty('--c',colors[i%colors.length]);p.style.left=(48+Math.random()*4)+'%';p.style.top=(44+Math.random()*5)+'%';layer.appendChild(p);
    }
    setTimeout(()=>layer.remove(),1900);
  }

  function showNext(){
    if(state.showing||!state.queue.length)return;state.showing=true;const a=state.queue.shift(),host=ensurePopupHost();
    document.getElementById('onitRewardHeadline').textContent=a.headline||'Nice one.';document.getElementById('onitRewardMessage').textContent=a.message||a.reason||'Good work.';document.getElementById('onitRewardCoins').textContent='+'+Number(a.coins||0)+' ONIT Coins';document.getElementById('onitRewardWeek').textContent=`${Number(a.week||0)} / ${Number(a.weekTarget||40)}`;document.getElementById('onitRewardMonth').textContent=`${Number(a.month||0)} / ${Number(a.monthTarget||160)}`;
    host.classList.remove('hidden');confetti(a.celebration||'small');
    clearTimeout(showNext.timer);showNext.timer=setTimeout(dismissAward,a.milestone==='MONTHLY'?7000:a.milestone==='WEEKLY'?6000:4800);
  }
  function dismissAward(){clearTimeout(showNext.timer);const host=document.getElementById('onitRewardPopupHost');if(host)host.classList.add('hidden');state.showing=false;setTimeout(showNext,180);if(document.getElementById('rewards')&&!document.getElementById('rewards').classList.contains('hidden'))load(true);}
  function handleApiRewards(items){const list=(Array.isArray(items)?items:[]).filter(x=>Number(x&&x.coins||0)>0);if(!list.length)return;state.queue.push(...list);showNext();}

  async function load(force=false){
    if(!SESSION_TOKEN||state.loading)return;if(!force&&state.my&&Date.now()-state.lastLoad<45000){render();return}
    state.loading=true;renderLoading();
    try{
      const mine=await apiPost('REWARDS_MY',{});state.my=mine.data||mine;
      if(typeof isOwner==='function'&&isOwner()){const owner=await apiPost('REWARDS_OWNER_DASHBOARD',{});state.owner=owner.data||owner;}else state.owner=null;
      state.lastLoad=Date.now();render();
    }catch(e){renderError(e)}finally{state.loading=false}
  }

  function renderLoading(){const root=document.getElementById('rewardsRoot');if(root&&!state.my)root.innerHTML=`<div class="card"><b>ONIT Rewards is loading…</b><div class="tiny">Checking your private coin ledger.</div></div>`;}
  function renderError(e){const root=document.getElementById('rewardsRoot');if(root)root.innerHTML=`<div class="card"><b>ONIT Rewards could not load.</b><div class="tiny">${esc(e&&e.message||e)}</div><div class="actions"><button class="secondary" onclick="ONITRewards.open(true)">TRY AGAIN</button></div></div>`;}
  function progressCard(label,value,target,copy){return `<div class="onitRewardStat"><div class="onitRewardStatTop"><b>${Number(value||0)} / ${Number(target||0)}</b><span>${esc(label)}</span></div><div class="onitRewardProgress"><i style="width:${pct(value,target)}%"></i></div><small>${esc(copy)}</small></div>`;}
  function prizeCard(s){const cfg=s.config||{},qualified=!!s.qualified;let body;if(cfg.active&&cfg.rewardTitle){body=`<b>${esc(cfg.rewardTitle)}</b>${cfg.rewardDescription?`<p>${esc(cfg.rewardDescription)}</p>`:''}<div class="tiny">${qualified?'UNLOCKED — month-end winner notification will be automatic.':`${Math.max(0,Number(s.monthTarget||160)-Number(s.month||0))} coins to unlock.`}</div>`;}else body=`<b>Reward to be announced</b><p>The System Owner can change the monthly reward at any time.</p><div class="tiny">The qualification target remains 160 ONIT Coins.</div>`;return `<div class="onitRewardCard onitRewardPrize"><div class="onitRewardPrizeIcon">O</div><div><div class="onitRewardEyebrow">${qualified?'REWARD UNLOCKED':'THIS MONTH’S REWARD'}</div>${body}</div></div>`;}
  function recentRows(s){const rows=Array.isArray(s.recent)?s.recent:[];if(!rows.length)return `<div class="onitRewardCard"><h3>Recent wins</h3><p class="muted">Your first verified ONIT action will appear here.</p></div>`;return `<div class="onitRewardCard"><h3>Recent wins</h3><div class="onitRewardRecent">${rows.map(r=>`<div class="onitRewardLedgerRow"><div class="onitRewardLedgerCoin">+${Number(r.Coins||0)}</div><div class="onitRewardLedgerMeta"><b>${esc(r.Reason||r.Action||'ONIT action')}</b><small>${esc(r['Brief Code']||'Workflow achievement')}</small></div><div class="onitRewardLedgerTime">${esc(fmtDate(r['Earned At']))}</div></div>`).join('')}</div></div>`;}

  function ownerPanel(){
    const o=state.owner;if(!o)return'';const cfg=o.config||{},people=Array.isArray(o.people)?o.people:[],winners=Array.isArray(o.winners)?o.winners:[];
    return `<div class="onitRewardOwner"><div class="onitRewardEyebrow">SYSTEM OWNER — MONTHLY REWARD</div><h3>What are we rewarding this month?</h3><p class="tiny">The target is locked at 40 coins per week / 160 per month. Change the reward without changing the system.</p><div class="onitRewardOwnerGrid"><div class="field"><label>REWARD TITLE</label><input id="rewardOwnerTitle" value="${esc(cfg.rewardTitle||'')}" placeholder="e.g. ₦10,000 lunch voucher"></div><div class="field"><label>MONTH</label><input id="rewardOwnerMonth" value="${esc(o.monthKey||currentMonth())}" readonly></div><div class="field"><label>DESCRIPTION</label><textarea id="rewardOwnerDescription" placeholder="What exactly will winners receive?">${esc(cfg.rewardDescription||'')}</textarea></div><div class="field"><label>WINNER MESSAGE</label><textarea id="rewardOwnerMessage" placeholder="Optional note sent to winners at month end">${esc(cfg.winnerMessage||'')}</textarea></div></div><label class="checkline"><input id="rewardOwnerActive" type="checkbox" ${cfg.active?'checked':''}> Reward is active for this month</label><div class="actions"><button class="new" onclick="ONITRewards.saveOwnerReward(this)">SAVE MONTHLY REWARD</button></div></div>
      <div class="onitRewardCard"><h3>Private staff progress</h3><p class="tiny">Only the System Owner sees everyone’s totals. Staff do not see a public leaderboard.</p>${people.length?people.map(p=>`<div class="onitOwnerPersonRow"><div><b>${esc(p.fullName)}</b><div class="tiny">${esc([p.department,p.position].filter(Boolean).join(' • '))}</div></div><div class="onitOwnerCoin">${Number(p.week||0)}/40 week</div><div class="${p.qualified?'onitRewardQualified':'onitRewardPending'}">${Number(p.month||0)}/160 ${p.qualified?'QUALIFIED':''}</div></div>`).join(''):`<div class="tiny">No staff reward activity yet.</div>`}</div>
      <div class="onitRewardCard"><h3>Qualified this month</h3>${winners.length?winners.map(w=>`<div class="onitOwnerWinnerRow"><div><b>${esc(w['Full Name']||'Staff')}</b><div class="tiny">${esc(w['Reward Title']||cfg.rewardTitle||'Reward pending')}</div></div><div class="onitOwnerCoin">${Number(w['Coins At Qualification']||160)} coins</div><div>${String(w['Fulfilment Status']||'Pending')==='Issued'?`<span class="onitRewardQualified">ISSUED</span>`:`<button class="secondary" onclick="ONITRewards.markFulfilled('${esc(w['Winner ID'])}',this)">MARK ISSUED</button>`}</div></div>`).join(''):`<div class="tiny">Nobody has hit 160 yet. ONIT will add qualifiers automatically.</div>`}</div>`;
  }

  function render(){
    const root=document.getElementById('rewardsRoot');if(!root||!state.my)return;const m=state.my,s=m.summary||{};
    root.innerHTML=`<div class="onitRewardsPage"><div class="onitRewardHero"><div><div class="onitRewardEyebrow">MY ONIT</div><h1>${Number(s.month||0)} ONIT COINS</h1><p>${esc(m.firstName||'You')}, this is your private record of consistent workflow. Forty coins represents the working week. Hit 160 in the month and the reward unlocks.</p></div><div class="onitCoinMark"><div class="onitCoinDisc">O</div></div></div><div class="onitRewardGrid">${progressCard('TODAY',s.day,s.dayTarget,'8 is the fun daily pace — no pressure if your workload lands differently.')}${progressCard('THIS WEEK',s.week,s.weekTarget,Number(s.week||0)>=Number(s.weekTarget||40)?'40/40. Weekly target complete.':`${Math.max(0,Number(s.weekTarget||40)-Number(s.week||0))} coins to the weekly target.`)}${progressCard('THIS MONTH',s.month,s.monthTarget,s.qualified?'160 reached. Reward unlocked.':`${Math.max(0,Number(s.monthTarget||160)-Number(s.month||0))} coins to qualification.`)}</div>${prizeCard(s)}${recentRows(s)}${ownerPanel()}</div>`;
  }

  async function saveOwnerReward(btn){
    const title=document.getElementById('rewardOwnerTitle')?.value.trim(),description=document.getElementById('rewardOwnerDescription')?.value.trim(),winnerMessage=document.getElementById('rewardOwnerMessage')?.value.trim(),monthKey=document.getElementById('rewardOwnerMonth')?.value.trim(),active=!!document.getElementById('rewardOwnerActive')?.checked;if(!title)return onitAlert('Please type the reward first.');
    const old=btn?.textContent;try{if(btn){btn.disabled=true;btn.textContent='SAVING…'}await apiPost('REWARDS_OWNER_SAVE_CONFIG',{rewardTitle:title,rewardDescription:description,winnerMessage,monthKey,active});if(typeof showToast==='function')showToast('ONIT Rewards','Monthly reward saved.');await load(true);}catch(e){onitAlert('Could not save the monthly reward. '+e.message)}finally{if(btn){btn.disabled=false;btn.textContent=old||'SAVE MONTHLY REWARD'}}
  }
  async function markFulfilled(id,btn){const old=btn?.textContent;try{if(btn){btn.disabled=true;btn.textContent='SAVING…'}await apiPost('REWARDS_OWNER_MARK_FULFILLED',{winnerId:id});if(typeof showToast==='function')showToast('Reward issued','ONIT recorded the fulfilment.');await load(true);}catch(e){onitAlert('Could not mark the reward as issued. '+e.message)}finally{if(btn){btn.disabled=false;btn.textContent=old||'MARK ISSUED'}}}
  function open(force=false){load(force);}
  window.ONITRewards={open,load,render,handleApiRewards,dismissAward,saveOwnerReward,markFulfilled};
  window.addEventListener('onit:workspace-ready',()=>{if(SESSION_TOKEN)setTimeout(()=>load(false),900)});
})();
