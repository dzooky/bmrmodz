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

function renderSteering(cv, theme, settings, mSport) {
    const center = { align: 'center' };
    cv.blit(wheelLayer(mSport ? 'm-sport' : 'standard'), 800 - SIZE / 2, 93);
    cv.text(mSport ? 'M Sport' : 'Standard', 800, 473, 24, theme.text, center);

    cv.text('Heating', 1140, 159, 22, HEATING_COLOR, center);
    renderTemperature(cv, theme, settings, 'steeringHeatingTemperature', 1140, HEATING_COLOR);
}

module.exports = renderSteering;
