'use strict';

const IHKA = 0x78;
const TEMPERATURE_DID = 0xD8D7;
const FOOTWELL_OFFSETS = { frontLeft: 3, frontRight: 4, rearLeft: 8, rearRight: 9 };

function createSeatTemperatureReader(link, log) {
    return async function readFootwellTemperatures() {
        const temperatures = { frontLeft: null, frontRight: null, rearLeft: null, rearRight: null, available: false };
        try {
            if (!link.ready) await link.init();
            if (!link.ready) throw new Error('Diagnostics unavailable');
            link.wake(IHKA);
            const reply = await link.read(IHKA, TEMPERATURE_DID, 1500);
            if (reply && reply.length === 19 && reply[0] === 0x62 && reply[1] === 0xD8 && reply[2] === 0xD7) {
                temperatures.available = true;
                for (const seat of Object.keys(FOOTWELL_OFFSETS)) {
                    const raw = reply[3 + FOOTWELL_OFFSETS[seat]];
                    const value = raw < 128 ? raw : raw - 256;
                    // Signed-byte endpoint codes are not usable temperature measurements.
                    if (value >= -40 && value < 127) temperatures[seat] = value;
                }
            }
        } catch (error) {
            log.warn('Climate Comfort footwell temperature: ' + error.message);
        }
        return temperatures;
    };
}

module.exports = createSeatTemperatureReader;
