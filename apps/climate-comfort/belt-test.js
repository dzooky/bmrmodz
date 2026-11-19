'use strict';

const ACSM = 0x01;
const BELT_WAIT_MS = 60000;
const beltCheckDelay = state => state === 0 ? 5000 : 500;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readBelt(request, position) {
    const frontContact = { frontLeft: 1, frontRight: 2 }[position];
    if (frontContact) {
        const reply = await request(ACSM, 0x31, [0x01, 0xA0, 0xD2, frontContact]);
        return reply && reply.length === 5 && (reply[4] === 0 || reply[4] === 1) ? reply[4] : null;
    }
    const rearOffset = { rearLeft: 2, rearRight: 4 }[position];
    const reply = await request(ACSM, 0x22, [0x40, 0x53]);
    const current = reply && reply[3 + rearOffset];
    if (current >= 130 && current <= 150) return 1;
    if (current >= 20 && current <= 50) return 0;
    return null;
}

async function waitForBelt(request, position, log, ready, enqueue, onLatched, keepWaiting = () => true) {
    const deadline = Date.now() + BELT_WAIT_MS;
    while (Date.now() < deadline && keepWaiting()) {
        const state = await enqueue(async () => {
            if (Date.now() >= deadline || !keepWaiting()) return null;
            let belt = null;
            try {
                belt = await readBelt(request, position);
            } catch (error) {
                log.warn('Climate Comfort belt check: ' + error.message);
            }
            if (belt === 1 && ready() && Date.now() < deadline) {
                return await onLatched() === false ? null : 1;
            }
            return belt === 1 ? 0 : belt;
        });
        if (state === 1) return true;
        const remaining = deadline - Date.now();
        if (remaining > 0) await pause(Math.min(beltCheckDelay(state), remaining));
    }
    return false;
}

module.exports = { pause, readBelt, beltCheckDelay, waitForBelt, BELT_WAIT_MS };
