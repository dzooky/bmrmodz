'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {serve}=require('./service');
const client=require('../../kit/runtime/car-equipment');
function encode(codes) {
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 const chars=s=>s.split('').forEach(c=>put(c.charCodeAt(0)-32,6));
 put(1,8);chars('1126');chars('G031');chars('0000');chars('0000');chars('0000');put(8,4);
 codes.forEach(chars);put(0,2);while(bits.length%8)bits.push(0);
 const fa=[];for(let i=0;i<bits.length;i+=8)fa.push(parseInt(bits.slice(i,i+8).join(''),2));
 return [0x62,0x3f,0x06,fa.length>>8,fa.length&255].concat(fa);
}
async function run(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'car-equipment-once-'));
 const socket=path.join(dir,'service.sock'),cacheFile=path.join(dir,'equipment.json');
 let reads=0,working=false;
 const response=encode(['248','6WB']);
 const link={ready:true,read:async()=>{reads++;return working?response:null;}};
 let instance;
 async function start(){
   instance=serve(link,socket,{cacheFile});
   await new Promise((resolve,reject)=>{instance.server.once('listening',resolve);instance.server.once('error',reject);});
   if(instance.equipment.pending) await instance.equipment.pending;
 }
 async function stop(){
   await new Promise(resolve=>instance.server.close(resolve));
   // serve closes socket path in its SIG handler, but the test closes server without signal.
   try{fs.unlinkSync(socket);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 try{
   await start();
   assert.strictEqual(reads,1,'one initial read when no cache');
   for(let i=0;i<30;i++){
     const result=await client.check(['248','6WB'],{socket});
     assert.strictEqual(result.results['248'],'waiting');
   }
   assert.strictEqual(reads,1,'checks do not trigger immediate retries');
   working=true;
   for(let i=0;i<10;i++)await client.check(['248'],{socket});
   assert.strictEqual(reads,1,'checks do not trigger immediate reads');
   let reply=await client.request({op:'reload'},{socket});
   assert.strictEqual(reply.available,true);
   assert.strictEqual(reads,2,'explicit reload reads gateway once');
   for(let i=0;i<30;i++){
     const result=await client.check(['248','6WB'],{socket});
     assert.strictEqual(result.results['248'],true);
     assert.strictEqual(result.results['6WB'],true);
   }
   assert.strictEqual(reads,2,'cached checks do not read gateway');
   await stop();await start();
   assert.strictEqual(reads,2,'restart loads saved cache without read');
   reply=await client.request({op:'refresh'},{socket});
   assert.strictEqual(reply.available,true);
   assert.strictEqual(reads,3,'legacy refresh remains explicit reload alias');
   await stop();instance=null;
 }finally{
   if(instance)await stop();
   fs.rmSync(dir,{recursive:true,force:true});
 }
 console.log('One-shot Car Equipment: no premature rechecks, manual reload, legacy refresh, restart cache OK');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
