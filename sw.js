/* CALLE360ONCE · caché de la interfaz local. No almacena datos personales ni teselas de mapas. */
const CACHE = 'calle360once-shell-v19';
const SHELL = [
  "./",
  "./index.html",
  "./personal.css",
  "./personal.js",
  "./manifest.webmanifest",
  "./calle360once.svg",
  "./calle360once-192.png",
  "./calle360once-512.png"
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('calle360once-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function saveSharedVCard(file) {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('calle360-share-target',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('inbox'))request.result.createObjectStore('inbox');};
    request.onerror=()=>reject(request.error||new Error('No se pudo abrir el buzón de contactos.'));
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('inbox','readwrite');
      tx.objectStore('inbox').put({blob:file,name:file.name||'contactos.vcf',type:file.type||'text/vcard',receivedAt:Date.now()},'latest');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{const error=tx.error;db.close();reject(error||new Error('No se pudo guardar el contacto compartido.'));};
    };
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST' && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith((async()=>{
      try {
        const data=await event.request.formData();
        const files=data.getAll('contacts').filter(item=>item && typeof item.size==='number' && item.size>0);
        const file=files[0] || [...data.values()].find(item=>item && typeof item.size==='number' && item.size>0);
        if(!file || file.size>5*1024*1024) throw new Error('Archivo vCard vacío o demasiado grande.');
        await saveSharedVCard(file);
        return Response.redirect(new URL('./?importSharedContact=1',event.request.url).href,303);
      } catch(error) {
        return Response.redirect(new URL('./?importSharedContactError=1',event.request.url).href,303);
      }
    })());
    return;
  }
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
