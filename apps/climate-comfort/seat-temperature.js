'use strict';

const BDC = 0x40;
const SEAT_DIDS = {
    frontLeft: [0xD732, 0xE432],
    frontRight: [0xD72F, 0xE430],
    rearLeft: [0xD7F1, 0xE433],
    rearRight: [0xD7B0, 0xE431],
};

function createSeatTemperatureReader(link) {
    const preferred = {};
    return async function readSeatTemperature(seat) {
        if (!link.ready) await link.init();
        if (!link.ready) return null;

        const dids = SEAT_DIDS[seat];
        const first = preferred[seat] || dids[0];
        const other = first === dids[0] ? dids[1] : dids[0];
        for (const did of [first, other]) {
            const reply = await link.read(BDC, did, 1200);
            if (!reply) return null;
            if (reply[0] === 0x7F && (reply[2] === 0x22 || reply[2] === 0x31)) continue;
            const dedicated = did === dids[0];
            if (reply[0] !== 0x62 || reply[1] !== (did >> 8) || reply[2] !== (did & 0xFF) ||
                reply.length !== (dedicated ? 5 : 12)) return null;

            preferred[seat] = did;
            const raw = reply[dedicated ? 3 : 5];
            const temperature = raw < 128 ? raw : raw - 256;
            return temperature >= -40 && temperature <= 85 ? temperature : null;
        }
        return null;
    };
}

module.exports = createSeatTemperatureReader;
