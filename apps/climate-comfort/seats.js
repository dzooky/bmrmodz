'use strict';

const artwork = require('./artwork');
const { renderTemperature, adjustSetting, settingValue, renderControlPanel, renderControlAction } = require('./controls');

const WIDTH = 254;
const HEIGHT = 344;
const SEAT_X = [424, 1176];
const CONTROL_OFFSET = 253;
const ART = {
    Front: [
        artwork('front-seat-quilted.png', WIDTH, HEIGHT, 0x434301),
        artwork('front-seat-quilted.png', WIDTH, HEIGHT, 0x434302, true),
    ],
    Rear: [
        artwork('rear-seat-isofix.png', WIDTH, HEIGHT, 0x434303, true),
        artwork('rear-seat-isofix.png', WIDTH, HEIGHT, 0x434304),
    ],
};

function renderLevelButton(cv, settings, key, x, y, direction, color, enabled) {
    cv.roundRect(x - 20, y - 23, 40, 46, 10, enabled ? '#ffffff12' : '#ffffff08');
    cv.polyline([[x - direction * 4, y - 10], [x + direction * 6, y],
        [x - direction * 4, y + 10]], 3, color);
    if (enabled) cv.target(x - 20, y - 23, 40, 46, () => adjustSetting(settings, key, direction),
        key + (direction > 0 ? '-right' : '-left'), 10, color);
}

function syncSeats(settings, equipment, allSeats) {
    if (settings.get('appEnabled') !== true) return;
    const destinations = allSeats ? ['frontRight', 'rearLeft', 'rearRight'] : ['frontRight'];
    for (const mode of ['Heating', 'Ventilation']) {
        if (equipment['frontSeat' + mode] !== true) continue;
        for (const parameter of ['Temperature', 'Level']) {
            const source = settings.item('frontLeft' + mode + parameter);
            const value = settingValue(settings, source);
            for (const position of destinations) {
                const row = position.startsWith('front') ? 'front' : 'rear';
                if (equipment[row + 'Seat' + mode] !== true) continue;
                const target = settings.item(position + mode + parameter);
                settings.set(target.key, Math.max(target.min, Math.min(target.max, value)));
            }
        }
    }
}

function renderControls(cv, theme, settings, position, x, title, color, gpu) {
    const enabled = settings.get('appEnabled') === true;
    if (!enabled) color = theme.dim;
    const key = position + title;
    const temperatureKey = key + 'Temperature';
    const levelKey = key + 'Level';
    const center = { align: 'center' };
    renderControlPanel(cv, x, 338, title, color, false, theme, gpu);
    renderTemperature(cv, theme, settings, temperatureKey, x, color, enabled);
    cv.text('Level', x, 361, 16, theme.dim, center);
    const level = settingValue(settings, settings.item(levelKey));
    renderLevelButton(cv, settings, levelKey, x - 46, 397, -1, color, enabled);
    cv.text(level === 0 ? '-' : String(level), x, 405, 24, enabled ? theme.text : theme.dim, center);
    renderLevelButton(cv, settings, levelKey, x + 46, 397, 1, color, enabled);

}

function renderSeats(cv, theme, settings, equipment, row, gpu, temperatureFor) {
    const prefix = row.toLowerCase();
    SEAT_X.forEach((center, index) => {
        ART[row][index](cv, theme, gpu, center - WIDTH / 2, 93);
        const side = index === 0 ? 'Left' : 'Right';
        const key = prefix + side;
        if (equipment[prefix + 'SeatVentilation'] === true) {
            renderControls(cv, theme, settings, key,
                center - CONTROL_OFFSET, 'Ventilation', '#5bc9ef', gpu);
        }
        if (equipment[prefix + 'SeatHeating'] === true) {
            renderControls(cv, theme, settings, key,
                center + CONTROL_OFFSET, 'Heating', '#ff945e', gpu);
        }
        cv.text(row + ' ' + side.toLowerCase(), center, 473, 24, theme.text, { align: 'center' });
        if (equipment[prefix + 'SeatHeating'] === true || equipment[prefix + 'SeatVentilation'] === true) {
            const reading = temperatureFor(key);
            const label = reading.label + ' ' + (Number.isFinite(reading.value) ? reading.value + ' °C' : '– °C');
            cv.text(label, center, 501, 18, theme.dim, { align: 'center' });
        }
    });
    if (row === 'Front') {
        const enabled = settings.get('appEnabled') === true;
        renderControlAction(cv, theme, 730, 492, 'Sync front', theme.text, 'sync-front',
            enabled ? () => syncSeats(settings, equipment, false) : null, 26, gpu);
        renderControlAction(cv, theme, 870, 492, 'Sync all', theme.text, 'sync-all',
            enabled ? () => syncSeats(settings, equipment, true) : null, 26, gpu);
    }
}

module.exports = renderSeats;
