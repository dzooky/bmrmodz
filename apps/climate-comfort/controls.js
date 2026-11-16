'use strict';

function renderTemperatureButton(cv, settings, key, x, y, direction, color) {
    cv.roundRect(x - 38, y - 23, 76, 46, 10, '#ffffff12');
    cv.polyline([[x - 10, y + direction * 4], [x, y - direction * 6],
        [x + 10, y + direction * 4]], 3, color);
    cv.target(x - 38, y - 23, 76, 46, () => adjustSetting(settings, key, direction),
        key + (direction > 0 ? '-up' : '-down'));
}

function adjustSetting(settings, key, direction) {
    const setting = settings.item(key);
    const current = settingValue(settings, setting);
    const next = Math.max(setting.min, Math.min(setting.max, current + direction));
    if (next !== current) settings.set(key, next);
}

function settingValue(settings, setting) {
    const value = settings.get(setting.key);
    return Number.isInteger(value) && value >= setting.min && value <= setting.max
        ? value : setting.default;
}

function renderTemperature(cv, theme, settings, key, x, color) {
    const center = { align: 'center' };
    renderTemperatureButton(cv, settings, key, x, 204, 1, color);
    cv.text(settingValue(settings, settings.item(key)) + ' °C',
        x, 259, 26, theme.text, center);
    renderTemperatureButton(cv, settings, key, x, 296, -1, color);
}

module.exports = { renderTemperature, adjustSetting, settingValue };
