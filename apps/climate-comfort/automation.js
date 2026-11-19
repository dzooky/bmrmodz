'use strict';

const { createCancellation } = require('./belt-test');

const WINDOW_MS = 60000;
const POSITIONS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];

module.exports = function createAutomation(settings, temperatureFor, activationState, seats, wheel, log, clock, options) {
    const now = clock || Date.now;
    const manual = !!(options && options.manual);
    const positions = options && options.positions || POSITIONS;
    let manualEnabled = false;
    let cancellation = createCancellation();
    let running = false, generation = 0, deadline = 0, currentEquipment = {};
    const completed = new Set(), pending = new Map(), nextAttempt = new Map(), initial = new Map(), statuses = new Map();

    function jobs(equipment) {
        const result = [];
        positions.forEach(position => {
            const row = position.indexOf('front') === 0 ? 'front' : 'rear';
            ['Heating', 'Ventilation'].forEach(mode => {
                if (equipment[row + 'Seat' + mode] !== true) return;
                const key = position + mode;
                const level = settings.get(key + 'Level');
                if (!Number.isInteger(level) || level < 1 || level > 3) return;
                result.push({ key, position, mode, level, thresholdKey: key + 'Temperature' });
            });
        });
        if (equipment.steeringWheelHeating === true && !(options && options.includeSteering === false)) {
            result.push({ key: 'steeringHeating', position: 'steering', mode: 'Heating',
                level: 1, thresholdKey: 'steeringHeatingTemperature' });
        }
        return result;
    }

    function eligible(job) {
        const threshold = settings.get(job.thresholdKey);
        if (!Number.isFinite(threshold)) return null;
        const reading = temperatureFor(job.position);
        const identity = reading.source + '/' + reading.sensor;
        // Retain the first valid temperature: cabin heating must not change
        // the startup decision while a passenger is still fastening a belt.
        if (!initial.has(identity) && Number.isFinite(reading.value)) initial.set(identity, reading.value);
        const value = initial.get(identity);
        if (!Number.isFinite(value)) { statuses.set(job.key, 'No temperature'); return null; }
        const matches = job.mode === 'Heating' ? value <= threshold : value >= threshold;
        if (!matches) statuses.set(job.key, 'Temperature outside rule');
        return matches ? { identity, threshold } : null;
    }

    function tick(equipment) {
        currentEquipment = equipment;
        const enabled = manual ? manualEnabled : activationState();
        // An unavailable activation state must not rearm the session.
        if (enabled === false) {
            if (running) { running = false; generation++; }
            return;
        }
        if (enabled !== true) return;
        if (!running) {
            running = true;
            generation++;
            deadline = manual ? Infinity : now() + WINDOW_MS;
            completed.clear();
            nextAttempt.clear();
            initial.clear();
        }
        if (now() >= deadline) return;
        jobs(equipment).forEach(job => {
            if (completed.has(job.key) || pending.has(job.key) || now() < (nextAttempt.get(job.key) || 0)) return;
            const control = job.position === 'steering' ? wheel : seats;
            // A manual test already owns this function for this journey.
            if (control.isActive(job.key) || (control.isPending && control.isPending(job.key))) {
                if (!manual) completed.add(job.key);
                else statuses.set(job.key, 'Previous task finishing');
                return;
            }
            const condition = eligible(job);
            if (!condition) return;
            const session = generation;
            const ready = () => {
                if (generation !== session || (manual ? !manualEnabled : activationState() !== true) || now() >= deadline) return false;
                const currentJob = jobs(currentEquipment).find(candidate => candidate.key === job.key);
                if (!currentJob || currentJob.level !== job.level ||
                    settings.get(job.thresholdKey) !== condition.threshold) return false;
                const reading = temperatureFor(job.position);
                return reading.source + '/' + reading.sensor === condition.identity;
            };
            const token = {};
            const signal = cancellation;
            const report = message => {
                if (generation === session && (!manual || manualEnabled)) statuses.set(job.key, message);
            };
            pending.set(job.key, token);
            report('Waiting for belt');
            Promise.resolve().then(() => {
                if (!ready()) return false;
                return job.position === 'steering'
                    ? wheel.activateAutomatically(ready)
                    : seats.run(job.position, job.mode, job.level, { ready, waitMs: manual ? Infinity : undefined, signal, report });
            }).then(success => {
                if (success && generation === session) {
                    completed.add(job.key);
                    report('Activated level ' + job.level);
                }
            }).catch(error => {
                log.warn('Climate Comfort automatic ' + job.key + ': ' + error.message);
                report('Activation failed');
            }).finally(() => {
                if (pending.get(job.key) === token) pending.delete(job.key);
                if (generation === session) nextAttempt.set(job.key, now() + 5000);
            });
        });
    }

    return {
        tick,
        start() {
            if (!manual || manualEnabled) return;
            cancellation.cancel();
            cancellation = createCancellation();
            pending.clear();
            statuses.clear();
            manualEnabled = true;
            running = false;
            generation++;
        },
        stop() {
            if (!manual) return;
            cancellation.cancel();
            pending.clear();
            manualEnabled = false;
            running = false;
            generation++;
        },
        isRunning: () => manual && manualEnabled,
        status(key) {
            if (!manualEnabled) return 'Stopped';
            if (statuses.has(key)) return statuses.get(key);
            return settings.get(key + 'Level') > 0 ? 'Waiting...' : 'Level off';
        },
    };
};
