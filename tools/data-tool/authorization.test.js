'use strict';
const assert=require('assert'),policy=require('./authorization');
assert.strictEqual(policy.authorize({op:'read'},{verified:true,appId:'data-diagnostics'},['data-diagnostics']).allowed,true);
for(const identity of [null,{appId:'data-diagnostics'},{verified:false,appId:'data-diagnostics'},{verified:true,appId:'unknown'}]){
 assert.strictEqual(policy.authorize({op:'read'},identity,['data-diagnostics']).allowed,false);
}
assert.strictEqual(policy.authorize({op:'control'},{verified:true,appId:'data-diagnostics'},['data-diagnostics']).allowed,false);
assert.strictEqual(policy.authorize({op:'read',appId:'data-diagnostics'},null,['data-diagnostics']).allowed,false);
assert.strictEqual(policy.mode({}).enforced,false);
assert.strictEqual(policy.mode({authorizationEnabled:true}).productionReady,false);
console.log('Data Tool authorization: trusted allowlist and fail-closed rules passed');
