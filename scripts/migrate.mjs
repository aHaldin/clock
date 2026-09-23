import pg from 'pg';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const connectionString=process.env.DATABASE_URL||process.env.NETLIFY_DB_URL;
if(!connectionString)throw Error('Set DATABASE_URL or NETLIFY_DB_URL.');
const client=new pg.Client({connectionString});await client.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(7284062027)');
 await client.query('CREATE TABLE IF NOT EXISTS ph_migrations(name text PRIMARY KEY,checksum text NOT NULL)');
 for(const file of readdirSync(new URL('../netlify/database/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync(new URL('../netlify/database/migrations/'+file,import.meta.url),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
  const {rows}=await client.query('SELECT checksum FROM ph_migrations WHERE name=$1',[file]);
  if(rows.length){if(rows[0].checksum!==checksum)throw Error('An applied migration changed: '+file);continue}
  await client.query(sql);await client.query('INSERT INTO ph_migrations VALUES($1,$2)',[file,checksum]);
 }
 await client.query('COMMIT');console.log('Migrations complete.');
}catch(e){await client.query('ROLLBACK');throw e}finally{await client.end()}
