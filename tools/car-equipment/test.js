'use strict';
const assert=require('assert');
const path=require('path'),os=require('os');
const client=require('../../kit/runtime/car-equipment');
const {serve}=require('./service');
const {Equipment,normalize}=require('./equipment');
const {decodeVehicleOrder}=require('./vehicle-order');
const {parseResponse,REQUEST,SUB}=require('./transport');
function encode(codes){
 const bits=[];const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 const chars=str=>str.split('').forEach(c=>put(c.charCodeAt(0)-32,6));
 put(1,8);chars('1126');chars('G031');chars('0000');chars('0000');chars('0000');
 // Confirm date 1126, series G031; 8-bit version + 5 x 24-bit fields = 128 bits.
 put(8,4);
 codes.forEach(code=>chars(code));
 put(0,2);while(bits.length%8)bits.push(0);
 const fa=[];for(let i=0;i<bits.length;i+=8)fa.push(parseInt(bits.slice(i,i+8).join(''),2));
 const l=fa.length;return [0x62,0x3f,0x06,l>>8,l&255].concat(fa);
}
function frame(uds){
 const n=9+uds.length;const bytes=[0xf0,0xf2,0x71,1,15,11,0x10,0,uds.length].concat(uds);
 assert.strictEqual(n,bytes.length);
 return n.toString(16).padStart(8,'0')+Buffer.from(bytes).toString('hex')+'00000000';
}
async function run(){
 assert.strictEqual(normalize('hud'),'610');assert.strictEqual(normalize('6wb'),'6WB');
 assert.strictEqual(normalize('bad-code'),null);
 assert.strictEqual(decodeVehicleOrder([0x62,0x3f,0x06,0,1,0]),null);
 const response=encode(['610','6WB','6U3','494']);
 const decoded=decodeVehicleOrder(response);
 assert.ok(decoded,'valid FA must parse');
 assert.deepStrictEqual(Array.from(decoded).sort(),['494','610','6U3','6WB'].sort());
 assert.strictEqual(parseResponse(frame(response)).uds[0],0x62);
 assert.strictEqual(parseResponse(frame([0x7f,0x22,0x78])).pending,true);
 assert.strictEqual(parseResponse(frame([0x7f,0x22,0x31])).uds[2],0x31);
 assert.ok(REQUEST.indexOf('f21022000002000000023f0600')>=0);
 assert.ok(SUB.indexOf('0xf8a6')>=0);
 const equipment=new Equipment({ready:true,read:async()=>response});
 assert.strictEqual(equipment.check(['610']).results['610'],'waiting');
 await equipment.refresh();
 assert.strictEqual(equipment.check(['610','6U3']).results['610'],true);
 assert.strictEqual(equipment.check(['494','6WB']).results['6WB'],true);
 assert.strictEqual(equipment.check(['5AZ']).results['5AZ'],false);
 const fail=new Equipment({ready:true,read:async()=>null});
 await fail.refresh();assert.strictEqual(fail.check(['610']).results['610'],'waiting');
 assert.ok(fail.error);
 const sock=path.join(os.tmpdir(),'car-equipment-test-'+process.pid+'.sock');
 const instance=serve({ready:true,read:async()=>response},sock,{cacheFile:null});
 await new Promise((resolve,reject)=>{instance.server.once('listening',resolve);instance.server.once('error',reject);});
 try{
   const checked=await client.check(['hud','6WB','5AZ'],{socket:sock});
   assert.strictEqual(checked.results.hud,true);
   assert.strictEqual(checked.results['6WB'],true);
   assert.strictEqual(checked.results['5AZ'],false);
   assert.strictEqual(await client.has('610',{socket:sock}),true);
 }finally{instance.close();}
 console.log('Car Equipment: VO decoder, TASU parser, Unix socket and app client tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
