'use strict';
// Validate the state machine without connecting to the vehicle or rendering a cluster frame.
const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const source = fs.readFileSync(__dirname + '/regen-message.js', 'utf8');
const moduleMock = { exports: {} };
vm.runInNewContext(source, {
    module: moduleMock,
    exports: moduleMock.exports,
    require: id => {
        if (id === './kit/notification-tool') return { show: () => Promise.resolve({ok:true}) };
        if (id === './kit/i18n') return {t: x => x};
        throw new Error(id);
    },
    Buffer
}, {filename:'regen-message.js'});
const {createIndicator,testMessage} = moduleMock.exports;
const indicator = createIndicator();
const message = (state, ms) => indicator(state, ms);
assert.strictEqual(message('idle',0),null);
assert.strictEqual(message('requested',100).text,'Requested');
assert.strictEqual(message('requested',700).text,'');
assert.strictEqual(message('requested',3200),null);
assert.strictEqual(message('active',4000).text,'Started');
assert.strictEqual(message('active',4600).text,'');
assert.strictEqual(message('active',7000).text,'In Progress');
assert.strictEqual(message('active',7332).text,'');
assert.strictEqual(message('active',7666).text,'In Progress');
assert.strictEqual(message('active',7999).text,'');
assert.strictEqual(message('active',8332),null);
assert.strictEqual(message('active',10000),null);
assert.strictEqual(message('active',67000).text,'In Progress');
assert.strictEqual(message('idle',67500).text,'Finished');
assert.strictEqual(message('idle',68200).text,'');
assert.strictEqual(message('idle',71000),null);
assert.strictEqual(message('active',80000).text,'Started');
// Manual test mode: Requested -> Started -> In Progress -> Finished.
for(const [ms,name] of [[0,'Requested'],[3000,'Started'],[6000,'In Progress'],[7332,'Finished']])
    assert.strictEqual(testMessage(ms).text,name);
assert.strictEqual(testMessage(12000),null);
// In Progress: exactly two blinks, 333 ms ON and 333 ms OFF each.
assert.strictEqual(testMessage(6000).text,'In Progress');
assert.strictEqual(testMessage(6332).text,'In Progress');
assert.strictEqual(testMessage(6333).text,'');
assert.strictEqual(testMessage(6665).text,'');
assert.strictEqual(testMessage(6666).text,'In Progress');
assert.strictEqual(testMessage(6998).text,'In Progress');
assert.strictEqual(testMessage(6999).text,'');
assert.strictEqual(testMessage(7331).text,'');
assert.strictEqual(testMessage(7332).text,'Finished');
assert.strictEqual(testMessage(6000).durationMs,1332);
assert.strictEqual(testMessage(6000).blinkMs,333);
// The other three statuses retain their 500 ms / 3 s cadence.
assert.strictEqual(testMessage(500).text,'');
assert.strictEqual(testMessage(1000).text,'Requested');
assert.strictEqual(testMessage(3500).text,'');
assert.strictEqual(testMessage(4000).text,'Started');
assert.strictEqual(testMessage(7832).text,'');
assert.strictEqual(testMessage(8332).text,'Finished');
// Periodic live reminder remains every 60 seconds.
assert.strictEqual(message('active',67000).text,'In Progress');
console.log('DPF regeneration cluster: all four messages and transitions passed.');
