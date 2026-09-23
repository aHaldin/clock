import {equal,sha,fail,clockSessionCookie} from './security.mjs';
const encoder=new TextEncoder();
const iterations=100000;
export async function hashAdminPassword(password,salt=crypto.randomUUID()){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256);
 const digest=Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
 return `pbkdf2-sha256$${iterations}$${salt}$${digest}`;
}
export async function verifyAdminPassword(password,encoded){
 if(typeof password!=='string'||password.length>512||!/^pbkdf2-sha256\$100000\$[^$]+\$[a-f0-9]{64}$/.test(encoded||''))return false;
 const salt=encoded.split('$')[2];return equal(await hashAdminPassword(password,salt),encoded);
}
const readToken=cookie=>String(cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ph_admin='))?.slice(9);
export async function getPasswordAdmin(db,config,cookie){
 const token=readToken(cookie);if(!token||!config.ADMIN_PASSWORD_HASH||!db)return null;
 const session=await db.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND credential_version=? AND expires>?').bind(await sha(token),await sha(config.ADMIN_PASSWORD_HASH),Date.now()).first();
 return session?{userId:'password-admin',displayName:'Administrator'}:null;
}
export async function loginAdmin(service,password){
 if(!service.env.ADMIN_PASSWORD_HASH)fail(503,'Admin password is not configured. Add ADMIN_PASSWORD_HASH to the Netlify environment variables for Functions and redeploy.');
 if(!/^pbkdf2-sha256\$100000\$[^$]+\$[a-f0-9]{64}$/.test(service.env.ADMIN_PASSWORD_HASH))fail(503,'Admin password settings are invalid. Copy the complete ADMIN_PASSWORD_HASH value without surrounding quotes, then redeploy.');
 await service.limit('admin-password',5);
 if(!await verifyAdminPassword(password,service.env.ADMIN_PASSWORD_HASH))fail(401,'Incorrect admin password. Please try again.');
 const token=crypto.randomUUID()+crypto.randomUUID();const now=Date.now();
 await service.db.batch([
  service.stmt('UPDATE attempts SET count=MAX(0,count-1) WHERE key=?','admin-password'),
  service.stmt('DELETE FROM admin_sessions WHERE expires<=?',now),
  service.stmt('INSERT INTO admin_sessions VALUES(?,?,?)',await sha(token),await sha(service.env.ADMIN_PASSWORD_HASH),now+8*3600000)
 ]);return token;
}
export async function logoutAdmin(db,cookie){const token=readToken(cookie);if(token)await db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha(token)).run();}
export function adminSessionCookie(token,url,local=false){return clockSessionCookie(token,url,local).replace('ph_session=','ph_admin=').replace('Path=/api/clock','Path=/').replace('Max-Age=45','Max-Age=28800');}
