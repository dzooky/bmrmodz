'use strict';

const artwork = require('./artwork');
const { renderTemperature, adjustSetting, settingValue, renderControlPanel, renderControlAction } = require('./controls');

const WIDTH = 254;
const HEIGHT = 344;
const SEAT_X = [424, 1176];
const CONTROL_OFFSET = 253;
const ART = {
    Front: [
        artwork('front-seat-quilted.png', WIDTH, HEIGHT, 0x434301, true),
        artwork('front-seat-quilted.png', WIDTH, HEIGHT, 0x434302),
    ],
    Rear: [
        artwork('rear-seat-isofix.png', WIDTH, HEIGHT, 0x434303),
        artwork('rear-seat-isofix.png', WIDTH, HEIGHT, 0x434304, true),
    ],
};

function renderLevelButton(cv, settings, key, x, y, direction, color) {
    cv.roundRect(x - 20, y - 23, 40, 46, 10, '#ffffff12');
    cv.polyline([[x - direction * 4, y - 10], [x + direction * 6, y],
        [x - direction * 4, y + 10]], 3, color);
    cv.target(x - 20, y - 23, 40, 46, () => adjustSetting(settings, key, direction),
        key + (direction > 0 ? '-right' : '-left'));
}

function renderControls(cv, theme, settings, position, x, title, color, test) {
    const key = position + title;
    const temperatureKey = key + 'Temperature';
    const levelKey = key + 'Level';
    const center = { align: 'center' };
    renderControlPanel(cv, x, 395, title, color);
    renderTemperature(cv, theme, settings, temperatureKey, x, color);
    cv.text('Level', x, 361, 16, theme.dim, center);
    const level = settingValue(settings, settings.item(levelKey));
    renderLevelButton(cv, settings, levelKey, x - 46, 397, -1, color);
    cv.text(level === 0 ? '-' : String(level), x, 405, 24, theme.text, center);
    renderLevelButton(cv, settings, levelKey, x + 46, 397, 1, color);
    const active = test.isActive(key);
    const run = level > 0 && !active ? () => test.run(position, title, level) : null;
    renderControlAction(cv, theme, x, 442, active ? 'Testing...' : 'Test level', color, key + '-test', run);
}

function renderSeats(cv, theme, settings, equipment, row, test, gpu) {
    const prefix = row.toLowerCase();
    SEAT_X.forEach((center, index) => {
        ART[row][index](cv, theme, gpu, center - WIDTH / 2, 93);
        const side = index === 0 ? 'Left' : 'Right';
        const key = prefix + side;
        if (equipment[prefix + 'SeatVentilation'] === true) {
            renderControls(cv, theme, settings, key,
                center - CONTROL_OFFSET, 'Ventilation', '#5bc9ef', test);
        }
        if (equipment[prefix + 'SeatHeating'] === true) {
            renderControls(cv, theme, settings, key,
                center + CONTROL_OFFSET, 'Heating', '#ff945e', test);
        }
        cv.text(row + ' ' + side.toLowerCase(), center, 473, 24, theme.text, { align: 'center' });
    });
}

module.exports = renderSeats;
