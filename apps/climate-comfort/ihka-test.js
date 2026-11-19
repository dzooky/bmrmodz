'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');
const { pause, waitForBelt } = require('./belt-test');

const IHKA = 0x78;
const REQUEST_GAP_MS = 300;
const CLIMATE_STATUS = [0xD8, 0xDB];
const STOP = [0x02, 0xA1, 0x26];
const SEATS = {
    frontLeft: { Heating: [0x1B, 19], Ventilation: [0x1D, 21] },
    frontRight: { Heating: [0x1C, 20], Ventilation: [0x1E, 22] },
    rearLeft: { Heating: [0x22, 23], Ventilation: [0x24, 25] },
    rearRight: { Heating: [0x23, 24], Ventilation: [0x25, 26] },
};

function createIhkaTest(ctx, activationReady, enqueue) {
    const diag = ctx.isPreview ? null : new Diag(ctx.signals, ctx.log);
    const active = new Set();

    async function request(address, service, data, maxRetries = 3) {
        const reply = await diag.physical(address, service, data, 1500, replyTo(service, data),
            { hardTimeoutMs: 4500, callTimeoutMs: 2000, maxRetries, retryBaseMs: 400 });
        if (!reply) throw new Error('No response from ' + hex(address));
        if (reply[0] === 0x7F) throw new Error('ECU ' + hex(address) + ' NRC ' + hex(reply[2]));
        return reply;
    }

    async function readLevel(offset) {
        const reply = await request(IHKA, 0x22, CLIMATE_STATUS);
        const level = reply[3 + offset];
        if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error('IHKA level unavailable');
        return level;
    }

    async function pressButton(button) {
        const command = [0x01, 0xA1, 0x26, button];
        try {
            await request(IHKA, 0x31, command.concat(0x01));
            await pause(REQUEST_GAP_MS);
        } finally {
            await request(IHKA, 0x31, command.concat(0x00));
        }
    }

    async function waitForLevelChange(offset, previous) {
        for (const delay of [300, 400, 600, 800]) {
            await pause(delay);
            const level = await readLevel(offset);
            if (level !== previous) return level;
        }
        throw new Error('IHKA level did not change');
    }

    async function activate(button, offset, target, ready) {
        let attempted = false;
        try {
            if (!ready()) return false;
            await pause(REQUEST_GAP_MS);
            let level = await readLevel(offset);
            const visited = new Set();
            while (level !== target && !visited.has(level)) {
                if (!ready()) return false;
                visited.add(level);
                attempted = true;
                await pressButton(button);
                level = await waitForLevelChange(offset, level);
            }
            if (level !== target) throw new Error('IHKA did not reach level ' + target);
            return true;
        } finally {
            if (attempted) {
                try {
                    await pause(REQUEST_GAP_MS);
                    await request(IHKA, 0x31, STOP);
                } catch (error) {
                    ctx.log.warn('Climate Comfort IHKA stop: ' + error.message);
                }
            }
        }
    }

    async function readBeltRequest(address, service, data) {
        if (!diag.p) await diag.init();
        if (!diag.p) throw new Error('Diagnostics unavailable');
        return request(address, service, data, 0);
    }

    async function run(position, mode, target, options) {
        const key = position + mode;
        const control = SEATS[position] && SEATS[position][mode];
        if (!control || !Number.isInteger(target) || target < 1 || target > 3 || active.has(key)) return;
        active.add(key);
        const [button, offset] = control;
        const requiresActivation = mode === 'Ventilation' && (position === 'rearLeft' || position === 'rearRight');
        const automaticReady = options && options.ready;
        const ready = () => (!requiresActivation || activationReady()) && (!automaticReady || automaticReady());
        try {
            if (!diag) {
                await pause(REQUEST_GAP_MS);
                return false;
            }
            return await waitForBelt(readBeltRequest, position, ctx.log, ready, enqueue,
                () => activate(button, offset, target, ready), automaticReady || (() => true), options && options.waitMs);
        } catch (error) {
            ctx.log.warn('Climate Comfort ' + key + ': ' + error.message);
            return false;
        } finally {
            active.delete(key);
        }
    }

    return { run, isActive: key => active.has(key) };
}

module.exports = createIhkaTest;
