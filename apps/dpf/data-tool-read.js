'use strict';
// Explicit opt-in DPF transport adapter. The legacy TASU path stays authoritative
// whenever the Data Tool is unavailable or returns an invalid read.
const net=require('net');
const SOCKET='/run/bmrmodz-data-tool/ctl.sock';
// Stable diagnostic codes are technical identifiers, not locale-dependent UI text.
function errorCode(error){
 const code=String(error&&error.code||'');
 if(code==='TOOL_TIMEOUT')return 'TOOL_TIMEOUT';
 if(code==='INVALID_RESPONSE')return 'INVALID_RESPONSE';
 if(code==='ECONNREFUSED'||code==='ENOENT'||code==='EACCES')return 'SOCKET_'+code;
 const message=String(error&&error.message||error||'');
 if(message.includes('No matching response'))return 'NO_MATCHING_RESPONSE';
 if(message.includes('UDS negative response'))return 'UDS_NRC_'+(Number.isInteger(error&&error.nrc)?error.nrc.toString(16).toUpperCase().padStart(2,'0'):'UNKNOWN');
 if(message.includes('ECU/DID not allowlisted'))return 'NOT_ALLOWLISTED';
 if(message.includes('TASU rejected request'))return 'TASU_REJECTED';
 if(message.includes('Transport or TASU command error'))return 'TRANSPORT_ERROR';
 if(message.includes('Unexpected response'))return 'UNEXPECTED_RESPONSE';
 if(message.includes('Data Tool closed connection'))return 'SOCKET_CLOSED';
 return 'TOOL_ERROR';
}
function request(ecu,did,options){
 const opts=options||{};
 return new Promise((resolve,reject)=>{
  let settled=false,raw='';
  const socket=net.createConnection(opts.socket||SOCKET);
  const done=(error,value)=>{if(settled)return;settled=true;socket.destroy();error?reject(error):resolve(value);};
  socket.setTimeout(opts.timeoutMs||2200,()=>{const e=new Error('Data Tool timeout');e.code='TOOL_TIMEOUT';done(e);});
  socket.on('connect',()=>socket.write(JSON.stringify({op:'read',ecu,did})+'\n'));
  socket.on('data',chunk=>{
   raw+=chunk.toString('utf8');
   if(raw.length>8192)return done(new Error('Data Tool reply too large'));
   const end=raw.indexOf('\n');if(end<0)return;
   try{
    const reply=JSON.parse(raw.slice(0,end));
    const uds=reply&&reply.uds;
    if(reply&&reply.ok===false){
      const e=new Error(String(reply.error||'Data Tool rejected read').slice(0,120));
      if(Number.isInteger(reply.nrc))e.nrc=reply.nrc;
      return done(e);
    }
    if(!reply||reply.ok!==true||reply.ecu!==ecu||reply.did!==did||
      !Array.isArray(uds)||uds.length<3||uds.length>256||
      !uds.every(b=>Number.isInteger(b)&&b>=0&&b<=255)||
      uds[0]!==0x62||uds[1]!==((did>>8)&255)||uds[2]!==(did&255))
      {const e=new Error('Invalid Data Tool response');e.code='INVALID_RESPONSE';return done(e);}
    done(null,uds);
   }catch(e){done(e);}
  });
  socket.on('error',done);
  socket.on('end',()=>done(new Error('Data Tool closed connection')));
 });
}
function status(options){
 const opts=options||{};
 return new Promise(resolve=>{
  let finished=false,raw='';
  const socket=net.createConnection(opts.socket||SOCKET);
  const done=value=>{if(finished)return;finished=true;socket.destroy();resolve(value);};
  socket.setTimeout(opts.timeoutMs||1200,()=>done(false));
  socket.on('connect',()=>socket.write(JSON.stringify({op:'status'})+'\n'));
  socket.on('data',chunk=>{
   raw+=chunk.toString('utf8');
   if(raw.length>8192)return done(false);
   const end=raw.indexOf('\n');
   if(end<0)return;
   try{const reply=JSON.parse(raw.slice(0,end));done(!!(reply&&reply.ok===true&&reply.tool==='bmrmodz-data-tool'));}catch(_){done(false);}
  });
  socket.on('error',()=>done(false));
  socket.on('end',()=>done(false));
 });
}
// One bounded F150 recovery mirrors the successful diagnostics sequence:
// DDE 44BB -> settle -> DDE F150, only after a TASU-layer rejection.
// Never retry unrelated failures or add reads during a successful first attempt.
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function create(legacy,opts){
 const options=opts||{};
 let successful=0,fallbacks=0;
 const enabled=()=>typeof options.enabled==='function'?options.enabled()===true:options.enabled===true;
 return {
  get counters(){return {successful,fallbacks};},
  async read(ecu,did){
   if(enabled()){
    const toolRequest=options.request||request;
    let result,toolError;
    try{result=await toolRequest(ecu,did,options);}
    catch(error){toolError=error;}
    if(toolError&&ecu===0x12&&did===0xF150&&errorCode(toolError)==='TASU_REJECTED'){
      if(options.onRecovery)options.onRecovery('Retrying');
      // Warm-up is diagnostic-only. A rejection here does not bypass the
      // original bounded F150 retry, and never triggers a separate fallback.
      try{await toolRequest(ecu,0x44BB,options);}catch(_){}
      await (options.delay||delay)(1000);
      try{
        result=await toolRequest(ecu,did,options);
        toolError=null;
        if(options.onRecovery)options.onRecovery('Recovered');
      }catch(error){
        toolError=error;
        if(options.onRecovery)options.onRecovery('Failed');
      }
    }
    if(!toolError){
      successful++;
      if(options.onToolResult)options.onToolResult(ecu,did,{ok:true,code:'OK'});
      if(options.onSuccess)options.onSuccess(ecu,did);
      return result;
    }
    fallbacks++;
    if(options.onToolResult)options.onToolResult(ecu,did,{ok:false,code:errorCode(toolError)});
    if(options.onFallback)options.onFallback(toolError);
   }
   legacy.wake(ecu);
   const legacyReply=await legacy.physical(ecu,0x22,[(did>>8)&255,did&255],1800,
     u=>u&&((u[0]===0x62&&u[1]===((did>>8)&255)&&u[2]===(did&255))||(u[0]===0x7f&&u[1]===0x22)),
     options.requestOptions);
   if(options.onLegacyResult)options.onLegacyResult(ecu,did,legacyReply);
   return legacyReply;
  }
 };
}
module.exports={create,request,status,errorCode,SOCKET};
