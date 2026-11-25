'use strict';
const assert=require('assert');
const {create}=require('./diagnostic-report'),config=require('./config-check');
const fakeFs={statSync:()=>({isFile:()=>true,size:150}),readFileSync:()=>JSON.stringify({fields:{statusEngineTemperature:{getter:true},statusEngineSpeed2:{getter:true}}})};
assert.strictEqual(config.inspect('/test/cds.json',fakeFs).ok,true);
assert.strictEqual(config.inspect('/test/cds.json',{statSync:()=>{throw Error('missing');}}).ok,false);
const r=create({version:'0.1.3',transportReady:false,stats:{sent:0}},{
 environment:{catalog:{present:true},nativeModule:{resolved:false}},
 config:config.inspect('/test/cds.json',fakeFs)
});
assert.strictEqual(r.reportVersion,1);
assert.strictEqual(r.checks.cdsConfigFieldsValid,true);
assert.strictEqual(r.checks.nativeSubscriptionVerified,false);
assert.strictEqual(r.service.stats.sent,0);
console.log('Data Tool report: passive diagnostics and config validation passed');
