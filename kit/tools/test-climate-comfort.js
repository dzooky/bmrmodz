'use strict';

// Offline checks only: no SDK, vehicle connection or real diagnostic writes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const app = path.resolve(__dirname, '../../apps/climate-comfort');
const select = require(path.join(app, 'temperature-source'));
const createAutomation = require(path.join(app, 'automation'));
const createSettingsPage = require(path.join(app, 'settings'));
const getActivationState = require(path.join(app, 'activation-state'));
const applyTestThresholds = require(path.join(app, 'test-thresholds'));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function sourceTests() {
    const values = { temperatureSource: 'inside', rearTemperatureSource: 'inside', steeringTemperatureSource: 'inside' };
    const settings = { get: key => values[key], set: (key, value) => { values[key] = value; } };
    const readings = { outside: -5.5, frontLeft: 12, frontRight: 18, rearLeft: 20, rearRight: 23 };
    const equipment = { fourZoneClimate: true, rearSeatHeating: true, steeringWheelHeating: true };
    const resolve = position => select(settings, equipment, readings, position);
    assert.equal(resolve('frontLeft').value, 12);
    assert.equal(resolve('frontRight').value, 18);
    assert.equal(resolve('rearLeft').value, 20);
    assert.equal(resolve('rearRight').value, 23);
    assert.equal(resolve('steering').value, 12);
    equipment.fourZoneClimate = false;
    assert.equal(resolve('rearLeft').value, 12);
    assert.equal(resolve('rearRight').value, 18);
    assert.equal(resolve('rearRight').label, 'Inside (front)');
    values.rearTemperatureSource = 'outside';
    assert.equal(resolve('rearLeft').value, -5.5);
    assert.equal(resolve('rearRight').label, 'Outside');
    assert.equal(resolve('frontLeft').value, 12);
    values.steeringTemperatureSource = 'outside';
    assert.equal(resolve('steering').value, -5.5);
    readings.outside = null;
    assert.equal(resolve('steering').value, null);
    assert.equal(resolve('frontLeft').value, 12);

    const page = createSettingsPage(settings);
    let targets = {}, texts = [], bounds = [];
    const cv = { roundRect() {}, polyline() {}, text(t) { texts.push(t); },
        target(x, y, w, h, fn, key) { targets[key] = fn; bounds.push(y + h); } };
    function render() {
        targets = {}; texts = []; bounds = [];
        page.render(cv, { text: '#fff', dim: '#aaa' }, equipment);
        assert(bounds.every(bottom => bottom <= 512));
        assert(!texts.includes('Inside temperature') && !texts.includes('Outside temperature'));
    }
    for (const key of ['temperature-source', 'rear-temperature-source', 'steering-temperature-source']) {
        page.close(); render(); targets[key](); render();
        targets[key + '-inside'](); render();
        page.close(); targets[key](); render(); targets[key + '-outside'](); render();
    }
    equipment.steeringWheelHeating = false;
    equipment.rearSeatHeating = false;
    render();
    assert(!targets['rear-temperature-source']);
    assert(!targets['steering-temperature-source']);

    const notice = 'Inside temperature is affected by auxiliary heating while it is running.';
    values.temperatureSource = 'inside';
    render(); assert(!texts.includes(notice));
    equipment.auxiliaryHeating = true;
    render(); assert(texts.includes(notice));
    values.temperatureSource = 'outside';
    values.rearTemperatureSource = 'inside';
    values.steeringTemperatureSource = 'inside';
    render(); assert(!texts.includes(notice)); // hidden equipment choices do not count
    equipment.rearSeatHeating = true;
    render(); assert(texts.includes(notice));
    values.rearTemperatureSource = 'outside';
    render(); assert(!texts.includes(notice));
    equipment.steeringWheelHeating = true;
    render(); assert(texts.includes(notice));
    values.steeringTemperatureSource = 'outside';
    render(); assert(!texts.includes(notice));
    values.temperatureSource = 'inside';
    for (const key of ['temperature-source', 'rear-temperature-source', 'steering-temperature-source']) {
        page.close(); render(); targets[key](); render();
        assert(texts.includes(notice));
        assert(bounds.every(bottom => bottom <= 482)); // leave room for the footer
    }
}

function garageThresholdTests() {
    const manifest = JSON.parse(fs.readFileSync(path.join(app, 'app.json'), 'utf8'));
    const values = {};
    for (const item of manifest.settings) values[item.key] = item.default;
    values.frontLeftHeatingTemperature = 8;
    values.frontLeftVentilationTemperature = 25;
    values.frontLeftHeatingLevel = 2;
    values.temperatureSource = 'outside';
    const settings = { schema: manifest.settings, get: key => values[key], set: (key, value) => { values[key] = value; } };
    applyTestThresholds(settings, false);
    assert.equal(values.frontLeftHeatingTemperature, 8);
    applyTestThresholds(settings, true);
    for (const item of manifest.settings) {
        if (item.key.endsWith('HeatingTemperature')) {
            assert.equal(values[item.key], 20); assert.equal(item.max, 20);
        } else if (item.key.endsWith('VentilationTemperature')) {
            assert.equal(values[item.key], 10); assert.equal(item.min, 10);
        }
    }
    assert.equal(values.frontLeftHeatingLevel, 2);
    assert.equal(values.temperatureSource, 'outside');
    values.frontLeftHeatingTemperature = 18;
    applyTestThresholds(settings, true);
    assert.equal(values.frontLeftHeatingTemperature, 18);
}

