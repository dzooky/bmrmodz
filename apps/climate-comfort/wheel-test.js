'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const ACSM = 0x01;
const BDC = 0x40;
const WHEEL_HEATING = [0xD0, 0x74];
const WHEEL_TEST_SECONDS = 30;
const WHEEL_KEY = 'steeringHeating';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function createWheelTest(ctx) {
    const diag = ctx.isPreview ? null : new Diag(ctx.signals, ctx.log);
    const active = new Set();
    const pending = new Set();
    let nextCheck = 0;
    const attempted = new Set();
    let busy = false;
    let message = '';
    let wheelExpires = 0;

    async function request(address, service, data) {
        const response = await diag.physical(address, service, data, 1500, replyTo(service, data),
            { hardTimeoutMs: 3000, callTimeoutMs: 2000, maxRetries: 0 });
        if (!response) throw new Error('No response from ECU ' + hex(address));
        if (response[0] === 0x7F) throw new Error('ECU ' + hex(address) + ' refused (NRC ' + hex(response[2]) + ')');
        return response;
    }

    async function driverBeltLatched() {
        const reply = await request(ACSM, 0x31, [0x01, 0xA0, 0xD2, 0x01]);
        return reply.length === 5 && reply[4] === 0x01;
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
            if (diag) {
                if (!diag.p) await diag.init();
                if (!diag.p) throw new Error('Diagnostics unavailable');
                if (on && !await driverBeltLatched()) return;
                pending.delete(WHEEL_KEY);
                message = 'Testing wheel heating...';
                await testWheel(on ? 1 : 0);
            }
            pending.delete(WHEEL_KEY);
            attempted.delete(WHEEL_KEY);
            if (on) {
                active.add(WHEEL_KEY);
                if (!diag) wheelExpires = Date.now() + WHEEL_TEST_SECONDS * 1000;
                message = 'Wheel heating ' + (diag ? 'confirmed' : 'simulated') + ' (30 s test)';
            } else {
                wheelExpires = 0;
                active.delete(WHEEL_KEY);
                message = 'Wheel heating off';
            }
        } catch (error) {
            message = pending.has(WHEEL_KEY) ? 'Waiting for seat belt: ' + error.message : error.message;
        } finally {
            busy = false;
        }
    }

    function run() {
        if (busy) return;
        if (pending.delete(WHEEL_KEY)) {
            message = 'Activation cancelled';
        } else if (active.has(WHEEL_KEY) || attempted.has(WHEEL_KEY)) {
            return perform(false);
        } else {
            pending.add(WHEEL_KEY);
            nextCheck = 0;
            message = 'Waiting for seat belt';
            return tick();
        }
    }

    async function tick() {
        if (busy) return;
        if (wheelExpires && Date.now() >= wheelExpires) {
            wheelExpires = 0;
            active.delete(WHEEL_KEY);
            attempted.delete(WHEEL_KEY);
            message = 'Wheel heating test ended';
        }
        if (!pending.has(WHEEL_KEY) || Date.now() < nextCheck) return;
        nextCheck = Date.now() + 1000;
        return perform(true);
    }

    return {
        run,
        tick,
        isPending: key => pending.has(key),
        isActive: key => active.has(key) || attempted.has(key),
        isBusy: () => busy,
        message: () => message,
    };
}

module.exports = createWheelTest;
