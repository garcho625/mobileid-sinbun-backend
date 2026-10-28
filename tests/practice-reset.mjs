import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.ANSIM_PLAYWRIGHT_MODULE||resolve('.sites-runtime/browser-tools/node_modules/playwright/index.mjs')).href);
const root=resolve('.sites-runtime/qa/practice-reset');mkdirSync(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
let page;const errors=[];
async function open(){page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8788',{waitUntil:'networkidle'});await page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.restart-primary').disabled);}
const guide=()=>page.getByTestId('practice-flow');
const step=()=>page.getByTestId('practice-step');
const notice=text=>page.getByRole('status').filter({hasText:text}).waitFor();
const tab=text=>page.locator('aside').getByRole('button',{name:new RegExp(text)}).click();
async function snapshot(){return page.evaluate(async()=>{
 const db=await new Promise((ok,no)=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 const tx=db.transaction(['state','records','used']);
 const read=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 const [keys,records,used,wallet,interaction]=await Promise.all([read(tx.objectStore('state').getAllKeys()),read(tx.objectStore('records').getAll()),read(tx.objectStore('used').getAllKeys()),read(tx.objectStore('state').get('wallet')),read(tx.objectStore('state').get('legacy-interaction'))]);
 return {keys,records,used,id:wallet?.credential.payload.id,nonce:interaction?.nonce,caches:await caches.keys()};
 });}
async function assertReset(before){
 const after=await snapshot();
 for(const key of ['wallet','trust','legacy-interaction','qr-request','holder-request','qr-response','guide-mode','guide-receipt'])assert(!after.keys.includes(key),key+' must be removed');
 assert.deepEqual(after.records,before.records,'all synced and pending receipts must survive');assert.deepEqual(after.used,before.used,'replay protection must survive');assert.deepEqual(after.caches,before.caches,'offline shell must survive');
 assert.match(await guide().textContent(),/한 화면 연습 시작/);assert(!(await guide().textContent()).includes('이번 연습을 완료했어요'));
}
async function practice(cache=false){
 await guide().getByRole('button',{name:'한 화면 연습 시작 →'}).click();
 await step().getByRole('button',{name:'테스트 신분증 발급',exact:true}).click();await notice('가상 발급 완료');
 await step().getByRole('button',{name:'검증 준비하기 · 공개키 받기'}).click();await notice('15분 시험 정책');
 if(cache){await step().getByRole('button',{name:'화면 오프라인 준비',exact:true}).click();}
 await step().getByRole('button',{name:'장애 체험 시작 · 연결 차단 모의'}).click();
 await step().getByRole('button',{name:'새 검증 요청 만들기'}).click();
 assert.equal(await step().getByRole('checkbox').isChecked(),false);await step().getByRole('checkbox').check();await step().getByRole('button',{name:'동의하고 서명 응답 만들기'}).click();await notice('기기 키로 현재 요청');
 await step().getByRole('button',{name:'오프라인 서명 검증하기'}).click();await notice('비상 방문자 접수 완료');
 return snapshot();
}
try{
 await open();const first=await practice(true);
 await step().getByRole('button',{name:'연결 복구하기 · 온라인 전환'}).click();await step().getByRole('button',{name:'상태 확인하고 기록 저장하기'}).click();await notice('로컬 서버에 동기화');assert.match(await guide().textContent(),/이번 연습을 완료했어요/);
 const synced=await snapshot();assert(synced.records.some(r=>r.credential===first.id&&r.synced));assert(synced.used.length>0);
 await page.screenshot({path:root+'/01-complete.png',fullPage:true});
 await page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true}).click();await notice('새 연습을 시작');await assertReset(synced);
 await page.close();await open();await assertReset(synced);
 await guide().getByText('오프라인 화면 저장 설정',{exact:true}).click();await page.getByTestId('offline-status').filter({hasText:'저장된 화면을 확인'}).waitFor();
 await page.screenshot({path:root+'/02-restarted.png',fullPage:true});
 const second=await practice();assert.notEqual(first.id,second.id);assert.notEqual(first.nonce,second.nonce);assert(second.records.some(r=>r.credential===second.id&&!r.synced));
 await context.setOffline(true);await page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true}).click();await notice('새 연습을 시작');await assertReset(second);
 await page.reload({waitUntil:'load'});await page.waitForFunction(()=>!document.querySelector('.restart-primary').disabled);await assertReset(second);
 assert.match(await guide().textContent(),/이전 연습의 미동기화 기록 1건/);
 await guide().getByRole('button',{name:'한 화면 연습 시작 →'}).click();assert(await page.getByRole('button',{name:'테스트 신분증 발급',exact:true}).isDisabled());
 await context.setOffline(false);await page.locator('header').getByRole('button',{name:/연결 차단 중/}).click();
 await tab('복구 · 기록');await page.getByRole('button',{name:'상태 재확인 · 기록 동기화'}).click();await notice('로컬 서버에 동기화');
 assert((await snapshot()).records.some(r=>r.credential===second.id&&r.synced));await tab('한 화면 연습');assert(!(await guide().textContent()).includes('이번 연습을 완료했어요'),'syncing old records must not complete a new practice');
 // Make a real verifier request, then check the restart also clears QR state.
 await tab('가상 발급기관');await page.getByRole('button',{name:'검증자 신뢰키 · 정책 준비'}).click();await notice('15분 시험 정책');
 await tab('두 기기 QR 인증');
 // Hold only this isolated profile's IDB transaction while a QR job is pending.
 // Reset must stay disabled until that job can finish its durable write.
 await page.evaluate(async()=>{
  const db=await new Promise(ok=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result)});
  window.releaseQrLock=false;const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');
  function hold(){const r=store.get('verifier-id');r.onsuccess=()=>{if(!window.releaseQrLock)hold()};}hold();tx.oncomplete=()=>db.close();
 });
 await page.getByRole('button',{name:'새 요청 QR 생성'}).click();await page.waitForFunction(()=>document.querySelector('.restart-primary').disabled);assert(await page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true}).isDisabled());
 await page.evaluate(()=>{window.releaseQrLock=true});await page.waitForFunction(()=>!document.querySelector('.restart-primary').disabled);
 await page.waitForFunction(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result)});return new Promise(ok=>{const r=db.transaction('state').objectStore('state').get('qr-request');r.onsuccess=()=>ok(!!r.result)})});
 const qr=await snapshot();await page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true}).click();await notice('새 연습을 시작');await assertReset(qr);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:root+'/03-mobile-reset.png',fullPage:true});
 assert.deepEqual(errors,[]);writeFileSync(root+'/result.json',JSON.stringify({passed:true,consecutivePractices:2,refreshAndReopen:true,pendingAndSyncedPreserved:true,replayAndCachePreserved:true,offlineReset:true,oldRecordsSync:true,qrReset:true,resetBlockedDuringQr:true,mobileNoOverflow:true,pageErrors:errors},null,2));
 console.log('PASS: two consecutive practices, refresh/reopen, pending+synced receipt preservation, replay/cache preservation, offline reset, old-record sync, QR reset, mobile layout');
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:root+'/failure.png',fullPage:true});throw e}finally{await browser.close();}