function activationStateTests() {
    const data = { demo: false, rpm: 0 };
    assert.equal(getActivationState(data, true, 0, 10000, true), true);
    assert.equal(getActivationState(data, true, 0, 10000, false), null);
    // Test mode is gated by real diagnostic replies, not an RPM or demo signal.
    assert.equal(getActivationState({ demo: true }, true, 0, 10000, true), true);
    assert.equal(getActivationState(data, false, 10000, 10000), false);
    assert.equal(getActivationState({ ...data, rpm: 700 }, false, 10000, 10000), true);
    assert.equal(getActivationState({ ...data, rpm: 700 }, false, 0, 10000), null);
    assert.equal(getActivationState({ ...data, demo: true }, false, 10000, 10000), null);
}

async function temperatureAvailabilityTests() {
    const createReader = require(path.join(app, 'seat-temperature'));
    let reply = [0x62, 0xd8, 0xd7, ...Array(16).fill(20)];
    const reader = createReader({ ready: true, wake() {}, read: async () => reply }, { warn() {} });
    let result = await reader();
    assert.equal(result.available, true); assert.equal(result.frontLeft, 20);
    reply = [0x7f, 0x22, 0x22];
    result = await reader();
    assert.equal(result.available, false); assert.equal(result.frontLeft, null);
    reply = null;
    assert.equal((await reader()).available, false);
}

async function automationTests() {
    let time = 1000, engine = false;
    const values = { temperatureSource: 'inside', rearTemperatureSource: 'inside', steeringTemperatureSource: 'inside',
        frontLeftHeatingLevel: 2, frontRightHeatingLevel: 1,
        frontLeftHeatingTemperature: 15, frontRightHeatingTemperature: 15,
        rearLeftHeatingLevel: 3, rearRightHeatingLevel: 2,
        rearLeftHeatingTemperature: 15, rearRightHeatingTemperature: 15,
        frontLeftVentilationLevel: 0, frontRightVentilationLevel: 0,
        steeringHeatingTemperature: 15 };
    const settings = { get: key => values[key] };
    let equipment = { frontSeatHeating: true, rearSeatHeating: true, steeringWheelHeating: true, fourZoneClimate: false };
    const readings = { frontLeft: 10, frontRight: 20, rearLeft: 1, rearRight: 1, outside: 30 };
    const resolve = position => select(settings, equipment, readings, position);
    const calls = [], active = new Set();
    const seats = { isActive: key => active.has(key), run: async (position, mode, level, options) => {
        assert(options.ready()); calls.push([position, mode, level]); return true;
    } };
    const wheel = { isActive: () => false, activateAutomatically: async ready => {
        assert(ready()); calls.push(['steering']); return true;
    } };
    const automatic = createAutomation(settings, resolve, () => engine, seats, wheel, { warn() {} }, () => time);
    automatic.tick(equipment); await flush(); assert.equal(calls.length, 0);
    engine = null; automatic.tick(equipment); await flush(); assert.equal(calls.length, 0);
    engine = true; automatic.tick(equipment); await flush();
    assert.deepEqual(calls, [['frontLeft', 'Heating', 2], ['rearLeft', 'Heating', 3], ['steering']]);
    automatic.tick(equipment); await flush(); assert.equal(calls.length, 3);
    engine = null; automatic.tick(equipment); engine = true; automatic.tick(equipment); await flush();
    assert.equal(calls.length, 3); // lost RPM must not rearm a completed function
    engine = false; automatic.tick(equipment);
    engine = true;
    values.temperatureSource = 'outside';
    values.rearTemperatureSource = 'outside';
    values.steeringTemperatureSource = 'outside';
    values.frontSeatVentilation = true;
    equipment.frontSeatVentilation = true;
    values.frontLeftVentilationLevel = 2;
    values.frontLeftVentilationTemperature = 25;
    automatic.tick(equipment); await flush();
    assert.deepEqual(calls[3], ['frontLeft', 'Ventilation', 2]);
    assert.equal(calls.length, 4); // outside is hot: none of the heat jobs may run
    time += 61000; automatic.tick(equipment); await flush(); assert.equal(calls.length, 4);

    // A queued job must be cancelled when its source changes or equipment vanishes.
    engine = false; automatic.tick(equipment); engine = true;
    values.temperatureSource = 'inside';
    automatic.tick(equipment);
    values.temperatureSource = 'outside';
    await flush();
    assert.equal(calls.length, 4);
    engine = false; automatic.tick(equipment); engine = true;
    values.temperatureSource = 'inside';
    automatic.tick(equipment);
    equipment = {};
    automatic.tick(equipment);
    await flush();
    assert.equal(calls.length, 4);

    // Missing data never becomes zero or silently switches to another source.
    const unknown = createAutomation(settings, p => select(settings, {}, {}, p), () => true,
        seats, wheel, { warn() {} }, () => time);
    unknown.tick({ frontSeatHeating: true, steeringWheelHeating: true }); await flush();
    assert.equal(calls.length, 4);
}

