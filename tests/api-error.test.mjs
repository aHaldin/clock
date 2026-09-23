import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiError} from '../lib/api-error.mjs';
import {HttpError} from '../lib/security.mjs';
import {loginAdmin} from '../lib/admin-auth.mjs';
test('safe setup messages survive the API error handler',async()=>{
 for(const value of [undefined,'a plain password instead of a hash']){
  let failure;
  try{await loginAdmin({env:{ADMIN_PASSWORD_HASH:value},limit(){throw Error('must not reach database')}},'example')}catch(e){failure=e}
  const response=apiError(failure);assert.equal(response.status,503);assert.match(response.body.error,/ADMIN_PASSWORD_HASH/);
 }
 assert.equal(apiError(new HttpError(401,'Incorrect admin password.')).status,401);
});
test('database diagnostics do not expose SQL or connection secrets',()=>{
 const cases={'42P01':'DATABASE_SCHEMA_MISSING','42703':'DATABASE_SCHEMA_MISSING','28P01':'DATABASE_CONFIG_INVALID','ECONNREFUSED':'DATABASE_UNREACHABLE','unknown':'SERVICE_UNAVAILABLE'};
 for(const [code,expected] of Object.entries(cases)){
  const response=apiError(Object.assign(Error('secret connection URL and SQL values'),{code}));
  assert.equal(response.body.code,expected);assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(response),/secret connection/);
 }
});
