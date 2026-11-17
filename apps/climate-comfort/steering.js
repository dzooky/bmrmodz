'use strict';

const artwork = require('./artwork');
const { renderTemperature, renderControlPanel, renderControlAction } = require('./controls');

const SIZE = 344;
const HEATING_COLOR = '#ff945e';
const CONTROL_X = 1140;
const standardWheel = artwork('steering-standard.png', SIZE, SIZE, 0x434305);
const mSportWheel = artwork('steering-m-sport.png', SIZE, SIZE, 0x434306);

function renderSteering(cv, theme, settings, mSport, wheelTest, gpu) {
    const center = { align: 'center' };
    const drawWheel = mSport ? mSportWheel : standardWheel;
    drawWheel(cv, theme, gpu, 800 - SIZE / 2, 93);
    cv.text(mSport ? 'M Sport' : 'Standard', 800, 473, 24, theme.text, center);

    renderControlPanel(cv, CONTROL_X, 304, 'Heating', HEATING_COLOR, true);
    renderTemperature(cv, theme, settings, 'steeringHeatingTemperature', CONTROL_X, HEATING_COLOR);
    const key = 'steeringHeating';
    const enabled = !wheelTest.isBusy();
    const action = wheelTest.isActive(key) ? 'Deactivate' : wheelTest.isPending(key) ? 'Cancel' : 'Test heating';
    renderControlAction(cv, theme, CONTROL_X, 350, action, HEATING_COLOR, key + '-test',
        enabled ? wheelTest.run : null);
}

module.exports = renderSteering;
