'use strict';
/**
 * BMRMODZ shared Car Equipment client, available from packaged apps as
 * require('./kit/car-equipment').
 * Vehicle Order only; do not confuse an equipment bit with renderer support.
 */
const net=require('net');
const SOCKET='/run/bmrmodz-car-equipment/ctl.sock';
function request(payload,options){
  options=options||{};const location=options.socket||SOCKET,timeout=options.timeout||6000;
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(location),data=JSON.stringify(payload)+'\n';
    let reply='',completed=false;
    function finish(error,value){
      if(completed)return;completed=true;socket.destroy();
      if(error)reject(error);else resolve(value);
    }
    socket.setTimeout(timeout);
    socket.on('connect',()=>socket.write(data));
    socket.on('timeout',()=>finish(new Error('Car Equipment timeout')));
    socket.on('error',finish);
    socket.on('data',chunk=>{
      reply+=chunk.toString('utf8');
      if(reply.length>65536)return finish(new Error('Car Equipment oversized reply'));
      const end=reply.indexOf('\n');if(end<0)return;
      try{finish(null,JSON.parse(reply.slice(0,end)));}catch(e){finish(e);}
    });
    socket.on('end',()=>finish(new Error('Car Equipment closed without reply')));
  });
}
async function check(codes,options){
  const names=Array.isArray(codes)?codes:[codes];
  try{
    const answer=await request({op:'check',codes:names},options);
    if(!answer||!answer.ok||!answer.results)throw new Error(answer&&answer.error||'Invalid response');
    return answer;
  }catch(e){
    const results={};names.forEach(code=>{results[code]='unknown';});
    return {ok:false,results,source:'vehicle_order',updatedAt:null,error:String(e.message||e)};
  }
}
async function has(code,options){
  const result=await check([code],options);
  return result.results[code];  // true | false | 'unknown'
}
module.exports={check,has,request,SOCKET};
