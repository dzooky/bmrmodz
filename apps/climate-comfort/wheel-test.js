'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const { pause, readBelt, beltCheckDelay, BELT_WAIT_MS } = require('./belt-test');
const BDC = 0x40;
const WHEEL_HEATING = [0xD0, 0x74];
const WHEEL_TEST_SECONDS = 30;
const WHEEL_KEY = 'steeringHeating';

function createWheelTest(ctx, enqueue) {
    const diag = ctx.isPreview ? null : new Diag(ctx.signals, ctx.log);
    const active = new Set();
    const pending = new Set();
    let nextCheck = 0;
    let beltDeadline = 0;
    const attempted = new Set();
    let busy = false;
    let wheelExpires = 0;

    async function request(address, service, data) {
        const response = await diag.physical(address, service, data, 1500, replyTo(service, data),
            { hardTimeoutMs: 3000, callTimeoutMs: 2000, maxRetries: 0 });
        if (!response) throw new Error('No response from ECU ' + hex(address));
        if (response[0] === 0x7F) throw new Error('ECU ' + hex(address) + ' refused (NRC ' + hex(response[2]) + ')');
        return response;
    }

    async function readWheel() {
        const reply = await request(BDC, 0x22, WHEEL_HEATING);
        if (reply.length < 8 || reply[3] > 1) throw new Error('BDC wheel heating state unavailable');
        return { on: reply[3] === 1, fitted: reply[7] === 1 };
    }

    async function testWheel(level) {
        const on = level > 0;
        const current = await readWheel();
        if (on && !current.fitted) throw new Error('BDC did not confirm wheel heating');
        if (!on && !current.on) return;

        attempted.add(WHEEL_KEY);
        const seconds = on ? WHEEL_TEST_SECONDS : 0;
        if (on) wheelExpires = Date.now() + seconds * 1000;
        await request(BDC, 0x2E, WHEEL_HEATING.concat(seconds));
        for (const delay of [300, 500, 800, 1000]) {
            await pause(delay);
            if ((await readWheel()).on === on) return;
        }
        throw new Error('BDC did not confirm wheel heating ' + (on ? 'on' : 'off'));
    }

    async function perform(on) {
        busy = true;
        try {
            await enqueue(async () => {
                if (diag) {
                    if (on && Date.now() >= beltDeadline) {
                        pending.delete(WHEEL_KEY);
                        return;
                    }
                    if (!diag.p) await diag.init();
                    if (!diag.p) throw new Error('Diagnostics unavailable');
                    if (on) {
                        let state = null;
                        try {
                            state = await readBelt(request, 'frontLeft');
                        } catch (error) {
                            ctx.log.warn('Climate Comfort steering belt: ' + error.message);
                        }
                        if (Date.now() >= beltDeadline) {
                            pending.delete(WHEEL_KEY);
                            return;
                        }
                        if (state !== 1) {
                            nextCheck = Date.now() + beltCheckDelay(state);
                            return;
                        }
                    }
                    pending.delete(WHEEL_KEY);
                    await testWheel(on ? 1 : 0);
                }
                pending.delete(WHEEL_KEY);
                attempted.delete(WHEEL_KEY);
                if (on) {
                    active.add(WHEEL_KEY);
                    if (!diag) wheelExpires = Date.now() + WHEEL_TEST_SECONDS * 1000;
                } else {
                    wheelExpires = 0;
                    active.delete(WHEEL_KEY);
                }
            });
        } catch (error) {
            pending.delete(WHEEL_KEY);
            ctx.log.warn('Climate Comfort steering test: ' + error.message);
        } finally {
            busy = false;
        }
    }

    function run() {
        if (busy) return;
        if (pending.delete(WHEEL_KEY)) return;
        if (active.has(WHEEL_KEY) || attempted.has(WHEEL_KEY)) {
            return perform(false);
        } else {
            pending.add(WHEEL_KEY);
            nextCheck = 0;
            beltDeadline = Date.now() + BELT_WAIT_MS;
            return tick();
        }
    }

    async function tick() {
        if (busy) return;
        if (wheelExpires && Date.now() >= wheelExpires) {
            wheelExpires = 0;
            active.delete(WHEEL_KEY);
            attempted.delete(WHEEL_KEY);
        }
        if (!pending.has(WHEEL_KEY) || Date.now() < nextCheck) return;
        if (Date.now() >= beltDeadline) {
            pending.delete(WHEEL_KEY);
            return;
        }
        return perform(true);
    }

    return {
        run,
        tick,
        isPending: key => pending.has(key),
        isActive: key => active.has(key) || attempted.has(key),
        isBusy: () => busy,
    };
}

module.exports = createWheelTest;
