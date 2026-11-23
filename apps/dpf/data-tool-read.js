'use strict';
// Explicit opt-in DPF transport adapter. The legacy TASU path stays authoritative
// whenever the Data Tool is unavailable or returns an invalid read.
const net=require('net');
const SOCKET='/run/bmrmodz-data-tool/ctl.sock';
function request(ecu,did,options){
 const opts=options||{};
 return new Promise((resolve,reject)=>{
  let settled=false,raw='';
  const socket=net.createConnection(opts.socket||SOCKET);
  const done=(error,value)=>{if(settled)return;settled=true;socket.destroy();error?reject(error):resolve(value);};
  socket.setTimeout(opts.timeoutMs||2200,()=>done(new Error('Data Tool timeout')));
  socket.on('connect',()=>socket.write(JSON.stringify({op:'read',ecu,did})+'\n'));
  socket.on('data',chunk=>{
   raw+=chunk.toString('utf8');
   if(raw.length>8192)return done(new Error('Data Tool reply too large'));
   const end=raw.indexOf('\n');if(end<0)return;
   try{
    const reply=JSON.parse(raw.slice(0,end));
    const uds=reply&&reply.uds;
    if(!reply||reply.ok!==true||reply.ecu!==ecu||reply.did!==did||
      !Array.isArray(uds)||uds.length<3||uds.length>256||
      !uds.every(b=>Number.isInteger(b)&&b>=0&&b<=255)||
      uds[0]!==0x62||uds[1]!==((did>>8)&255)||uds[2]!==(did&255))
      return done(new Error('Invalid Data Tool response'));
    done(null,uds);
   }catch(e){done(e);}
  });
  socket.on('error',done);
  socket.on('end',()=>done(new Error('Data Tool closed connection')));
 });
}
function create(legacy,opts){
 const options=opts||{};
 let successful=0,fallbacks=0;
 const enabled=()=>typeof options.enabled==='function'?options.enabled()===true:options.enabled===true;
 return {
  get counters(){return {successful,fallbacks};},
  async read(ecu,did){
   if(enabled())try{const result=await (options.request||request)(ecu,did,options);successful++;if(options.onSuccess)options.onSuccess(ecu,did);return result;}
   catch(error){fallbacks++;if(options.onFallback)options.onFallback(error);}
   legacy.wake(ecu);
   return legacy.physical(ecu,0x22,[(did>>8)&255,did&255],1800,
     u=>u&&((u[0]===0x62&&u[1]===((did>>8)&255)&&u[2]===(did&255))||(u[0]===0x7f&&u[1]===0x22)),
     options.requestOptions);
  }
 };
}
module.exports={create,request,SOCKET};
