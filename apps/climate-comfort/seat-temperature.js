'use strict';

const BDC = 0x40;
const SEAT_DIDS = {
    frontLeft: [0xD732, 0xE432],
    frontRight: [0xD72F, 0xE430],
    rearLeft: [0xD7F1, 0xE433],
    rearRight: [0xD7B0, 0xE431],
};

const hex = byte => byte.toString(16).toUpperCase().padStart(2, '0');

function createSeatTemperatureReader(link, diagnostics) {
    const preferred = {};
    return async function readSeatTemperature(seat) {
        const results = [];
        diagnostics[seat] = 'Reading...';
        if (!link.ready) await link.init();
        if (!link.ready) {
            diagnostics[seat] = 'Diagnostics unavailable';
            return null;
        }
        link.wake(BDC);
        const dids = SEAT_DIDS[seat];
        const first = preferred[seat] || dids[0];
        const other = first === dids[0] ? dids[1] : dids[0];
        for (const did of [first, other]) {
            let reply;
            try {
                reply = await link.read(BDC, did, 1200);
            } catch (error) {
                const reason = /busy|temporarily_not_accepted/i.test(error.message) ? 'TASU busy' : 'Transport error';
                results.push(hex(did) + ' ' + reason);
                diagnostics[seat] = results.join(' / ');
                continue;
            }
            results.push(hex(did) + ' ' + (reply && reply.length
                ? Array.from(reply.slice(0, 12), hex).join(' ') : 'No response'));
            diagnostics[seat] = results.join(' / ');
            if (!reply || reply[0] === 0x7F) continue;
            const dedicated = did === dids[0];
            if (reply[0] !== 0x62 || reply[1] !== (did >> 8) || reply[2] !== (did & 0xFF) ||
                reply.length !== (dedicated ? 5 : 12)) continue;

            const raw = reply[dedicated ? 3 : 5];
            const temperature = raw < 128 ? raw : raw - 256;
            if (temperature >= -40 && temperature <= 85) {
                preferred[seat] = did;
                return temperature;
            }
        }
        return null;
    };
}

module.exports = createSeatTemperatureReader;
