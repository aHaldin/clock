import pg from 'pg';
import {PostgresAdapter} from './postgres-adapter.mjs';
let db;
export function getConfig(){return {...process.env,ADMIN_USER_IDS:'password-admin',BROWSER_CLOCKING:process.env.BROWSER_CLOCKING??'true',LOCAL_CLOCKING:process.env.NODE_ENV==='development'&&process.env.LOCAL_CLOCKING==='true'}}
export function getDatabase(){
 const connectionString=process.env.NETLIFY_DB_URL||process.env.DATABASE_URL;
 if(!connectionString)return null;
 db??=new PostgresAdapter(new pg.Pool({connectionString,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:20000}));
 return db;
}
