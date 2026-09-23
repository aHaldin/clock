import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestLocation} from '../lib/location.mjs';
test('location captures only requested coordinates and requests a fresh fix',async()=>{
 const capturedAt=Date.now();let options;
 const result=await requestLocation({getCurrentPosition(ok,no,opts){options=opts;ok({coords:{latitude:51,longitude:0,accuracy:20},timestamp:capturedAt});}});
 assert.deepEqual(result,{latitude:51,longitude:0,accuracy:20,capturedAt});assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);
});
test('denied, unavailable, unsupported and stalled location requests fail clearly',async()=>{
 await assert.rejects(requestLocation(null),/unavailable/);
 for(const [code,message] of [[1,/permission is required/],[2,/could not be found/],[3,/timed out/]])await assert.rejects(requestLocation({getCurrentPosition(ok,no){no({code})}}),message);
 await assert.rejects(requestLocation({getCurrentPosition(){}},5),/timed out/);
});
