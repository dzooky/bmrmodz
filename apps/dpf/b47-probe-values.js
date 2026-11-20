'use strict';
/**
 * Experimental B47 DPF readout candidates for an external BimmerLink comparison.
 * This is NOT verified B47 calibration and must not feed the main DPF gauges.
 * The payload is a full positive UDS 0x62 DID reply (not just data bytes).
 */
const CANDIDATES = {
    '44BE': { name: 'Soot mass', bytes: 2, factor: 0.01525902, decimals: 2, unit: 'g', note: 'B57 factor' },
    '44BD': { name: 'Ash mass', bytes: 2, factor: 0.01525902, decimals: 2, unit: 'g', note: 'B57 factor' },
    '44BF': { name: 'Since last regen', bytes: 4, factor: 0.001, decimals: 2, unit: 'km', note: 'if raw is metres' },
    '44C7': { name: 'Avg regen interval', bytes: 2, factor: 1, decimals: 0, unit: 'km', note: 'if raw is km' }
};
function candidate(did, reply) {
    const id = typeof did === 'number' ? did.toString(16).toUpperCase().padStart(4, '0') : String(did).toUpperCase();
    const spec = CANDIDATES[id];
    if (!spec || !Array.isArray(reply) || reply.length !== spec.bytes + 3 ||
        reply[0] !== 0x62 || reply[1] !== parseInt(id.slice(0, 2), 16) ||
        reply[2] !== parseInt(id.slice(2, 4), 16)) return null;
    let raw = 0;
    for (let i = 3; i < reply.length; i++) raw = raw * 256 + reply[i];
    return { raw, value: raw * spec.factor, display: (raw * spec.factor).toFixed(spec.decimals) +
        ' ' + spec.unit, note: spec.note };
}
// Display raw readings in decimal as a comparison aid, without inferring units.
const UNVERIFIED = {
    '44BB': { bytes: 1, label: 'regen request byte', context: 'BimmerLink: Requested No (baseline)' },
    '467E': { bytes: 4, label: 'regen mode bits', context: 'BimmerLink: Running No (baseline)' },
    '44ED': { bytes: 2, label: 'pressure encoded', context: 'BimmerLink: 0.01 bar diff / 1.00 bar before DPF' },
    '4502': { bytes: 2, label: 'temperature encoded', context: 'BimmerLink: 134 C exhaust before DPF (baseline)' }
};
function rawReading(did, reply) {
    const id = typeof did === 'number' ? did.toString(16).toUpperCase().padStart(4,'0') : String(did).toUpperCase();
    const spec = UNVERIFIED[id];
    if (!spec || !Array.isArray(reply) || reply.length !== spec.bytes + 3 ||
        reply[0] !== 0x62 || reply[1] !== parseInt(id.slice(0,2),16) ||
        reply[2] !== parseInt(id.slice(2,4),16)) return null;
    let raw=0;
    for(let i=3;i<reply.length;i++) raw=raw*256+reply[i];
    const hex=reply.slice(3).map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join('');
    return {raw, hex, display: 'RAW ' + raw + ' (0x' + hex + ')', label:spec.label, context:spec.context};
}
module.exports = { CANDIDATES, candidate, UNVERIFIED, rawReading };
