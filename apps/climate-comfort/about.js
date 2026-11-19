'use strict';

const path = require('path');
const { decode: decodePng, rasterRuns } = require('./png');
const { version } = require('../package.json');

const TOP = 54;
const BOTTOM = 512;
const RELEASE_START = 105;
const RELEASE_STEP = 22;
const RELEASES = [
    ['0.1.51', 'Remove the extra vehicle-state interface required by engine-off testing.'],
    ['0.1.50', 'Allow automatic activation with ignition on for engine-off vehicle testing.'],
    ['0.1.49', 'Explain the effect of auxiliary heating on inside temperature readings.'],
    ['', 'Match Settings selection highlights to the rounded menu rows.'],
    ['', 'Match temperature and level highlights to their shape and segment color.'],
    ['0.1.48', 'Use selected temperature sources for automatic activation.'],
    ['', 'Show selected readings below seats and the steering wheel.'],
    ['', 'Use the driver sensor for inside steering wheel temperature.'],
    ['0.1.47', 'Add separate temperature source choices in Settings.'],
    ['', 'Use same-side front sensors for rear seats without four-zone climate.'],
    ['0.1.46', 'Detect auxiliary heating from VO option 536.'],
    ['', 'Simplify the My Car equipment display.'],
    ['0.1.45', 'Detect four-zone climate control from VO option 4NB.'],
    ['0.1.44', 'Show the footwell temperature for each seat from IHKA.'],
    ['0.1.43', 'Retry alternate seat temperature reads and show replies in My Car.'],
    ['0.1.42', 'Render test and sync labels with smooth control icons.'],
    ['0.1.41', 'Sync front or all seat settings from the driver seat.'],
    ['0.1.40', 'Correct the left and right seat artwork orientation.'],
    ['0.1.39', 'Show measured seat cushion temperatures when available.'],
    ['0.1.38', 'Clarify the conditions for automatic activation.'],
    ['0.1.37', 'Scroll through About and the full release history.'],
    ['0.1.36', 'Update the steering wheel heating pictogram.'],
    ['0.1.35', 'Match the rear seat and steering control styling.'],
    ['0.1.34', 'Restore original front seats and smooth steering graphics.'],
    ['0.1.33', 'Use smooth textures for the rear seats too.'],
    ['0.1.32', 'Draw front seats as smooth textures on MGU.'],
    ['0.1.31', 'Refresh the front seat graphics and side controls.'],
    ['0.1.30', 'Run multiple comfort tests in the same session.'],
    ['0.1.29', 'Allow front ventilation tests with the engine off.'],
    ['0.1.28', 'Allow ventilation tests to wait for the engine.'],
    ['0.1.27', 'Test the selected seat heating and ventilation level.'],
    ['0.1.26', 'Wait up to a minute for the driver belt to latch.'],
    ['0.1.25', 'Allow more time for the driver heating test sequence.'],
    ['0.1.24', 'Retry driver belt reads after transport errors.'],
    ['0.1.23', 'Move driver heating test controls to the bottom.'],
    ['0.1.22', 'Save vehicle equipment and add a reload button.'],
    ['0.1.21', 'Retry vehicle order reads and report gateway errors.'],
    ['0.1.20', 'Retry driver belt reads and show IHKA test results.'],
    ['0.1.19', 'Test stopping the driver heating diagnostic routine.'],
    ['0.1.18', 'Show driver heating status and BDC reply bytes.'],
    ['0.1.17', 'Show a single BDC heating read for the driver seat.'],
    ['0.1.16', 'Try alternate BDC seat heating identifiers.'],
    ['0.1.15', 'Read seat heating levels from BDC for testing.'],
    ['0.1.14', 'Disable seat tests that can affect the climate panel.'],
    ['0.1.13', 'Wait for IHKA to confirm seat level changes.'],
    ['', 'Add a timed steering wheel heating test.'],
    ['0.1.12', 'Queue seat tests until the matching belt is fastened.'],
    ['0.1.11', 'Test direct reads of the two front belt latches.'],
    ['0.1.10', 'Read belt contact currents with ACSM DID 4053.'],
    ['0.1.9', 'Correct front belt reads and show rear belt states.'],
    ['0.1.8', 'Read the driver and passenger belt latch states.'],
    ['0.1.7', 'Show belt contact readings and engine status in My Car.'],
    ['0.1.6', 'Remove the temporary ACSM occupancy test.'],
    ['0.1.5', 'Show ACSM seat occupancy data in My Car.'],
    ['0.1.4', 'Show controls only for confirmed equipment.'],
    ['', 'Mark unconfirmed equipment with a red icon.'],
    ['0.1.3', 'Detect seat heating and ventilation from VO.'],
    ['0.1.2', 'Automatic steering equipment detection from VO.'],
    ['0.1.1', 'Manual steering equipment preview.'],
    ['0.1.0', 'Initial development preview.'],
];
const maxScroll = Math.max(0, Math.max(512, RELEASE_START + RELEASES.length * RELEASE_STEP) - BOTTOM);

let artwork;

function renderAbout(cv, theme, offset) {
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
    const text = (label, x, y, size, color, options) => {
        const baseline = y - offset;
        if (baseline - size >= TOP && baseline + 4 <= BOTTOM) {
            cv.text(label, x, baseline, size, color, options);
        }
    };

    cv.clip(40, TOP, 1518, BOTTOM - TOP);
    for (const { x, y, width, label, runs } of artwork) {
        for (const run of runs) {
            const left = edge(x + run.x);
            const top = Math.max(TOP, edge(y + run.y - offset));
            const bottom = Math.min(BOTTOM, edge(y + run.y + run.height - offset));
            if (bottom <= top) continue;
            cv.fillRect(left, top, edge(x + run.x + run.width) - left,
                bottom - top, '#' + run.color.toString(16).padStart(8, '0'));
        }
        if (label) text(label, x + width / 2, 504, 15, theme.text, { align: 'center' });
    }

    const center = { align: 'center' };
    const bold = { font: 'bold' };
    text('CLIMATE COMFORT', 640, 218, 30, theme.text,
        { align: 'center', font: 'bold', spacing: 2.5 });
    text('Temperature rules for seat heating, ventilation and steering wheel heating.', 640, 252, 19, theme.dim, center);
    text('This test version requires the car to be switched on and the relevant seat belt to be fastened.',
        640, 280, 19, theme.dim, center);
    text('Version ' + version, 640, 309, 18, theme.dim, center);
    text('Developed by dzooky@bmrmodz', 640, 349, 18, theme.text, center);
    text("WHAT'S NEW", 1120, 80, 22, theme.text, bold);

    RELEASES.forEach(([release, description], index) => {
        const y = RELEASE_START + index * RELEASE_STEP;
        if (release) text(release, 1120, y, 14, theme.text, bold);
        const width = cv.textWidth(description, 14);
        text(description, 1186, y, width > 360 ? 14 * 360 / width : 14, theme.dim);
    });
    cv.noclip();

    if (maxScroll > 0) {
        const bar = { x: 1563, y: TOP, w: 6, h: BOTTOM - TOP };
        const thumb = bar.h * bar.h / (bar.h + maxScroll);
        cv.scroll = { y: TOP, bar };
        cv.roundRect(bar.x, bar.y + offset / maxScroll * (bar.h - thumb), bar.w, thumb, 3, theme.dim);
    }
}

module.exports = { renderAbout, maxScroll };
