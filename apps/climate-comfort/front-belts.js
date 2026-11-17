'use strict';

const { Diag, hex, replyTo } = require('./kit/diag');

const ACSM_ADDRESS = 0x01;
const ROUTINE_CONTROL = 0x31;
const STATUS = { 0x00: 'Open', 0x01: 'Latched', 0xFB: 'Fault', 0xFC: 'Coding mismatch',
    0xFD: 'Not fitted', 0xFF: 'Invalid' };

function frontBeltReader(signals, log) {
    const diag = new Diag(signals, log);
    diag.quiet = true;

    async function readContact(contact) {
        // ACSM5 GURTKONTAKT: startRoutine A0D2 with a single contact selector.
        const request = [0x01, 0xA0, 0xD2, contact];
        const reply = await diag.physical(ACSM_ADDRESS, ROUTINE_CONTROL, request, 1500,
            replyTo(ROUTINE_CONTROL, request), { hardTimeoutMs: 3000 });
        if (!reply) return 'No response';
        if (reply[0] === 0x7F) return reply.length >= 3 ? 'NRC ' + hex(reply[2]) : 'Invalid response';
        if (reply.length !== 5) return 'Unexpected reply (' + reply.map(byte => hex(byte)).join(' ') + ')';
        const value = reply[4];
        return (STATUS[value] || '?') + ' ' + hex(value);
    }

    return async function readFrontBelts(keepReading) {
        if (!diag.p) await diag.init();
        if (!diag.p) return 'Front belts: Diagnostics unavailable';

        const left = await readContact(0x01);
        if (!keepReading()) return null;
        const right = await readContact(0x02);
        return 'A0D2: FL ' + left + '  FR ' + right;
    };
}

module.exports = frontBeltReader;
