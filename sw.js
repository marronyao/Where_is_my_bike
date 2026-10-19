const CACHE='my-bikes-shell-v3';
const SHELL=['./','./index.html','./style.css','./app.js','./config.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('my-bikes-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
// Only cache this app's static shell. Never intercept map tiles or private data.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.some(p=>new URL(p,self.registration.scope).href===url.href))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));});
