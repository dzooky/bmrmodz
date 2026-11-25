'use strict';
// Broker: one short-lived worker at a time, hard-killed on deadline.
// Never pass request-controlled module paths, config paths or process arguments.
const {spawn}=require('child_process'),path=require('path');
const MODES=['load','sample'],FIELDS=['statusEngineTemperature','statusEngineSpeed2'];
function createRunner(options){
  const opts=options||{};
  const worker=opts.worker||path.join(__dirname,'signal-worker.js');
  const deadline=opts.timeoutMs||8000;
  const spawnProcess=opts.spawn||spawn;
  let running=false;
  return {
    run(mode,field){
      if(MODES.indexOf(mode)<0 || (mode==='sample'&&FIELDS.indexOf(field)<0))return Promise.resolve({ok:false,stage:'allowlist',error:'Unsupported signal test'});
      if(running)return Promise.resolve({ok:false,stage:'busy',error:'Another signal probe is running'});
      running=true;
      return new Promise(resolve=>{
        let child=null,timer=null,data='',done=false;
        const finish=out=>{
          if(done)return;
          done=true;clearTimeout(timer);
          if(child&&!child.killed)try{child.kill('SIGKILL');}catch(_){}
          running=false;resolve(out);
        };
        try{
          child=spawnProcess(process.execPath,[worker,mode,mode==='load'?'-':field],{
            stdio:['ignore','pipe','ignore'],env:process.env
          });
          timer=setTimeout(()=>finish({ok:false,stage:'worker-timeout',error:'Isolated SOME/IP worker timed out'}),deadline);
          child.stdout.setEncoding('utf8');
          child.stdout.on('data',part=>{
            data+=part;
            if(data.length>16384)return finish({ok:false,stage:'worker-output',error:'Worker response too large'});
            const index=data.indexOf('\n');
            if(index>=0){
              try{
                const answer=JSON.parse(data.slice(0,index));
                finish(answer&&typeof answer.ok==='boolean'?answer:{ok:false,stage:'worker-output',error:'Invalid worker response'});
              }catch(e){finish({ok:false,stage:'worker-output',error:'Malformed worker output'});}
            }
          });
          child.on('error',e=>finish({ok:false,stage:'spawn',error:String(e.message||e)}));
          child.on('exit',(code,signal)=>finish({ok:false,stage:'worker-exit',error:'Worker exited before reply (code '+code+', signal '+signal+')'}));
        }catch(e){finish({ok:false,stage:'spawn',error:String(e.message||e)});}
      });
    }
  };
}
module.exports={createRunner};