function diagnosticHarness() {
    let time = 1000, belt = 0, wheelOn = false, ready = true;
    const commands = [], delays = [], levels = new Map();
    const buttonOffsets = { 27: 19, 28: 20, 29: 21, 30: 22, 34: 23, 35: 24, 36: 25, 37: 26 };
    let beltReplies = [0, null, 1];
    class Diag {
        constructor() { this.p = true; }
        async init() { this.p = true; }
        async physical(address, service, data) {
            commands.push({ address, service, data: Array.from(data) });
            if (address === 1) {
                belt = beltReplies.length ? beltReplies.shift() : belt;
                if (belt === null) return null;
                if (service === 0x31) return [0x71, 1, 0xa0, 0xd2, belt];
                const reply = [0x62, 0x40, 0x53, 0, 0, belt ? 140 : 30, 0, belt ? 140 : 30];
                return reply;
            }
            if (address === 0x78 && service === 0x22) {
                const reply = [0x62, 0xd8, 0xdb, ...Array(27).fill(0)];
                levels.forEach((value, offset) => { reply[3 + offset] = value; });
                return reply;
            }
            if (address === 0x78 && service === 0x31) {
                const offset = buttonOffsets[data[3]];
                if (data[0] === 1 && data[4] === 1) {
                    const previous = levels.get(offset) || 0;
                    levels.set(offset, previous === 0 ? 3 : previous - 1);
                }
                return [0x71, ...data];
            }
            if (address === 0x40 && service === 0x22) return [0x62, 0xd0, 0x74, wheelOn ? 1 : 0, 0, 0, 0, 1];
            if (address === 0x40 && service === 0x2e) {
                wheelOn = data[2] > 0;
                return [0x6e, data[0], data[1]];
            }
            throw Error('Unexpected request');
        }
    }
    const modules = {};
    function load(name) {
        if (modules[name]) return modules[name];
        const module = { exports: {} };
        const customRequire = target => target === './kit/diag'
            ? { Diag, hex: n => n.toString(16), replyTo: () => () => true }
            : target === './belt-test' ? load('belt-test') : require(target);
        vm.runInNewContext(fs.readFileSync(path.join(app, name + '.js'), 'utf8'),
            { module, exports: module.exports, require: customRequire, Date: { now: () => time },
                setTimeout(fn, ms) { delays.push(ms); time += ms; fn(); } }, { filename: name });
        modules[name] = module.exports;
        return module.exports;
    }
    return { load, commands, delays, levels, ctx: { isPreview: false, signals: {}, log: { warn() {} } },
        ready: () => ready, cancel: () => { ready = false; },
        belt: sequence => { beltReplies = sequence; }, wheelOn: () => wheelOn };
}

async function commandTests() {
    const h = diagnosticHarness();
    const seats = h.load('ihka-test')(h.ctx, () => true, operation => operation());
    assert.equal(await seats.run('frontLeft', 'Heating', 1, { ready: h.ready }), true);
    assert.equal(h.levels.get(19), 1);
    assert(h.delays.includes(5000) && h.delays.includes(500));
    const presses = h.commands.filter(c => c.address === 0x78 && c.service === 0x31 && c.data[4] === 1);
    const releases = h.commands.filter(c => c.address === 0x78 && c.service === 0x31 && c.data[4] === 0);
    assert.equal(presses.length, 3); assert.equal(releases.length, 3);
    assert(h.commands.some(c => c.address === 0x78 && c.data.join(',') === '2,161,38'));
    h.belt([1]);
    assert.equal(await seats.run('rearRight', 'Ventilation', 2, { ready: h.ready }), true);
    assert.equal(h.levels.get(26), 2);
    h.cancel();
    const count = h.commands.length;
    assert.equal(await seats.run('frontRight', 'Heating', 3, { ready: h.ready }), false);
    assert.equal(h.commands.length, count);

    const w = diagnosticHarness();
    const wheel = w.load('wheel-test')(w.ctx, operation => operation());
    assert.equal(await wheel.activateAutomatically(w.ready), true);
    assert.equal(w.wheelOn(), true);
    assert(w.commands.some(c => c.service === 0x2e && c.data.join(',') === '208,116,30'));
    const before = w.commands.length;
    w.cancel();
    assert.equal(await wheel.activateAutomatically(w.ready), false);
    assert.equal(w.commands.length, before);
}

(async () => {
    sourceTests();
    activationStateTests();
    garageThresholdTests();
    await temperatureAvailabilityTests();
    await automationTests();
    await commandTests();
    console.log('PASS: source selection, rear fallback, driver sensor for steering, UI choices, live diagnostic/engine gating, session decisions, belt retries and complete press/release/stop.');
})().catch(error => { console.error(error); process.exitCode = 1; });
