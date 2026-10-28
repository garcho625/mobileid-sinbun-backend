// Isolated loopback fixture: changing fake page text must appear online while
// the explicitly prepared copy remains available when the browser is offline.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.ANSIM_PLAYWRIGHT_MODULE||resolve('.sites-runtime/browser-tools/node_modules/playwright/index.mjs')).href);
let version=1;
const server=createServer((req,res)=>{
 if(req.url==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync('public/sw.js'));}
 else if(req.url==='/offline-assets.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:'abcdef1234567890abcd',assets:['/']}));}
 else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fake offline fixture</title><p id="version">Fake page '+version+'</p>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage();
try{
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base);await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 version=2;await page.reload();assert.equal(await page.locator('#version').textContent(),'Fake page 2','online reload must use fresh server HTML');
 await context.setOffline(true);await page.reload();assert.equal(await page.locator('#version').textContent(),'Fake page 1','prepared shell must still reopen without network');
 await context.setOffline(false);await page.reload();assert.equal(await page.locator('#version').textContent(),'Fake page 2');
 console.log('PASS: online reload shows changed UI, offline reload uses prepared shell, reconnection shows current UI; isolated fake data only');
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
