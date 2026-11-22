'use strict';
const assert=require('assert'),{inspect,SIGNALS,hasConfig}=require('./signal-environment');
const catalog={'interfaces':{
  'de.bmw.infotainment.vehicle.CDS':{fields:{statusEngineTemperature:{getter:true}}}
}};
const fakeFs={statSync:()=>({isFile:()=>true,size:100}),readFileSync:()=>JSON.stringify(catalog)};
const report=inspect({fs:fakeFs,catalogPath:'/fake/catalog',resolveModule:()=>'/fake/someip.node'});
assert.strictEqual(report.ok,true);
assert.strictEqual(report.nativeModule.resolved,true);
assert.strictEqual(report.catalog.present,true);
const cds=report.interfaces.find(x=>x.interface==='de.bmw.infotainment.vehicle.CDS');
assert.strictEqual(cds.fields.find(x=>x.name==='statusEngineTemperature').inCatalog,true);
assert.strictEqual(cds.fields.find(x=>x.name==='statusEngineSpeed2').inCatalog,false);
assert.ok(SIGNALS['de.bmw.infotainment.KombiIF'].includes('statusBordcomputerAverage'));
assert.strictEqual(hasConfig(catalog,'unknown','field'),false);
const fail=inspect({fs:{statSync:()=>{throw Error('absent');}},resolveModule:()=>{throw Error('missing');}});
assert.strictEqual(fail.catalog.present,false);
assert.strictEqual(fail.nativeModule.resolved,false);
console.log('Data Tool signal environment: passive catalog/module checks passed');
