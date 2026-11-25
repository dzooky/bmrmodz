'use strict';
// Tool-only local client. Never contacts TASU, CDS or any ECU directly.
const net=require('net');
const SOCKET='/run/bmrmodz-data-tool/ctl.sock';
function request(payload,opts){
  const options=opts||{}, timeout=options.timeoutMs||12000;
  return new Promise((resolve,reject)=>{
    let ended=false,raw='';
    const client=net.createConnection(options.socket||SOCKET);
    const done=(error,data)=>{
      if(ended)return;ended=true;client.destroy();
      if(error)reject(error);else resolve(data);
    };
    client.setTimeout(timeout,()=>done(new Error('Data Tool timeout')));
    client.on('connect',()=>client.write(JSON.stringify(payload)+'\n'));
    client.on('data',chunk=>{
      raw+=chunk.toString('utf8');
      if(raw.length>65536)return done(new Error('Data Tool reply too large'));
      const end=raw.indexOf('\n');
      if(end<0)return;
      try{done(null,JSON.parse(raw.slice(0,end)));}
      catch(error){done(error);}
    });
    client.on('error',e=>done(e));
    client.on('end',()=>done(new Error('Data Tool closed without reply')));
  });
}
module.exports={request,SOCKET};
