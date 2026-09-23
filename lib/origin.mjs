// Trust server configuration, never an arbitrary forwarded host supplied by a caller.
export function isAllowedOrigin(request,config={}) {
 const origin=request.headers.get('origin');
 if(!origin||origin==='null')return false;
 let buildOrigins=[];
 try{const parsed=JSON.parse(config.PH_BUILD_ORIGINS||'[]');if(Array.isArray(parsed))buildOrigins=parsed;}catch{}
 const candidates=[new URL(request.url).origin,config.APP_ORIGIN,config.STUDIO_ORIGIN,config.URL,...buildOrigins];
 if(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(config.SITE_NAME||''))candidates.push(`https://${config.SITE_NAME}.netlify.app`);
 return candidates.some(value=>{
  if(typeof value!=='string'||!value)return false;
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&origin===url.origin;}catch{return false;}
 });
}
