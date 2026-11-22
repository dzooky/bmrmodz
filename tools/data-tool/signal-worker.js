'use strict';
// Isolated process: native SOME/IP binding can deadlock or abort without
// taking down the main Data Tool. This worker is never started on boot.
// Only approved read-only CDS fields may be sampled.
const fs=require('fs'),path=require('path');
const {SIGNALS}=require('./signal-environment');
const CDS='de.bmw.infotainment.vehicle.CDS';
const ALLOWED=['statusEngineTemperature','statusEngineSpeed2'];
let sent=false,proxy=null,finishTimer=null;
function finish(result){
  if(sent)return;
  sent=true;
  clearTimeout(finishTimer);
  try{process.stdout.write(JSON.stringify(result)+'\n');}catch(_){}
  if(proxy&&typeof proxy.shutdown==='function')Promise.resolve().then(()=>proxy.shutdown()).catch(()=>{}).then(()=>process.exit(0));
  else process.exit(0);
  setTimeout(()=>process.exit(0),300).unref();
}
function error(stage,e){finish({ok:false,stage,error:String(e&&e.message||e).slice(0,240)});}
async function main(){
  if(process.argv.length!==4) return error('args',new Error('Expected mode and field'));
  const mode=process.argv[2],field=process.argv[3];
  if(mode!=='load' && mode!=='sample')return error('args',new Error('Unsupported mode'));
  if(mode==='sample'&&ALLOWED.indexOf(field)<0)return error('allowlist',new Error('CDS field not allowed'));
  let someip;
  try{
    // Caller can opt into a specific installation path; no binary is bundled.
    const modulePath=process.env.BMRMODZ_SOMEIP_MODULE;
    someip=modulePath?require(modulePath):require('someip');
  }catch(e){return error('module-load',e);}
  if(!someip||typeof someip.buildProxy!=='function')return error('module-api',new Error('buildProxy not available'));
  if(mode==='load')return finish({ok:true,stage:'module-load',hasBuildProxy:true});
  const cfgPath=process.env.BMRMODZ_CDS_CONFIG;
  if(!cfgPath)return error('config',new Error('BMRMODZ_CDS_CONFIG is required; tool does not borrow another app configuration'));
  let cfg;
  try{
    const stat=fs.statSync(cfgPath);
    if(!stat.isFile()||stat.size>1024*1024)throw new Error('Invalid CDS configuration file');
    cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  }catch(e){return error('config',e);}
  if(!cfg||typeof cfg!=='object')return error('config',new Error('Invalid config object'));
  try{
    // Match the scheduling approach of kit/runtime/signals.js.
    proxy=await new Promise((resolve,reject)=>setImmediate(()=>{
      try{Promise.resolve(someip.buildProxy(cfg,'1')).then(p=>Promise.resolve(p.init()).then(()=>p)).then(resolve,reject);}catch(e){reject(e);}
    }));
  }catch(e){return error('proxy-init',e);}
  const sample=v=>{
    const raw=field==='statusEngineTemperature'
      ? {oil:v&&v.temperatureEngineOilDrive,coolant:v&&v.temperatureEngineDrive}
      : {rpm:v&&v.actualValueRPMEngineCrankshaft};
    finish({ok:true,stage:'sample',interface:CDS,field,received:true,value:raw});
  };
  try{
    await new Promise((resolve,reject)=>setImmediate(()=>{
      try{Promise.resolve(proxy.subscribe({name:field,onReceive:sample})).then(resolve,reject);}catch(e){reject(e);}
    }));
    if(typeof proxy.getValue==='function')Promise.resolve().then(()=>proxy.getValue(field,2500)).then(sample,()=>{});
    finishTimer=setTimeout(()=>finish({ok:false,stage:'sample',error:'No signal received during isolated probe'}),4500);
  }catch(e){error('subscribe',e);}
}
main().catch(e=>error('unexpected',e));
