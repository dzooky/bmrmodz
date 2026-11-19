'use strict';

const controlTexture = require('./control-texture');

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

function renderControlIcon(cv, x, y, title, color) {
    if (title === 'Heating') {
        cv.polyline([[x - 14, y + 6], [x + 1, y + 6], [x + 8, y - 12],
            [x + 14, y - 10], [x + 7, y + 12], [x - 12, y + 12], [x - 14, y + 6]], 2, color);
        for (const dx of [-8, -2, 4]) {
            cv.polyline([[x + dx, y + 2], [x + dx - 2, y - 2],
                [x + dx, y - 6], [x + dx - 2, y - 10]], 2, color);
        }
        return;
    }

    let blade = [[2, -3], [1, -10], [4, -14], [9, -13], [10, -9], [7, -5], [2, -3]];
    for (let turn = 0; turn < 4; turn++) {
        cv.polyline(blade.map(([dx, dy]) => [x + dx, y + dy]), 2, color);
        blade = blade.map(([dx, dy]) => [-dy, dx]);
    }
}

function drawPanelIcon(cv, x, steering, title, color) {
    if (steering) {
        cv.arc(x - 4, 132, 10.5, 12.5, 76, 360, color);
        cv.roundRect(x - 7.5, 128.5, 7, 7, 3.5, color);
        cv.polyline([[x - 15, 132], [x - 4, 131], [x + 7, 133]], 2, color);
        cv.polyline([[x - 4, 133], [x - 4, 143]], 2, color);
        for (const dx of [-1, 6, 13]) {
            const tip = x + dx;
            cv.polyline([[tip, 124], [tip + 1, 120], [tip + 1, 117], [tip - 1, 113],
                [tip - 1, 109], [tip, 106]], 2, color);
            cv.polyline([[tip - 3, 110], [tip, 106], [tip + 3, 110]], 2, color);
        }
    } else {
        renderControlIcon(cv, x, 125, title, color);
    }
}

function renderControlPanel(cv, x, height, title, color, steering = false, theme, gpu) {
    cv.strokeRoundRect(x - 82, 92, 164, height, 15, 2, color);
    const key = steering ? 'steering-icon' : title + '-icon';
    const draw = pen => drawPanelIcon(pen, 24, steering, title, color);
    // The icon drawing uses its original vertical coordinates inside a translated pen.
    const rendered = controlTexture(cv, theme, gpu, key, color, x - 24, 101, 48, 46, pen => {
        draw({
            arc: (cx, cy, ...args) => pen.arc(cx, cy - 101, ...args),
            polyline: (points, ...args) => pen.polyline(points.map(([px, py]) => [px, py - 101]), ...args),
            roundRect: (left, top, ...args) => pen.roundRect(left, top - 101, ...args),
        });
    });
    if (!rendered) drawPanelIcon(cv, x, steering, title, color);
    cv.text(title, x, 159, 18, color, { align: 'center' });
}

function renderControlAction(cv, theme, x, y, label, color, key, run, height = 32, gpu) {
    const enabled = !!run;
    const draw = pen => {
        pen.roundRect(0, 0, 122, height, 8, '#ffffff12');
        if (enabled) pen.strokeRoundRect(0, 0, 122, height, 8, 1, color);
        pen.text(label, 61, height / 2 + 6, 17, enabled ? theme.text : theme.dim, { align: 'center' });
    };
    const rendered = controlTexture(cv, theme, gpu, key,
        [label, color, enabled, theme.text, theme.dim], x - 61, y, 122, height, draw);
    if (!rendered) {
        cv.roundRect(x - 61, y, 122, height, 8, '#ffffff12');
        if (run) cv.strokeRoundRect(x - 61, y, 122, height, 8, 1, color);
        cv.text(label, x, y + height / 2 + 6, 18, run ? theme.text : theme.dim, { align: 'center' });
    }
    if (run) cv.target(x - 61, y, 122, height, run, key);
}

module.exports = { renderTemperature, adjustSetting, settingValue, renderControlPanel, renderControlAction };
