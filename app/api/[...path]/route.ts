import {isAllowedOrigin} from '@/lib/origin.mjs';
import {getDatabase,getConfig} from '@/lib/database.mjs';
import {getPasswordAdmin,loginAdmin,logoutAdmin,adminSessionCookie} from '@/lib/admin-auth.mjs';
import {Service} from '@/lib/service.mjs';
import {HttpError,fail,sha,clockSessionCookie} from '@/lib/security.mjs';
export const dynamic='force-dynamic';
async function handle(req:Request){const headers=new Headers({'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});try{const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,'');const config={...getConfig(),DB:getDatabase()} as any;const cookie=(token:string)=>clockSessionCookie(token,req.url,config.LOCAL_CLOCKING);if(!config.DB)fail(503,'Database unavailable. Please contact your administrator.');const service=new Service(config.DB,config,await getPasswordAdmin(config.DB,config,req.headers.get('cookie')));let raw='',body:any={};if(req.method==='POST'){if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON is required.');if(!isAllowedOrigin(req,config))fail(403,'Request origin not allowed.');raw=await req.text();if(raw.length>8192)fail(413,'Request too large.');try{body=JSON.parse(raw)}catch{fail(400,'Invalid JSON.')}}
let data:any;
if(path==='admin/login'&&req.method==='POST'){const token=await loginAdmin(service,body.password);headers.set('Set-Cookie',adminSessionCookie(token,req.url,config.LOCAL_CLOCKING));data={ok:true};}
else if(path==='admin/logout'&&req.method==='POST'){await logoutAdmin(config.DB,req.headers.get('cookie'));headers.set('Set-Cookie',adminSessionCookie('',req.url,config.LOCAL_CLOCKING));data={ok:true};}
else if(path==='device'&&req.method==='GET'){try{const d=await service.device(req,'');data={approved:true,name:d.name,mode:d.mode||'certificate'};}catch(e:any){if(e.status!==403)throw e;data={approved:false,message:e.message}}}
else if(path==='clock/reset'&&req.method==='POST'){const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('ph_session='))?.slice(11);if(token)await service.stmt('DELETE FROM sessions WHERE token_hash=?',await sha(token)).run();headers.set('Set-Cookie',cookie(''));data={ok:true};}
else if(path.startsWith('clock/')&&req.method==='POST'){const result=await service.clock(req,path.slice(6),body,raw);if(result.token)headers.set('Set-Cookie',cookie(result.token));if(result.clear)headers.set('Set-Cookie',cookie(''));data=result.data;}
else if(path==='admin/report'&&req.method==='GET')data=await service.report(url.searchParams);
else if(path==='admin/export'&&req.method==='GET'){headers.set('Content-Type','text/csv; charset=utf-8');headers.set('Content-Disposition','attachment; filename="podcast-house-timesheets.csv"');return new Response(await service.export(url.searchParams),{headers})}
else if(path==='admin/engineer'&&req.method==='POST')data=await service.editEngineer(body);
else if(path==='admin/correct'&&req.method==='POST')data=await service.correct(body);
else if(path==='admin/browser'&&req.method==='POST'){headers.set('Set-Cookie',await service.approveBrowser(req,body.name));data={ok:true};}
else if(path==='admin/device'&&req.method==='POST')data=await service.deviceEdit(body);
else if(path==='admin/history'&&req.method==='GET')data=await service.history(url.searchParams.get('id'));
else fail(404,'Not found.');return Response.json(data,{headers});
}catch(e:any){const status=e instanceof HttpError?e.status:503;return Response.json({error:status===503?'Service unavailable. No success is confirmed. Please reconnect and check your status.':e.message},{status,headers})}}
export const GET=handle;export const POST=handle;
