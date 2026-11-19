'use strict';

const WINDOW_MS = 60000;
const POSITIONS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];

module.exports = function createAutomation(settings, temperatureFor, engineState, seats, wheel, log, clock) {
    const now = clock || Date.now;
    let running = false, generation = 0, deadline = 0, currentEquipment = {};
    const completed = new Set(), pending = new Set(), nextAttempt = new Map(), initial = new Map();

    function jobs(equipment) {
        const result = [];
        POSITIONS.forEach(position => {
            const row = position.indexOf('front') === 0 ? 'front' : 'rear';
            ['Heating', 'Ventilation'].forEach(mode => {
                if (equipment[row + 'Seat' + mode] !== true) return;
                const key = position + mode;
                const level = settings.get(key + 'Level');
                if (!Number.isInteger(level) || level < 1 || level > 3) return;
                result.push({ key, position, mode, level, thresholdKey: key + 'Temperature' });
            });
        });
        if (equipment.steeringWheelHeating === true) {
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
        if (!Number.isFinite(value)) return null;
        const matches = job.mode === 'Heating' ? value <= threshold : value >= threshold;
        return matches ? { identity, threshold } : null;
    }

    function tick(equipment) {
        currentEquipment = equipment;
        const engine = engineState();
        // Missing RPM is not an engine-stop event and must not rearm the session.
        if (engine === false) {
            if (running) { running = false; generation++; }
            return;
        }
        if (engine !== true) return;
        if (!running) {
            running = true;
            generation++;
            deadline = now() + WINDOW_MS;
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
                completed.add(job.key);
                return;
            }
            const condition = eligible(job);
            if (!condition) return;
            const session = generation;
            const ready = () => {
                if (generation !== session || engineState() !== true || now() >= deadline) return false;
                const currentJob = jobs(currentEquipment).find(candidate => candidate.key === job.key);
                if (!currentJob || currentJob.level !== job.level ||
                    settings.get(job.thresholdKey) !== condition.threshold) return false;
                const reading = temperatureFor(job.position);
                return reading.source + '/' + reading.sensor === condition.identity;
            };
            pending.add(job.key);
            Promise.resolve().then(() => {
                if (!ready()) return false;
                return job.position === 'steering'
                    ? wheel.activateAutomatically(ready)
                    : seats.run(job.position, job.mode, job.level, { ready });
            }).then(success => {
                if (success && generation === session) completed.add(job.key);
            }).catch(error => {
                log.warn('Climate Comfort automatic ' + job.key + ': ' + error.message);
            }).finally(() => {
                pending.delete(job.key);
                if (generation === session) nextAttempt.set(job.key, now() + 5000);
            });
        });
    }

    return { tick };
};
