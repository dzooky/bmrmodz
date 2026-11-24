'use strict';
const assert=require('assert'),os=require('os'),path=require('path'),net=require('net');
const {serve}=require('./service'),{getRead}=require('./profiles'),{command,decode}=require('./transport');
function call(socket,request){
  return new Promise((resolve,reject)=>{
    const conn=net.createConnection(socket);let buffer='';
    conn.on('connect',()=>conn.write(JSON.stringify(request)+'\n'));
    conn.on('data',chunk=>{buffer+=chunk.toString();if(buffer.includes('\n')){conn.end();try{resolve(JSON.parse(buffer.split('\n')[0]));}catch(e){reject(e);}}});
    conn.on('error',reject);
  });
}
async function run(){
 assert.strictEqual(getRead(0x12,0x44BB),'dde');
 assert.strictEqual(getRead(0x40,0xD074),'bdc');
 assert.strictEqual(getRead(0x12,0x2E00),null);
 assert.ok(command(0x10,0x3f06).endsWith('f21022000002000000023f0600'));
 const uds=[0x62,0x44,0xbb,0x05],frame=[0xf0,0xf2,0x71,1,15,11,0x12,0,uds.length].concat(uds);
 const hex=frame.length.toString(16).padStart(8,'0')+Buffer.from(frame).toString('hex');
 assert.deepStrictEqual(decode(hex).uds,uds);
 let sent=0,opened=0,closed=0;
 const mockFactory=()=>{opened++;return {ready:true,async read(ecu,did){sent++;await new Promise(r=>setTimeout(r,30));if(did===0xF150)throw new Error('TASU rejected request TASU status 0x25');return [0x62,did>>8,did&255,0x05];},close(){closed++;}};};
 const socket=path.join(os.tmpdir(),'bmrmodz-data-test-'+process.pid+'.sock');
 let signalTests=0;
 const svc=serve(mockFactory,socket,{signalRunner:{run:async(mode,field)=>{signalTests++;return {ok:true,mode,field,isolated:true};}}});
 await new Promise((r,j)=>{svc.server.once('listening',r);svc.server.once('error',j);});
 try{
   const status=await call(socket,{op:'status'});
   assert.strictEqual(status.version,'0.1.9');
   assert.strictEqual(status.capabilities.security.socketMode,'0666');
   assert.strictEqual(status.capabilities.security.clientIdentityVerified,false);
   assert.strictEqual(status.capabilities.security.appAuthorizationEnforced,false);
   assert.strictEqual(status.capabilities.security.productionReady,false);
   assert.strictEqual(status.ok,true);assert.strictEqual(status.stats.sent,0);
   assert.strictEqual(status.capabilities.signals.mode,'isolated-on-demand-probe');
   const passive=await call(socket,{op:'signalEnvironment'});
   assert.strictEqual(passive.ok,true);
   assert.strictEqual(passive.mode,'passive-only');
   assert.ok(passive.limitations.includes('No SOME/IP subscription was attempted'));
   assert.strictEqual(sent,0);
   const native=await call(socket,{op:'signalNative',mode:'load'});
   assert.strictEqual(native.ok,true);
   assert.strictEqual(native.isolated,true);
   assert.strictEqual(signalTests,1);
   assert.strictEqual(sent,0);
   const report=await call(socket,{op:'report'});
   assert.strictEqual(report.reportVersion,1);
   assert.strictEqual(report.checks.udsVehicleVerified,false);
   assert.strictEqual(sent,0);
   const cc=await call(socket,{op:'ccPlan'});
   assert.strictEqual(cc.controlsEnabled,false);
   assert.strictEqual(cc.operations.wheelHeat.sid,0x2e);
   assert.strictEqual(sent,0);
   const attempt=await call(socket,{op:'control',ecu:0x40,sid:0x2e,data:[0xd0,0x74,30]});
   assert.strictEqual(attempt.ok,false);
   assert.strictEqual(sent,0);
   const rejected=await call(socket,{op:'read',ecu:0x40,did:0x2E00});
   assert.strictEqual(rejected.ok,false);assert.strictEqual(sent,0);
   const [a,b]=await Promise.all([call(socket,{op:'read',ecu:0x12,did:0x44BB}),call(socket,{op:'read',ecu:0x12,did:0x44BB})]);
   assert.strictEqual(a.ok,true);assert.strictEqual(b.ok,true);assert.strictEqual(sent,1);
   assert.strictEqual((await call(socket,{op:'read',ecu:0x12,did:0x44BB})).cached,true);
   assert.strictEqual(sent,1);
   assert.strictEqual(opened,1);assert.strictEqual(closed,1);
   await new Promise(r=>setTimeout(r,550));
   const next=await call(socket,{op:'read',ecu:0x18,did:0x6000});
   assert.strictEqual(next.ok,true);
   assert.strictEqual(opened,2);assert.strictEqual(closed,2);
   assert.strictEqual((await call(socket,{op:'status'})).transportReady,false);
   const failed=await call(socket,{op:'read',ecu:0x12,did:0xF150});
   assert.strictEqual(failed.ok,false);
   assert.match(failed.error,/TASU status 0x25/);
   assert.strictEqual(opened,3);assert.strictEqual(closed,3);
   assert.strictEqual((await call(socket,{op:'status'})).transportReady,false);
 }finally{svc.close();}
 // Enforced test mode must fail closed when no trusted kernel-backed adapter is present.
 const secureSocket=path.join(os.tmpdir(),'bmrmodz-data-secure-'+process.pid+'.sock');
 const secure=serve(mockFactory,secureSocket,{authorizationEnabled:true,allowedApps:['data-diagnostics'],signalRunner:{run:async()=>({ok:true})}});
 await new Promise((r,j)=>{secure.server.once('listening',r);secure.server.once('error',j);});
 try{
  assert.strictEqual((await call(secureSocket,{op:'status'})).capabilities.security.appAuthorizationEnforced,true);
  assert.strictEqual((await call(secureSocket,{op:'read',ecu:0x12,did:0x44BB})).error,'Access denied');
  assert.strictEqual((await call(secureSocket,{op:'signalNative',mode:'load'})).error,'Access denied');
 }finally{secure.close();}

 console.log('Data Tool: allowlist, framing, socket, on-demand, coalescing and cache tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
