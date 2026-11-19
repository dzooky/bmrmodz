'use strict';

// VehicleCondition: 7 = ignition on, 8 = becoming drive-ready, 10 = drive-ready.
// These states are valid with zero RPM, including a car connected to a power supply.
module.exports = function activationState(data, allowEngineOffTest, lastCar, now = Date.now()) {
    if (!data || data.demo) return null;
    if (allowEngineOffTest) {
        if (!Number.isInteger(data.condition) || data.condition < 1 || data.condition > 12) return null;
        return [7, 8, 10].includes(data.condition);
    }
    if (now - lastCar > 5000 || !Number.isFinite(data.rpm)) return null;
    return data.rpm >= 300;
};
