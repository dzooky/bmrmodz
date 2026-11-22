'use strict';
// Explicit HTTPS upload of the sanitized report only. No automatic sending.
// Provision token out of band in app data or environment; never commit it.
const fs=require('fs'),path=require('path'),https=require('https'),dns=require('dns'),net=require('net');
const HOST='dzooky.eu',ENDPOINT='/bmrmodz.php';
function token(dataDir){
  const env=process.env.BMRMODZ_REPORT_TOKEN;
  if(env&&env.trim())return env.trim();
  const file=path.join(dataDir,'report-upload-token.txt');
  const value=fs.readFileSync(file,'utf8').trim();
  if(value.length<32||value.length>256)throw new Error('Upload token must be 32-256 characters');
  return value;
}
function uplinkLookup(dataDir){
  return (hostname,opts,cb)=>{
    let lease=null;
    for(const f of [path.join(dataDir,'uplink.json'),'/run/mgu-uplink/lease.json']){
      try{lease=JSON.parse(fs.readFileSync(f,'utf8'));}catch(_){}
      if(lease&&Array.isArray(lease.dns))break;
    }
    const servers=lease&&Array.isArray(lease.dns)?lease.dns.filter(ip=>net.isIP(ip)):[];
    if(!servers.length)return dns.lookup(hostname,opts,cb);
    const resolver=new dns.Resolver();
    resolver.setServers(servers);
    const timer=setTimeout(()=>resolver.cancel(),6000);
    resolver.resolve4(hostname,(error,addresses)=>{
      clearTimeout(timer);
      if(error||!addresses||!addresses.length)return cb(error||new Error('No DNS address'));
      if(opts.all)return cb(null,addresses.map(address=>({address,family:4})));
      cb(null,addresses[0],4);
    });
  };
}
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
  let auth;
  try{auth=opts.token||token(dataDir);}catch(e){return Promise.reject(new Error('Upload token not configured'));}
  return new Promise((resolve,reject)=>{
    let finished=false,buffer='';
    const done=(error,response)=>{
      if(finished)return;finished=true;
      if(error)reject(error);else resolve(response);
    };
    const req=(opts.https||https).request({
      hostname:HOST,port:443,path:ENDPOINT,method:'POST',agent:false,
      lookup:uplinkLookup(dataDir),timeout:12000,
      headers:{'Content-Type':'application/json','Accept':'application/json',
        'Content-Length':Buffer.byteLength(body),'X-BMRMODZ-Token':auth}
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
module.exports={upload,token,HOST,ENDPOINT};
