/* ONIT festive detail v0.40.20: UI decoration only, no account or operational data. */
(() => {
  'use strict';
  const now = new Date();
  const m = now.getMonth(), d = now.getDate();
  const seasonal = (m === 10 && d >= 20) || m === 11 || (m === 0 && d <= 6);
  if (!seasonal) return;
  const storageKey='onit.christmas.mode.v1'; // Keep the existing user's v0.40.17 preference.
  let choice;
  try{choice=localStorage.getItem(storageKey)}catch(_){choice=null}
  let enabled = choice!=='off';
  let button, snow;
  const treeIcon='<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m12 2-5 8h3l-5 7h14l-5-7h3l-5-8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 17v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const santaHat='<svg viewBox="0 0 56 46" focusable="false" aria-hidden="true"><path d="M9 27C15 11 26 6 41 7c-3 4-7 10-7 22Z" fill="#c33443" stroke="#982432" stroke-width="1"/><path d="M41 7c4 0 6-2 7-4" stroke="#ba3444" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="49" cy="6" r="6.1" fill="#fffdf7" stroke="#d8d4cc" stroke-width=".8"/><path d="M8 26c8-3 19-3 30 2 2 1 2 3 0 5-10-4-21-5-32-1-2-1-1-5 2-6Z" fill="#fffdf8" stroke="#ddd8d2" stroke-width=".9"/><path d="M15 27c7-1 14 0 18 2" stroke="#fff" stroke-width="1.5" opacity=".9" fill="none"/></svg>';
  const pine='<svg viewBox="0 0 110 65" focusable="false" aria-hidden="true"><path d="M-3 0C22 21 47 20 109 54" fill="none" stroke="#745b3b" stroke-width="2.1"/><g fill="none" stroke-linecap="round"><path d="M7 8 0 30M7 8 32 2M19 15 6 39M19 15 47 8M31 21 23 48M31 21 61 14M44 26 43 53M44 26 72 15M58 33 65 58M58 33 84 22M73 40 82 61M73 40 96 30M89 47 104 62M89 47 107 40" stroke="#2d7353" stroke-width="2.8"/><path d="M5 12 1 22M5 12 22 6M18 19 11 29M18 19 31 14M32 25 30 36M32 25 50 20M49 30 50 41M49 30 66 23M65 37 73 49M65 37 79 32" stroke="#4a9670" stroke-width="1.45"/></g><circle cx="63" cy="37" r="3.2" fill="#c64452"/><circle cx="69" cy="35" r="2.8" fill="#a62d3e"/><circle cx="66" cy="41" r="2.3" fill="#d6655d"/><circle cx="91" cy="50" r="2.4" fill="#cbae5a"/></svg>';
  function decoration(parent,klass,svg){if(!parent)return;const e=document.createElement('span');e.className=klass;e.setAttribute('aria-hidden','true');if(svg)e.innerHTML=svg;parent.appendChild(e);return e}
  function update(){
    document.documentElement.classList.toggle('onitChristmas',enabled);
    if(button){button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Turn Christmas decorations off':'Turn Christmas decorations on');button.title=enabled?'Turn Christmas decorations off':'Turn Christmas decorations on'}
    if(snow)snow.hidden=!enabled;
  }
  function init(){
    const header=document.querySelector('#appShell .top');
    if(!header||document.getElementById('onitXmasToggle'))return;
    // Defensive cleanup for any previously injected seasonal nodes (e.g. hot reload).
    document.querySelectorAll('.onitXmasBanner,.onitXmasLights,.onitXmasAuthRibbon').forEach(el=>el.remove());
    button=document.createElement('button');button.id='onitXmasToggle';button.type='button';button.className='onitXmasToggle';
    button.innerHTML=treeIcon+'<span class="onitXmasToggleText">FESTIVE MODE</span>';
    button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(storageKey,enabled?'on':'off')}catch(_){}update()});
    header.insertBefore(button,header.firstChild);
    const sideBrand=document.querySelector('#appShell .sideBrand');
    const authLogo=document.querySelector('#authGate .authLogo');
    const authCard=document.querySelector('#authGate .authCard');
    decoration(sideBrand,'onitXmasHat',santaHat);
    decoration(sideBrand,'onitXmasPine',pine);
    decoration(sideBrand,'onitXmasBauble');
    decoration(authLogo,'onitXmasHat',santaHat);
    decoration(authCard,'onitXmasPine',pine);
    decoration(authCard,'onitXmasBauble');
    decoration(header,'onitXmasPine',pine);
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduce){
      snow=document.createElement('div');snow.className='onitXmasSnow';snow.setAttribute('aria-hidden','true');
      // Sixteen low-cost, slow snowflakes distributed over light and dark content.
      // Negative delays avoid empty intervals after navigation and at startup.
      [[3,12,24,-7,12],[8,11,27,-19,-14],[13,14,30,-11,21],[18,12,23,-18,-18],
       [23,15,29,-24,16],[29,11,25,-6,-13],[34,13,31,-22,15],[39,15,28,-14,-19],
       [44,12,24,-21,20],[49,14,32,-9,-22],[54,13,26,-18,18],[59,16,29,-7,-15],
       [64,11,25,-23,20],[69,14,30,-15,-14],[74,12,28,-3,17],[79,15,27,-19,-19]].forEach(([x,size,time,delay,drift])=>{
        const f=document.createElement('span');f.innerHTML='<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path class="onitSnowOutline" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07M8.5 5.5 12 8.5l3.5-3M18.5 8.5 15.5 12l3 3.5M15.5 18.5 12 15.5l-3.5 3M5.5 15.5 8.5 12l-3-3.5"/><path class="onitSnowCore" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07M8.5 5.5 12 8.5l3.5-3M18.5 8.5 15.5 12l3 3.5M15.5 18.5 12 15.5l-3.5 3M5.5 15.5 8.5 12l-3-3.5"/></svg>';f.style.cssText=`--x:${x}%;--s:${size}px;--t:${time}s;--delay:${delay}s;--dx:${drift}px`;snow.appendChild(f);
      });
      document.body.appendChild(snow);
    }
    document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('onitXmasPaused',document.hidden));
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
