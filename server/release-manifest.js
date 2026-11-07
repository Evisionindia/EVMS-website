import {createHash} from 'node:crypto';
export function verifiedManifestState(data,asset,release){
 if(data.length!==asset.size||'sha256:'+createHash('sha256').update(data).digest('hex')!==asset.digest)throw Error('Manifest integrity mismatch');
 const m=JSON.parse(data.toString('utf8'));
 if(!['e-vms-release-manifest/v2','evms-release-manifest/v1'].includes(m.schema)||!['E-VMS','EVMS'].includes(m.product)||typeof m.version!=='string')throw Error('Unsupported manifest');
 return release.assets.map(a=>{
  const entry=m.artifacts?.find(x=>x.file===a.name);
  if(!entry||entry.size_bytes!==a.size||'sha256:'+entry.sha256!==a.digest||!a.name.includes('-'+m.version+'-'))return a;
  const allowed=new Set(['Valid','NotSigned','HashMismatch','NotTrusted','UnknownError','NOT_CHECKED','CHECK_FAILED']);
  return {...a,technicalVersion:m.version,signatureState:allowed.has(entry.authenticode?.status)?entry.authenticode.status:'UNKNOWN',releaseState:m.production_release_eligible===false?'NOT_PRODUCTION_ELIGIBLE':m.production_release_eligible===true&&entry.authenticode?.status==='Valid'?'MANIFEST_ELIGIBLE':'UNKNOWN',manifestVerified:true};
 });
}
export async function enrichManifest(raw,release,api,cfg){
 const asset=(raw.assets||[]).find(a=>['E-VMS-release-manifest.json','EVMS-release-manifest.json'].includes(a.name)&&a.state==='uploaded'&&a.size>0&&a.size<=1000000&&/^sha256:[a-f0-9]{64}$/.test(a.digest||''));
 if(!asset)return release;
 try{return {...release,assets:verifiedManifestState(await api.bytes(cfg.repo,asset.id,1000000),asset,release)};}catch{return release;}
}
