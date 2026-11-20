'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {Equipment}=require('./equipment');
const {decodeVehicleOrder}=require('./vehicle-order');
function encode(codes){
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 const chars=str=>str.split('').forEach(c=>put(c.charCodeAt(0)-32,6));
 put(1,8);chars('1126');chars('G031');chars('0000');chars('0000');chars('0000');
 put(8,4);codes.forEach(chars);put(0,2);while(bits.length%8)bits.push(0);
 const fa=[];for(let i=0;i<bits.length;i+=8)fa.push(parseInt(bits.slice(i,i+8).join(''),2));
 return [0x62,0x3f,0x06,fa.length>>8,fa.length&255].concat(fa);
}
async function run(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bmrmodz-vo-'));
 const cacheFile=path.join(temp,'vehicle-order.json'),response=encode(['6WB','248','494']);
 assert.ok(decodeVehicleOrder(response));
 let reads=0;
 try{
  const initial=new Equipment({ready:true,read:async()=>{reads++;return response;}},{cacheFile});
  assert.strictEqual(initial.check(['6WB']).results['6WB'],'waiting');
  await initial.refresh();
  assert.strictEqual(reads,1);
  assert.strictEqual(initial.check(['6WB']).results['6WB'],true);
  assert.ok(fs.existsSync(cacheFile),'cache persisted');
  const next=new Equipment({ready:true,read:async()=>{reads++;return null;}},{cacheFile});
  assert.strictEqual(next.cached,true);
  assert.strictEqual(next.check(['6WB','4NB']).results['6WB'],true);
  assert.strictEqual(next.check(['4NB']).results['4NB'],false);
  assert.strictEqual(reads,1,'reading cached answers must not contact vehicle');
  await next.refresh();
  assert.strictEqual(reads,2,'explicit refresh contacts gateway once');
  assert.strictEqual(next.check(['6WB']).results['6WB'],true,'failed refresh retains existing equipment');
  fs.writeFileSync(cacheFile,'{"schema":1,"codes":["bad code"],"updatedAt":"2026-11-20T00:00:00.000Z"}');
  const bad=new Equipment({ready:true,read:async()=>null},{cacheFile});
  assert.strictEqual(bad.check(['6WB']).results['6WB'],'waiting','invalid cache must be rejected');
  const isolated=new Equipment({ready:true,read:async()=>response},{cacheFile:null});
  await isolated.refresh();assert.strictEqual(isolated.check(['6WB']).results['6WB'],true);
  assert.strictEqual(JSON.parse(fs.readFileSync(cacheFile,'utf8')).codes[0],'bad code');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log('Persistent Car Equipment cache: saved/loaded, no redundant reads, explicit refresh, invalid data rejected');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
