import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
const keys=['NETLIFY_DB_URL','DATABASE_URL','NETLIFY_DB_DRIVER'];
test('database factory handles missing settings, local Postgres and Netlify serverless pools',async()=>{
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const pools=[];
 try{
  for(const key of keys)delete process.env[key];
  assert.equal((await import('../lib/database.mjs?missing')).getDatabase(),null);
  process.env.DATABASE_URL='postgresql://test:test@localhost:5432/test';
  const local=(await import('../lib/database.mjs?local')).getDatabase();pools.push(local.pool);
  assert.ok(local.pool instanceof pg.Pool);
  process.env.NETLIFY_DB_URL='postgresql://test:test@database.example:5432/test';
  process.env.NETLIFY_DB_DRIVER='serverless';
  const hosted=(await import('../lib/database.mjs?hosted')).getDatabase();pools.push(hosted.pool);
  assert.ok(!(hosted.pool instanceof pg.Pool));
  assert.equal(hosted.pool.options.connectionString,process.env.NETLIFY_DB_URL);
 }finally{
  await Promise.all(pools.map(pool=>pool.end()));
  for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
 }
});
