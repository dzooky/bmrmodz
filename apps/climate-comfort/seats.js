'use strict';

const path = require('path');
const { makeLayer } = require('./kit/record');
const { decode, rasterRuns } = require('./png');
const { renderTemperature, adjustSetting, settingValue } = require('./controls');

const WIDTH = 254;
const HEIGHT = 344;
const SEAT_X = [540, 1060];
const IMAGES = { Front: 'front-seat-quilted.png', Rear: 'rear-seat-isofix.png' };
const seatLayers = {};

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
    cv.text(title, x, 159, 22, color, center);
    renderTemperature(cv, theme, settings, temperatureKey, x, color);
    cv.text('Level', x, 361, 16, theme.dim, center);
    const level = settingValue(settings, settings.item(levelKey));
    renderLevelButton(cv, settings, levelKey, x - 46, 397, -1, color);
    cv.text(level === 0 ? '-' : String(level), x, 405, 24, theme.text, center);
    renderLevelButton(cv, settings, levelKey, x + 46, 397, 1, color);
    const enabled = level > 0 && !test.isActive(key);
    cv.roundRect(x - 61, 442, 122, 32, 8, '#ffffff12');
    cv.text(test.isActive(key) ? 'Testing...' : 'Test level', x, 464, 17, enabled ? theme.text : theme.dim, center);
    if (enabled) cv.target(x - 61, 442, 122, 32, () => test.run(position, title, level), key + '-test');
}

function renderSeats(cv, theme, settings, equipment, row, test) {
    if (!seatLayers[row]) {
        const seat = decode(path.join(__dirname, IMAGES[row]), WIDTH, HEIGHT);
        const runs = rasterRuns(seat);
        const mirrorBySide = row === 'Rear' ? [false, true] : [true, false];
        seatLayers[row] = mirrorBySide.map(mirror => makeLayer(WIDTH, HEIGHT, layer => {
            for (const run of runs) {
                const x = mirror ? WIDTH - run.x - run.width : run.x;
                const color = '#' + run.color.toString(16).padStart(8, '0');
                layer.fillRect(x, run.y, run.width, run.height, color);
            }
        }));
    }

    const prefix = row.toLowerCase();
    SEAT_X.forEach((center, index) => {
        cv.blit(seatLayers[row][index], center - WIDTH / 2, 93);
        const side = index === 0 ? 'Left' : 'Right';
        const key = prefix + side;
        if (equipment[prefix + 'SeatVentilation'] === true) {
            renderControls(cv, theme, settings, key,
                center - 180, 'Ventilation', '#5bc9ef', test);
        }
        if (equipment[prefix + 'SeatHeating'] === true) {
            renderControls(cv, theme, settings, key,
                center + 180, 'Heating', '#ff945e', test);
        }
        cv.text(row + ' ' + side.toLowerCase(), center, 473, 24, theme.text, { align: 'center' });
    });
}

module.exports = renderSeats;
