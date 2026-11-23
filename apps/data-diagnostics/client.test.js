'use strict';
const assert=require('assert'),os=require('os'),path=require('path'),net=require('net'),fs=require('fs');
const client=require('./client');
async function main(){
  const socket=path.join(os.tmpdir(),'bmrmodz-data-app-'+process.pid+'.sock');
  try{fs.unlinkSync(socket);}catch(_){}
  let requests=[];
  const server=net.createServer(conn=>{
    let buffer='';
    conn.on('data',part=>{
      buffer+=part.toString('utf8');
      if(buffer.includes('\n')){
        const req=JSON.parse(buffer.split('\n')[0]);requests.push(req);
        conn.end(JSON.stringify(req.op==='status'?{ok:true,version:'0.1.5'}:{ok:false,error:'Rejected'})+'\n');
      }
    });
  });
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);server.listen(socket);});
  try{
    const result=await client.request({op:'status'},{socket,timeoutMs:1000});
    assert.strictEqual(result.ok,true);
    assert.strictEqual(result.version,'0.1.5');
    assert.strictEqual(requests.length,1);
    assert.deepStrictEqual(requests[0],{op:'status'});
    const invalid=await client.request({op:'control'},{socket,timeoutMs:1000});
    assert.strictEqual(invalid.ok,false);
  }finally{await new Promise(resolve=>server.close(resolve));try{fs.unlinkSync(socket);}catch(_){}}
  await assert.rejects(client.request({op:'status'},{socket,timeoutMs:100}),/ENOENT|ECONNREFUSED/);
  console.log('Data Diagnostics socket client: request/response and offline error passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
