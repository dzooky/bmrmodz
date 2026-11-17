'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const IHKA = 0x78;
const ACSM = 0x01;
const CLIMATE_STATUS = 0xD8DB;
const BELT_CURRENT = 0x4053;
const SEATS = {
    frontLeft: { contact: 1, Heating: [0x1B, 19], Ventilation: [0x1D, 21] },
    frontRight: { contact: 2, Heating: [0x1C, 20], Ventilation: [0x1E, 22] },
    rearLeft: { currentOffset: 2, Heating: [0x22, 23], Ventilation: [0x24, 25] },
    rearRight: { currentOffset: 4, Heating: [0x23, 24], Ventilation: [0x25, 26] },
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
        // The G31 rear contacts measured 14.0?14.2 mA latched. Outliers stay unconfirmed.
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
        } finally {
            await request(IHKA, 0x31, [0x01, 0xA1, 0x26, button, 0x00]);
        }
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
                const [button, offset] = seat[mode];
                let current = await readLevel(offset);
                const visited = new Set();
                while (current !== level && !visited.has(current)) {
                    visited.add(current);
                    attempted.add(key);
                    await pressButton(button);
                    await pause(350);
                    current = await readLevel(offset);
                }
                if (current !== level) throw new Error('Requested level was not reached');
            }
            pending.delete(key);
            attempted.delete(key);
            if (level === 0) active.delete(key);
            else active.add(key);
            message = level === 0 ? 'Off' : 'Level ' + level + (diag ? ' confirmed' : ' simulated');
        } catch (error) {
            message = pending.has(key) ? 'Waiting for seat belt: ' + error.message : error.message;
        } finally {
            busy = false;
        }
    }

    function run(position, mode, level) {
        const seat = SEATS[position];
        if (!seat || !Object.prototype.hasOwnProperty.call(seat, mode) ||
            !Array.isArray(seat[mode]) || !Number.isInteger(level) || level < 0 || level > 3 || busy) return;

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
