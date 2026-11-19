'use strict';

// This resolver is shared by the display and automatic activation.
function temperatureFor(settings, equipment, readings, position) {
    const rear = position.indexOf('rear') === 0;
    const steering = position === 'steering';
    const key = steering ? 'steeringTemperatureSource' : rear ? 'rearTemperatureSource' : 'temperatureSource';
    const source = settings.get(key) === 'outside' ? 'outside' : 'inside';
    let sensor = position;
    let label = 'Inside';
    if (source === 'outside') {
        sensor = 'outside';
        label = 'Outside';
    } else if (steering) {
        sensor = 'frontLeft';
    } else if (rear && equipment.fourZoneClimate !== true) {
        sensor = position === 'rearLeft' ? 'frontLeft' : 'frontRight';
        label = 'Inside (front)';
    }
    const value = readings[sensor];
    return { value: Number.isFinite(value) ? value : null, label, source, sensor };
}

module.exports = temperatureFor;
