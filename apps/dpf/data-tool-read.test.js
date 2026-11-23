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
 let lastLegacy=null;
 const observed=create(legacy,{enabled:false,onLegacyResult:(ecu,did,reply)=>{lastLegacy={ecu,did,reply};}});
 await observed.read(0x12,0x44bb);
 assert.deepStrictEqual(lastLegacy,{ecu:0x12,did:0x44bb,reply:[0x62,0x44,0xbb,9]});
 // A status probe is passive; it must not issue an ECU read.
 const net=require('net'),os=require('os'),path=require('path');
 const sock=path.join(os.tmpdir(),'dpf-tool-status-'+process.pid+'.sock');
 let requestedOp=null;
 const server=net.createServer(client=>{
  let raw='';
  client.on('data',chunk=>{
   raw+=String(chunk);
   if(raw.includes('\\n')){
    requestedOp=JSON.parse(raw.split('\\n')[0]).op;
    client.end(JSON.stringify({ok:true,tool:'bmrmodz-data-tool'})+'\\n');
   }
  });
 });
 await new Promise(resolve=>server.listen(sock,resolve));
 try{
  assert.strictEqual(await require('./data-tool-read').status({socket:sock}),true);
  assert.strictEqual(requestedOp,'status');
  assert.strictEqual(await require('./data-tool-read').status({socket:sock+'.missing',timeoutMs:200}),false);
 }finally{await new Promise(resolve=>server.close(resolve));require('fs').unlinkSync(sock);}
 console.log('DPF Data Tool opt-in, success and legacy fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
