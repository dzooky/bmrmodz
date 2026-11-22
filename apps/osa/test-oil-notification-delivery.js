'use strict';

// Standalone regression checks: node apps/osa/test-oil-notification-delivery.js
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let replies = [];
let calls = [];
Module._load = function(request, parent, isMain) {
    if (request === './kit/notification-tool')
        return { show: async (...args) => { calls.push(args); const next = replies.shift(); if (next instanceof Error) throw next; return next; } };
    if (request === './cluster-locales')
        return { warmupLabel: () => 'Oil warm' };
    return originalLoad.apply(this, arguments);
};
let oil;
try { oil = require('./oil-notification'); }
finally { Module._load = originalLoad; }

const log = { info() {}, warn() {} };
async function run() {
    const transition = oil.createWarmupMessage();
    assert.equal(transition(90, 80, 1000), 80, 'already warm oil triggers immediately');
    assert.equal(transition(90, 80, 1250), null, 'no duplicate in the display window');
    assert.equal(transition(90, 80, 6500), null, 'no duplicate after the display window');
    assert.equal(transition(77, 80, 7000), null, '2 °C hysteresis re-arms the trigger');
    assert.equal(transition(80, 80, 7500), 80, 'warming back to target triggers again');

    const originalTimeout = global.setTimeout;
    const delays = [];
    global.setTimeout = (fn, ms) => { delays.push(ms); queueMicrotask(fn); return { unref() {} }; };
    try {
        calls = [];
        replies = [{ ok: false, error: 'busy' }, new Error('socket unavailable'), { ok: true }];
        assert.equal(await oil.show(log, 'en', 80, 'automatic'), true);
        assert.equal(calls.length, 3);
        assert.deepEqual(delays, [500, 500]);

        calls = [];
        delays.length = 0;
        replies = Array(5).fill({ ok: false, error: 'busy' });
        assert.equal(await oil.show(log, 'en', 80, 'automatic'), false);
        assert.equal(calls.length, 5);
        assert.deepEqual(delays, [500, 500, 500, 500]);
    } finally {
        global.setTimeout = originalTimeout;
    }
    process.stdout.write('OSA oil notification delivery tests passed\\n');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
