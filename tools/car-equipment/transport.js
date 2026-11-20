'use strict';
/*
 * Standalone read-only VO transport for BMW MGU using an installed hmictl
 * helper (TASU SOME/IP gateway, same ECU/DID as Climate Comfort).
 *
 * hmictl is provided by a separately installed compatible MGU HU Tool
 * (for example iteriodev-comfort); it is NOT copied or redistributed here.
 */
const fs=require('fs');
const {spawn}=require('child_process');
const CANDIDATES=[
  '/var/opt/iteriodev-comfort/current/hmictl',
  '/var/opt/iteriodev-turnview/current/hmictl',
  '/var/opt/iteriodev-overlays/current/hmictl'
];
const SUB='sub 0xf8a6 128 1 1 0x8001';
const REQUEST='call 0xf8a6 128 1 1 f21022000002000000023f0600';
function resolveHelper() {
  if(process.env.CAR_EQUIPMENT_HMICTL) return process.env.CAR_EQUIPMENT_HMICTL;
  return CANDIDATES.find(p=>{try{fs.accessSync(p,fs.constants.X_OK);return true;}catch(e){return false;}});
}
function parseResponse(hex){
  if(!/^[0-9a-f]+$/i.test(hex)||hex.length<20||hex.length%2)return null;
  const n=parseInt(hex.slice(0,8),16),raw=Buffer.from(hex.slice(8),'hex');
  if(n>raw.length)return null;
  const b=raw.slice(0,n);
  if(b.length>=5&&b[2]===0x7f)return {error:'TASU rejected request: '+b[4]};
  if(b.length<10||b[6]!==0x10)return null;
  const uds=Array.from(b.slice(9));
  if(uds[0]===0x7f&&uds[1]===0x22&&uds[2]===0x78)return {pending:true};
  if(uds[0]===0x7f&&uds[1]===0x22)return {uds};
  if(uds[0]===0x62&&uds[1]===0x3f&&uds[2]===0x06)return {uds};
  return null;
}
class HmiLink {
  constructor(helper){this.helper=helper;this.ready=false;this.child=null;this.pendingLine=null;this.pendingEvent=null;this.buffer='';this.starting=null;this.closed=false;}
  init(){
    if(this.ready)return Promise.resolve();
    if(this.starting)return this.starting;
    this.starting=new Promise((resolve,reject)=>{
      const child=spawn(this.helper,['serve'],{stdio:['pipe','pipe','inherit']});
      this.child=child;let settled=false;
      const fail=e=>{this.ready=false;this._rejectAll(e);if(!settled){settled=true;reject(e);}};
      child.on('error',fail);
      child.on('exit',c=>fail(new Error('hmictl exited: '+c)));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk=>{
        this.buffer+=chunk;if(this.buffer.length>65536){fail(new Error('hmictl output too large'));child.kill();return;}
        let n;while((n=this.buffer.indexOf('\n'))>=0){
          const line=this.buffer.slice(0,n).trim();this.buffer=this.buffer.slice(n+1);
          if(line.indexOf('ev ')===0){const w=line.split(' ');if(w[1]==='0xf8a6'&&w[2]==='0x8001'&&this.pendingEvent){
            const data=parseResponse(w[3]||'');if(!data)continue;
            if(data.pending){this.pendingEvent.extend();continue;}
            this.pendingEvent.resolve(data.error?null:data.uds);
          }}else if(/^(ok|error)\b/.test(line)&&this.pendingLine)this.pendingLine.resolve(line);
        }
      });
      this._line(SUB,4500).then(answer=>{
        if(!/^ok\b/.test(answer))throw new Error('TASU subscription failed: '+answer);
        this.ready=true;if(!settled){settled=true;resolve();}
      }).catch(fail);
    }).then(value=>{this.starting=null;return value;},error=>{this.starting=null;throw error;});
    return this.starting;
  }
  _rejectAll(e){
    if(this.pendingLine){this.pendingLine.reject(e);this.pendingLine=null;}
    if(this.pendingEvent){this.pendingEvent.reject(e);this.pendingEvent=null;}
  }
  _line(command,timeout){
    return new Promise((resolve,reject)=>{
      if(!this.child||!this.child.stdin.writable){reject(new Error('hmictl unavailable'));return;}
      if(this.pendingLine){reject(new Error('hmictl command busy'));return;}
      const done=(fn,value)=>{clearTimeout(timer);this.pendingLine=null;fn(value);};
      const timer=setTimeout(()=>done(reject,new Error('hmictl command timeout')),timeout||5000);
      this.pendingLine={resolve:v=>done(resolve,v),reject:e=>done(reject,e)};
      this.child.stdin.write(command+'\n',e=>{if(e&&this.pendingLine)this.pendingLine.reject(e);});
    });
  }
  async read(target,did,timeout){
    if(target!==0x10||did!==0x3f06)throw new Error('Only gateway VO 22 3F 06 is permitted');
    if(!this.ready)await this.init();
    if(this.pendingEvent)throw new Error('VO read already in flight');
    // Arm listener before issuing request; the TASU reply may arrive before command ACK.
    let event;
    const received=new Promise((resolve,reject)=>{
      let timer;
      const done=(fn,v)=>{clearTimeout(timer);this.pendingEvent=null;fn(v);};
      const arm=ms=>{clearTimeout(timer);timer=setTimeout(()=>done(resolve,null),ms);};
      event={pending:false,resolve:v=>done(resolve,v),reject:e=>done(reject,e),extend:()=>{event.pending=true;arm(10000);},setNormalTimeout:()=>arm(timeout||3000)};
      this.pendingEvent=event;arm((timeout||3000)+5000);
    });
    try{
      const ack=await this._line(REQUEST,5000);
      if(!/^ok\b/.test(ack)){event.resolve(null);throw new Error('TASU request failed: '+ack);}
      if(this.pendingEvent===event&&!event.pending)event.setNormalTimeout();
      return await received;
    }catch(e){if(this.pendingEvent===event)event.resolve(null);throw e;}
  }
  close(){this.closed=true;if(this.child)this.child.kill();this.child=null;this.ready=false;}
}
function createLink(){
 const override=process.env.CAR_EQUIPMENT_ADAPTER;
 if(override){
   const adapter=require(override);
   if(typeof adapter.createLink!=='function')throw new Error('Adapter must export createLink()');
   return adapter.createLink();
 }
 const helper=resolveHelper();
 if(!helper)throw new Error('Compatible hmictl missing; install iteriodev-comfort or set CAR_EQUIPMENT_HMICTL');
 return new HmiLink(helper);
}
module.exports={HmiLink,createLink,parseResponse,resolveHelper,REQUEST,SUB};
