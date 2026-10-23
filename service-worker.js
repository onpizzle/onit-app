importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

const FIREBASE_CONFIG={apiKey:'AIzaSyAmpqFDMfo6zAorD-f14hTQnSNFDFU6VHM',authDomain:'onit-backend-api.firebaseapp.com',projectId:'onit-backend-api',storageBucket:'onit-backend-api.firebasestorage.app',messagingSenderId:'1052909191157',appId:'1:1052909191157:web:392c4a50b453deb5ebeabc'};
try{firebase.initializeApp(FIREBASE_CONFIG);firebase.messaging();}catch(e){}

const CACHE='onit-v0.30.4-brief-alert-audio-fix';
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
  event.notification.close();
  const url=(event.notification.data&&event.notification.data.url)||'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){try{c.navigate(url)}catch(e){}return c.focus()}}
    return clients.openWindow?clients.openWindow(url):null;
  }));
});

const STATIC=['./offline.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/onit-logo-horizontal.png','./assets/onit-logo-full.png','./icons/favicon-32.png','./cases-module.css','./cases-module.js','./pulse-module.css','./pulse-module.js','./assist-traffic-module.css','./assist-traffic-module.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('onit-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(async()=>{try{if(self.registration.navigationPreload)await self.registration.navigationPreload.enable()}catch(e){}return self.clients.claim()})
  );
});

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // Never serve a cached ONIT application shell. Navigation preload can shave a round trip.
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/version.json') || url.pathname.endsWith('/reset.html')){
    event.respondWith((async()=>{
      try{
        if(req.mode==='navigate'){const preload=await event.preloadResponse;if(preload)return preload}
        return await fetch(req,{cache:'no-store'});
      }catch(e){return req.mode==='navigate'?caches.match('./offline.html'):Response.error()}
    })());
    return;
  }

  // Static assets: cache-first for instant repeat loads, refresh quietly in the background.
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const network=fetch(req,{cache:'no-store'}).then(r=>{
      if(r.ok && STATIC.some(p=>url.pathname.endsWith(p.replace('./','')))){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
      return r;
    }).catch(()=>null);
    if(cached){event.waitUntil(network);return cached}
    return (await network)||Response.error();
  })());
});

