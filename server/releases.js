import {github} from './github.js';
export function normalizeRelease(raw,cfg){
 if(raw.draft||raw.prerelease||!/^v?\d+\.\d+\.\d+$/.test(raw.tag_name))throw Error('Not a stable release');
 const prefix='https://github.com/'+cfg.repo+'/releases/';
 if(raw.html_url!==prefix+'tag/'+raw.tag_name||!Number.isFinite(Date.parse(raw.published_at)))throw Error('Invalid release metadata');
 const assets=(raw.assets||[]).filter(a=>a.state==='uploaded'&&Number.isSafeInteger(a.id)&&Number.isSafeInteger(a.size)&&a.size>0&&['Client','Owner'].some(role=>a.name==='EVMS-'+role+'-Setup-'+raw.tag_name.replace(/^v/,'')+'-x64.exe')&&a.browser_download_url===prefix+'download/'+raw.tag_name+'/'+a.name).map(a=>({id:a.id,name:a.name,size:a.size,url:a.browser_download_url,digest:/^sha256:[a-f0-9]{64}$/.test(a.digest||'')?a.digest:null}));
 if(!assets.length)throw Error('No approved installers');
 const body=String(raw.body||'').split('\n\n---\nSource release:')[0].replace(/<!--[\s\S]*?-->/g,'').slice(0,6000);
 return {tag:raw.tag_name,title:String(raw.name||raw.tag_name).slice(0,200),publishedAt:raw.published_at,url:raw.html_url,notes:body,assets};
}
function cached(db,key,loader){let pending,failureUntil=0;return async()=>{
 const now=Date.now(),old=db.prepare('SELECT * FROM release_cache WHERE key=?').get(key);
 const fallback=()=>old?{...JSON.parse(old.payload),stale:true,checkedAt:new Date(old.checked).toISOString()}:{unavailable:true,message:'Release information temporarily unavailable.'};
 if(old&&now-old.checked<600000)return {...JSON.parse(old.payload),stale:false,checkedAt:new Date(old.checked).toISOString()};
 if(pending)return pending;if(now<failureUntil)return fallback();
 pending=(async()=>{try{const data=await loader();db.prepare('INSERT OR REPLACE INTO release_cache VALUES(?,?,?)').run(key,JSON.stringify(data),Date.now());return {...data,stale:false,checkedAt:new Date().toISOString()};}catch{failureUntil=Date.now()+60000;return fallback();}finally{pending=null;}})();return pending;
};}
export function releaseResolver(db,cfg,fetcher=fetch){const api=github(cfg.githubToken,fetcher);return cached(db,cfg.repo,async()=>{const raw=await api.request('/repos/'+cfg.repo+'/releases/latest');if(!raw)throw Error();return normalizeRelease(raw,cfg);});}
export function releaseCatalog(db,cfg,fetcher=fetch){
 const api=github(cfg.githubToken,fetcher);
 return cached(db,cfg.repo+':catalog',async()=>{
  const all=await api.list('/repos/'+cfg.repo+'/releases');
  const releases=all.flatMap(r=>{try{return[normalizeRelease(r,cfg)];}catch{return[];}}).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const latest=await api.request('/repos/'+cfg.repo+'/releases/latest');
  const latestTag=latest&&!latest.draft&&!latest.prerelease?latest.tag_name:null;
  let sync={status:'unknown',message:'Release synchronization has not been verified.'};
  const marker=all.find(r=>r.tag_name==='release-sync-status');
  if(marker){try{const m=JSON.parse(marker.body);const age=Date.now()-Date.parse(m.checked_at);sync={status:m.status==='ok'&&age>=0&&age<10800000?'ok':'warning',checkedAt:m.checked_at,message:m.status==='ok'&&age>=0&&age<10800000?'Release synchronization checked.':'Release synchronization delayed or failed; showing available mirrored releases.'};}catch{/* retain unknown */}}
  return {releases,latestTag:releases.some(r=>r.tag===latestTag)?latestTag:null,empty:releases.length===0,sync};
 });
}
