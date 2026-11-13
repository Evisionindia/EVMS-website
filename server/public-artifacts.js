// Public distribution is an explicit client-only allowlist, including stale caches.
export const isClientInstaller=name=>/^(?:E-VMS-Pro-\d+\.\d+\.\d+-Windows-x64|EVMS-Client-Setup-\d+\.\d+\.\d+-x64)\.exe$/.test(name||'');
export const isClientAsset=name=>isClientInstaller(name)||name==='client.yml'||(name?.endsWith('.blockmap')&&isClientInstaller(name.slice(0,-9)));
export function publicCatalog(data){
 if(!data||typeof data!=='object')return {unavailable:true};
 if(Array.isArray(data.releases))return {...data,releases:data.releases.map(publicCatalog).filter(r=>r.assets?.length)};
 if(Array.isArray(data.assets))return {...data,notes:'Customer operator client release. Check version, signature and deployment compatibility before installation.',assets:data.assets.filter(a=>isClientInstaller(a.name))};
 return data;
}
