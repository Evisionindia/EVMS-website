import {JWT} from 'google-auth-library';
import {approved} from './reports.js';
export async function syncSheet(cfg,job,row,{fetcher=fetch,getToken}={}){
 const token=getToken?await getToken():await new JWT({email:cfg.sheets.email,key:cfg.sheets.key,scopes:['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.metadata.readonly']}).getAccessToken();
 const headers={Authorization:'Bearer '+token.token,'Content-Type':'application/json'};
 const id=encodeURIComponent(cfg.sheets.id);
 const permissions=await fetcher('https://www.googleapis.com/drive/v3/files/'+id+'/permissions?pageSize=100&fields=nextPageToken,permissions(type,role)',{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!permissions.ok)throw Error('Cannot verify spreadsheet privacy');
 const data=await permissions.json();
 if(data.nextPageToken||!Array.isArray(data.permissions)||data.permissions.some(p=>['anyone','domain'].includes(p.type)))throw Error('Spreadsheet must be private');
 const range=encodeURIComponent('Leads!A'+job.row_number+':K'+job.row_number);
 const response=await fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+id+'/values/'+range+'?valueInputOption=RAW',{method:'PUT',headers,body:JSON.stringify({values:[[row.id,...approved.map(k=>row[k])]]}),signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('Sheets update failed');
}
