'use strict';

const path = require('path');
const { decode: decodePng, rasterRuns } = require('./png');
const { version } = require('../package.json');

let artwork;

function renderAbout(cv, theme) {
    if (!artwork) {
        artwork = [
            ['brmodz_logo.png', 300, 124, 490, 58],
            ['qr_instagram.png', 116, 120, 332, 375, 'Instagram'],
            ['qr_facebook.png', 116, 120, 496, 375, 'Facebook'],
            ['qr_report_bug.png', 103, 104, 667, 383, 'Report a bug'],
            ['qr_request_feature.png', 103, 104, 831, 383, 'Request a feature']
        ].map(([file, width, height, x, y, label]) => ({
            x, y, width, label,
            runs: rasterRuns(decodePng(path.join(__dirname, file), width, height))
        }));
    }
    const scale = cv.place ? cv.place.scale : 1;
    const edge = coordinate => Math.round(coordinate * scale) / scale;
    for (const { x, y, width, label, runs } of artwork) {
        for (const run of runs) {
            const left = edge(x + run.x);
            const top = edge(y + run.y);
            cv.fillRect(left, top, edge(x + run.x + run.width) - left,
                edge(y + run.y + run.height) - top, '#' + run.color.toString(16).padStart(8, '0'));
        }
        if (label) cv.text(label, x + width / 2, 510, 15, theme.text, { align: 'center' });
    }

    const center = { align: 'center' };
    cv.text('CLIMATE COMFORT', 640, 218, 30, theme.text,
        { align: 'center', font: 'bold', spacing: 2.5 });
    cv.text('Temperature rules for seat heating, ventilation and steering wheel heating.', 640, 252, 19, theme.dim, center);
    cv.text('Planned seat automation uses occupancy at each seat, with settings on the front display.',
        640, 280, 19, theme.dim, center);
    cv.text('Version ' + version, 640, 309, 18, theme.dim, center);
    cv.text('Developed by dzooky@bmrmodz', 640, 349, 18, theme.text, center);

    cv.text("WHAT'S NEW", 1120, 80, 22, theme.text, { font: 'bold' });
    cv.text(version, 1120, 105, 14, theme.text, { font: 'bold' });
    cv.text('Wait up to a minute for the driver belt to latch.', 1186, 105, 14, theme.dim);
    cv.text('0.1.25', 1120, 127, 14, theme.text, { font: 'bold' });
    cv.text('Allow more time for the driver heating test sequence.', 1186, 127, 14, theme.dim);
    cv.text('0.1.15', 1120, 149, 14, theme.text, { font: 'bold' });
    cv.text('Read seat heating levels from BDC for testing.', 1186, 149, 14, theme.dim);
    cv.text('0.1.14', 1120, 171, 14, theme.text, { font: 'bold' });
    cv.text('Disable seat tests that can affect the climate panel.', 1186, 171, 14, theme.dim);
    cv.text('0.1.13', 1120, 199, 14, theme.text, { font: 'bold' });
    cv.text('Wait for IHKA to confirm seat level changes.', 1186, 199, 14, theme.dim);
    cv.text('Add a timed steering wheel heating test.', 1186, 215, 14, theme.dim);
    cv.text('0.1.12', 1120, 240, 14, theme.text, { font: 'bold' });
    cv.text('Queue seat tests until the matching belt is fastened.', 1186, 240, 14, theme.dim);
    cv.text('0.1.11', 1120, 266, 14, theme.text, { font: 'bold' });
    cv.text('Test direct reads of the two front belt latches.', 1186, 266, 14, theme.dim);
    cv.text('0.1.10', 1120, 290, 14, theme.text, { font: 'bold' });
    cv.text('Read belt contact currents with ACSM DID 4053.', 1186, 290, 14, theme.dim);
    cv.text('0.1.9', 1120, 312, 14, theme.text, { font: 'bold' });
    cv.text('Correct front belt reads and show rear belt states.', 1186, 312, 14, theme.dim);
    cv.text('0.1.8', 1120, 335, 14, theme.text, { font: 'bold' });
    cv.text('Read the driver and passenger belt latch states.', 1186, 335, 14, theme.dim);
    cv.text('0.1.7', 1120, 356, 14, theme.text, { font: 'bold' });
    cv.text('Show belt contact readings and engine status in My Car.', 1186, 356, 14, theme.dim);
    cv.text('0.1.6', 1120, 379, 14, theme.text, { font: 'bold' });
    cv.text('Remove the temporary ACSM occupancy test.', 1186, 379, 14, theme.dim);
    cv.text('0.1.5', 1120, 401, 14, theme.text, { font: 'bold' });
    cv.text('Show ACSM seat occupancy data in My Car.', 1186, 401, 14, theme.dim);
    cv.text('0.1.4', 1120, 422, 14, theme.text, { font: 'bold' });
    cv.text('Show controls only for confirmed equipment.', 1186, 422, 14, theme.dim);
    cv.text('Mark unconfirmed equipment with a red icon.', 1186, 434, 14, theme.dim);
    cv.text('0.1.3', 1120, 456, 14, theme.text, { font: 'bold' });
    cv.text('Detect seat heating and ventilation from VO.', 1186, 456, 14, theme.dim);
    cv.text('0.1.2', 1120, 479, 14, theme.text, { font: 'bold' });
    cv.text('Automatic steering equipment detection from VO.', 1186, 479, 14, theme.dim);
    cv.text('0.1.1', 1120, 500, 14, theme.text, { font: 'bold' });
    cv.text('Manual steering equipment preview.', 1186, 500, 14, theme.dim);
}

module.exports = renderAbout;
