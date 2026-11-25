'use strict';
const assert=require('assert');
const {createRunner,STEPS}=require('./test-runner');
async function run(){
  let commands=[];
  const sender=async req=>{
    commands.push(req);
    if(req.op==='status')return {ok:true,version:'0.1.5'};
    if(req.op==='signalEnvironment')return {ok:true,catalog:{present:true},nativeModule:{resolved:false}};
    if(req.op==='configCheck')return {ok:false,error:'Missing CDS config'};
    if(req.op==='signalNative')return {ok:false,stage:'module-load',error:'Native binding missing'};
    if(req.op==='read')return {ok:true,uds:[0x62,req.did>>8,req.did&255,1]};
    throw Error('Unexpected operation');
  };
  let updates=0;
  const result=await createRunner(sender).run(()=>updates++);
  assert.strictEqual(result.schema,1);
  assert.strictEqual(result.results.length,STEPS.length);
  assert.strictEqual(updates,STEPS.length);
  assert.strictEqual(result.results.find(r=>r.id==='dde').status,'PASS');
  assert.strictEqual(result.results.find(r=>r.id==='cdsTemp').status,'SKIP');
  assert.strictEqual(result.controlsTested,false);
  assert.strictEqual(result.deviceVerified,false);
  assert.strictEqual(JSON.stringify(result).includes('"uds"'),false);
  assert.ok(commands.every(x=>x.op==='read'||['status','signalEnvironment','configCheck','signalNative'].includes(x.op)));
  assert.ok(commands.filter(x=>x.op==='read').every(x=>x.ecu>=0&&Number.isInteger(x.did)));
  const unavailable=await createRunner(async()=>{throw Error('Socket unavailable');}).run();
  assert.strictEqual(unavailable.results[0].status,'FAIL');
  assert.strictEqual(unavailable.results.slice(1).every(r=>r.status==='SKIP'),true);
  const unexpected=await createRunner(async req=>req.op==='status'?{ok:true}:{ok:true,uds:[0x62,0xff,0xff]}).run();
  assert.strictEqual(unexpected.results.find(r=>r.id==='dde').status,'FAIL');
  console.log('Data Diagnostics: safe staged runner, UDS echo, skipped signals, no control, sanitized report passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
