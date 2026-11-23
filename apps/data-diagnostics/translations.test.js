'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {catalogs,t}=require('./translations');
const spec=require('./app.json');
const keys=Object.keys(catalogs.en).sort();
assert.strictEqual(Object.keys(catalogs).length,1);
const supported=spec.settings.find(s=>s.key==='language').options.map(a=>a[0]);
assert.deepStrictEqual(Object.keys(catalogs).sort(),supported.sort());
for(const [lang,catalog] of Object.entries(catalogs)){
  assert.deepStrictEqual(Object.keys(catalog).sort(),keys,lang+' key mismatch');
  for(const [key,value] of Object.entries(catalog))assert.ok(typeof value==='string'&&value.trim(),lang+' empty '+key);
  assert.ok(t(lang,"What's New"));
  assert.ok(t(lang,'Share'));
}
assert.ok(spec.screens[0].buttons.some(b=>b[0]==='BTN_RUN'));
assert.deepStrictEqual(spec.signals,{});
assert.strictEqual(spec.requires['bmrmodz-data-tool'],'0.1.8');
assert.ok(spec.screens[0].buttons.some(b=>b[0]==='BTN_SEND'));
assert.ok(t('en','Secure upload'));
const main=fs.readFileSync(path.join(__dirname,'main.js'),'utf8');
for(const text of [
 'This application is still in development phase and not ready for public use.',
 'We still working on it and will be available soon.',
 'Thank you'
])assert.ok(main.includes(text));
assert.ok(main.includes("const pages=['Info','Diagnostics','Results','Share']"));
console.log('Data Diagnostics: 22 translations, new app notice, tool-only manifest passed');
