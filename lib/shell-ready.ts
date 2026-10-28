export async function shellReady(){
 if(!globalThis.isSecureContext||!('serviceWorker' in navigator)||!('caches' in globalThis))return false;
 if(!(await navigator.serviceWorker.getRegistration('/'))?.active)return false;
 let current:string|undefined;
 if(navigator.onLine)try{const r=await fetch('/offline-assets.json',{cache:'no-store'});if(r.ok)current=((await r.json()) as {version:string}).version;}catch{}
 for(const name of await caches.keys()){
  if(!name.startsWith('ansim-shell-')||(current&&name!=='ansim-shell-'+current))continue;
  const cache=await caches.open(name),meta=await cache.match('/offline-assets.json');if(!meta)continue;
  const manifest=await meta.json() as {assets:string[]};const paths=new Set((await cache.keys()).map(r=>new URL(r.url).pathname));
  if(Array.isArray(manifest.assets)&&manifest.assets.every(p=>paths.has(p)))return true;
 }return false;
}
