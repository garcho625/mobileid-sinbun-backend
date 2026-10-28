import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import QRCode from 'qrcode';
const {chromium}=await import(pathToFileURL(process.env.ANSIM_PLAYWRIGHT_MODULE||resolve('.sites-runtime/browser-tools/node_modules/playwright/index.mjs')).href);
const root=resolve('.sites-runtime/qa/qr-input');mkdirSync(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const holder=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}}),verifier=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}});
const h=await holder.newPage(),v=await verifier.newPage(),errors=[];
let offline=false,apiRequests=0,chooserEvents=0;
for(const c of [holder,verifier]){c.on('request',r=>{if(offline&&new URL(r.url()).pathname==='/api/demo')apiRequests++});c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)))}
for(const p of [h,v])p.on('pageerror',e=>errors.push(e.message));h.on('filechooser',()=>chooserEvents++);
const tab=(p,t)=>p.locator('aside').getByRole('button',{name:new RegExp(t)}).click();
const notice=(p,t)=>p.getByRole('status').filter({hasText:t}).waitFor();
const input=p=>p.locator('.qr-input');
const alert=(p,t)=>input(p).getByRole('alert').filter({hasText:t}).waitFor();
async function download(p,label,name){const done=p.waitForEvent('download');await p.getByRole('button',{name:label,exact:true}).click();const file=root+'/'+name;await(await done).saveAs(file);assert.equal(readFileSync(file).subarray(1,4).toString(),'PNG');return file;}
async function prepare(p,issue){await p.goto('http://127.0.0.1:8788',{waitUntil:'networkidle'});await tab(p,'가상 발급기관');if(issue){await p.getByRole('button',{name:'테스트 신분증 발급',exact:true}).click();await notice(p,'가상 발급 완료')}await p.getByRole('button',{name:'검증자 신뢰키 · 정책 준비'}).click();await notice(p,'15분 시험 정책');await tab(p,'실험 개요');await p.getByText('오프라인 화면 저장 설정',{exact:true}).click();await p.getByRole('button',{name:'화면 오프라인 준비',exact:true}).click();await p.getByTestId('offline-status').filter({hasText:'준비 완료'}).waitFor({timeout:45000});}
async function manual(p,type,text){const details=input(p).locator('details');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();await p.getByLabel(type+' 입력',{exact:true}).fill(text);await input(p).getByRole('button',{name:'데이터 읽기',exact:true}).click();}
async function copy(p,kind){await p.bringToFront();await p.getByRole('button',{name:kind+' QR 전체 데이터 복사',exact:true}).click();await p.locator('.qr-display .qr-feedback').filter({hasText:'복사했습니다'}).waitFor();return p.evaluate(()=>navigator.clipboard.readText());}
async function pending(){return v.evaluate(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('ansim-offline-v1');r.onsuccess=()=>ok(r.result)});return new Promise(ok=>{const r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>ok(r.result.filter(x=>!x.synced))})});}
try{
 await prepare(h,true);await prepare(v,false);await tab(h,'이용자 지갑');const card=await download(h,'가상 신분증 이미지 저장','identity-card-not-qr.png');
 await tab(h,'두 기기 QR 인증');await h.getByRole('button',{name:'이 기기는 이용자',exact:true}).click();await tab(v,'두 기기 QR 인증');
 await holder.setOffline(true);await verifier.setOffline(true);offline=true;
 await v.getByRole('button',{name:'새 요청 QR 생성'}).click();await v.getByTestId('qr-status').filter({hasText:'요청 QR 생성 완료'}).waitFor();const requestText=await copy(v,'요청'),request=JSON.parse(requestText),requestFile=await download(v,'요청 QR 이미지 저장','request.png');
 await v.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(requestFile);await alert(v,'이용자 기기의 요청 QR');assert((await v.getByLabel('ansim-response 사진',{exact:true}).inputValue()).endsWith('request.png'));assert.equal(await v.getByTestId('ansim-response-feedback').count(),0);
 await manual(h,'ansim-request',request.sessionId);await alert(h,'세션 ID만');assert.equal(await h.getByRole('checkbox').count(),0);
 await manual(h,'ansim-request','');await alert(h,'전체 데이터를 붙여');await manual(h,'ansim-request','{bad json');await alert(h,'올바른 안심');
 await manual(h,'ansim-request','x'.repeat(1501));await alert(h,'너무 큽니다');
 await h.getByLabel('ansim-request 사진',{exact:true}).setInputFiles(card);await alert(h,'신분증 카드 이미지가 아닌');
 await h.getByLabel('ansim-request 사진',{exact:true}).setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(5_000_001)});await alert(h,'5MB 이하');
 const expired={...request,issuedAt:Date.now()-180000,expiresAt:Date.now()-60000},expiredFile=root+'/expired.png';await QRCode.toFile(expiredFile,JSON.stringify(expired),{width:520});await h.getByLabel('ansim-request 사진',{exact:true}).setInputFiles(expiredFile);await alert(h,'만료된 요청');
 // Exercise the actual file-selection UI, not just setInputFiles.
 const chooser=h.waitForEvent('filechooser');await h.getByLabel('ansim-request 사진',{exact:true}).click();await(await chooser).setFiles(requestFile);await h.getByTestId('ansim-request-feedback').filter({hasText:'요청 QR 읽기 완료'}).waitFor();assert.equal(chooserEvents,1,'selection must not reopen the chooser');assert((await h.getByLabel('ansim-request 사진',{exact:true}).inputValue()).endsWith('request.png'));assert.match(await h.getByTestId('ansim-request-file-name').textContent(),/request.png/);
 await h.getByRole('checkbox').check();await h.getByRole('button',{name:'승인하고 응답 QR 생성'}).click();await h.getByTestId('qr-status').filter({hasText:'응답 QR 생성 완료'}).waitFor();const responseFile=await download(h,'응답 QR 이미지 저장','response.png');
 await v.getByLabel('ansim-response 사진',{exact:true}).setInputFiles(responseFile);await v.getByTestId('ansim-response-feedback').filter({hasText:'응답 QR 검증 성공'}).waitFor();assert.equal((await pending()).length,1);await v.screenshot({path:root+'/01-photo-success.png',fullPage:true});
 await input(v).getByRole('button',{name:'선택한 사진 다시 읽기',exact:true}).click();await alert(v,'이미 사용한 요청');assert.equal((await pending()).length,1);assert.equal(await v.getByTestId('ansim-response-feedback').count(),0);
 // A second session exercises both directions using the copy/paste path.
 await v.getByRole('button',{name:'새 요청 QR 생성'}).click();await v.getByTestId('qr-status').filter({hasText:'요청 QR 생성 완료'}).waitFor();const nextRequest=await copy(v,'요청');assert.notEqual(JSON.parse(nextRequest).sessionId,request.sessionId);
 await h.getByLabel('ansim-request 사진',{exact:true}).setInputFiles(responseFile);await alert(h,'검증자 기기의 응답 QR');
 await manual(h,'ansim-request',nextRequest);await h.getByTestId('ansim-request-feedback').filter({hasText:'요청 QR 읽기 완료'}).waitFor();await h.getByRole('checkbox').check();await h.getByRole('button',{name:'승인하고 응답 QR 생성'}).click();await h.getByTestId('qr-status').filter({hasText:'응답 QR 생성 완료'}).waitFor();const responseText=await copy(h,'응답');assert(!responseText.includes('privateKey'));assert(!requestText.includes('privateKey'));
 await manual(v,'ansim-response',responseText);await v.getByTestId('ansim-response-feedback').filter({hasText:'응답 QR 검증 성공'}).waitFor();assert.equal((await pending()).length,2);await v.screenshot({path:root+'/02-data-success.png',fullPage:true});
 await manual(v,'ansim-response',responseText);await alert(v,'이미 사용한 요청');assert.equal((await pending()).length,2);
 await h.setViewportSize({width:390,height:844});const layout=await h.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,grid:getComputedStyle(e).gridTemplateColumns})).filter(e=>e.right>innerWidth+1)}));writeFileSync(root+'/layout.json',JSON.stringify(layout,null,2));assert(layout.width<=layout.viewport);const qrBox=await h.getByTestId('응답 QR').boundingBox();assert(Math.abs(qrBox.width-qrBox.height)<1,'visible QR must keep its square aspect ratio');await h.screenshot({path:root+'/03-mobile.png',fullPage:true});
 assert.equal(apiRequests,0);assert.deepEqual(errors,[]);writeFileSync(root+'/result.json',JSON.stringify({passed:true,downloadedRequestAndResponsePng:true,fileChooserEvents:chooserEvents,fileNameRetained:true,wrongRoleVisible:true,sessionOnlyRejectedClearly:true,blankMalformedOversizeAndNonQrRejected:true,expiredVisible:true,clipboardRoundtrip:true,photoAndJsonRoundtrip:true,replayBlocked:true,offlineApiRequests:apiRequests,mobileNoOverflow:true,pageErrors:errors},null,2));console.log('PASS: real QR PNG downloads and file chooser, selected filename retained, local wrong-role/session/expiry/file errors, both photo and clipboard JSON roundtrips, replay block, zero offline API calls, mobile layout');
}catch(e){await h.screenshot({path:root+'/holder-failure.png',fullPage:true});await v.screenshot({path:root+'/verifier-failure.png',fullPage:true});throw e}finally{await browser.close();}
