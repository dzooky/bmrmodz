'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {serve,deferredLink}=require('./service');
const client=require('../../kit/runtime/car-equipment');
const {DEFAULT_CACHE}=require('./equipment');
function encode(codes){
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 const chars=s=>s.split('').forEach(c=>put(c.charCodeAt(0)-32,6));
 put(1,8);chars('1126');chars('G031');chars('0000');chars('0000');chars('0000');put(8,4);
 codes.forEach(chars);put(0,2);while(bits.length%8)bits.push(0);
 const fa=[];for(let i=0;i<bits.length;i+=8)fa.push(parseInt(bits.slice(i,i+8).join(''),2));
 return [0x62,0x3f,0x06,fa.length>>8,fa.length&255].concat(fa);
}
async function run(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mgu-health-'));
 const socket=path.join(dir,'ctl.sock'),cacheFile=path.join(dir,'cache.json');
 let attempts=0,reads=0,available=false;
 const link=deferredLink(()=>{
   attempts++;
   if(!available)throw new Error('Compatible hmictl missing');
   return {ready:true,read:async()=>{reads++;return encode(['248','6WB']);}};
 });
 const instance=serve(link,socket,{cacheFile});
 try{
   await new Promise((resolve,reject)=>{instance.server.once('listening',resolve);instance.server.once('error',reject);});
   if(instance.equipment.pending)await instance.equipment.pending;
   assert.strictEqual(instance.server.listening,true,'service must survive missing helper');
   assert.strictEqual(attempts,1,'one initial helper attempt');
   let result=await client.check(['248'],{socket});
   assert.strictEqual(result.results['248'],'waiting');
   for(let i=0;i<10;i++)await client.check(['248'],{socket});
   assert.strictEqual(attempts,1,'ordinary checks must not retry');
   available=true;
   const reloaded=await client.request({op:'reload'},{socket});
   assert.strictEqual(reloaded.available,true);
   assert.strictEqual(reads,1);
   result=await client.check(['248'],{socket});
   assert.strictEqual(result.results['248'],true);
   assert.ok(fs.existsSync(cacheFile),'cache must persist');
   assert.strictEqual(DEFAULT_CACHE,'/var/opt/bmrmodz-car-equipment/equipment.json');
 }finally{
   await new Promise(resolve=>instance.server.close(resolve));
   fs.rmSync(dir,{recursive:true,force:true});
 }
 console.log('MGU service healthy without hmictl, cached mode and user reload validated');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
