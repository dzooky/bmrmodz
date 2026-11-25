'use strict';

// Apply the requested garage thresholds once, including already installed apps.
// Levels and selected temperature sources are preserved.
module.exports = function applyTestThresholds(settings, enabled) {
    if (!enabled || settings.get('_garageThresholdsV1') === true) return;
    settings.schema.forEach(item => {
        if (item.key.endsWith('HeatingTemperature')) settings.set(item.key, 20);
        else if (item.key.endsWith('VentilationTemperature')) settings.set(item.key, 10);
    });
    settings.set('_garageThresholdsV1', true);
};
