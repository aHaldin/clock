import {HttpError} from './security.mjs';
// Never expose raw database errors: they can contain SQL, credentials or row data.
export function apiError(error){
 if(error instanceof HttpError)return {status:error.status,body:{error:error.message}};
 const code=typeof error?.code==='string'?error.code:'';
 if(['42P01','42703'].includes(code))return {status:503,body:{error:'Database setup is incomplete. The Netlify database migrations must finish before sign-in can work.',code:'DATABASE_SCHEMA_MISSING'}};
 if(['28P01','28000','3D000'].includes(code))return {status:503,body:{error:'The database connection settings are invalid. Check the database connection in Netlify and redeploy.',code:'DATABASE_CONFIG_INVALID'}};
 if(code.startsWith('08')||['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(code))return {status:503,body:{error:'The server cannot connect to the database. Check Netlify Database availability and connection settings.',code:'DATABASE_UNREACHABLE'}};
 return {status:503,body:{error:'Service unavailable. No success is confirmed. Please reconnect and check your status.',code:'SERVICE_UNAVAILABLE'}};
}
