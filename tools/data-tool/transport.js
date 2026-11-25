'use strict';
// Restricted TASU/Uds read transport, using an already-installed hmictl helper.
// Framing follows the proven Car Equipment Tool path; access to non-VO ECUs
// must be verified on a real MGU before production use.
const fs=require('fs'), {spawn}=require('child_process');
const CANDIDATES=[
  '/var/opt/iteriodev-comfort/current/hmictl',
  '/var/opt/iteriodev-turnview/current/hmictl',
  '/var/opt/iteriodev-overlays/current/hmictl'
];
const SUB='sub 0xf8a6 128 1 1 0x8001';
function helperPath() {
  if (process.env.BMRMODZ_DATA_HMICTL) return process.env.BMRMODZ_DATA_HMICTL;
  return CANDIDATES.find(p=>{try{fs.accessSync(p,fs.constants.X_OK);return true;}catch(_){return false;}});
}
function command(target,did){
  const bytes=Buffer.from([0xF2,target,0x22,0,0,2,0,0,0,2,(did>>8)&255,did&255,0]);
  return 'call 0xf8a6 128 1 1 '+bytes.toString('hex');
}
function decode(hex){
  if(typeof hex!=='string'||!/^[a-f0-9]+$/i.test(hex)||hex.length<20||hex.length%2)return null;
  const n=parseInt(hex.slice(0,8),16),raw=Buffer.from(hex.slice(8),'hex');
  if(n>raw.length||n<9)return null;
  const b=raw.slice(0,n);
  if(b[2]===0x7f)return {error:'TASU reject '+b[4]};
  return {ecu:b[6],uds:Array.from(b.slice(9))};
}
class HmiTransport {
  constructor(helper){this.helper=helper;this.child=null;this.ready=false;this.initPromise=null;this.pendingLine=null;this.pendingRead=null;this.buffer='';}
  init(){
    if(this.ready)return Promise.resolve();
    if(this.initPromise)return this.initPromise;
    this.initPromise=new Promise((resolve,reject)=>{
      const child=spawn(this.helper,['serve'],{stdio:['pipe','pipe','inherit']});this.child=child;let finished=false;
      const fail=e=>{this.ready=false;this.failPending(e);if(!finished){finished=true;reject(e);}};
      child.on('error',fail);child.on('exit',c=>fail(new Error('hmictl exited '+c)));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',part=>{
        this.buffer+=part;
        if(this.buffer.length>65536){fail(new Error('hmictl output overflow'));child.kill();return;}
        let idx;while((idx=this.buffer.indexOf('\n'))>=0){
          const line=this.buffer.slice(0,idx).trim();this.buffer=this.buffer.slice(idx+1);
          if(line.startsWith('ev ')){
            const fields=line.split(' ');
            if(fields[1]!=='0xf8a6'||fields[2]!=='0x8001'||!this.pendingRead)continue;
            const response=decode(fields[3]);if(!response)continue;
            this.pendingRead.consume(response);
          } else if(/^(ok|error)\b/.test(line)&&this.pendingLine)this.pendingLine.resolve(line);
        }
      });
      this.line(SUB,4500).then(answer=>{
        if(!/^ok\b/.test(answer))throw new Error('TASU subscription rejected: '+answer);
        this.ready=true;if(!finished){finished=true;resolve();}
      }).catch(fail);
    }).then(v=>{this.initPromise=null;return v;},e=>{this.initPromise=null;throw e;});
    return this.initPromise;
  }
  failPending(e){if(this.pendingLine)this.pendingLine.reject(e);if(this.pendingRead)this.pendingRead.reject(e);}
  line(s,timeout){
    return new Promise((resolve,reject)=>{
      if(!this.child||!this.child.stdin.writable)return reject(new Error('hmictl unavailable'));
      if(this.pendingLine)return reject(new Error('command busy'));
      let finished=false;
      const finish=(fn,v)=>{if(finished)return;finished=true;clearTimeout(timer);this.pendingLine=null;fn(v);};
      const timer=setTimeout(()=>finish(reject,new Error('hmictl command timeout')),timeout);
      this.pendingLine={resolve:v=>finish(resolve,v),reject:e=>finish(reject,e)};
      this.child.stdin.write(s+'\n',e=>{if(e&&this.pendingLine)this.pendingLine.reject(e);});
    });
  }
  async read(ecu,did){
    if(!this.ready)await this.init();
    if(this.pendingRead)throw new Error('read in flight');
    let pending;
    const received=new Promise((resolve,reject)=>{
      let timer,done=false;
      const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);this.pendingRead=null;fn(v);};
      const arm=(ms)=>{clearTimeout(timer);timer=setTimeout(()=>finish(resolve,null),ms);};
      pending={
        reject:e=>finish(reject,e),
        consume:response=>{
          if(response.error)return finish(reject,new Error(response.error));
          if(response.ecu!==ecu)return;
          const u=response.uds;
          if(u[0]===0x7f&&u[1]===0x22&&u[2]===0x78){pending.sawPending=true;arm(10000);return;}
          if(u[0]===0x7f&&u[1]===0x22)return finish(resolve,u);
          if(u[0]===0x62&&u[1]===(did>>8)&&u[2]===(did&255))finish(resolve,u);
        },
        arm
      };
      this.pendingRead=pending;arm(10000);
    });
    try{
      const ack=await this.line(command(ecu,did),5000);
      if(!/^ok\b/.test(ack))throw new Error('TASU command rejected: '+ack);
      if(this.pendingRead===pending&&!pending.sawPending)pending.arm(3500);
      return await received;
    }catch(e){if(this.pendingRead===pending)pending.reject(e);received.catch(()=>{});throw e;}
  }
  close(){if(this.child)this.child.kill();this.child=null;this.ready=false;}
}
function createTransport(){
  if(process.env.BMRMODZ_DATA_ADAPTER){
    const adapter=require(process.env.BMRMODZ_DATA_ADAPTER);
    if(typeof adapter.createTransport!=='function')throw new Error('Adapter must export createTransport()');
    return adapter.createTransport();
  }
  const helper=helperPath();
  if(!helper)throw new Error('No compatible installed hmictl helper');
  return new HmiTransport(helper);
}
module.exports={HmiTransport,createTransport,helperPath,command,decode,SUB};
