importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

const FIREBASE_CONFIG={apiKey:'AIzaSyAmpqFDMfo6zAorD-f14hTQnSNFDFU6VHM',authDomain:'onit-backend-api.firebaseapp.com',projectId:'onit-backend-api',storageBucket:'onit-backend-api.firebasestorage.app',messagingSenderId:'1052909191157',appId:'1:1052909191157:web:392c4a50b453deb5ebeabc'};
try{firebase.initializeApp(FIREBASE_CONFIG);firebase.messaging();}catch(e){}

const UI_VERSION='0.37.4';
const UI_REVISION=3704;
const DASHBOARD_UI_REVISION=37041;
const CACHE='onit-v0.37.4-fast-home';
const STATIC=['./offline.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/onit-logo-horizontal.png','./assets/onit-logo-full.png','./icons/favicon-32.png','./cases-module.css','./cases-module.js','./activation-command.css','./activation-command.js','./ideas-dump.css','./ideas-dump.js','./visual-contrast.css','./pulse-module.css','./pulse-module.js','./assist-traffic-module.css','./assist-traffic-module.js','./core-intelligence.css','./core-intelligence.js','./autocare-module.css','./autocare-module.js','./authority-engine.js','./sync-engine.js','./release-guard.js','./command-palette.css','./command-palette.js','./dialog-system.css','./dialog-system.js','./attention-loop.css','./attention-loop.js'];

try{
  const messaging=firebase.messaging();
  messaging.onBackgroundMessage(payload=>{
    const n=payload.notification||{},d=payload.data||{},title=n.title||d.title||'ONIT';
    const isBrief=d.type==='BRIEF_ALERT';
    const options={body:n.body||d.body||d.message||'You have a new ONIT update.',icon:'./icons/icon-192.png',badge:'./icons/favicon-32.png',tag:isBrief?'onit-new-brief-'+(d.briefCode||'new'):'onit-update',renotify:isBrief,requireInteraction:isBrief,vibrate:isBrief?[180,80,180,80,320]:undefined,data:{url:d.url||'./',type:d.type||'',briefCode:d.briefCode||''}};
    self.registration.showNotification(title,options);
  });
}catch(e){}
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=(event.notification.data&&event.notification.data.url)||'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){try{c.navigate(url)}catch(e){}return c.focus()}}return clients.openWindow?clients.openWindow(url):null}));
});

async function cacheFreshStatic(){
  const c=await caches.open(CACHE);
  for(const path of STATIC){
    try{const u=new URL(path,self.location.href);u.searchParams.set('_ui',UI_VERSION);const r=await fetch(u.toString(),{cache:'reload'});if(r.ok){await c.put(new Request(new URL(path,self.location.href).toString()),r.clone());await c.put(u.toString(),r.clone())}}catch(e){}
  }
}
async function announceUiVersion(){
  const list=await clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(list.map(async c=>{
    try{
      c.postMessage({type:'ONIT_UI_VERSION_ACTIVATED',version:UI_VERSION,uiRevision:UI_REVISION,dashboardUiRevision:DASHBOARD_UI_REVISION});
    }catch(e){}
  }));
}

self.addEventListener('install',event=>{event.waitUntil(cacheFreshStatic().then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('onit-')&&k!==CACHE).map(k=>caches.delete(k)));
    try{if(self.registration.navigationPreload)await self.registration.navigationPreload.disable()}catch(e){}
    await self.clients.claim();await cacheFreshStatic();await announceUiVersion();
  })());
});
self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='SKIP_WAITING')self.skipWaiting();
  if(d.type==='AUTOCARE_REFRESH_STATIC'||d.type==='ONIT_UI_SYNC_NOW')event.waitUntil(cacheFreshStatic().then(()=>announceUiVersion()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  const path=url.pathname.toLowerCase();
  const isShell=req.mode==='navigate'||path.endsWith('/index.html')||path.endsWith('/version.json')||path.endsWith('/service-worker.js')||path.endsWith('/reset.html');
  if(isShell){
    event.respondWith((async()=>{try{return await fetch(req,{cache:'no-store'})}catch(e){return req.mode==='navigate'?(await caches.match('./offline.html'))||Response.error():Response.error()}})());return;
  }
  const isUiAsset=/\.(?:js|css)$/.test(path)||path.endsWith('/manifest.webmanifest');
  if(isUiAsset){
    event.respondWith((async()=>{
      try{const r=await fetch(req,{cache:'reload'});if(r.ok){const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)))}return r}catch(e){return (await caches.match(req,{ignoreSearch:true}))||Response.error()}
    })());return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);const network=fetch(req,{cache:'no-store'}).then(r=>{if(r.ok&&STATIC.some(p=>url.pathname.endsWith(p.replace('./','')))){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r}).catch(()=>null);
    if(cached){event.waitUntil(network);return cached}return(await network)||Response.error();
  })());
});
