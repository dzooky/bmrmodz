'use strict';

const IHKA = 0x78;
const TEMPERATURE_DID = 0xD8D7;
const FOOTWELL_OFFSETS = { frontLeft: 3, frontRight: 4, rearLeft: 8, rearRight: 9 };
const hex = byte => byte.toString(16).toUpperCase().padStart(2, '0');

function createSeatTemperatureReader(link, diagnostics) {
    return async function readFootwellTemperatures() {
        const temperatures = { frontLeft: null, frontRight: null, rearLeft: null, rearRight: null };
        let status;
        try {
            if (!link.ready) await link.init();
            if (!link.ready) throw new Error('Diagnostics unavailable');
            link.wake(IHKA);
            const reply = await link.read(IHKA, TEMPERATURE_DID, 1500);
            status = 'D8D7 ' + (reply && reply.length ? Array.from(reply, hex).join(' ') : 'No response');
            if (reply && reply.length === 19 && reply[0] === 0x62 && reply[1] === 0xD8 && reply[2] === 0xD7) {
                for (const seat of Object.keys(FOOTWELL_OFFSETS)) {
                    const raw = reply[3 + FOOTWELL_OFFSETS[seat]];
                    const value = raw < 128 ? raw : raw - 256;
                    // Signed-byte endpoint codes are not usable temperature measurements.
                    if (value >= -40 && value < 127) temperatures[seat] = value;
                }
            }
        } catch (error) {
            status = /busy|temporarily_not_accepted/i.test(error.message)
                ? 'D8D7 TASU busy' : 'D8D7 ' + error.message.slice(0, 54);
        }
        for (const seat of Object.keys(temperatures)) diagnostics[seat] = status;
        return temperatures;
    };
}

module.exports = createSeatTemperatureReader;
