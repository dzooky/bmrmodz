'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {serve}=require('./service');
const client=require('../../kit/runtime/car-equipment');
function encode(codes){
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 const chars=s=>s.split('').forEach(c=>put(c.charCodeAt(0)-32,6));
 put(1,8);chars('1126');chars('G031');chars('0000');chars('0000');chars('0000');put(8,4);
 codes.forEach(chars);put(0,2);while(bits.length%8)bits.push(0);
 const fa=[];for(let i=0;i<bits.length;i+=8)fa.push(parseInt(bits.slice(i,i+8).join(''),2));
 return [0x62,0x3f,0x06,fa.length>>8,fa.length&255].concat(fa);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'car-equipment-retry-'));
 const socket=path.join(dir,'ctl.sock'),cacheFile=path.join(dir,'cache.json');
 let reads=0,healthy=false;
 const link={ready:true,read:async()=>{reads++;return healthy?encode(['6WB','248']):null;}};
 const instance=serve(link,socket,{cacheFile,shortRetryMs:30,longRetryMs:60});
 try{
   await new Promise((resolve,reject)=>{instance.server.once('listening',resolve);instance.server.once('error',reject);});
   // No application check may wait for the diagnostic read to settle.
   const first=await client.check(['6WB','248'],{socket});
   assert.strictEqual(first.results['6WB'],'waiting');
   assert.strictEqual(first.results['248'],'waiting');
   await sleep(100);
   assert.ok(reads>=2,'failed VO must be retried automatically');
   healthy=true;
   await sleep(120);
   const result=await client.check(['6WB','248','610'],{socket});
   assert.strictEqual(result.results['6WB'],true);
   assert.strictEqual(result.results['248'],true);
   assert.strictEqual(result.results['610'],false);
   assert.ok(fs.existsSync(cacheFile),'successful VO saved');
   const completed=reads;
   await sleep(100);
   assert.strictEqual(reads,completed,'no further reads after success');
 }finally{
   await new Promise(resolve=>{instance.server.once('close',resolve);instance.close();});
   fs.rmSync(dir,{recursive:true,force:true});
 }
 console.log('Car Equipment waiting + automatic retry + persistent cache validated');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
