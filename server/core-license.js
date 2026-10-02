export function createCoreLicenseRegistrar(cfg,{fetchImpl=fetch}={}){
 return async({artifact,checksum,requestId})=>{
  if(!cfg.trial.coreConfigured)throw Object.assign(Error('CORE_LICENSE_REGISTRATION_NOT_CONFIGURED'),{retryable:false});
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),cfg.trial.registrationTimeoutMs);
   try{
    const response=await fetchImpl(cfg.trial.registrationUrl,{method:'POST',headers:{'Authorization':`Bearer ${cfg.trial.serviceToken}`,'Content-Type':'application/json','Idempotency-Key':requestId},body:JSON.stringify({license_artifact:artifact,artifact_checksum:checksum}),signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(response.ok&&body.success&&body.license_id&&body.artifact_checksum)return body;
    const error=Object.assign(Error(body.message||`CORE_REGISTRATION_HTTP_${response.status}`),{status:response.status,retryable:response.status>=500});
    if(!error.retryable)throw error;lastError=error;
   }catch(error){lastError=error;if(error.retryable===false||error.status&&error.status<500)throw error;}
   finally{clearTimeout(timer);}
   if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*100));
  }
  throw lastError||Error('CORE_LICENSE_REGISTRATION_FAILED');
 };
}
