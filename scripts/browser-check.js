import {chromium} from 'playwright-core';import AxeBuilder from '@axe-core/playwright';import express from 'express';import {randomBytes} from 'node:crypto';import bcrypt from 'bcryptjs';import fs from 'node:fs';import assert from 'node:assert/strict';import {config} from '../server/config.js';import {openDatabase} from '../server/db.js';import {createApp} from '../server/app.js';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_EXECUTABLE?undefined:'chrome',executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
const results=[];
try{
 for(const [front,back] of [[4173,5180],[4300,6200]]){
  const cfg=config({PUBLIC_SITE_URL:'http://127.0.0.1:'+front,API_BASE_URL:'http://127.0.0.1:'+back,CORS_ORIGINS:'http://127.0.0.1:'+back});
  const db=openDatabase(':memory:'),password=randomBytes(24).toString('hex');db.prepare('INSERT INTO owners VALUES(?,?,?)').run('fixture','owner@example.com',await bcrypt.hash(password,4));
  const backend=createApp(db,cfg,{resolveRelease:async()=>({unavailable:true})}).listen(back,'127.0.0.1');
  const staticApp=express();staticApp.get('/runtime-config.js',(_q,r)=>r.type('js').send('window.EVMS_CONFIG='+JSON.stringify({apiBase:cfg.api})));
  staticApp.get(['/owner','/product','/about','/contact','/downloads','/trial'],(q,r)=>r.sendFile(q.path.slice(1)+'.html',{root:'dist'}));staticApp.use(express.static('dist'));const frontend=staticApp.listen(front,'127.0.0.1');
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(cfg.site+'/product');await page.locator('.feature-card').first().waitFor();assert.equal(await page.locator('.feature-card').count(),4);
   await page.screenshot({path:'artifacts/desktop-'+front+'.png',fullPage:true});
   await page.goto(cfg.site+'/contact');
   await page.locator('[name=name]').fill('Website acceptance fixture');await page.locator('[name=company]').fill('Test organization');await page.locator('[name=email]').fill('fixture@example.com');await page.locator('[name=interest]').selectOption({label:'Product demonstration'});await page.locator('[name=consent]').check();await page.locator('#demo-form button').click();await page.getByText('Your request has been saved.',{exact:false}).waitFor();
   assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
   await page.goto(cfg.site+'/owner');await page.locator('#login [name=email]').fill('owner@example.com');await page.locator('#login [name=password]').fill(password);await page.locator('#login button').click();await page.locator('#owner-metrics .owner-metric').first().waitFor();assert.equal(await page.locator('#owner-metrics .owner-metric').count(),6);
   await page.locator('[data-panel=leads]').click();await page.locator('#leads button').waitFor();await page.locator('#leads button').click();await page.locator('#lead-status').selectOption('qualified');await page.locator('#save-status').click();await page.getByText('Saved.',{exact:true}).waitFor();await page.locator('#close-dialog').click();
   const download=page.waitForEvent('download');await page.locator('[data-export=xlsx]').click();const file=await download;assert.equal(file.suggestedFilename(),'e-vms-demo-requests.xlsx');
   for(const section of ['trials','licenses','downloads','audit','settings','company']){await page.locator(`[data-panel=${section}]`).click();await page.locator(`[data-panel-view=${section}]`).waitFor();}
   await page.screenshot({path:'artifacts/owner-'+front+'.png',fullPage:true});const ownerAxe=await new AxeBuilder({page}).analyze();
   await page.locator('#logout').click();await page.locator('#login').waitFor();assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
   await page.setViewportSize({width:390,height:844});await page.goto(cfg.site+'/product');await page.locator('.feature-card').first().waitFor();await page.locator('#menu').click();assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'true');await page.getByRole('navigation').getByText('Product',{exact:true}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:'artifacts/mobile-'+front+'.png',fullPage:true});const mobileAxe=await new AxeBuilder({page}).analyze();
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).scrollBehavior),'auto');
   await page.goto('http://127.0.0.1:'+back+'/product');await page.locator('.feature-card').first().waitFor();
   assert.deepEqual(errors,[]);
   const violations=[...ownerAxe.violations,...mobileAxe.violations].map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));
   results.push({front,back,leadPersisted:true,ownerCRUD:true,xlsxDownload:true,sameOrigin:true,separateOrigin:true,mobileOverflow:false,reducedMotion:true,errors,violations});
  }finally{await context.close();frontend.close();backend.close();db.close();}
 }
}finally{await browser.close();fs.writeFileSync('artifacts/browser-check.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.violations.length))process.exitCode=1;
