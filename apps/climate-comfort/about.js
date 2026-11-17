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
    cv.text('Read belt contact currents with ACSM DID 4053.', 1186, 105, 14, theme.dim);
    cv.text('0.1.9', 1120, 134, 14, theme.text, { font: 'bold' });
    cv.text('Correct front belt reads and show rear belt states.', 1186, 134, 14, theme.dim);
    cv.text('0.1.8', 1120, 163, 14, theme.text, { font: 'bold' });
    cv.text('Read the driver and passenger belt latch states.', 1186, 163, 14, theme.dim);
    cv.text('0.1.7', 1120, 191, 14, theme.text, { font: 'bold' });
    cv.text('Show belt contact readings and engine status in My Car.', 1186, 191, 14, theme.dim);
    cv.text('0.1.6', 1120, 220, 14, theme.text, { font: 'bold' });
    cv.text('Remove the temporary ACSM occupancy test.', 1186, 220, 14, theme.dim);
    cv.text('0.1.5', 1120, 249, 14, theme.text, { font: 'bold' });
    cv.text('Show ACSM seat occupancy data in My Car.', 1186, 249, 14, theme.dim);
    cv.text('0.1.4', 1120, 278, 14, theme.text, { font: 'bold' });
    cv.text('Show controls only for confirmed equipment.', 1186, 278, 14, theme.dim);
    cv.text('Mark unconfirmed equipment with a red icon.', 1186, 292, 14, theme.dim);
    cv.text('0.1.3', 1120, 321, 14, theme.text, { font: 'bold' });
    cv.text('Detect seat heating and ventilation from VO.', 1186, 321, 14, theme.dim);
    cv.text('0.1.2', 1120, 350, 14, theme.text, { font: 'bold' });
    cv.text('Automatic steering equipment detection from VO.', 1186, 350, 14, theme.dim);
    cv.text('0.1.1', 1120, 379, 14, theme.text, { font: 'bold' });
    cv.text('Manual steering equipment preview.', 1186, 379, 14, theme.dim);
    cv.text('0.1.0', 1120, 407, 14, theme.text, { font: 'bold' });
    cv.text('Initial preview with Info, My Car and About.', 1186, 407, 14, theme.dim);
    cv.text('Five equipment items listed in My Car.', 1186, 422, 14, theme.dim);
    cv.text('Toggle equipment in the emulator panel.', 1186, 436, 14, theme.dim);
    cv.text('Seat graphics added to Front.', 1186, 451, 14, theme.dim);
    cv.text('Two steering wheel variants and a heating threshold.', 1186, 465, 14, theme.dim);
    cv.text('Separate controls for the outer rear seats.', 1186, 479, 14, theme.dim);
    cv.text('iDrive preview and Climate Comfort app icon.', 1186, 494, 14, theme.dim);
}

module.exports = renderAbout;
