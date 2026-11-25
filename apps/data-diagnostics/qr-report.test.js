'use strict';
const assert=require('assert');
const {create,payload}=require('./qr-report');
const report={schema:1,finishedAt:'2026-11-22T22:00:00.000Z',
 results:Array.from({length:11},(_,i)=>({id:'test'+i,status:i%2?'FAIL':'PASS',
 detail:'Missing tool config or network permissions; code=0x22'}))};
const text=payload(report);
assert.ok(text.startsWith('BMRMODZ-DATA/1;'));
assert.strictEqual(text.includes('"uds"'),false);
const qr=create(report);
assert.ok(qr.getModuleCount()>20);
assert.ok(qr.getModuleCount()<150);
assert.strictEqual(typeof qr.isDark(0,0),'boolean');
assert.throws(()=>create({schema:2,results:[]}));
console.log('Data Diagnostics: report payload and offline QR encoding passed');
