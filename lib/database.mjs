import pg from 'pg';
import {getDatabase as getNetlifyDatabase,MissingDatabaseConnectionError} from '@netlify/database';
import {PostgresAdapter} from './postgres-adapter.mjs';
let db;
export function getConfig(){return {...process.env,PH_BUILD_ORIGINS:process.env.PH_BUILD_ORIGINS,ADMIN_USER_IDS:'password-admin',BROWSER_CLOCKING:process.env.BROWSER_CLOCKING??'true',LOCAL_CLOCKING:process.env.NODE_ENV==='development'&&process.env.LOCAL_CLOCKING==='true'}}
export function getDatabase(){
 if(db)return db;
 try{
  // Netlify selects its serverless connector and reads runtime context correctly.
  db=new PostgresAdapter(getNetlifyDatabase().pool);
 }catch(error){
  if(!(error instanceof MissingDatabaseConnectionError))throw error;
  if(!process.env.DATABASE_URL)return null;
  db=new PostgresAdapter(new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:20000}));
 }
 return db;
}
