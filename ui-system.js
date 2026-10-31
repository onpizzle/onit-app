/* ONIT UI System v1.0.0 — shared DOM primitives and state handling */
(function(){
  'use strict';
  const VERSION='1.0.0';
  const iconFor=t=>({loading:'',error:'!',success:'✓',warning:'!',empty:'—',info:'i'}[t]||'i');
  const asElement=ref=>typeof ref==='string'?document.querySelector(ref):ref;
  function clear(el){while(el&&el.firstChild)el.removeChild(el.firstChild)}
  function makeButton(action){
    const b=document.createElement('button');b.type='button';b.className=action.variant==='primary'?'new':'secondary';b.textContent=String(action.label||'CONTINUE');
    if(typeof action.onClick==='function')b.addEventListener('click',action.onClick,{once:!!action.once});
    if(action.disabled)b.disabled=true;return b;
  }
  function setState(ref,opts={}){
    const el=asElement(ref);if(!el)return null;clear(el);
    const type=String(opts.type||'info'),wrap=document.createElement('div');wrap.className='onitUIState';wrap.dataset.state=type;
    if(type==='error')wrap.setAttribute('role','alert');else{wrap.setAttribute('role','status');wrap.setAttribute('aria-live',type==='loading'?'polite':'polite')}
    if(type==='loading')wrap.setAttribute('aria-busy','true');
    const icon=document.createElement('div');icon.className='onitUIStateIcon';icon.setAttribute('aria-hidden','true');
    if(type==='loading'){const spinner=document.createElement('span');spinner.className='onitUISpinner';icon.appendChild(spinner)}else icon.textContent=iconFor(type);
    const body=document.createElement('div');body.className='onitUIStateBody';
    if(opts.title){const t=document.createElement('div');t.className='onitUIStateTitle';t.textContent=String(opts.title);body.appendChild(t)}
    if(opts.message){const m=document.createElement('div');m.className='onitUIStateMessage';m.textContent=String(opts.message);body.appendChild(m)}
    const actions=Array.isArray(opts.actions)?opts.actions:(opts.action?[opts.action]:[]);
    if(actions.length){const row=document.createElement('div');row.className='onitUIStateActions';actions.filter(Boolean).forEach(a=>row.appendChild(makeButton(a)));body.appendChild(row)}
    wrap.append(icon,body);el.appendChild(wrap);return wrap;
  }
  function setBusy(ref,busy,label){
    const el=asElement(ref);if(!el)return;
    if(busy){if(!el.dataset.onitOriginalLabel)el.dataset.onitOriginalLabel=el.textContent||'';el.disabled=true;el.setAttribute('aria-busy','true');if(label)el.textContent=label}
    else{el.disabled=false;el.removeAttribute('aria-busy');if(el.dataset.onitOriginalLabel){el.textContent=el.dataset.onitOriginalLabel;delete el.dataset.onitOriginalLabel}}
  }
  function ensureAnnouncer(){let a=document.getElementById('onitUIAnnouncer');if(a)return a;a=document.createElement('div');a.id='onitUIAnnouncer';a.className='onitSROnly';a.setAttribute('aria-live','polite');a.setAttribute('aria-atomic','true');document.body.appendChild(a);return a}
  function announce(message,priority='polite'){const a=ensureAnnouncer();a.setAttribute('aria-live',priority==='assertive'?'assertive':'polite');a.textContent='';requestAnimationFrame(()=>{a.textContent=String(message||'')})}
  function enhance(root=document){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll('.modal').forEach(m=>{m.setAttribute('role','dialog');m.setAttribute('aria-modal','true')});
    root.querySelectorAll('.toast').forEach(t=>{t.setAttribute('role','status');t.setAttribute('aria-live','polite')});
    root.querySelectorAll('.dangerText').forEach(t=>{if(!t.hasAttribute('role'))t.setAttribute('role','alert')});
    root.querySelectorAll('button:disabled').forEach(b=>b.setAttribute('aria-disabled','true'));
  }
  function observe(){if(!document.body)return;enhance(document);const o=new MutationObserver(ms=>{for(const m of ms){m.addedNodes.forEach(n=>{if(n.nodeType===1)enhance(n)});if(m.type==='attributes'&&m.target.matches?.('button')){if(m.target.disabled)m.target.setAttribute('aria-disabled','true');else m.target.removeAttribute('aria-disabled')}}});o.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','class']})}
  window.ONITUI={version:VERSION,setState,setBusy,announce,enhance};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
