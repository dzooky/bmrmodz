'use strict';
const assert=require('assert'),{createRunner}=require('./signal-isolate');
async function main(){
  const runner=createRunner({timeoutMs:1200});
  const bad=await runner.run('sample','arbitrary');
  assert.strictEqual(bad.ok,false);
  assert.strictEqual(bad.stage,'allowlist');
  // Mock child process via a standalone JS worker fixture. Real SOME/IP is
  // intentionally not available or loaded in CI.
  const path=require('path'),os=require('os'),fs=require('fs');
  const worker=path.join(os.tmpdir(),'bmrmodz-signal-fixture-'+process.pid+'.js');
  fs.writeFileSync(worker,`if(process.argv[2]==='load')process.stdout.write(JSON.stringify({ok:true,stage:'module-load'})+'\\n'); else setInterval(()=>{},1000);`);
  try{
    const mock=createRunner({worker,timeoutMs:250});
    const good=await mock.run('load');
    assert.strictEqual(good.ok,true);
    const slow=await mock.run('sample','statusEngineTemperature');
    assert.strictEqual(slow.stage,'worker-timeout');
  }finally{fs.unlinkSync(worker);}
  console.log('Data Tool signal isolate: allowlist, child lifecycle and kill timeout passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
