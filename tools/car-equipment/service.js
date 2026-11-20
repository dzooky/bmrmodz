'use strict';
// Car Equipment - read-only local Unix socket API for BMRMODZ apps.
// Link provider must expose Climate Comfort-compatible init()/ready/read(0x10,0x3F06,3000).
const fs=require('fs'),net=require('net'),path=require('path');
const {Equipment}=require('./equipment');
const SOCKET=process.env.CAR_EQUIPMENT_SOCKET||'/run/bmrmodz-car-equipment/ctl.sock';
function serve(link,socketPath,options) {
  const equipment=new Equipment(link,options);
  const target=socketPath||SOCKET;
  try { fs.mkdirSync(path.dirname(target)); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  try { fs.unlinkSync(target); } catch(e) {if(e.code!=='ENOENT')throw e;}
  const server=net.createServer(c=>{
    c.setEncoding('utf8');let buffer='';
    c.on('data',async chunk=>{
      buffer+=chunk;if(buffer.length>16384){c.destroy();return;}
      let n;while((n=buffer.indexOf('\n'))!==-1){
        const line=buffer.slice(0,n);buffer=buffer.slice(n+1);let req;
        try{req=JSON.parse(line);}catch(e){c.write(JSON.stringify({ok:false,error:'Invalid JSON'})+'\n');continue;}
        try {
          let reply;
          if(req.op==='get'||req.op==='status')reply=Object.assign({ok:true},equipment.summary());
          else if(req.op==='check'){
            // Check is cache-only. Never cause another gateway read.
            // The only automatic read occurs once on an uncached service startup.
            if(equipment.pending)await equipment.pending;
            reply=equipment.check(req.codes);
          }
          else if(req.op==='reload'||req.op==='refresh'){
            // Explicit user action only. Keep refresh as an alias for existing apps.
            const result=await equipment.refresh();
            reply=Object.assign({ok:true},result);
          }
          else reply={ok:false,error:'Unsupported operation'};
          if(!c.destroyed)c.write(JSON.stringify(reply)+'\n');
        }catch(e){if(!c.destroyed)c.write(JSON.stringify({ok:false,error:String(e.message||e)})+'\n');}
      }
    });
  });
  server.listen(target,()=>{
    fs.chmodSync(target,0o666);
    // Single initial gateway read only when cache is missing. Never retry on checks.
    if(!equipment.codes)equipment.refresh().catch(console.error);
  });
  function close(){server.close();try{fs.unlinkSync(target);}catch(e){}}
  process.on('SIGTERM',close);process.on('SIGINT',close);
  return {server,equipment,close};
}
// Explicit provider boundary: do not fake VO detection if HU diagnostic transport is missing.
if(require.main===module){
  let provider;
  try{provider=require('./transport').createLink();}catch(e){console.error('Car Equipment transport unavailable:',e.message);process.exit(1);}
  serve(provider);
}
module.exports={serve};
