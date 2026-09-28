import fs from 'node:fs';import {github} from '../server/github.js';import {eligible,syncRelease} from './mirror-lib.js';
const policy=JSON.parse(fs.readFileSync('content/releases.json'));
if(process.env.GITHUB_REPOSITORY!==policy.mirrorRepository)throw Error('Run only in the approved website repository');
if(!process.env.MIRROR_TOKEN)throw Error('Mirror write authentication required');
const sourceApi=github(process.env.SOURCE_RELEASE_TOKEN),mirrorApi=github(process.env.MIRROR_TOKEN);
const status={checked_at:new Date().toISOString(),status:'ok',synchronized:[],failed:[]};
try{
 const releases=(await sourceApi.list('/repos/'+policy.sourceRepository+'/releases')).filter(eligible);
 if(!releases.length)throw Error('No eligible source releases');
 for(const summary of releases){
  try{const source=await sourceApi.request('/repos/'+policy.sourceRepository+'/releases/'+summary.id);source.assets=await sourceApi.list('/repos/'+policy.sourceRepository+'/releases/'+summary.id+'/assets');status.synchronized.push((await syncRelease(source,sourceApi,mirrorApi,policy)).source_tag);}catch{status.failed.push(summary.tag_name);}
 }
 const latest=await sourceApi.request('/repos/'+policy.sourceRepository+'/releases/latest');
 if(latest&&status.synchronized.includes(latest.tag_name)){
  const mirrored=await mirrorApi.request('/repos/'+policy.mirrorRepository+'/releases/tags/'+encodeURIComponent(latest.tag_name));
  await mirrorApi.request('/repos/'+policy.mirrorRepository+'/releases/'+mirrored.id,{method:'PATCH',body:{make_latest:'true'}});
 }
 if(status.failed.length)status.status='error';
}catch{status.status='error';status.message='Source retrieval or verification failed; previous verified releases retained.';}
let marker=await mirrorApi.request('/repos/'+policy.mirrorRepository+'/releases/tags/'+policy.syncTag);
const body=JSON.stringify(status,null,2);
if(!marker)await mirrorApi.request('/repos/'+policy.mirrorRepository+'/releases',{method:'POST',body:{tag_name:policy.syncTag,name:'Release synchronization status',body,prerelease:true,make_latest:'false'}});
else await mirrorApi.request('/repos/'+policy.mirrorRepository+'/releases/'+marker.id,{method:'PATCH',body:{body}});
console.log(JSON.stringify(status));if(status.status!=='ok')process.exitCode=1;
