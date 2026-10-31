// Handle clicks before Firebase Messaging imports so FCM cannot overwrite ONIT routing.
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=(event.notification&&event.notification.data)||{};
  const fcm=(data.FCM_MSG&&data.FCM_MSG.data)||{};
  const link=(data.FCM_MSG&&data.FCM_MSG.fcmOptions&&data.FCM_MSG.fcmOptions.link)||'';
  const url=data.url||fcm.url||link||'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){
      if('focus' in c){
        try{c.navigate(url)}catch(e){}
        return c.focus();
      }
    }
    return clients.openWindow?clients.openWindow(url):null;
  }));
});

importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

const FIREBASE_CONFIG={apiKey:'AIzaSyAmpqFDMfo6zAorD-f14hTQnSNFDFU6VHM',authDomain:'onit-backend-api.firebaseapp.com',projectId:'onit-backend-api',storageBucket:'onit-backend-api.firebasestorage.app',messagingSenderId:'1052909191157',appId:'1:1052909191157:web:392c4a50b453deb5ebeabc'};
let messaging=null;
try{firebase.initializeApp(FIREBASE_CONFIG);messaging=firebase.messaging();}catch(e){}

const UI_VERSION='0.38.2';
const UI_REVISION=38100;
const DASHBOARD_UI_REVISION=38101;
const CACHE='onit-v0.38.2-command-feedback';
const STATIC=['./offline.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/onit-logo-horizontal.png','./assets/onit-logo-full.png','./icons/favicon-32.png','./cases-module.css','./cases-module.js','./activation-command.css','./activation-command.js','./ideas-dump.css','./ideas-dump.js','./visual-contrast.css','./pulse-module.css','./pulse-module.js','./assist-traffic-module.css','./assist-traffic-module.js','./core-intelligence.css','./core-intelligence.js','./autocare-module.css','./autocare-module.js','./authority-engine.js','./sync-engine.js','./release-guard.js','./command-palette.css','./command-palette.js','./dialog-system.css','./dialog-system.js','./attention-loop.css','./attention-loop.js','./rewards-module.css','./rewards-module.js','./ui-system.css','./ui-system.js'];

// Notification+data messages are displayed automatically by FCM in the background.
// Keep this callback only as a fallback for any legacy data-only message.
try{
  if(messaging)messaging.onBackgroundMessage(payload=>{
    if(payload&&payload.notification)return;
    const d=(payload&&payload.data)||{},title=d.title||(d.type==='BUZZER'?'ONIT BUZZER':'ONIT');
    const urgent=d.type==='BUZZER'||d.type==='BRIEF_ALERT'||String(d.actionRequired||'')==='true'||['OWNER_BROADCAST','APPROVAL_REQUIRED','TEAM_LEAD_APPROVAL_REQUIRED','REVISION','HANDOVER_RECEIVED','DATA_EXPORT_APPROVAL','AUTO_ESCALATION_TRAFFIC','AUTO_ESCALATION_APPROVAL','AUTO_ESCALATION_TEAM_LEAD'].includes(String(d.notificationType||''));
    const tag=d.notificationId?'onit-'+d.notificationId:d.buzzerId?'onit-buzzer-'+d.buzzerId:d.briefCode?'onit-'+(d.type||'update')+'-'+d.briefCode:'onit-update';
    return self.registration.showNotification(title,{body:d.body||d.message||'You have a new ONIT update.',icon:'./icons/icon-192.png',badge:'./icons/favicon-32.png',tag,renotify:urgent,requireInteraction:urgent,silent:false,data:{url:d.url||'./',type:d.type||'',notificationType:d.notificationType||'',notificationId:d.notificationId||'',briefCode:d.briefCode||'',buzzerId:d.buzzerId||''}});
  });
}catch(e){}

async function cacheFreshStatic(){
  const c=await caches.open(CACHE);
  for(const path of STATIC){
    try{const u=new URL(path,self.location.href);u.searchParams.set('_ui',UI_VERSION);const r=await fetch(u.toString(),{cache:'reload'});if(r.ok){await c.put(new Request(new URL(path,self.location.href).toString()),r.clone());await c.put(u.toString(),r.clone())}}catch(e){}
  }
}
self.addEventListener('install',event=>{event.waitUntil(cacheFreshStatic())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('onit-')&&k!==CACHE).map(k=>caches.delete(k)));try{if(self.registration.navigationPreload)await self.registration.navigationPreload.disable()}catch(e){}try{await clients.claim()}catch(e){}})())});
self.addEventListener('message',event=>{const d=event.data||{};if(d.type==='AUTOCARE_REFRESH_STATIC')event.waitUntil(cacheFreshStatic());if(d.type==='ONIT_ACTIVATE_UPDATE')event.waitUntil((async()=>{try{await cacheFreshStatic()}catch(e){}await self.skipWaiting()})())});
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
