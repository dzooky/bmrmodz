'use strict';
// Experimental read-only Data Tool. No vehicle requests at boot or from status.
// Every read requires a specifically allowed ECU/DID. Responses are not
// presented as verified until vehicle testing confirms them.
const fs=require('fs'), net=require('net'), path=require('path');
const {READS,getRead}=require('./profiles');
const signalEnvironment=require('./signal-environment');
const SOCKET=process.env.BMRMODZ_DATA_SOCKET||'/run/bmrmodz-data-tool/ctl.sock';
const GAP_MS=200, CACHE_MS=500;
function serve(factory,socketPath){
  const socket=socketPath||SOCKET;
  let transport=null,queue=Promise.resolve(),lastRequest=0;
  const inflight=new Map(),cache=new Map();
  const stats={sent:0,ok:0,timeout:0,error:0,coalesced:0,cacheHits:0};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function read(ecu,did){
    const group=getRead(ecu,did);
    if(!group)return Promise.resolve({ok:false,error:'ECU/DID not allowlisted'});
    const key=ecu+':'+did;
    const cached=cache.get(key);
    if(cached&&Date.now()-cached.at<CACHE_MS){stats.cacheHits++;return Promise.resolve(Object.assign({cached:true},cached.reply));}
    if(inflight.has(key)){stats.coalesced++;return inflight.get(key);}
    const request=queue.then(async()=>{
      const remaining=lastRequest+GAP_MS-Date.now();
      if(remaining>0)await sleep(remaining);
      lastRequest=Date.now();
      stats.sent++;
      try {
        if(!transport)transport=factory();
        const reply=await transport.read(ecu,did);
        if(!reply){stats.timeout++;return {ok:false,error:'No matching response',ecu,did};}
        if(reply[0]===0x7f){stats.error++;return {ok:false,error:'UDS negative response',ecu,did,nrc:reply[2]};}
        if(reply[0]!==0x62||reply[1]!==did>>8||reply[2]!==(did&255)){stats.error++;return {ok:false,error:'Unexpected response',ecu,did};}
        stats.ok++;
        const result={ok:true,ecu,did,group,uds:reply,at:new Date().toISOString()};
        cache.set(key,{at:Date.now(),reply:result});
        return result;
      }catch(e){stats.error++;return {ok:false,ecu,did,error:String(e&&e.message||e)};}
    });
    queue=request.then(()=>{},()=>{});
    inflight.set(key,request);
    request.then(()=>inflight.delete(key),()=>inflight.delete(key));
    return request;
  }
  const capabilities=()=>({
    uds:{mode:'read-only-experimental',reads:READS,controls:'not implemented'},
    signals:{mode:'passive-environment-probe',reason:'Native subscription requires separate on-car verification'},
    background:{mode:'on-demand-only',reason:'No unattended ECU polling in feasibility build'}
  });
  try{fs.mkdirSync(path.dirname(socket),{recursive:true});}catch(e){if(e.code!=='EEXIST')throw e;}
  try{fs.unlinkSync(socket);}catch(e){if(e.code!=='ENOENT')throw e;}
  const server=net.createServer(client=>{
    client.setEncoding('utf8');let buffer='',lines=0;
    client.on('data',async chunk=>{
      buffer+=chunk;
      if(buffer.length>8192){client.destroy();return;}
      let n;while((n=buffer.indexOf('\n'))>=0){
        if(++lines>100){client.destroy();return;}
        const raw=buffer.slice(0,n);buffer=buffer.slice(n+1);let req,reply;
        try{
          req=JSON.parse(raw);
          if(!req||typeof req!=='object')throw new Error('Invalid request');
          if(req.op==='status')reply={ok:true,tool:'bmrmodz-data-tool',version:'0.1.1',transportReady:!!(transport&&transport.ready),stats,capabilities:capabilities()};
          else if(req.op==='capabilities')reply={ok:true,capabilities:capabilities()};
          else if(req.op==='signalEnvironment')reply=signalEnvironment.inspect();
          else if(req.op==='read'&&Number.isInteger(req.ecu)&&Number.isInteger(req.did))reply=await read(req.ecu,req.did);
          else reply={ok:false,error:'Unsupported request'};
        }catch(e){reply={ok:false,error:String(e.message||e)};}
        if(!client.destroyed)client.write(JSON.stringify(reply)+'\n');
      }
    });
  });
  server.listen(socket,()=>fs.chmodSync(socket,0o666));
  function close(){server.close();if(transport&&transport.close)transport.close();try{fs.unlinkSync(socket);}catch(_){}}
  return {server,read,close,stats};
}
if(require.main===module){
  const instance=serve(()=>require('./transport').createTransport());
  process.on('SIGTERM',()=>{instance.close();process.exit(0);});
  process.on('SIGINT',()=>{instance.close();process.exit(0);});
}
module.exports={serve};
