'use strict';
const assert=require('assert');
const {Equipment,normalize}=require('./equipment');
const {decodeVehicleOrder}=require('./vehicle-order');
assert.strictEqual(normalize('hud'),'610');
assert.strictEqual(normalize('6wb'),'6WB');
assert.strictEqual(normalize('bad-code'),null);
assert.strictEqual(decodeVehicleOrder([0x62,0x3f,0x06,0,1,0]),null);
(async()=>{
 const equipment=new Equipment({ready:true,read:async()=>null});
 assert.strictEqual(equipment.check(['610']).results['610'],'unknown');
 await equipment.refresh();
 assert.strictEqual(equipment.check(['hud']).results.hud,'unknown');
 assert.ok(equipment.error);
 equipment.codes=new Set(['610','6U3']);equipment.error=null;
 assert.deepStrictEqual(equipment.check(['hud','6WB','6U3']).results,{hud:true,'6WB':false,'6U3':true});
 console.log('Car Equipment API smoke tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
