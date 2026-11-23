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
 let transportResults=[];
 const rejected=create(legacy,{enabled:true,
  request:async()=>{const e=new Error('No matching response');throw e;},
  onToolResult:(ecu,did,result)=>transportResults.push({ecu,did,result})
 });
 assert.deepStrictEqual(await rejected.read(0x12,0xF150),[0x62,0x44,0xbb,9]);
 assert.deepStrictEqual(transportResults.pop(),{ecu:0x12,did:0xF150,result:{ok:false,code:'NO_MATCHING_RESPONSE'}});
 const nrcError=new Error('UDS negative response');nrcError.nrc=0x31;
 assert.strictEqual(require('./data-tool-read').errorCode(nrcError),'UDS_NRC_31');
 const disconnected=new Error('connect ENOENT');disconnected.code='ENOENT';
 assert.strictEqual(require('./data-tool-read').errorCode(disconnected),'SOCKET_ENOENT');
 assert.strictEqual(require('./data-tool-read').errorCode(Object.assign(new Error('Data Tool timeout'),{code:'TOOL_TIMEOUT'})),'TOOL_TIMEOUT');
 const toolSuccess=create(legacy,{enabled:true,request:async()=>[0x62,0xF1,0x50,1,2,3],
  onToolResult:(ecu,did,result)=>transportResults.push(result)});
 assert.deepStrictEqual(await toolSuccess.read(0x12,0xF150),[0x62,0xF1,0x50,1,2,3]);
 assert.deepStrictEqual(transportResults.pop(),{ok:true,code:'OK'});
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
   if(raw.includes('\n')){
    requestedOp=JSON.parse(raw.split('\n')[0]).op;
    client.end(JSON.stringify({ok:true,tool:'bmrmodz-data-tool'})+'\n');
   }
  });
 });
 await new Promise(resolve=>server.listen(sock,resolve));
 try{
  assert.strictEqual(await require('./data-tool-read').status({socket:sock}),true);
  assert.strictEqual(requestedOp,'status');
  assert.strictEqual(await require('./data-tool-read').status({socket:sock+'.missing',timeoutMs:200}),false);
 }finally{await new Promise(resolve=>server.close(resolve));try{require('fs').unlinkSync(sock);}catch(e){if(e.code!=='ENOENT')throw e;}}
 // Real socket regression: a read returning after the former 2.2s limit must
 // succeed within the new 15s window without triggering a TASU fallback.
 const slowSock=path.join(os.tmpdir(),'dpf-tool-slow-'+process.pid+'.sock');
 const slowServer=net.createServer(client=>{
  let raw='';
  client.on('data',chunk=>{
   raw+=String(chunk);
   if(raw.includes('\\n')){
    const req=JSON.parse(raw.split('\\n')[0]);
    setTimeout(()=>client.end(JSON.stringify({ok:true,ecu:req.ecu,did:req.did,uds:[0x62,0xF1,0x50,0x0F,0x1F,0xE8]})+'\\n'),2400);
   }
  });
 });
 await new Promise(resolve=>slowServer.listen(slowSock,resolve));
 try{
  const beforeLegacy=legacyCalls;
  const reply=await create(legacy,{enabled:true,socket:slowSock,timeoutMs:15000}).read(0x12,0xF150);
  assert.deepStrictEqual(reply,[0x62,0xF1,0x50,0x0F,0x1F,0xE8]);
  assert.strictEqual(legacyCalls,beforeLegacy,'successful delayed Data Tool reads must not fall back');
 }finally{
  await new Promise(resolve=>slowServer.close(resolve));
  try{require('fs').unlinkSync(slowSock);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 console.log('DPF Data Tool opt-in, success and legacy fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
