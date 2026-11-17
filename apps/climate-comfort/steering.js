'use strict';

const path = require('path');
const { makeLayer } = require('./kit/record');
const { decode, rasterRuns } = require('./png');
const { renderTemperature } = require('./controls');

const SIZE = 344;
const HEATING_COLOR = '#ff945e';
const layers = {};

function wheelLayer(variant) {
    if (!layers[variant]) {
        const image = decode(path.join(__dirname, 'steering-' + variant + '.png'), SIZE, SIZE);
        layers[variant] = makeLayer(SIZE, SIZE, layer => {
            for (const run of rasterRuns(image)) {
                const color = '#' + run.color.toString(16).padStart(8, '0');
                layer.fillRect(run.x, run.y, run.width, run.height, color);
            }
        });
    }
    return layers[variant];
}

function renderSteering(cv, theme, settings, mSport, wheelTest, seatTestBusy) {
    const center = { align: 'center' };
    cv.blit(wheelLayer(mSport ? 'm-sport' : 'standard'), 800 - SIZE / 2, 93);
    cv.text(mSport ? 'M Sport' : 'Standard', 800, 473, 24, theme.text, center);

    cv.text('Heating', 1140, 159, 22, HEATING_COLOR, center);
    renderTemperature(cv, theme, settings, 'steeringHeatingTemperature', 1140, HEATING_COLOR);
    const key = 'steeringHeating';
    const enabled = !seatTestBusy && !wheelTest.isBusy();
    const action = wheelTest.isActive(key) ? 'Deactivate' : wheelTest.isPending(key) ? 'Cancel' : 'Test heating';
    cv.roundRect(1076, 350, 128, 38, 8, '#ffffff12');
    cv.text(action, 1140, 375, 18, enabled ? theme.text : theme.dim, center);
    if (enabled) cv.target(1076, 350, 128, 38, wheelTest.run, key + '-test');
}

module.exports = renderSteering;
