import {hmac,equal,sha,fail} from './security.mjs';
const read=req=>(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ph_kiosk='))?.slice(9)||'';
async function valid(token,env){
 if(!env.PIN_PEPPER||env.PIN_PEPPER.length<32)fail(503,'PIN security is not configured. Contact your administrator.');
 const [id,signature]=token.split('.');
 return /^[a-f0-9-]{36}$/.test(id||'')&&equal(signature,await hmac(env.PIN_PEPPER,'kiosk:'+id));
}
export async function anyDevice(req,env){
 const token=read(req);if(!await valid(token,env))fail(401,'Reload the clock to start a secure session.');
 return {fingerprint:await sha('kiosk:'+token),name:'PIN access',mode:'any'};
}
export async function prepareAnyDevice(req,env){
 if(await valid(read(req),env))return {req};
 const id=crypto.randomUUID(),token=id+'.'+await hmac(env.PIN_PEPPER,'kiosk:'+id);
 const headers=new Headers(req.headers);headers.set('cookie',(headers.get('cookie')||'')+'; ph_kiosk='+token);
 const url=new URL(req.url),local=env.LOCAL_CLOCKING===true&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 return {req:new Request(req.url,{method:req.method,headers}),cookie:`ph_kiosk=${token}; HttpOnly;${local?'':' Secure;'} SameSite=Strict; Path=/api; Max-Age=31536000`};
}
