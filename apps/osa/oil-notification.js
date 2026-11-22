'use strict';

// Oil Service Assistant owns the temperature trigger and localized message.
// The shared Notification Tool alone owns KOMBI rendering and timing.
const notification = require('./kit/notification-tool');
const { warmupLabel } = require('./cluster-locales');
const MESSAGE_MS = 4000;

function createWarmupMessage() {
    let previousTarget = null;
    let armed = false;
    let reachedAt = null;
    return (temperature, target, now) => {
        if (target !== previousTarget) {
            previousTarget = target;
            armed = temperature < target;
            reachedAt = null;
        }
        if (reachedAt !== null && now - reachedAt < MESSAGE_MS) return target;
        if (temperature <= target - 2) armed = true;
        if (!armed || temperature < target) return null;
        armed = false;
        reachedAt = now;
        return target;
    };
}

function show(log, language, target, kind) {
    const segments = [
        { text: warmupLabel(language) + ' ', color: '#ffffff' },
        { text: String(target) + ' °C', color: '#ffb547' }
    ];
    const send = attempt => Promise.resolve()
        .then(() => notification.show('osa', segments,
            { durationMs: MESSAGE_MS, blinkMs: 0, repeat: 1, repeatIntervalMs: 0 }))
        .then(result => {
            if (result && result.ok) {
                log.info('OSA Notification Tool accepted ' + kind + ' oil warm-up message');
                return;
            }
            if (result && result.error === 'busy' && attempt < 8) {
                return new Promise(resolve => {
                    const timer = setTimeout(() => resolve(send(attempt + 1)), 250);
                    timer.unref();
                });
            }
            log.warn('OSA Notification Tool ' + kind + ': ' +
                (result && result.error || 'no response'));
        })
        .catch(error => log.warn('OSA Notification Tool ' + kind + ' send/render failed: ' +
            String(error && error.message || error)));
    return send(0);
}

function start(log, getSample, getLanguage) {
    if (process.env.MGU_RENDERD_SOCKET && /mgu-emu-/.test(process.env.MGU_RENDERD_SOCKET)) return;
    let warmupMessage = createWarmupMessage();
    let wasEnabled = false;
    let active = false;
    function poll() {
        try {
            const sample = getSample();
            const enabled = !!(sample && sample.enabled && Number.isFinite(sample.oil) &&
                Number.isFinite(sample.target));
            if (!enabled) {
                if (wasEnabled) warmupMessage = createWarmupMessage();
                wasEnabled = false;
                active = false;
                return;
            }
            wasEnabled = true;
            const message = warmupMessage(sample.oil, sample.target, Date.now());
            const visible = message !== null;
            if (visible && !active) show(log, getLanguage(), message, 'automatic');
            active = visible;
        } catch (error) {
            log.warn('OSA oil notification polling: ' + String(error && error.message || error));
        }
    }
    poll();
    setInterval(poll, 250).unref();
}

module.exports = { start, show, createWarmupMessage, MESSAGE_MS };
