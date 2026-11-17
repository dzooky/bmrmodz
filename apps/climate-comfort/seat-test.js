'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const IHKA = 0x78;
const ACSM = 0x01;
const BDC = 0x40;
const WHEEL_HEATING = [0xD0, 0x74];
const WHEEL_TEST_SECONDS = 30;
const WHEEL_KEY = 'steeringHeating';
const CLIMATE_STATUS = 0xD8DB;
const BELT_CURRENT = 0x4053;
const SEATS = {
    frontLeft: { contact: 1, Heating: [0x1B, 19], Ventilation: [0x1D, 21] },
    frontRight: { contact: 2, Heating: [0x1C, 20], Ventilation: [0x1E, 22] },
    rearLeft: { currentOffset: 2, Heating: [0x22, 23], Ventilation: [0x24, 25] },
    rearRight: { currentOffset: 4, Heating: [0x23, 24], Ventilation: [0x25, 26] },
    steering: { contact: 1, Heating: true },
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function createSeatTest(ctx) {
    const diag = ctx.isPreview ? null : new Diag(ctx.signals, ctx.log);
    const active = new Set();
    const pending = new Map();
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

    async function beltLatched(seat) {
        if (seat.contact) {
            const reply = await request(ACSM, 0x31, [0x01, 0xA0, 0xD2, seat.contact]);
            return reply.length === 5 && reply[4] === 0x01;
        }

        const reply = await request(ACSM, 0x22, [BELT_CURRENT >> 8, BELT_CURRENT & 0xFF]);
        const current = reply[3 + seat.currentOffset];
        // The G31 rear contacts measured 14.0-14.2 mA latched. Outliers stay unconfirmed.
        return current >= 130 && current <= 150;
    }

    async function readLevel(offset) {
        const reply = await request(IHKA, 0x22, [CLIMATE_STATUS >> 8, CLIMATE_STATUS & 0xFF]);
        const level = reply[3 + offset];
        if (level === undefined || level > 3) throw new Error('IHKA level unavailable');
        return level;
    }

    async function pressButton(button) {
        try {
            await request(IHKA, 0x31, [0x01, 0xA1, 0x26, button, 0x01]);
            await pause(250);
        } finally {
            await request(IHKA, 0x31, [0x01, 0xA1, 0x26, button, 0x00]);
        }
    }

    async function waitForLevelChange(offset, previous) {
        // Allow IHKA to publish the new level without sending another button press.
        for (const delay of [300, 400, 600, 800]) {
            await pause(delay);
            const current = await readLevel(offset);
            if (current !== previous) return current;
        }
        return previous;
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

    async function perform(position, mode, level, waiting) {
        const seat = SEATS[position];
        const key = position + mode;
        busy = true;
        try {
            if (diag) {
                if (!diag.p) await diag.init();
                if (!diag.p) throw new Error('Diagnostics unavailable');
                if (waiting && !await beltLatched(seat)) return;

                pending.delete(key);
                message = 'Testing ' + mode.toLowerCase() + '...';
                if (key === WHEEL_KEY) {
                    await testWheel(level);
                } else {
                    const [button, offset] = seat[mode];
                    let current = await readLevel(offset);
                    const visited = new Set();
                    while (current !== level && !visited.has(current)) {
                        visited.add(current);
                        attempted.add(key);
                        await pressButton(button);
                        const previous = current;
                        current = await waitForLevelChange(offset, previous);
                        if (current === previous) {
                            if (current === 0) attempted.delete(key);
                            throw new Error('IHKA stayed at level ' + current + ' after button ' + hex(button));
                        }
                    }
                    if (current !== level) {
                        throw new Error('IHKA reached level ' + current + ' instead of ' + level);
                    }
                }
            }
            pending.delete(key);
            attempted.delete(key);
            if (level === 0) active.delete(key);
            else active.add(key);
            if (key === WHEEL_KEY) {
                if (level === 0) wheelExpires = 0;
                else if (!diag) wheelExpires = Date.now() + WHEEL_TEST_SECONDS * 1000;
                message = level === 0 ? 'Wheel heating off' :
                    'Wheel heating ' + (diag ? 'confirmed' : 'simulated') + ' (30 s test)';
            } else {
                message = level === 0 ? 'Off' : 'Level ' + level + (diag ? ' confirmed' : ' simulated');
            }
        } catch (error) {
            message = pending.has(key) ? 'Waiting for seat belt: ' + error.message : error.message;
        } finally {
            busy = false;
        }
    }

    function run(position, mode, level) {
        const seat = SEATS[position];
        if (!seat || !Object.prototype.hasOwnProperty.call(seat, mode) ||
            !seat[mode] || !Number.isInteger(level) || level < 0 || level > 3 || busy) return;

        const key = position + mode;
        if (pending.delete(key)) {
            message = 'Activation cancelled';
        } else if (active.has(key) || attempted.has(key)) {
            return perform(position, mode, 0, false);
        } else if (level > 0) {
            pending.set(key, { position, mode, level });
            nextCheck = 0;
            message = 'Waiting for seat belt';
            return tick();
        } else {
            message = 'Select level 1, 2 or 3';
        }
    }

    async function tick() {
        if (!busy && wheelExpires && Date.now() >= wheelExpires) {
            wheelExpires = 0;
            active.delete(WHEEL_KEY);
            attempted.delete(WHEEL_KEY);
            message = 'Wheel heating test ended';
        }
        if (busy || !pending.size || Date.now() < nextCheck) return;
        const [key, test] = pending.entries().next().value;
        // Rotate pending seats so an open belt cannot hold up the other seats.
        pending.delete(key);
        pending.set(key, test);
        nextCheck = Date.now() + 1000;
        return perform(test.position, test.mode, test.level, true);
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

module.exports = createSeatTest;
