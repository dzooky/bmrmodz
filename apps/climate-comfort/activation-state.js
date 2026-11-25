'use strict';

// The engine-off test uses a recent positive IHKA reply as its availability gate.
// It needs no additional SOME/IP vehicle-state interface; the belt is checked
// separately immediately before activation.
module.exports = function activationState(data, allowEngineOffTest, lastCar, now = Date.now(), liveDiagnostics = false) {
    if (allowEngineOffTest) return liveDiagnostics ? true : null;
    if (!data || data.demo) return null;
    if (now - lastCar > 5000 || !Number.isFinite(data.rpm)) return null;
    return data.rpm >= 300;
};
