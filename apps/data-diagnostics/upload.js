'use strict';
// Explicit manual HTTP upload of sanitized reports to the LAN receiver only.
// No token, DNS resolution, internet endpoint or automatic background sending.
const http=require('http');
const HOST='192.168.0.10',ENDPOINT='/bmrmodz.php';
function upload(report,dataDir,options){
  const opts=options||{};
  if(!report||report.schema!==1||report.application!=='bmrmodz-data-diagnostics'||!Array.isArray(report.results))
    return Promise.reject(new Error('Invalid diagnostic report'));
  // Only allowlisted fields; do not transmit any future accidental vehicle fields.
  const allowed=['schema','application','runMode','startedAt','finishedAt','totals','results',
    'controlsTested','signalPermissionsVerified','deviceVerified','notes'];
  const safe={};
  allowed.forEach(key=>{if(Object.prototype.hasOwnProperty.call(report,key))safe[key]=report[key];});
  // Whitelist each result property too.
  safe.results=report.results.map(item=>({
    id:String(item.id||''),label:String(item.label||''),status:String(item.status||''),
    durationMs:Number(item.durationMs)||0,detail:String(item.detail||'').slice(0,160)
  }));
  const body=JSON.stringify(safe);
  if(Buffer.byteLength(body)>32768)return Promise.reject(new Error('Diagnostic report exceeds 32 KB'));
  return new Promise((resolve,reject)=>{
    let finished=false,buffer='';
    const done=(error,response)=>{
      if(finished)return;finished=true;
      if(error)reject(error);else resolve(response);
    };
    const req=(opts.http||http).request({
      hostname:HOST,port:80,path:ENDPOINT,method:'POST',agent:false,
      timeout:12000,
      headers:{'Content-Type':'application/json','Accept':'application/json',
        'Content-Length':Buffer.byteLength(body)}
    },response=>{
      response.setEncoding('utf8');
      response.on('data',part=>{buffer+=part;if(buffer.length>4096)req.destroy(new Error('Oversized server reply'));});
      response.on('end',()=>{
        let answer;
        try{answer=JSON.parse(buffer);}catch(_){return done(new Error('Invalid server response'));}
        if(response.statusCode!==201||!answer||answer.ok!==true||!/^([0-9a-f]{24})$/.test(answer.id||''))
          return done(new Error('Upload rejected (HTTP '+response.statusCode+')'));
        done(null,{ok:true,id:answer.id});
      });
      response.on('error',done);
    });
    req.on('timeout',()=>req.destroy(new Error('Upload timeout')));
    req.on('error',done);
    req.end(body);
  });
}
module.exports={upload,HOST,ENDPOINT};
