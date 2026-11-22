'use strict';

const notification = require('./kit/notification-tool');
const { t } = require('./kit/i18n');
const PREFIX = 'DPF Regeneration:';
const HALF_BLINK_MS = 500;
const BLINK_MS = 6 * HALF_BLINK_MS;
const ACTIVE_REPEAT_MS = 60000;
const REQUESTED = { text: 'Requested', colour: '#ffd700' };
const STARTED = { text: 'Started', colour: '#ff2a2a' };
const ACTIVE = { text: 'In Progress', colour: '#ff2a2a' };
const COMPLETE = { text: 'Finished', colour: '#23dc5a' };
const BLANK = { text: '' };

function blink(message, elapsed) {
    if (elapsed >= BLINK_MS) return null;
    return Math.floor(elapsed / HALF_BLINK_MS) % 2 === 0 ? message : BLANK;
}

function testMessage(elapsed) {
    const message = [REQUESTED, STARTED, ACTIVE, COMPLETE][Math.floor(elapsed / BLINK_MS)];
    return message ? blink(message, elapsed % BLINK_MS) : null;
}

function createIndicator() {
    let previous = null;
    let message = null;
    let startedAt = 0;
    return (state, now) => {
        if (state !== previous) {
            message = state === 'requested' ? REQUESTED : state === 'active' ? STARTED
                : state === 'idle' && previous === 'active' ? COMPLETE : null;
            startedAt = now;
            previous = state;
        }
        if (state === 'active') {
            const elapsed = now - startedAt;
            // Announce the transition once, then repeat "In Progress" each minute.
            // "In Progress" follows the 3-second "Started" window immediately.
            if (elapsed < BLINK_MS) return blink(STARTED, elapsed);
            return blink(ACTIVE, (elapsed - BLINK_MS) % ACTIVE_REPEAT_MS);
        }
        if (!message) return null;
        return blink(message, now - startedAt);
    };
}

function start(log, getMessage) {
    let lastKey = null;
    let lastShownAt = -Infinity;
    function poll() {
        const message = getMessage();
        // State machine still owns the event and recurrence decisions. The tool owns
        // blink timing. Ignore the alternating empty 'blink off' states.
        if (!message || !message.text) return;
        const translated = t(message.text);
        const key = translated + ':' + message.colour;
        const now = Date.now();
        if (key === lastKey && now - lastShownAt < BLINK_MS - 100) return;
        lastKey = key;
        lastShownAt = now;
        notification.show('dpf', [
            { text: t(PREFIX) + ' ', color: '#ffffff' },
            { text: translated, color: message.colour }
        ], { durationMs: BLINK_MS, blinkMs: HALF_BLINK_MS, repeat: 1, repeatIntervalMs: 0 })
            .then(result => {
                if (!result || !result.ok) log.warn('DPF Notification Tool: ' + (result && result.error || 'no response'));
            }).catch(error => log.warn('DPF Notification Tool: ' + error));
    }
    poll();
    setInterval(poll, 250).unref();
}

module.exports = { start, createIndicator, testMessage };
