'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {create}=require('./distance-record');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dpf-distance-'));
try{
  const h=create(dir);
  assert.strictEqual(h.maxKm,0);
  assert.strictEqual(h.scale(350,null),400); // average sets the initial scale
  assert.strictEqual(h.observe(352.5),true);
  assert.strictEqual(h.maxKm,352.5);
  assert.strictEqual(h.scale(350,352.5),400);
  assert.strictEqual(h.observe(430.2),true); // exceeds old limit, increase scale
  assert.strictEqual(h.scale(350,430.2),500);
  assert.strictEqual(h.observe(12),false); // new regeneration cannot erase record
  assert.strictEqual(h.maxKm,430.2);
  assert.strictEqual(h.observe(NaN),false);
  assert.strictEqual(h.observe(-1),false);
  assert.strictEqual(h.observe(100001),false);
  const reloaded=create(dir);
  assert.strictEqual(reloaded.maxKm,430.2); // survived restart
  assert.strictEqual(reloaded.scale(350,12),500);
  console.log('DPF persistent adaptive distance scale verified');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
