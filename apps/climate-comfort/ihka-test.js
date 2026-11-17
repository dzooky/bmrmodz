'use strict';

const { Diag, replyTo, hex } = require('./kit/diag');

const IHKA = 0x78;
const ACSM = 0x01;
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
            { hardTimeoutMs: 3000, callTimeoutMs: 2000, maxRetries: 0 });
    }

    function result(reply) {
        return reply ? reply.slice(0, 8).map(byte => hex(byte)).join(' ') : 'No response';
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
                const belt = await request(ACSM, [0x01, 0xA0, 0xD2, 0x01]);
                if (!belt || belt.length !== 5 || belt[0] !== 0x71 || belt[4] !== 0x01) {
                    detail = 'Fasten driver belt and retry';
                    return;
                }
            }
            try {
                if (!stopOnly) {
                    try {
                        detail = 'Press ' + result(await request(IHKA, PRESS));
                        await new Promise(resolve => setTimeout(resolve, 250));
                    } finally {
                        detail += '   Release ' + result(await request(IHKA, RELEASE));
                    }
                }
            } finally {
                stopResult = 'Stop ' + result(await request(IHKA, STOP));
            }
        } catch (error) {
            ctx.log.warn('Climate Comfort IHKA test: ' + error.message);
            detail = 'Diagnostic error. Try Stop A126.';
        } finally {
            busy = false;
        }
    }

    return { run, isBusy: () => busy, detail: () => detail, stopResult: () => stopResult };
}

module.exports = createIhkaTest;
