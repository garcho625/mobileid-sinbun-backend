import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import QRCode from 'qrcode';
const {chromium}=await import(pathToFileURL(process.env.ANSIM_PLAYWRIGHT_MODULE || resolve('.sites-runtime/browser-tools/node_modules/playwright/index.mjs')).href);
const base=new URL(process.argv[2]||'http://127.0.0.1:8788');
assert(['127.0.0.1','localhost'].includes(base.hostname));
const channel=process.argv[3]||'chrome';
assert(['chrome','msedge'].includes(channel));
const root=resolve('.sites-runtime/qa',`offline-${channel}-${Date.now()}`);mkdirSync(root,{recursive:true});
const errors=[],contexts=[];
let offlinePhase=false,offlineApiRequests=0;
async function launch(role){const c=await chromium.launchPersistentContext(join(root,role),{channel,headless:true,viewport:{width:1280,height:1000},ignoreHTTPSErrors:base.protocol==='https:',args:base.protocol==='https:'?['--ignore-certificate-errors']:[]});contexts.push(c);c.on('request',r=>{if(offlinePhase&&new URL(r.url()).pathname==='/api/demo')offlineApiRequests++;});c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));for(const p of c.pages())p.on('pageerror',e=>errors.push(e.message));return c;}
const tab=(p,label)=>p.locator('aside').getByRole('button',{name:new RegExp(label)}).click();
const notice=(p,text)=>p.getByRole('status').filter({hasText:text}).waitFor();
async function prepare(p,issue){await p.goto(base.origin,{waitUntil:'networkidle'});await tab(p,'가상 발급기관');if(issue){await p.getByRole('button',{name:'테스트 신분증 발급',exact:true}).click();await notice(p,'가상 발급 완료');}await p.getByRole('button',{name:'검증자 신뢰키 · 정책 준비'}).click();await notice(p,'15분 시험 정책');await tab(p,'실험 개요');await p.getByText('오프라인 화면 저장 설정',{exact:true}).click();await p.getByRole('button',{name:'화면 오프라인 준비',exact:true}).click();await p.getByTestId('offline-status').filter({hasText:'준비 완료'}).waitFor({timeout:45000});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);}
async function keyState(p){return p.evaluate(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});const wallet=await new Promise(ok=>{const r=db.transaction('state').objectStore('state').get('wallet');r.onsuccess=()=>ok(r.result);});db.close();let exportBlocked=false;try{await crypto.subtle.exportKey('jwk',wallet.device.privateKey);}catch{exportBlocked=true;}return {id:wallet.credential.payload.id,extractable:wallet.device.privateKey.extractable,exportBlocked,legacyStorage:localStorage.getItem('ansim-demo-records-v1')};});}
async function qrTab(p,role){await tab(p,'두 기기 QR 인증');await p.getByRole('button',{name:role==='holder'?'이 기기는 이용자':'이 기기는 검증자',exact:true}).click();}
let holder,verifier;
try{
 holder=await launch('holder');verifier=await launch('verifier');let hp=holder.pages()[0],vp=verifier.pages()[0];
 await prepare(hp,true);await prepare(vp,false);
 const before=await keyState(hp);assert.equal(before.extractable,false);assert(before.exportBlocked);
 const cacheAudit=await hp.evaluate(async()=>{const names=(await caches.keys()).filter(k=>k.startsWith('ansim-shell-'));const urls=[];for(const n of names)for(const r of await(await caches.open(n)).keys())urls.push(new URL(r.url).pathname);return {assets:urls.length,apiCached:urls.some(u=>u.startsWith('/api/'))};});assert(!cacheAudit.apiCached);
 await holder.setOffline(true);await verifier.setOffline(true);offlinePhase=true;
 await hp.reload({waitUntil:'networkidle'});assert.equal((await keyState(hp)).id,before.id);
 await holder.close();holder=await launch('holder');await holder.setOffline(true);hp=holder.pages()[0];await hp.goto(base.origin,{waitUntil:'networkidle'});await hp.waitForFunction(async()=>!!document.querySelector('.shell'));
 assert.deepEqual((await keyState(hp)).id,before.id);assert((await keyState(hp)).exportBlocked);
 await qrTab(hp,'holder');await qrTab(vp,'verifier');await vp.getByRole('button',{name:'새 요청 QR 생성'}).click();await vp.getByTestId('qr-status').filter({hasText:'요청 QR 생성 완료'}).waitFor();
 const requestFile=join(root,'request.png');await vp.getByTestId('요청 QR').screenshot({path:requestFile});
 await hp.getByLabel('ansim-request 사진',{exact:true}).setInputFiles(requestFile);await hp.getByTestId('qr-status').filter({hasText:'요청을 읽었습니다'}).waitFor();
 await hp.getByRole('checkbox').check();await hp.getByRole('button',{name:'승인하고 응답 QR 생성'}).click();await hp.getByTestId('qr-status').filter({hasText:'응답 QR 생성 완료'}).waitFor();
 const responseFile=join(root,'response.png');await hp.getByTestId('응답 QR').screenshot({path:responseFile});
 const responseText=await hp.locator('textarea[aria-label="응답 QR 데이터"]').inputValue();assert(!responseText.includes('privateKey'));
 await vp.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(responseFile);await vp.getByTestId('qr-status').filter({hasText:'QR 오프라인 검증 성공'}).waitFor();assert.equal(await vp.locator('.check .pass').count(),8);
 const pending=await vp.evaluate(()=>JSON.parse(localStorage.getItem('ansim-demo-records-v1')||'[]').find(r=>!r.synced));assert(pending);
 await vp.getByRole('button',{name:'선택한 사진 다시 읽기',exact:true}).click();await vp.getByTestId('qr-status').filter({hasText:'이미 사용한 요청'}).waitFor();
 await verifier.close();verifier=await launch('verifier');await verifier.setOffline(true);vp=verifier.pages()[0];await vp.goto(base.origin,{waitUntil:'networkidle'});await qrTab(vp,'verifier');
 await vp.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(responseFile);await vp.getByTestId('qr-status').filter({hasText:'이미 사용한 요청'}).waitFor();
 const altered=JSON.parse(responseText);altered.credential.payload.id=crypto.randomUUID();const alteredFile=join(root,'tampered.png');await QRCode.toFile(alteredFile,JSON.stringify(altered),{width:520,errorCorrectionLevel:'M'});
 await vp.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(alteredFile);await vp.getByTestId('qr-status').filter({hasText:'QR 검증 차단'}).waitFor();assert(await vp.locator('.check .fail').count()>0);
 await vp.getByRole('button',{name:'새 요청 QR 생성'}).click();await vp.getByTestId('qr-status').filter({hasText:'요청 QR 생성 완료'}).waitFor();await vp.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(responseFile);await vp.getByTestId('qr-status').filter({hasText:'QR 검증 차단'}).waitFor();
 assert.equal(offlineApiRequests,0);
 offlinePhase=false;await verifier.setOffline(false);await holder.setOffline(false);
 await tab(vp,'복구 · 기록');const toggle=vp.getByRole('button',{name:/● 연결 차단 중/});if(await toggle.count())await toggle.click();await vp.getByRole('button',{name:'상태 재확인 · 기록 동기화'}).click();await notice(vp,'로컬 서버에 동기화');
 const rows=await vp.evaluate(async()=>await(await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'records'})})).json());assert.equal(rows.records.find(r=>r.id===pending.id).result,'복구 확인 · 상태 일치');
 await vp.screenshot({path:join(root,'recovery.png'),fullPage:true});
 await qrTab(hp,'holder');await hp.getByRole('button',{name:'카메라로 요청 QR 스캔'}).click();await hp.getByRole('alert').filter({hasText:'카메라'}).waitFor();
 await holder.setOffline(true);
 await hp.evaluate(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});await new Promise((ok,no)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('wallet');r.onsuccess=()=>store.put({...r.result,device:{...r.result.device,privateKey:null}},'wallet');tx.oncomplete=ok;tx.onabort=()=>no(tx.error);});db.close();});
 await hp.reload({waitUntil:'networkidle'});await notice(hp,'기기 키를 복원');await tab(hp,'가상 발급기관');assert(await hp.getByRole('button',{name:'테스트 신분증 발급',exact:true}).isDisabled());await qrTab(hp,'holder');assert(await hp.getByRole('button',{name:'승인하고 응답 QR 생성'}).isDisabled());
 assert.deepEqual(errors,[]);
 const result={passed:true,channel,base:base.origin,browserVersion:holder.browser()?.version(),offlineReload:true,browserProcessRestart:true,keyRestoredNonextractable:true,cacheAudit,independentProfiles:true,qrImageDecode:true,offlineApiRequests,replayAfterRestartBlocked:true,tamperAndOtherSessionBlocked:true,d1Sync:true,cameraPhysicalScan:'UNVERIFIED',cameraUnavailableMessage:true,corruptKeyBlocked:true,offlineIssuanceBlocked:true,pendingRecord:pending.id};writeFileSync(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){const states=[];for(const c of contexts)for(const p of c.pages()){try{states.push({url:p.url(),status:await p.locator('[data-testid="offline-status"]').allTextContents(),qr:await p.locator('[data-testid="qr-status"]').allTextContents()});}catch{}}writeFileSync(join(root,'failure.json'),JSON.stringify({error:String(error),errors,states},null,2));throw error;}finally{await Promise.allSettled(contexts.map(c=>c.close()));}
