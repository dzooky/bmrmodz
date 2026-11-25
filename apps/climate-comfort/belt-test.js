'use strict';

const ACSM = 0x01;
const BELT_WAIT_MS = 60000;
const beltCheckDelay = state => state === 0 ? 5000 : 500;
function createCancellation() {
    let cancelled = false;
    const listeners = new Set();
    return {
        get cancelled() { return cancelled; },
        onCancel(fn) {
            if (cancelled) { fn(); return () => {}; }
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        cancel() {
            if (cancelled) return;
            cancelled = true;
            listeners.forEach(fn => fn());
            listeners.clear();
        },
    };
}

const pause = (ms, signal) => new Promise(resolve => {
    if (!signal) { setTimeout(resolve, ms); return; }
    if (signal.cancelled) { resolve(false); return; }
    let timer, unsubscribe = () => {}, finished = false;
    const finish = value => {
        if (finished) return;
        finished = true;
        if (timer !== undefined) clearTimeout(timer);
        unsubscribe();
        resolve(value);
    };
    timer = setTimeout(() => finish(true), ms);
    if (!finished) unsubscribe = signal.onCancel(() => finish(false));
});

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

function createBeltReader(request, clock = Date.now) {
    const cache = new Map();
    const read = position => {
        const current = cache.get(position);
        if (current && (current.pending || clock() < current.expires)) {
            return current.error ? Promise.reject(current.error) : current.promise;
        }
        const entry = { pending: true, expires: 0, error: null, promise: null };
        cache.set(position, entry);
        entry.promise = readBelt(request, position).then(state => {
            entry.pending = false;
            entry.expires = clock() + (state === 0 || state === 1 ? 5000 : 500);
            return state;
        }, error => {
            entry.pending = false;
            entry.error = error;
            entry.expires = clock() + 500;
            throw error;
        });
        return entry.promise;
    };
    read.clear = () => cache.clear();
    return read;
}

async function waitForBelt(request, position, log, ready, enqueue, onLatched, keepWaiting = () => true, waitMs = BELT_WAIT_MS, signal, report = () => {}, readState) {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline && keepWaiting()) {
        const state = await enqueue(async () => {
            if (Date.now() >= deadline || !keepWaiting()) return null;
            let belt = null, beltError = null;
            try {
                belt = await (readState ? readState(position) : readBelt(request, position));
            } catch (error) {
                log.warn('Climate Comfort belt check: ' + error.message);
                beltError = /busy|TEMPORARILY_NOT_ACCEPTED/i.test(error.message) ? 'Belt: TASU busy' : 'Belt unavailable';
            }
            report(beltError || (belt === 1 ? 'Belt latched' : belt === 0 ? 'Waiting for belt' : 'Belt unavailable'));
            if (belt === 1 && ready() && Date.now() < deadline) {
                return await onLatched() === false ? null : 1;
            }
            return belt === 1 ? 0 : belt;
        });
        if (state === 1) return true;
        const remaining = deadline - Date.now();
        if (remaining > 0) await pause(Math.min(beltCheckDelay(state), remaining), signal);
    }
    return false;
}

module.exports = { createCancellation, createBeltReader, pause, readBelt, beltCheckDelay, waitForBelt, BELT_WAIT_MS };
