import {chromium} from 'playwright-core';import AxeBuilder from '@axe-core/playwright';import fs from 'node:fs';import assert from 'node:assert/strict';import {config} from '../server/config.js';import {openDatabase} from '../server/db.js';import {createApp} from '../server/app.js';
fs.mkdirSync('artifacts',{recursive:true});
const db=openDatabase(':memory:'),cfg=config({PUBLIC_SITE_URL:'http://127.0.0.1:4173'}),server=createApp(db,cfg).listen(4173,'127.0.0.1');
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const fixtureRelease=tag=>({tag,title:'E-VMS '+tag,publishedAt:'2026-09-28T00:00:00Z',notes:'Fixture release notes',url:'https://github.com/Evisionindia/EVMS-website/releases/tag/'+tag,assets:[{id:1,name:'E-VMS-Pro-'+tag.slice(1)+'-Windows-x64.exe',size:1234,url:'https://github.com/Evisionindia/EVMS-website/releases/download/'+tag+'/E-VMS-Pro-'+tag.slice(1)+'-Windows-x64.exe'}]});
await page.route('**/api/releases',r=>r.fulfill({json:{releases:[fixtureRelease('v1.1.1'),fixtureRelease('v1.1.0')],latestTag:'v1.1.1',sync:{status:'ok'}}}));
try{
 for(const width of [1440,1280,1024,768,480,390,320]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/','/product','/workflow','/deployment','/downloads','/trial','/about','/contact','/privacy']){
   const response=await page.goto(cfg.site+path);assert.equal(response.status(),200);
   if(path==='/product')await page.locator('.feature-card').first().waitFor();
   if(path==='/downloads'){await page.getByRole('heading',{name:'Previous releases',exact:true}).waitFor();assert.equal(await page.locator('.release-entry').count(),2);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+path+' overflow');
   if(width===1440||width===390){const axe=await new AxeBuilder({page}).analyze();results.push({width,path,violations:axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))});await page.screenshot({path:'artifacts/audit-'+width+'-'+(path.slice(1)||'home')+'.png',fullPage:true});}
  }
 }
 await page.goto(cfg.site);await page.locator('[data-flow=record]').focus();assert.equal(await page.locator('.workflow-board').getAttribute('data-active'),'record');for(const flow of ['record','review','access','organize']){
 await page.locator('[data-flow='+flow+']').click();
 assert.equal(await page.locator('[data-panel='+flow+']').isVisible(),true);
 assert.equal(await page.locator('[data-panel]:visible').count(),1);
 assert.equal(await page.locator('[data-flow='+flow+']').getAttribute('aria-pressed'),'true');
}
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.workflow-board').evaluate(e=>getComputedStyle(e).transform),'none');await page.locator('#menu').click();await page.getByRole('navigation').getByText('Contact',{exact:true}).click();await page.waitForURL('**/contact');
 await page.locator('[name=name]').fill('Audit fixture');await page.locator('[name=company]').fill('Test');await page.locator('[name=email]').fill('audit@example.com');await page.locator('[name=interest]').selectOption({label:'Product demonstration'});await page.locator('[name=consent]').check();await page.locator('#demo-form button').click();await page.getByText('Your request has been saved.',{exact:false}).waitFor();
 assert.equal(db.prepare('SELECT source FROM leads').get().source,'/contact');
 const failures=[{json:[]},{json:{bad:true}},{status:503,json:{error:'offline'}},{status:401,json:{error:'unauthorized'}},{status:200,body:'not json',contentType:'text/plain'}];
 for(const response of failures){await page.route('**/api/features',r=>r.fulfill(response));await page.goto(cfg.site+'/product');await page.locator('#features button').waitFor();assert.notEqual(await page.locator('#features').getAttribute('data-state'),'loading');await page.unroute('**/api/features');}
 await page.route('**/api/features',r=>r.abort('failed'));await page.goto(cfg.site+'/product');await page.getByText('Product information is temporarily unavailable.',{exact:true}).waitFor();await page.unroute('**/api/features');await page.locator('#features button').click();await page.locator('.feature-card').first().waitFor();
 await page.clock.install();await page.route('**/api/features',()=>{});await page.goto(cfg.site+'/product');await page.clock.fastForward(11000);await page.locator('#features button').waitFor();await page.unroute('**/api/features');await page.clock.resume();
 await page.unroute('**/api/releases');
 for(const response of [{json:{releases:[],empty:true,sync:{status:'unknown'}}},{json:{bad:true}},{status:503,json:{unavailable:true}},{json:{releases:[fixtureRelease('v1.1.0')],latestTag:'v1.1.0',stale:true,checkedAt:'2026-09-20T00:00:00Z',sync:{status:'warning',message:'Synchronization failed.'}}}]){
  await page.route('**/api/releases',r=>r.fulfill(response));await page.goto(cfg.site+'/downloads');await page.waitForFunction(()=>document.querySelector('#release').dataset.state!=='loading');assert.notEqual(await page.locator('#release').getAttribute('data-state'),'loading');await page.unroute('**/api/releases');
 }
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const staticPage=await noJS.newPage();await staticPage.goto(cfg.site);assert.equal(await staticPage.locator('.workflow-board').count(),1);await noJS.close();
 assert.deepEqual(errors,[]);assert.equal(results.reduce((n,r)=>n+r.violations.length,0),0,JSON.stringify(results));
 console.log('PASS: 8 pages × 7 widths; axe on 16 views; API success/empty/malformed/401/503/network/timeout/retry/stale; form, keyboard, reduced motion, no-JS workflow.');
}finally{fs.writeFileSync('artifacts/audit-browser.json',JSON.stringify({results,errors},null,2));await browser.close();server.close();db.close();}
