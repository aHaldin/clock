import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {hashAdminPassword,verifyAdminPassword,loginAdmin,getPasswordAdmin,logoutAdmin,adminSessionCookie} from '../lib/admin-auth.mjs';
import {Service} from '../lib/service.mjs';
import {sha,hmac,pinHash,deviceProof,clockSessionCookie} from '../lib/security.mjs';
import {range,totals,duration,csvCell} from '../lib/time.mjs';
import gateway from '../deployment/gateway.mjs';
class D1{constructor(){this.sql=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())this.sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'))}prepare(sql){const db=this.sql;let args=[];const wrap={bind(...a){args=a;return wrap},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}},_run(){if(/RETURNING/i.test(sql)){const results=db.prepare(sql).all(...args);return {results,meta:{changes:results.length}}}const before=db.prepare('SELECT total_changes() n').get().n;db.prepare(sql).run(...args);return {meta:{changes:Number(db.prepare('SELECT total_changes() n').get().n-before)}}}};return wrap}async batch(list){this.sql.exec('BEGIN IMMEDIATE');try{const r=list.map(s=>s._run());this.sql.exec('COMMIT');return r}catch(e){this.sql.exec('ROLLBACK');throw e}}}
const databases=[];
async function createDB(){
 if(!process.env.PH_TEST_POSTGRES)return new D1();
 const {PGlite}=await import('@electric-sql/pglite');
 const {btree_gist}=await import('@electric-sql/pglite/contrib/btree_gist');
 const {PostgresAdapter}=await import('../lib/postgres-adapter.mjs');
 const pg=new PGlite({extensions:{btree_gist}});databases.push(pg);
 for(const file of readdirSync(new URL('../netlify/database/migrations/',import.meta.url)).sort())await pg.exec(readFileSync(new URL('../netlify/database/migrations/'+file,import.meta.url),'utf8'));
 class TestAdapter extends PostgresAdapter {transaction(fn){return pg.transaction(fn)}}
 return new TestAdapter(pg);
}
afterEach(async()=>{while(databases.length)await databases.pop().close()});
const env={PIN_PEPPER:'p'.repeat(64),DEVICE_GATEWAY_SECRET:'g'.repeat(64),ADMIN_USER_IDS:'admin-1'};const fingerprint='a'.repeat(64);
async function setup(){const db=await createDB(),admin=new Service(db,env,{userId:'admin-1'});await admin.editEngineer({name:'Alex Morgan',pin:'123456',active:true});await admin.deviceEdit({name:'Studio A',fingerprint,active:true});return {db,admin,service:new Service(db,env)}}
async function req(path,body={},token,fp=fingerprint){const raw=JSON.stringify(body),at=Date.now(),nonce=crypto.randomUUID(),method='POST';const signature=await hmac(env.DEVICE_GATEWAY_SECRET,[method,'/api/clock/'+path,await sha(raw),fp,at,nonce].join('\n'));const headers={'x-ph-device-proof':JSON.stringify({fingerprint:fp,at,nonce,signature})};if(token)headers.cookie='ph_session='+token;return{r:new Request('https://app.test/api/clock/'+path,{method,headers,body:raw}),raw}}
async function clock(service,path,body={},token){const {r,raw}=await req(path,body,token);return service.clock(r,path,body,raw)}
test('PIN security: fixed length, unique, keyed hash, wrong and inactive rejected',async()=>{const {admin,service,db}=await setup();await assert.rejects(pinHash('123',env.PIN_PEPPER),/six-digit/);assert.notEqual(await pinHash('123456',env.PIN_PEPPER),'123456');await assert.rejects(clock(service,'verify',{pin:'999999'}),/recognised/);await assert.rejects(admin.editEngineer({name:'Other',pin:'123456',active:true}),/already assigned/);const e=await db.prepare('SELECT * FROM engineers').first();await admin.editEngineer({id:e.id,name:e.name,active:false});await assert.rejects(clock(service,'verify',{pin:'123456'}),/recognised/)});
test('five failed PIN attempts lock the device; successful use does not consume limit',async()=>{const {service}=await setup();for(let i=0;i<7;i++)await clock(service,'verify',{pin:'123456'});for(let i=0;i<5;i++)await assert.rejects(clock(service,'verify',{pin:'000000'}),/recognised/);await assert.rejects(clock(service,'verify',{pin:'123456'}),/15 minutes/)});
test('clock in/out saved once; simultaneous duplicate requests cannot create duplicates',async()=>{const {service,db}=await setup();const a=await clock(service,'verify',{pin:'123456'}),b=await clock(service,'verify',{pin:'123456'});const results=await Promise.allSettled([clock(service,'in',{},a.token),clock(service,'in',{},b.token)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.prepare('SELECT * FROM shifts').all()).results.length,1);const c=await clock(service,'verify',{pin:'123456'}),d=await clock(service,'verify',{pin:'123456'});assert.ok(c.data.shiftId);const outs=await Promise.allSettled([clock(service,'out',{shiftId:c.data.shiftId},c.token),clock(service,'out',{shiftId:d.data.shiftId},d.token)]);assert.equal(outs.filter(r=>r.status==='fulfilled').length,1);assert.ok((await db.prepare('SELECT * FROM shifts').first()).ended_at);await assert.rejects(clock(service,'out',{shiftId:c.data.shiftId},c.token),/expired/)});
test('engineer session cannot access admin methods; allowlist is exact',async()=>{const {db,service}=await setup();await assert.rejects(service.report(new URLSearchParams()),/Administrator/);await assert.rejects(service.editEngineer({}),/Administrator/);await assert.rejects(service.correct({}),/Administrator/);await assert.rejects(service.deviceEdit({}),/Administrator/);await assert.rejects(service.history('x'),/Administrator/);await assert.rejects(service.export(new URLSearchParams()),/Administrator/);await assert.rejects(new Service(db,env,{userId:'admin'}).report(new URLSearchParams()),/Administrator/)});
test('unapproved, tampered, replayed and revoked device proofs rejected',async()=>{const {service,admin}=await setup();await assert.rejects(service.device(new Request('https://app.test/api/device'),''),/approved studio/);const p=await req('verify',{pin:'123456'});await service.device(p.r,p.raw);await assert.rejects(service.device(p.r,p.raw),/already been used/);const q=await req('verify',{pin:'123456'});await assert.rejects(service.device(q.r,'{}'),/could not be verified/);const unknown=await req('verify',{},null,'b'.repeat(64));await assert.rejects(service.device(unknown.r,unknown.raw),/not approved/);await admin.deviceEdit({name:'Studio A',fingerprint,active:false});const r=await req('verify');await assert.rejects(service.device(r.r,r.raw),/revoked/);await assert.rejects(deviceProof(r.r,r.raw,''),/not configured/)});
test('sessions are device-bound, expire and are invalidated by PIN reset',async()=>{const {service,admin,db}=await setup();const v=await clock(service,'verify',{pin:'123456'});await admin.deviceEdit({name:'Other',fingerprint:'b'.repeat(64),active:true});const p=await req('in',{},v.token,'b'.repeat(64));await assert.rejects(service.clock(p.r,'in',{},p.raw),/expired/);await db.prepare('UPDATE sessions SET expires=0').run();await assert.rejects(clock(service,'in',{},v.token),/expired/);const fresh=await clock(service,'verify',{pin:'123456'});const e=await db.prepare('SELECT * FROM engineers').first();await admin.editEngineer({id:e.id,name:e.name,pin:'654321',active:true});await assert.rejects(clock(service,'in',{},fresh.token),/expired/);await assert.rejects(clock(service,'verify',{pin:'123456'}),/recognised/)});
test('overnight and DST hours use elapsed UTC time and London range boundaries',()=>{const shift={started_at:Date.parse('2026-03-28T23:00:00Z'),ended_at:Date.parse('2026-03-29T03:00:00Z')};const r=range('2026-03-29','2026-03-29');assert.equal(r.end-r.start,23*3600000);assert.equal(duration(shift,r.start,r.end,Date.now()),3*3600000);const fall=range('2026-10-25','2026-10-25');assert.equal(fall.end-fall.start,25*3600000);assert.deepEqual(totals([shift,{started_at:r.start,ended_at:null}],r.start,r.end,r.start+3600000),{completed:10800000,ongoing:3600000});assert.throws(()=>range('2026-02-31','2026-03-02'),/Invalid/)});
test('corrections require reason, preserve original, reject overlaps and stale edits atomically',async()=>{const {db,admin}=await setup();const e=await db.prepare('SELECT id FROM engineers').first();const start=Date.parse('2026-01-01T10:00:00Z');await db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?,?)').bind('s1',e.id,start,start+3600000,fingerprint,1).run();await db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?,?)').bind('s2',e.id,start+7200000,start+10800000,fingerprint,1).run();const base={id:'s1',version:1,start:new Date(start).toISOString(),end:new Date(start+5400000).toISOString()};await assert.rejects(admin.correct({...base,reason:''}),/reason/);await assert.rejects(admin.correct({...base,end:new Date(start+9000000).toISOString(),reason:'Mistyped end'}),/overlaps/);assert.equal((await admin.history('s1')).length,1);await admin.correct({...base,reason:'Correct missed minutes'});const h=await admin.history('s1');assert.equal(h.length,2);assert.equal(JSON.parse(h[0].before).ended_at,start+3600000);assert.equal(h[0].actor,'admin-1');await assert.rejects(admin.correct({...base,reason:'Stale update'}),/changed/);await assert.rejects(db.prepare('DELETE FROM audit').run(),/immutable/)});
test('CSV flags open shifts and prevents spreadsheet formulas',async()=>{assert.equal(csvCell('=SUM(A1)'),`"'=SUM(A1)"`);const{db,admin}=await setup();const e=await db.prepare('SELECT id FROM engineers').first();await db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?,?)').bind('open',e.id,Date.now()-17*3600000,null,fingerprint,1).run();const csv=await admin.export(new URLSearchParams());assert.match(csv,/Missing clock-out/);assert.match(csv,/Exact shift seconds/)});
test('gateway rejects forged HTTP certificate headers without real TLS metadata',async()=>{const r=new Request('https://studio.test/api/clock/in',{method:'POST',headers:{'x-ph-device-proof':'forged','cf-cert-verified':'SUCCESS'},body:'{}'});const response=await gateway.fetch(r,{APP_ORIGIN:'https://app.test',DEVICE_GATEWAY_SECRET:env.DEVICE_GATEWAY_SECRET});assert.equal(response.status,403)});
test('explicit local mode permits loopback PIN clocking but never remote hosts',async()=>{const {db}=await setup();const service=new Service(db,{...env,LOCAL_CLOCKING:true});const request=(path,body,token)=>new Request('http://127.0.0.1:5173/api/clock/'+path,{method:'POST',headers:token?{cookie:'ph_session='+token}:{},body:JSON.stringify(body)});const verify=await service.clock(request('verify',{pin:'123456'}),'verify',{pin:'123456'},'');const result=await service.clock(request('in',{},verify.token),'in',{},'');assert.equal(result.data.action,'in');assert.equal((await db.prepare('SELECT device FROM shifts').first()).device,'local-laptop');await assert.rejects(service.device(new Request('https://app.example/api/device'),''),/approved studio/);const strict=new Service(db,{...env,LOCAL_CLOCKING:'true'});await assert.rejects(strict.device(new Request('http://127.0.0.1:5173/api/device'),''),/approved studio/);});

test('session cookies support local HTTP without weakening hosted or HTTPS sessions',()=>{
 for(const host of ['127.0.0.1','localhost','[::1]']){
  const cookie=clockSessionCookie('test-token',`http://${host}:5173/api/clock/verify`,true);
  assert.doesNotMatch(cookie,/; Secure;/);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\/api\/clock/);
  assert.match(clockSessionCookie('',`http://${host}:5173/api/clock/reset`,true),/Max-Age=0/);
 }
 for(const [url,local] of [['https://app.example/api/clock/verify',true],['http://app.example/api/clock/verify',true],['https://127.0.0.1/api/clock/verify',true],['http://127.0.0.1/api/clock/verify',false],['http://127.0.0.1/api/clock/verify','true']])assert.match(clockSessionCookie('test-token',url,local),/; Secure;/);
});

