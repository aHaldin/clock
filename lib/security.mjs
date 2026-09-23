const encoder=new TextEncoder();
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new HttpError(status,message)};
export async function sha(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
export async function pinHash(pin,pepper){if(!pepper||pepper.length<32)fail(503,'PIN security is not configured. Contact your administrator.');if(!/^\d{6}$/.test(pin||''))fail(400,'Enter a six-digit code.');return hmac(pepper,'podcast-house-pin-v1:'+pin)}
export function adminAllowed(user,allowlist){return !!user&&String(allowlist||'').split(',').map(x=>x.trim()).filter(Boolean).includes(user.userId)}
export async function deviceProof(request,body,secret,now=Date.now()){
 if(!secret||secret.length<32)fail(403,'Device certificates are not configured in this environment. Clocking is disabled.');
 const p=request.headers.get('x-ph-device-proof');if(!p)fail(403,'Use an approved studio Mac with its installed certificate.');
 let proof;try{proof=JSON.parse(p)}catch{fail(403,'Invalid device certificate proof.')}
 const {fingerprint,at,nonce,signature}=proof;
 if(!/^[a-f0-9]{64}$/.test(fingerprint||'')||!Number.isSafeInteger(at)||Math.abs(now-at)>30000||!/^[a-f0-9-]{36}$/.test(nonce||''))fail(403,'Device certificate proof expired or invalid.');
 const url=new URL(request.url);const payload=[request.method,url.pathname+url.search,await sha(body),fingerprint,at,nonce].join('\n');
 if(!equal(signature,await hmac(secret,payload)))fail(403,'Device certificate could not be verified.');
 return {fingerprint,nonce,expires:now+60000};
}

// Only explicit loopback development may use an HTTP session cookie.
// The route normalises LOCAL_CLOCKING to false in every production build.
export function clockSessionCookie(token,requestUrl,localClocking=false){
 const url=new URL(requestUrl);
 const localHttp=localClocking===true&&url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 return `ph_session=${token}; HttpOnly;${localHttp?'':' Secure;'} SameSite=Strict; Path=/api/clock; Max-Age=${token?'45':'0'}`;
}
