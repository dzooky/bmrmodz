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
            armed = true; // An already warm engine is eligible for an immediate notification.
            reachedAt = null;
        }
        if (reachedAt !== null && now - reachedAt < MESSAGE_MS) return null;
        if (temperature <= target - 2) armed = true;
        if (!armed || temperature < target) return null;
        armed = false;
        reachedAt = now;
        return target;
    };
}

const MAX_SEND_ATTEMPTS = 5;
const RETRY_MS = 500;

function show(log, language, target, kind) {
    const segments = [
        { text: warmupLabel(language) + ' ', color: '#ffffff' },
        { text: String(target) + ' °C', color: '#ffb547' }
    ];
    async function send() {
        for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
            try {
                const result = await notification.show('osa', segments,
                    { durationMs: MESSAGE_MS, blinkMs: 0, repeat: 1, repeatIntervalMs: 0 });
                if (result && result.ok) {
                    log.info('OSA Notification Tool accepted ' + kind + ' oil warm-up message (attempt ' + attempt + ')');
                    return true;
                }
                log.warn('OSA Notification Tool ' + kind + ' attempt ' + attempt + '/' + MAX_SEND_ATTEMPTS + ': ' +
                    (result && result.error || 'no response'));
            } catch (error) {
                log.warn('OSA Notification Tool ' + kind + ' attempt ' + attempt + '/' + MAX_SEND_ATTEMPTS +
                    ' send/render failed: ' + String(error && error.message || error));
            }
            if (attempt < MAX_SEND_ATTEMPTS)
                await new Promise(resolve => setTimeout(resolve, RETRY_MS));
        }
        log.warn('OSA Notification Tool ' + kind + ': delivery exhausted after ' + MAX_SEND_ATTEMPTS + ' attempts');
        return false;
    }
    return send();
}

function start(log, getSample, getLanguage) {
    if (process.env.MGU_RENDERD_SOCKET && /mgu-emu-/.test(process.env.MGU_RENDERD_SOCKET)) return;
    const warmupMessage = createWarmupMessage();
    let pending = null;
    let sending = false;
    let deliveryExhausted = false;
    function poll() {
        try {
            const sample = getSample();
            if (!sample || sample.demo || !Number.isFinite(sample.oil) ||
                !Number.isFinite(sample.target)) return;
            // Track temperature independently of the output preference. This avoids
            // missing a threshold while Settings or Notification Tool is unavailable.
            const message = warmupMessage(sample.oil, sample.target, Date.now());
            if (message !== null) {
                pending = message;
                deliveryExhausted = false;
                log.info('OSA oil threshold reached: ' + sample.oil + ' °C (target ' + message + ' °C)');
            }
            if (sample.oil <= sample.target - 2 && !sending) pending = null;
            if (pending === null || !sample.enabled || sending || deliveryExhausted) return;
            sending = true;
            const current = pending;
            Promise.resolve()
                .then(() => show(log, getLanguage(), current, 'automatic'))
                .then(success => {
                    if (pending === current) {
                        if (success) pending = null;
                        else deliveryExhausted = true;
                    }
                })
                .catch(error => {
                    deliveryExhausted = true;
                    log.warn('OSA oil notification delivery failed: ' + String(error && error.message || error));
                })
                .finally(() => { sending = false; });
        } catch (error) {
            log.warn('OSA oil notification polling: ' + String(error && error.message || error));
        }
    }
    poll();
    setInterval(poll, 250).unref();
}

module.exports = { start, show, createWarmupMessage, MESSAGE_MS };