test('admin password login, expiry, password change and logout are enforced server-side',async()=>{
 const db=await createDB(),hash=await hashAdminPassword('test-password-only');
 assert.notEqual(hash,'test-password-only');assert.notEqual(hash,await hashAdminPassword('test-password-only'));
 const config={...env,ADMIN_USER_IDS:'password-admin',ADMIN_PASSWORD_HASH:hash},service=new Service(db,config);
 await assert.rejects(loginAdmin(service,'wrong'),/Incorrect admin password/);
 assert.equal(await getPasswordAdmin(db,config,'ph_admin=forged'),null);
 const token=await loginAdmin(service,'test-password-only'),cookie='ph_admin='+token;
 const user=await getPasswordAdmin(db,config,cookie);assert.equal(user.userId,'password-admin');
 assert.ok(await new Service(db,config,user).report(new URLSearchParams()));
 assert.equal(await getPasswordAdmin(db,{...config,ADMIN_PASSWORD_HASH:await hashAdminPassword('replacement')},cookie),null);
 assert.doesNotMatch(adminSessionCookie(token,'http://127.0.0.1:5173',true),/; Secure;/);
 assert.match(adminSessionCookie(token,'https://studio.example',true),/; Secure;/);
 assert.match(adminSessionCookie('', 'http://127.0.0.1:5173',true),/Max-Age=0/);
 await logoutAdmin(db,cookie);assert.equal(await getPasswordAdmin(db,config,cookie),null);
 const exp=await loginAdmin(service,'test-password-only');await db.prepare('UPDATE admin_sessions SET expires=0').run();assert.equal(await getPasswordAdmin(db,config,'ph_admin='+exp),null);
 for(let i=0;i<4;i++)await assert.rejects(loginAdmin(service,'wrong'),/Incorrect/);
 await assert.rejects(loginAdmin(service,'test-password-only'),/15 minutes/);
});

