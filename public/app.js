import {jsonRequest} from './request.js';
const base=window.EVMS_CONFIG?.apiBase||'';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const menu=document.querySelector('#menu');if(menu)menu.onclick=()=>{const open=document.querySelector('nav').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));};
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>{document.querySelector('nav').classList.remove('open');menu?.setAttribute('aria-expanded','false');});
function state(box,message,retry){box.replaceChildren(el('p',message));const b=el('button','Retry','button');b.onclick=retry;box.append(b);box.dataset.state='error';}
async function features(){const box=document.querySelector('#features');box.textContent='Loading product information…';box.dataset.state='loading';
 try{const rows=await jsonRequest(base+'/api/features');if(!Array.isArray(rows)||rows.some(f=>!['name','category','description','limitation'].every(k=>typeof f[k]==='string')))throw Error();
 box.replaceChildren(...rows.map(f=>{const card=el('article',null,'feature-card');card.append(el('p',f.category,'eyebrow'),el('h3',f.name),el('p',f.description),el('small',f.limitation));return card;}));box.dataset.state=rows.length?'success':'empty';if(!rows.length){state(box,'No public product information is available.',features);box.dataset.state='empty';}
 }catch{state(box,'Product information is temporarily unavailable.',features);}
}
function trusted(url){try{const u=new URL(url,location.origin);return u.protocol==='https:'&&u.hostname==='github.com'||u.origin===new URL(base||location.origin).origin&&u.pathname.startsWith('/api/releases/download/');}catch{return false;}}
function releaseCard(r){
 if(!r||typeof r.tag!=='string'||!Number.isFinite(Date.parse(r.publishedAt))||!trusted(r.url)||!Array.isArray(r.assets)||r.assets.some(a=>!trusted(a.url)||typeof a.name!=='string'||!Number.isFinite(a.size)||a.size<=0))throw Error();
 const card=el('article',null,'release-entry');card.append(el('h3',r.title||r.tag),el('p',r.tag+' · Published '+new Date(r.publishedAt).toLocaleDateString()));
 if(r.notes){const details=el('details'),summary=el('summary','Release notes');details.append(summary,el('pre',r.notes));card.append(details);}
 const notes=el('a','View GitHub release ↗','text-link');notes.href=r.url;notes.rel='noopener';card.append(notes);
 const grid=el('div',null,'release-assets');
 for(const a of r.assets){const item=el('div',null,'asset');item.append(el('strong',a.name.includes('Owner')?'EVMS Owner':'EVMS Client'),el('small',a.name),el('p',(a.size/1048576).toFixed(1)+' MiB · Windows x64'));const link=el('a','Download installer ↗','button');link.href=a.url;link.rel='noopener';item.append(link);if(a.digest)item.append(el('small','SHA-256 (GitHub): '+a.digest.replace('sha256:','')));grid.append(item);}
 card.append(grid);return card;
}
async function releases(){const box=document.querySelector('#release');box.textContent='Checking published release information…';box.dataset.state='loading';
 try{const d=await jsonRequest(base+'/api/releases');if(!Array.isArray(d.releases)||d.unavailable)throw Error();const cards=d.releases.map(releaseCard);box.replaceChildren();box.dataset.state=d.releases.length?'success':'empty';
 if(d.stale)box.append(el('p','GitHub is unavailable. Showing previously checked releases from '+new Date(d.checkedAt).toLocaleString()+'.','status-warning'));
 if(d.sync?.status!=='ok')box.append(el('p',d.sync?.message||'Release synchronization has not been verified.','status-warning'));
 if(!cards.length){state(box,'No verified mirrored releases are available yet.',releases);box.dataset.state='empty';return;}
 const latest=d.releases.findIndex(r=>r.tag===d.latestTag);box.append(el('h2',latest>=0?(d.stale?'Last verified latest release':'Latest mirrored release'):'Available releases'));
 if(latest>=0)box.append(cards[latest]);const history=cards.filter((_,i)=>i!==latest);if(history.length){box.append(el('h2','Previous releases'),...history);}
 }catch{state(box,'Release information temporarily unavailable. Please retry.',releases);}
}
const form=document.querySelector('#demo-form');
if(form)form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button'),m=document.querySelector('#form-message'),body=Object.fromEntries(new FormData(form));body.consent=form.elements.consent.checked;body.source=location.pathname;b.disabled=true;m.textContent='Saving your request…';m.className='';try{const d=await jsonRequest(base+'/api/leads',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(d.saved!==true||typeof d.message!=='string')throw Error('Unable to confirm submission. Please retry.');m.textContent=d.message;form.reset();}catch(err){m.textContent=err.message==='Failed to fetch'?'Connection failed. Submission is not confirmed; retry with the same details.':err.message;m.className='error';}finally{b.disabled=false;}};
if(document.querySelector('#features'))features();if(document.querySelector('#release'))releases();
