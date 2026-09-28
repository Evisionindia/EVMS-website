import {createHash} from 'node:crypto';
export const checksum=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const isPE=b=>b.length>=68&&b[0]===77&&b[1]===90&&b.readUInt32LE(60)<=b.length-4&&b.subarray(b.readUInt32LE(60),b.readUInt32LE(60)+4).equals(Buffer.from([80,69,0,0]));
export const eligible=r=>!r.draft&&/^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(r.tag_name)&&Number.isSafeInteger(r.id)&&Number.isFinite(Date.parse(r.published_at));
export function approvedAssets(r,policy){
 const version=r.tag_name.replace(/^v/,'');
 const approved=(r.assets||[]).filter(a=>policy.requiredRoles.some(role=>a.name==='EVMS-'+role+'-Setup-'+version+'-x64.exe'));
 if(policy.requiredRoles.some(role=>!approved.some(a=>a.name==='EVMS-'+role+'-Setup-'+version+'-x64.exe')))throw Error('Release lacks required Client/Owner installers');
 if(new Set(approved.map(a=>a.name)).size!==approved.length||approved.some(a=>a.state!=='uploaded'||!Number.isSafeInteger(a.id)||!Number.isSafeInteger(a.size)||a.size<2||a.size>policy.maxAssetBytes))throw Error('Invalid installer metadata');
 return approved;
}
export async function syncRelease(source,sourceApi,mirrorApi,policy){
 if(!eligible(source))throw Error('Ineligible source release');
 const repo=policy.mirrorRepository,sourceRepo=policy.sourceRepository;
 if(source.html_url!=='https://github.com/'+sourceRepo+'/releases/tag/'+source.tag_name)throw Error('Unexpected source release URL');
 const notes=String(source.body||'');
 if(/(?:ghp_|github_pat_)[a-zA-Z0-9_]{20,}|-----BEGIN .*PRIVATE KEY|(?:password|token|secret)\s*[:=]\s*\S+/i.test(notes))throw Error('Release notes require privacy review');
 const assets=approvedAssets(source,policy);
 const prepared=[];
 for(const a of assets){const data=await sourceApi.bytes(sourceRepo,a.id,policy.maxAssetBytes);if(data.length!==a.size||!isPE(data))throw Error('Installer byte/size verification failed');const digest=checksum(data);if(a.digest&&a.digest!==digest)throw Error('Source checksum mismatch');prepared.push({...a,data,digest});}
 let mirror=await mirrorApi.request('/repos/'+repo+'/releases/tags/'+encodeURIComponent(source.tag_name));
 if(mirror&&!(mirror.body||'').includes('EVMS-MIRROR source='+sourceRepo+' id='+source.id))throw Error('Mirror tag belongs to another release; refusing overwrite');
 const body=notes+'\n\n---\nSource release: '+source.html_url+'\nSource published: '+source.published_at+'\n<!-- EVMS-MIRROR source='+sourceRepo+' id='+source.id+' -->';
 if(!mirror)mirror=await mirrorApi.request('/repos/'+repo+'/releases',{method:'POST',body:{tag_name:source.tag_name,name:source.name||source.tag_name,body,draft:true,prerelease:!!source.prerelease}});
 const current=await mirrorApi.list('/repos/'+repo+'/releases/'+mirror.id+'/assets');
 const known=current.find(a=>a.name===policy.mappingAsset);
 let oldMap=null;if(known){try{oldMap=JSON.parse((await mirrorApi.bytes(repo,known.id,1000000)).toString());}catch{throw Error('Existing mirror mapping unreadable');}}
 for(const a of prepared){
  const exists=current.find(x=>x.name===a.name);
  if(exists){
   const actual=checksum(await mirrorApi.bytes(repo,exists.id,policy.maxAssetBytes));
   if(exists.size!==a.size||actual!==a.digest)throw Error('Published asset changed; publish a new version instead of replacing installer');
  }else{const uploaded=await mirrorApi.upload(repo,mirror.id,a.name,a.data);if(uploaded.size!==a.size||checksum(await mirrorApi.bytes(repo,uploaded.id,policy.maxAssetBytes))!==a.digest)throw Error('Mirror upload verification failed');}
 }
 const fresh=await mirrorApi.list('/repos/'+repo+'/releases/'+mirror.id+'/assets');
 const mapping={source_repository:sourceRepo,source_release_id:source.id,source_tag:source.tag_name,source_release_url:source.html_url,source_published_at:source.published_at,mirror_repository:repo,mirror_release_id:mirror.id,mirror_tag:source.tag_name,sync_status:'verified',assets:prepared.map(a=>({name:a.name,size:a.size,sha256:a.digest,source_asset_id:a.id,mirror_asset_id:fresh.find(x=>x.name===a.name).id}))};
 const {sync_timestamp:ignored,...oldComparable}=oldMap||{};
 if(JSON.stringify(oldComparable)!==JSON.stringify(mapping)){
  if(known)await mirrorApi.request('/repos/'+repo+'/releases/assets/'+known.id,{method:'DELETE'});
  await mirrorApi.upload(repo,mirror.id,policy.mappingAsset,Buffer.from(JSON.stringify({...mapping,sync_timestamp:new Date().toISOString()},null,2)));
 }
 if(mirror.name!==(source.name||source.tag_name)||mirror.body!==body||mirror.draft||mirror.prerelease!==!!source.prerelease)await mirrorApi.request('/repos/'+repo+'/releases/'+mirror.id,{method:'PATCH',body:{name:source.name||source.tag_name,body,draft:false,prerelease:!!source.prerelease,make_latest:'false'}});
 return mapping;
}
