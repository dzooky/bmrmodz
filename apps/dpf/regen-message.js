'use strict';

const notification = require('./kit/notification-tool');
const { t } = require('./kit/i18n');
const PREFIX = 'DPF Regeneration:';
const HALF_BLINK_MS = 500;
const BLINK_MS = 6 * HALF_BLINK_MS;
const PROGRESS_HALF_BLINK_MS = 333;
const PROGRESS_BLINK_MS = 4 * PROGRESS_HALF_BLINK_MS; // Two complete on/off blinks.
const ACTIVE_REPEAT_MS = 60000;
const REQUESTED = { text: 'Requested', colour: '#ffd700' };
const STARTED = { text: 'Started', colour: '#ff2a2a' };
const ACTIVE = { text: 'In Progress', colour: '#ff2a2a', blinkMs: PROGRESS_HALF_BLINK_MS, durationMs: PROGRESS_BLINK_MS };
const COMPLETE = { text: 'Finished', colour: '#23dc5a' };
const BLANK = { text: '' };

function blink(message, elapsed) {
    const duration = message.durationMs || BLINK_MS;
    const halfBlink = message.blinkMs || HALF_BLINK_MS;
    if (elapsed >= duration) return null;
    return Math.floor(elapsed / halfBlink) % 2 === 0 ? message : BLANK;
}

function testMessage(elapsed) {
    const starts = [0, BLINK_MS, 2 * BLINK_MS, 2 * BLINK_MS + PROGRESS_BLINK_MS];
    const messages = [REQUESTED, STARTED, ACTIVE, COMPLETE];
    for (let i = 0; i < messages.length; i++) {
        if (elapsed < starts[i]) break;
        const result = blink(messages[i], elapsed - starts[i]);
        if (result) return result;
        if (elapsed < starts[i] + (messages[i].durationMs || BLINK_MS)) return null;
    }
    return null;
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
    let sequence = 0;
    function poll() {
        const message = getMessage();
        // State machine still owns the event and recurrence decisions. The tool owns
        // blink timing. Ignore the alternating empty 'blink off' states.
        if (!message || !message.text) return;
        const translated = t(message.text);
        const key = translated + ':' + message.colour;
        const now = Date.now();
        const durationMs = message.durationMs || BLINK_MS;
        const blinkMs = message.blinkMs || HALF_BLINK_MS;
        if (key === lastKey && now - lastShownAt < durationMs - 100) return;
        lastKey = key;
        lastShownAt = now;
        const event = ++sequence;
        const segments = [
            { text: t(PREFIX) + ' ', color: '#ffffff' },
            { text: translated, color: message.colour }
        ];
        function send(attempt) {
            if (event !== sequence) return; // A newer regeneration event supersedes retries.
            // Catch synchronous rendering exceptions as well as transport failures.
            Promise.resolve().then(() => notification.show('dpf', segments,
                { durationMs, blinkMs, repeat: 1, repeatIntervalMs: 0 }))
                .then(result => {
                    if (result && result.ok) {
                        if (attempt === 0) log.info('DPF Notification Tool accepted: ' + translated);
                        return;
                    }
                    if (result && result.error === 'busy' && attempt < 5) {
                        const timer = setTimeout(() => send(attempt + 1), 150);
                        timer.unref();
                    } else log.warn('DPF Notification Tool: ' + (result && result.error || 'no response'));
                }).catch(error => log.warn('DPF Notification Tool send/render failed: ' +
                    String(error && error.message || error)));
        }
        send(0);
    }
    poll();
    setInterval(poll, 250).unref();
}

module.exports = { start, createIndicator, testMessage };
