'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const IHKA = 0x78;
const ACSM = 0x01;
const DRIVER_BELT = [0x01, 0xA0, 0xD2, 0x01];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const PRESS = [0x01, 0xA1, 0x26, 0x1B, 0x01];
const RELEASE = [0x01, 0xA1, 0x26, 0x1B, 0x00];
const STOP = [0x02, 0xA1, 0x26];

function createIhkaTest(ctx) {
    const diag = new Diag(ctx.signals, ctx.log);
    let busy = false;
    let detail = '';
    let stopResult = '';

    function request(address, data) {
        return diag.physical(address, 0x31, data, 1500, replyTo(0x31, data),
            { hardTimeoutMs: 3000, callTimeoutMs: 2000, maxRetries: 2, retryBaseMs: 200 });
    }

    function result(reply) {
        return reply ? reply.slice(0, 8).map(byte => hex(byte)).join(' ') : 'No response';
    }

    async function readDriverBelt() {
        let failure;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await pause(350 * attempt);
            try {
                const reply = await request(ACSM, DRIVER_BELT);
                if (reply) return reply;
            } catch (error) {
                failure = error;
            }
        }
        if (failure) throw failure;
        return null;
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
                const belt = await readDriverBelt();
                const state = belt && belt.length === 5 && belt[0] === 0x71 ? belt[4] : undefined;
                if (state !== 0x01) {
                    detail = state === 0x00 ? 'Fasten driver belt and retry' : 'Driver belt: ' + result(belt);
                    return;
                }
            }
            try {
                if (!stopOnly) {
                    try {
                        detail = 'Press ' + (await showRequest(IHKA, PRESS));
                        await pause(250);
                    } finally {
                        detail += '   Release ' + (await showRequest(IHKA, RELEASE));
                    }
                }
            } finally {
                stopResult = 'Stop ' + (await showRequest(IHKA, STOP));
            }
        } catch (error) {
            ctx.log.warn('Climate Comfort IHKA test: ' + error.message);
            if (!diag.p) detail = 'Diagnostics unavailable';
            else if (/busy|temporarily_not_accepted/i.test(error.message)) detail = 'Driver belt: TASU busy';
            else detail = 'Driver belt: ' + error.message.slice(0, 54);
        } finally {
            busy = false;
        }
    }

    return { run, isBusy: () => busy, detail: () => detail, stopResult: () => stopResult };
}

module.exports = createIhkaTest;
