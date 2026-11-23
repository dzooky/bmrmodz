'use strict';
const assert=require('assert');
const {create}=require('./data-tool-read');
(async()=>{
 let legacyCalls=0,toolCalls=0;
 const legacy={wake(){},async physical(){legacyCalls++;return [0x62,0x44,0xbb,9];}};
 const disabled=create(legacy,{enabled:false,request:async()=>{toolCalls++;return [0x62,0x44,0xbb,4];}});
 assert.deepStrictEqual(await disabled.read(0x12,0x44bb),[0x62,0x44,0xbb,9]);
 assert.strictEqual(toolCalls,0);
 const enabled=create(legacy,{enabled:true,request:async()=>{toolCalls++;return [0x62,0x44,0xbb,4];}});
 assert.deepStrictEqual(await enabled.read(0x12,0x44bb),[0x62,0x44,0xbb,4]);
 assert.strictEqual(enabled.counters.successful,1);
 assert.strictEqual(legacyCalls,1);
 const failed=create(legacy,{enabled:true,request:async()=>{throw new Error('Unavailable');}});
 assert.deepStrictEqual(await failed.read(0x12,0x44bb),[0x62,0x44,0xbb,9]);
 assert.strictEqual(failed.counters.fallbacks,1);
 assert.strictEqual(legacyCalls,2);
 console.log('DPF Data Tool opt-in, success and legacy fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
