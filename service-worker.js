const CACHE='onit-v0.18.4';
const STATIC=['./offline.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/onit-logo-horizontal.png','./assets/onit-logo-full.png','./icons/favicon-32.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('onit-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
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

  // Never serve a cached ONIT application shell.
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/version.json') || url.pathname.endsWith('/reset.html')){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .catch(()=>req.mode==='navigate'?caches.match('./offline.html'):Response.error())
    );
    return;
  }

  // Static assets: network-first with cache fallback.
  event.respondWith(
    fetch(req,{cache:'no-store'})
      .then(r=>{
        if(r.ok && STATIC.some(p=>url.pathname.endsWith(p.replace('./','')))){
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return r;
      })
      .catch(()=>caches.match(req))
  );
});
