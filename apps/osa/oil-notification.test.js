'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(__dirname + '/oil-notification.js', 'utf8');
const calls = [], logs = [];
let interval, clock = 0;
const sample = { enabled: true, oil: 70, target: 80 };
const moduleMock = {exports: {}};
vm.runInNewContext(source, {
    module: moduleMock,
    exports: moduleMock.exports,
    require: id => {
        if (id === './kit/notification-tool') return {
            show: (app, segments, options) => {
                calls.push({app, segments, options});
                return Promise.resolve({ok: true});
            }
        };
        if (id === './cluster-locales') return {warmupLabel: lang => lang === 'sk' ? 'Olej zohriaty' : 'Oil warmed up'};
        throw new Error(id);
    },
    Number,
    Date: {now: () => clock},
    Promise,
    setInterval: cb => { interval = cb; return {unref() {}}; },
    setTimeout,
    process: {env: {}}
}, {filename: 'oil-notification.js'});

const {createWarmupMessage, start, show, MESSAGE_MS} = moduleMock.exports;
assert.strictEqual(MESSAGE_MS, 4000);
const warm = createWarmupMessage();
assert.strictEqual(warm(70,80,0),null);
assert.strictEqual(warm(79,80,100),null);
assert.strictEqual(warm(80,80,200),80);
assert.strictEqual(warm(81,80,3500),80);
assert.strictEqual(warm(81,80,4200),null);
assert.strictEqual(warm(81,80,6000),null); // no repeat without cooling
assert.strictEqual(warm(78,80,7000),null);
assert.strictEqual(warm(80,80,8000),80);

const log = {info: s => logs.push(s), warn: s => logs.push(s)};
async function run() {
    start(log, () => sample, () => 'sk');
    assert.strictEqual(calls.length,0);
    clock = 500;
    sample.oil = 80;
    interval();
    await Promise.resolve(); await Promise.resolve();
    assert.strictEqual(calls.length,1,'Must fire exactly once on threshold crossing');
    assert.strictEqual(calls[0].app,'osa');
    assert.strictEqual(calls[0].segments[0].text,'Olej zohriaty ');
    assert.strictEqual(calls[0].segments[1].text,'80 °C');
    assert.strictEqual(calls[0].options.durationMs,4000);
    assert.strictEqual(calls[0].options.blinkMs,0);
    clock = 750;
    interval();
    assert.strictEqual(calls.length,1,'No duplicate on subsequent polls');
    sample.enabled = false;
    clock = 1000;
    interval();
    sample.oil = 70;
    sample.enabled = true;
    clock = 1250;
    interval();
    sample.oil = 80;
    clock = 1500;
    interval();
    await Promise.resolve();
    assert.strictEqual(calls.length,2,'Rearm after notifications were disabled and cold');
    await show(log,'sk',80,'preview');
    assert.strictEqual(calls.length,3,'Manual preview does not require live temperature data');
    const app=JSON.parse(fs.readFileSync(__dirname + '/app.json','utf8'));
    const main=fs.readFileSync(__dirname + '/main.js','utf8');
    assert.strictEqual(app.version,'0.2.61');
    assert.strictEqual(app.requires['bmrmodz-notification'],'0.1.1');
    assert(!app.settings.some(s=>s.key==='clusterLowerTest'||s.key==='clusterPassiveTest'));
    assert(!main.includes('turboIconPreview'));
    assert(!main.includes('cluster-render'));
    assert(main.includes("oilNotification.show(log, getLanguage(), oilWarmTarget(), 'preview')"));
    const testAction = app.settings.find(s=>s.key === 'clusterBcTest');
    assert.strictEqual(testAction.type, 'action');
    assert.strictEqual(testAction.label, 'Show notification message');
    assert.strictEqual(testAction.actionLabel, 'Proceed');
    assert(main.includes("ctx.settings.onAction('clusterBcTest'"));
    assert(!main.includes("ctx.settings.get('clusterBcTest')"));
    assert(!main.includes("ctx.settings.set('clusterBcTest'"));
    console.log('OSA shared Notification Tool: preview, trigger, 4s display and re-arm passed.');
}
run().catch(err=>{ console.error(err); process.exitCode=1; });
