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
    const values = { appEnabled: true, temperatureSource: 'inside', rearTemperatureSource: 'inside', steeringTemperatureSource: 'inside' };
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
    const cv = { roundRect() {}, circle() {}, polyline() {}, text(t) { texts.push(t); },
        target(x, y, w, h, fn, key) { targets[key] = fn; bounds.push(y + h); } };
    function render() {
        targets = {}; texts = []; bounds = [];
        page.render(cv, { text: '#fff', dim: '#aaa' }, equipment);
        assert(bounds.every(bottom => bottom <= 512));
        assert(!texts.includes('Inside temperature') && !texts.includes('Outside temperature'));
    }
    values.appEnabled = false;
    render();
    assert.deepEqual(Object.keys(targets), ['app-enabled']);
    assert(!texts.includes('Front seat temperature source'));
    targets['app-enabled']();
    assert.equal(values.appEnabled, true);
    render();
    assert(targets['temperature-source'] && targets['rear-temperature-source'] && targets['steering-temperature-source']);
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

async function manualFrontTest() {
    let time = 1000;
    const values = {
        frontLeftHeatingLevel: 2, frontRightHeatingLevel: 1,
        rearLeftHeatingLevel: 3, rearRightHeatingLevel: 3,
        frontLeftHeatingTemperature: 20, frontRightHeatingTemperature: 20,
        rearLeftHeatingTemperature: 20, rearRightHeatingTemperature: 20,
        steeringHeatingTemperature: 20,
    };
    const calls = [], releases = [];
    const seats = { isActive: () => false, run(position, mode, level, options) {
        calls.push({ position, mode, level, options });
        return new Promise(resolve => releases.push(resolve));
    } };
    const wheel = { isActive: () => false, activateAutomatically() { throw Error('Wheel must not start'); } };
    const automation = createAutomation({ get: key => values[key] },
        () => ({ value: 17, source: 'inside', sensor: 'frontLeft' }), () => false,
        seats, wheel, { warn() {} }, () => time,
        { manual: true, positions: ['frontLeft', 'frontRight'], includeSteering: false });
    const equipment = { frontSeatHeating: true, rearSeatHeating: true, steeringWheelHeating: true };
    automation.tick(equipment); await flush(); assert.equal(calls.length, 0);
    automation.start(); automation.tick(equipment); await flush();
    assert.equal(automation.isRunning(), true);
    assert.deepEqual(calls.map(call => call.position), ['frontLeft', 'frontRight']);
    time += 180000;
    automation.tick(equipment); await flush();
    assert(calls.every(call => call.options.ready()));
    assert(calls.every(call => call.options.waitMs === Infinity));
    automation.stop();
    assert.equal(automation.isRunning(), false);
    assert(calls.every(call => !call.options.ready()));
    releases.splice(0).forEach(resolve => resolve(false));
    await flush(); automation.tick(equipment); await flush();
    assert.equal(calls.length, 2);
    automation.start(); automation.tick(equipment); await flush();
    assert.equal(calls.length, 4); // a fresh simulated journey rearms both front seats
    automation.stop();
    releases.splice(0).forEach(resolve => resolve(false));
    await flush();
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

async function combinedFrontCommandsTest() {
    const h = diagnosticHarness();
    h.belt([1]);
    let tail = Promise.resolve();
    const enqueue = fn => {
        const promise = tail.then(fn);
        tail = promise.catch(() => {});
        return promise;
    };
    const seats = h.load('ihka-test')(h.ctx, () => false, enqueue);
    const values = {};
    for (const position of ['frontLeft', 'frontRight']) {
        values[position + 'HeatingTemperature'] = 20;
        values[position + 'VentilationTemperature'] = 10;
        values[position + 'HeatingLevel'] = 1;
        values[position + 'VentilationLevel'] = 1;
    }
    const automatic = createAutomation({ get: key => values[key] },
        position => ({ value: 17, source: 'inside', sensor: position }), () => false,
        seats, { isActive: () => false }, h.ctx.log, () => 1000,
        { manual: true, positions: ['frontLeft', 'frontRight'], includeSteering: false });
    const equipment = { frontSeatHeating: true, frontSeatVentilation: true };
    async function settle() { for (let i = 0; i < 400; i++) await flush(); }
    automatic.start(); automatic.tick(equipment); await settle();
    for (const offset of [19, 20, 21, 22]) assert.equal(h.levels.get(offset), 1);
    automatic.stop();
    for (const offset of [19, 20, 21, 22]) h.levels.set(offset, 0); // physical panel off
    automatic.start(); automatic.tick(equipment); await settle();
    for (const offset of [19, 20, 21, 22]) assert.equal(h.levels.get(offset), 1);
    automatic.stop();
}

async function cancellationAndRestartTests() {
    const { createCancellation, waitForBelt } = require(path.join(app, 'belt-test'));
    const signal = createCancellation();
    let valid = true, reads = 0;
    const statuses = [];
    const waiting = waitForBelt(async () => {
        reads++;
        return [0x71, 1, 0xa0, 0xd2, 0];
    }, 'frontLeft', { warn() {} }, () => valid, fn => fn(),
    () => { throw Error('An open belt must not activate'); }, () => valid, Infinity, signal,
    message => statuses.push(message));
    await flush();
    assert(statuses.includes('Waiting for belt'));
    const stoppedAt = Date.now();
    valid = false; signal.cancel();
    assert.equal(await waiting, false);
    assert(Date.now() - stoppedAt < 500); // interrupt the five-second wait
    assert.equal(reads, 1);

    const values = { frontLeftVentilationLevel: 1, frontLeftVentilationTemperature: 10 };
    let busy = true;
    const calls = [], releases = [];
    const seats = {
        isActive: () => busy,
        run(position, mode, level, options) {
            calls.push(options);
            return new Promise(resolve => releases.push(resolve));
        },
    };
    const test = createAutomation({ get: key => values[key] },
        () => ({ value: 17, source: 'inside', sensor: 'frontLeft' }), () => false,
        seats, {}, { warn() {} }, () => 1000,
        { manual: true, positions: ['frontLeft'], includeSteering: false });
    const equipment = { frontSeatVentilation: true };
    test.start(); test.tick(equipment); await flush();
    assert.equal(test.status('frontLeftVentilation'), 'Previous task finishing');
    busy = false; test.tick(equipment); await flush();
    assert.equal(calls.length, 1); // a busy old task must not mark this test completed
    test.stop(); assert.equal(calls[0].signal.cancelled, true);
    test.start(); test.tick(equipment); await flush();
    assert.equal(calls.length, 2);
    releases.shift()(false); await flush();
    test.tick(equipment); await flush();
    assert.equal(calls.length, 2); // an old finally must not remove the new pending task
    assert.equal(calls[1].ready(), true);
    test.stop();
    releases.shift()(false); await flush();
}

async function diagnosticPacingTests() {
    const { createBeltReader } = require(path.join(app, 'belt-test'));
    let time = 1000, reads = 0, state = 0, busy = false;
    const reader = createBeltReader(async () => {
        reads++;
        if (busy) throw Error('TASU busy');
        return [0x71, 1, 0xa0, 0xd2, state];
    }, () => time);
    assert.deepEqual(await Promise.all([reader('frontLeft'), reader('frontLeft')]), [0, 0]);
    assert.equal(reads, 1);
    await reader('frontRight'); assert.equal(reads, 2);
    time += 4999; await reader('frontLeft'); assert.equal(reads, 2);
    time++; state = 1; assert.equal(await reader('frontLeft'), 1); assert.equal(reads, 3);
    time += 4000; assert.equal(await reader('frontLeft'), 1); assert.equal(reads, 3);
    reader.clear(); busy = true;
    await assert.rejects(reader('frontLeft'), /TASU busy/); assert.equal(reads, 4);
    time += 499; await assert.rejects(reader('frontLeft'), /TASU busy/); assert.equal(reads, 4);
    time++; busy = false; assert.equal(await reader('frontLeft'), 1); assert.equal(reads, 5);

    const createQueue = require(path.join(app, 'diagnostic-queue'));
    const starts = [];
    const queue = createQueue(350, () => time, async ms => { time += ms; });
    await queue(async () => { starts.push(time); });
    await queue(async () => { starts.push(time); queue.backoff(1000); });
    await assert.rejects(queue(async () => { starts.push(time); throw Error('No response'); }), /No response/);
    await queue(async () => { starts.push(time); });
    assert(starts[1] - starts[0] >= 350);
    assert(starts[2] - starts[1] >= 1000);
    assert(starts[3] - starts[2] >= 350);
}

async function rearCommandsTest() {
    const h = diagnosticHarness();
    h.belt([1]);
    let tail = Promise.resolve();
    const enqueue = fn => {
        const promise = tail.then(fn); tail = promise.catch(() => {}); return promise;
    };
    const seats = h.load('ihka-test')(h.ctx, () => false, enqueue);
    const values = {};
    for (const position of ['rearLeft', 'rearRight']) {
        values[position + 'HeatingTemperature'] = 20;
        values[position + 'VentilationTemperature'] = 10;
        values[position + 'HeatingLevel'] = 1;
        values[position + 'VentilationLevel'] = 1;
    }
    const rear = createAutomation({ get: key => values[key] },
        position => ({ value: 17, source: 'inside', sensor: position }), () => false,
        seats, {}, h.ctx.log, () => 1000,
        { manual: true, positions: ['rearLeft', 'rearRight'], includeSteering: false });
    const equipment = { rearSeatHeating: true, rearSeatVentilation: true, frontSeatHeating: true, steeringWheelHeating: true };
    async function settle() { for (let i = 0; i < 500; i++) await flush(); }
    rear.tick(equipment); await settle(); assert.equal(h.commands.length, 0);
    rear.start(); rear.tick(equipment); await settle();
    for (const offset of [23, 24, 25, 26]) assert.equal(h.levels.get(offset), 1);
    assert(!h.commands.some(c => c.address === 1 && c.service === 0x31));
    assert(h.commands.some(c => c.address === 1 && c.service === 0x22 && c.data.join(',') === '64,83'));
    assert(!h.commands.some(c => c.address === 0x78 && c.service === 0x31 && [27, 28, 29, 30].includes(c.data[3])));
    rear.stop();
    for (const offset of [23, 24, 25, 26]) h.levels.set(offset, 0);
    rear.start(); rear.tick(equipment); await settle();
    for (const offset of [23, 24, 25, 26]) assert.equal(h.levels.get(offset), 1);
    rear.stop();

    const base = require(path.join(app, 'belt-test'));
    const openRear = async () => [0x62, 0x40, 0x53, 0, 0, 30, 0, 30];
    assert.equal(await base.readBelt(openRear, 'rearLeft'), 0);
    assert.equal(await base.readBelt(openRear, 'rearRight'), 0);
}

async function masterSwitchTests() {
    const values = { appEnabled: false, frontLeftHeatingLevel: 1, frontLeftHeatingTemperature: 20 };
    const calls = [], releases = [];
    const seats = {
        isActive: () => false,
        run(position, mode, level, options) {
            calls.push(options);
            return new Promise(resolve => releases.push(resolve));
        },
    };
    const controller = createAutomation({ get: key => values[key] },
        () => ({ value: 17, source: 'inside', sensor: 'frontLeft' }), () => true,
        seats, {}, { warn() {} }, () => 1000);
    const equipment = { frontSeatHeating: true };
    controller.tick(equipment); await flush(); assert.equal(calls.length, 0);
    values.appEnabled = true;
    controller.tick(equipment); await flush(); assert.equal(calls.length, 1);
    assert.equal(calls[0].ready(), true);
    values.appEnabled = false;
    assert.equal(calls[0].ready(), false);
    controller.stop();
    assert.equal(calls[0].signal.cancelled, true);
    releases.shift()(false); await flush();
    controller.tick(equipment); await flush(); assert.equal(calls.length, 1);
    values.appEnabled = true;
    controller.tick(equipment); await flush(); assert.equal(calls.length, 2);
    controller.stop(); releases.shift()(false); await flush();
}

function bmwServicesTests() {
    const { inspectCatalog, maxScroll } = require(path.join(app, 'bmw-services'));
    const report = inspectCatalog({
        interfaces: {
            'de.bmw.ClimateControlRules': { fields: { ruleEnabled: { getter: 1, notifier: 2, setter: 3 } }, methods: { setRule: {} } },
            'de.bmw.ConnectedDrive.Entitlements': { fields: { status: { getter: 5 } } },
            'de.bmw.CDS': { fields: { rpm: { getter: 1 } } },
        },
        instanceIDs: { 'de.bmw.ClimateControlRules': { Main_Instance: 1 } },
    });
    assert.equal(report.interfaceCount, 3);
    assert.equal(report.matchCount, 2);
    assert.equal(report.subscription, 'Unknown');
    assert.equal(report.climateRules, 'Unknown');
    const rules = report.matches.find(match => match.name === 'de.bmw.ClimateControlRules');
    assert.deepEqual(rules.instances, ['Main_Instance']);
    assert.equal(rules.fields[0].readable, true);
    assert.equal(rules.fields[0].notified, true);
    assert.equal(rules.fields[0].writable, true);
    assert.deepEqual(rules.methods, ['setRule']);
    const ruleDetails = require(path.join(app, 'bmw-services')).detailLines(report, report.matches.indexOf(rules));
    assert(ruleDetails.some(line => line.includes('ruleEnabled')));
    assert.equal(maxScroll({ ...report, matches: Array(17).fill(rules) }), 0); // listed only, never invoked
    assert.throws(() => inspectCatalog({}), /Invalid catalog/);
    const empty = inspectCatalog({ interfaces: {}, instanceIDs: {} });
    assert.equal(empty.matchCount, 0);
    assert.equal(empty.subscription, 'Unknown');
    assert.equal(maxScroll({ ...report, matches: Array(40).fill(rules) }) > 0, true);
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

    const unlimited = diagnosticHarness();
    unlimited.belt([...Array(14).fill(0), 1]);
    const unlimitedSeats = unlimited.load('ihka-test')(unlimited.ctx, () => true, operation => operation());
    assert.equal(await unlimitedSeats.run('frontLeft', 'Heating', 3,
        { ready: unlimited.ready, waitMs: Infinity }), true);
    assert(unlimited.delays.filter(delay => delay === 5000).length >= 14);

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
    await manualFrontTest();
    await combinedFrontCommandsTest();
    await cancellationAndRestartTests();
    await diagnosticPacingTests();
    await rearCommandsTest();
    await masterSwitchTests();
    bmwServicesTests();
    console.log('PASS: source selection, rear fallback, driver sensor for steering, UI choices, live diagnostic/engine gating, session decisions, belt retries and complete press/release/stop, independent Front/Rear Start/Stop.');
})().catch(error => { console.error(error); process.exitCode = 1; });
