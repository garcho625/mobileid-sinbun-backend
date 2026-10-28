import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.ANSIM_PLAYWRIGHT_MODULE||resolve('.sites-runtime/browser-tools/node_modules/playwright/index.mjs')).href);
const root=resolve('.sites-runtime/qa/guided-ui');mkdirSync(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const flow=page.getByTestId('practice-flow'),step=page.getByTestId('practice-step');
const notice=text=>page.getByRole('status').filter({hasText:text}).waitFor();
const tab=text=>page.locator('aside').getByRole('button',{name:new RegExp(text)}).click();
async function at(n){await step.getByRole('heading',{name:new RegExp(n+' / 7')}).waitFor();assert.match(await page.locator('aside .nav.active').textContent(),/한 화면 연습/);assert.equal(await flow.locator('[aria-current=step]').count(),1);assert.equal(await flow.locator('[aria-current=step]').textContent().then(v=>v.startsWith(String(n))),true);}
try{
 await page.goto('http://127.0.0.1:8788',{waitUntil:'networkidle'});
 const reset=page.getByRole('button',{name:'↺ 처음부터 다시 시작',exact:true});await reset.waitFor();const box=await reset.boundingBox();assert(box.y>=0&&box.y<110,'reset is prominent in the first viewport');
 await page.screenshot({path:root+'/01-start.png',fullPage:true});
 await flow.getByRole('button',{name:'한 화면 연습 시작 →',exact:true}).click();await at(1);
 await step.getByRole('button',{name:'테스트 신분증 발급',exact:true}).click();await notice('가상 발급 완료');await at(2);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/05-mobile-step.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 assert.match(await page.getByTestId('identity-status').textContent(),/미확인/);await page.screenshot({path:root+'/02-issued.png',fullPage:true});
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'가상 신분증 이미지 저장'}).click();await(await downloaded).saveAs(root+'/demo-id.png');assert.equal(readFileSync(root+'/demo-id.png').subarray(1,4).toString(),'PNG');
 await step.getByRole('button',{name:'검증 준비하기 · 공개키 받기'}).click();await notice('15분 시험 정책');
 await step.getByRole('button',{name:'화면 오프라인 준비',exact:true}).click();await at(3);
 await step.getByRole('button',{name:'장애 체험 시작 · 연결 차단 모의'}).click();await at(4);
 await step.getByRole('button',{name:'새 검증 요청 만들기'}).click();await at(5);
 assert(await step.getByRole('button',{name:'동의하고 서명 응답 만들기'}).isDisabled());
 await step.getByRole('checkbox').check();await step.getByRole('button',{name:'동의하고 서명 응답 만들기'}).click();await notice('기기 키로 현재 요청');await at(6);
 await step.getByRole('button',{name:'오프라인 서명 검증하기'}).click();await notice('비상 방문자 접수 완료');await at(7);
 await step.getByRole('button',{name:'연결 복구하기 · 온라인 전환'}).click();await step.getByRole('button',{name:'상태 확인하고 기록 저장하기'}).click();await notice('로컬 서버에 동기화');await step.getByRole('heading',{name:'이번 연습을 완료했어요'}).waitFor();assert.equal(await flow.locator('li[data-complete=true]').count(),7);assert.match(await step.textContent(),/이번 연습 접수 기록 1건/);
 assert.match(await page.getByTestId('identity-status').textContent(),/마지막 조회: 정상/);await page.screenshot({path:root+'/03-complete.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));const mobileBox=await reset.boundingBox();assert(mobileBox.y>=0&&mobileBox.y+mobileBox.height<=844,'sticky reset remains in viewport after scrolling');await page.screenshot({path:root+'/04-mobile.png',fullPage:true});
 await tab('복구 · 기록');await page.getByRole('button',{name:'발급기관 정지 처리 (실험)'}).click();await notice('테스트 증명정보를 정지');await tab('이용자 지갑');assert.match(await page.getByTestId('identity-status').textContent(),/마지막 조회: 정지/);
 await reset.click();await notice('새 연습을 시작');await flow.getByRole('button',{name:'한 화면 연습 시작 →'}).waitFor();await flow.getByText('두 기기로 QR 교환하기',{exact:true}).click();await flow.getByRole('button',{name:'검증자로 시작',exact:true}).click();await page.getByRole('button',{name:'새 요청 QR 생성'}).waitFor();
 assert.deepEqual(errors,[]);writeFileSync(root+'/result.json',JSON.stringify({passed:true,sevenStepsWithoutMenuNavigation:true,prominentStickyReset:true,consentRequired:true,png:true,unknownActiveStoppedLabels:true,mobileNoOverflow:true,qrVerifierRole:true,pageErrors:errors},null,2));console.log('PASS: all 7 practice steps on one screen, sticky reset, required consent, PNG export, honest status labels, mobile layout, legacy screens and QR role');
}catch(e){await page.screenshot({path:root+'/failure.png',fullPage:true});throw e}finally{await browser.close();}
