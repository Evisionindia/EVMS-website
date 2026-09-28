import {setTimeout as delay} from 'node:timers/promises';
export function github(token,fetcher=fetch){
 const headers={Accept:'application/vnd.github+json','User-Agent':'EVMS-Website','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})};
 async function request(route,{method='GET',body,raw=false}={}){
  const url=route.startsWith('https://')?route:'https://api.github.com'+route;
  const u=new URL(url);if(u.protocol!=='https:'||!['api.github.com','uploads.github.com'].includes(u.hostname))throw Error('Untrusted GitHub endpoint');
  for(let n=0;n<3;n++){
   let r;try{r=await fetcher(url,{method,headers:{...headers,...(body?{'Content-Type':raw?'application/octet-stream':'application/json'}:{})},body:body?(raw?body:JSON.stringify(body)):undefined,redirect:'error',signal:AbortSignal.timeout(raw?120000:8000)});}catch(e){if(method!=='GET'||n===2)throw Error('GitHub connection failed',{cause:e});await delay(200*2**n);continue;}
   if(r.status===404)return null;
   if(!r.ok){if(method==='GET'&&n<2&&r.status>=500){await delay(200*2**n);continue;}throw Error('GitHub request failed ('+r.status+')');}
   return r.status===204?{}:r.json();
  }
 }
 async function list(route){const rows=[];for(let page=1;page<=100;page++){const batch=await request(route+(route.includes('?')?'&':'?')+'per_page=100&page='+page);if(!Array.isArray(batch))throw Error('GitHub list unavailable');rows.push(...batch);if(batch.length<100)return rows;}throw Error('GitHub pagination safety limit');}
 async function bytes(repo,id,max=536870912){
  if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid asset ID');
  const signal=AbortSignal.timeout(120000);
  let r=await fetcher('https://api.github.com/repos/'+repo+'/releases/assets/'+id,{headers:{...headers,Accept:'application/octet-stream'},redirect:'manual',signal});
  if([301,302,303,307,308].includes(r.status)){
   const url=new URL(r.headers.get('location'));if(url.protocol!=='https:'||!['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname)||url.username||url.password)throw Error('Untrusted asset redirect');
   r=await fetcher(url,{redirect:'error',signal});
  }
  if(!r.ok||!r.body)throw Error('Asset unavailable');
  const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>max)throw Error('Asset exceeds size limit');chunks.push(c);}return Buffer.concat(chunks);
 }
 return {request,list,bytes,upload:(repo,id,name,bytes)=>request('https://uploads.github.com/repos/'+repo+'/releases/'+id+'/assets?name='+encodeURIComponent(name),{method:'POST',body:bytes,raw:true})};
}
