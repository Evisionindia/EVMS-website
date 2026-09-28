import {Readable} from 'node:stream';import {pipeline} from 'node:stream/promises';
export async function proxyInstaller(res,cfg,asset,fetcher=fetch){
 const controller=new AbortController();res.on('close',()=>controller.abort());
 const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
 let response=await fetcher('https://api.github.com/repos/'+cfg.repo+'/releases/assets/'+asset.id,{headers:{Accept:'application/octet-stream',Authorization:'Bearer '+cfg.githubToken,'User-Agent':'EVMS-Website'},redirect:'manual',signal});
 if([301,302,303,307,308].includes(response.status)){
  const location=new URL(response.headers.get('location'));
  if(location.protocol!=='https:'||!['release-assets.githubusercontent.com','objects.githubusercontent.com','github.com'].includes(location.hostname))throw Error('Untrusted asset redirect');
  response=await fetcher(location,{redirect:'error',signal});
 }
 if(!response.ok||!response.body||response.headers.get('content-type')?.includes('json'))throw Error('Asset unavailable');
 res.attachment(asset.name).type('application/octet-stream');res.set('Cache-Control','private, no-store');
 await pipeline(Readable.fromWeb(response.body),res);
}
