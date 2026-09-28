export async function jsonRequest(url,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(url,{...options,signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(typeof d.error==='string'?d.error:'Request unavailable.');return d;}catch(e){if(e.name==='AbortError')throw Error('Request timed out. Please retry.',{cause:e});throw e;}finally{clearTimeout(timer);}
}