test('hosted browser approval requires admin, rejects unknown and expired browsers, clocks and revokes',async()=>{
 const {db}=await setup(),config={...env,BROWSER_CLOCKING:'true'};
 const admin=new Service(db,config,{userId:'admin-1'}),service=new Service(db,config);
 const request=(cookie='',url='https://app.test/api/device')=>new Request(url,{headers:{cookie}});
 await assert.rejects(service.approveBrowser(request(),'Laptop'),/Administrator/);
 await assert.rejects(admin.approveBrowser(request('','http://app.test/api/admin/browser'),'Laptop'),/HTTPS/);
 await assert.rejects(service.device(request(),''),/not approved/);
 const cookie=await admin.approveBrowser(request(),'My laptop');
 assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const device=await service.device(request(cookie),'');assert.equal(device.mode,'browser');
 assert.doesNotMatch(JSON.stringify((await db.prepare('SELECT * FROM devices').all()).results),/ph_browser=/);
 const verified=await service.clock(request(cookie),'verify',{pin:'123456'},'');
 await service.clock(request(cookie+'; ph_session='+verified.token),'in',{},'');
 assert.equal((await db.prepare('SELECT device FROM shifts').first()).device,device.fingerprint);
 await assert.rejects(service.report(new URLSearchParams()),/Administrator/);
 await assert.rejects(new Service(db,env).device(request(cookie),''),/approved studio/);
 const expired=(Date.now()-31536000001)+'.'+crypto.randomUUID()+crypto.randomUUID();
 await admin.deviceEdit({fingerprint:await sha('browser:'+expired),name:'Expired',active:true});
 await assert.rejects(service.device(request('ph_browser='+expired),''),/not approved/);
 const pending=await service.clock(request(cookie),'verify',{pin:'123456'},'');
 await admin.deviceEdit({...device,active:false});
 await assert.rejects(service.device(request(cookie),''),/revoked/);
 await assert.rejects(service.clock(request(cookie+'; ph_session='+pending.token),'out',{shiftId:pending.data.shiftId},''),/revoked/);
});
