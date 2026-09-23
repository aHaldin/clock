import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedOrigin} from '../lib/origin.mjs';
const request=(origin,url='http://localhost:3000/api/admin/login',extra={})=>new Request(url,{method:'POST',headers:{...extra,...origin?{origin}:{}}});
test('Netlify public URL is accepted when the function sees an internal URL',()=>{
 assert.equal(isAllowedOrigin(request('https://studio.netlify.app'),{URL:'https://studio.netlify.app/'}),true);
 assert.equal(isAllowedOrigin(request('https://studio.netlify.app'),{URL:'https://clock.example',SITE_NAME:'studio'}),true);
 assert.equal(isAllowedOrigin(request('https://clock.example'),{APP_ORIGIN:'https://clock.example/'}),true);
});
test('exact build-time deploy origins remain available in the function',()=>{
 const config={PH_BUILD_ORIGINS:JSON.stringify(['https://deploy-preview-1--studio.netlify.app','https://abc--studio.netlify.app'])};
 assert.equal(isAllowedOrigin(request('https://deploy-preview-1--studio.netlify.app'),config),true);
 assert.equal(isAllowedOrigin(request('https://deploy-preview-2--studio.netlify.app'),config),false);
});
test('untrusted origins and forged forwarding headers stay rejected',()=>{
 const config={URL:'https://studio.netlify.app',SITE_NAME:'studio',PH_BUILD_ORIGINS:'invalid'};
 for(const origin of [null,'null','https://other.netlify.app','https://studio.netlify.app.attacker.test','http://studio.netlify.app','https://studio.netlify.app:444','https://studio.netlify.app/path'])assert.equal(isAllowedOrigin(request(origin,undefined,{'x-forwarded-host':'attacker.test','x-forwarded-proto':'https'}),config),false);
 assert.equal(isAllowedOrigin(request('https://attacker.test',undefined,{'x-forwarded-host':'attacker.test'}),config),false);
});
test('direct same-origin local requests work without hosting configuration',()=>{
 assert.equal(isAllowedOrigin(request('http://localhost:3000')),true);
 assert.equal(isAllowedOrigin(request('http://localhost:3001')),false);
});
