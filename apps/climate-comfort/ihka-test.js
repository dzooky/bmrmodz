'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const IHKA = 0x78;
const ACSM = 0x01;
const DRIVER_BELT = [0x01, 0xA0, 0xD2, 0x01];
const REQUEST_GAP_MS = 300;
const BELT_CHECK_INTERVAL_MS = 5000;
const BELT_WAIT_MS = 60000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const PRESS = [0x01, 0xA1, 0x26, 0x1B, 0x01];
const RELEASE = [0x01, 0xA1, 0x26, 0x1B, 0x00];
const STOP = [0x02, 0xA1, 0x26];

function createIhkaTest(ctx) {
    const diag = new Diag(ctx.signals, ctx.log);
    let busy = false;
    let detail = '';
    let stopResult = '';

    function request(address, data, maxRetries = 3) {
        return diag.physical(address, 0x31, data, 1500, replyTo(0x31, data),
            { hardTimeoutMs: 4500, callTimeoutMs: 2000, maxRetries, retryBaseMs: 400 });
    }

    function result(reply) {
        return reply ? reply.slice(0, 8).map(byte => hex(byte)).join(' ') : 'No response';
    }

    async function waitForDriverBelt() {
        const deadline = Date.now() + BELT_WAIT_MS;
        let lastStatus = 'Driver belt: No response';
        detail = 'Waiting for driver belt...';
        while (Date.now() < deadline) {
            try {
                // Belt reads are paced here, including when TASU is busy.
                const reply = await request(ACSM, DRIVER_BELT, 0);
                const state = reply && reply.length === 5 && reply[0] === 0x71 ? reply[4] : undefined;
                if (state === 0x01) return true;
                lastStatus = state === 0x00 ? 'Driver belt: timed out waiting for latch' :
                    'Driver belt: ' + result(reply);
            } catch (error) {
                lastStatus = /busy|temporarily_not_accepted/i.test(error.message) ? 'Driver belt: TASU busy' :
                    'Driver belt: ' + error.message.slice(0, 54);
                ctx.log.warn('Climate Comfort driver belt: ' + error.message);
            }
            const remaining = deadline - Date.now();
            if (remaining > 0) await pause(Math.min(BELT_CHECK_INTERVAL_MS, remaining));
        }
        detail = lastStatus;
        return false;
    }

    async function showRequest(address, data) {
        try {
            return result(await request(address, data));
        } catch (error) {
            ctx.log.warn('Climate Comfort IHKA test: ' + error.message);
            return /busy|temporarily_not_accepted/i.test(error.message) ? 'TASU busy' : 'Transport error';
        }
    }

    async function run(stopOnly) {
        if (busy) return;
        busy = true;
        detail = '';
        stopResult = '';
        try {
            if (!diag.p) await diag.init();
            if (!diag.p) throw new Error('Diagnostics unavailable');
            if (!stopOnly) {
                if (!await waitForDriverBelt()) return;
                detail = '';
                await pause(REQUEST_GAP_MS);
            }
            try {
                if (!stopOnly) {
                    try {
                        detail = 'Press ' + (await showRequest(IHKA, PRESS));
                        await pause(REQUEST_GAP_MS);
                    } finally {
                        detail += '   Release ' + (await showRequest(IHKA, RELEASE));
                    }
                    await pause(REQUEST_GAP_MS);
                }
            } finally {
                stopResult = 'Stop ' + (await showRequest(IHKA, STOP));
            }
        } catch (error) {
            ctx.log.warn('Climate Comfort IHKA test: ' + error.message);
            detail = 'Diagnostics unavailable';
        } finally {
            busy = false;
        }
    }

    return { run, isBusy: () => busy, detail: () => detail, stopResult: () => stopResult };
}

module.exports = createIhkaTest;
