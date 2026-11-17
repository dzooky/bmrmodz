'use strict';

const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const { ReadOnlyDiag } = require('./kit/readonly-diag');
const { readVehicleOrder } = require('./vehicle-order');
const renderAbout = require('./about');
const renderSeats = require('./seats');
const createIhkaTest = require('./ihka-test');
const createWheelTest = require('./wheel-test');
const renderSteering = require('./steering');

const NOTICE = [
    'This application is still in development phase and not ready for public use.',
    'We still working on it and will be available soon.',
    'Thank you',
];

function equipmentTabs(equipment) {
    const tabs = ['Info'];
    if (equipment.frontSeatHeating === true || equipment.frontSeatVentilation === true) tabs.push('Front');
    if (equipment.rearSeatHeating === true || equipment.rearSeatVentilation === true) tabs.push('Rear');
    if (equipment.steeringWheelHeating === true) tabs.push('Steering');
    tabs.push('My Car', 'About');
    return tabs;
}

function renderIhkaTest(cv, theme, test, wheelTest) {
    const disabled = test.isBusy() || wheelTest.isBusy();
    const center = { align: 'center' };
    const button = (x, text, stopOnly) => {
        cv.roundRect(x, 52, 180, 35, 8, '#ffffff19');
        cv.text(text, x + 90, 76, 18, disabled ? theme.dim : theme.text, center);
        if (!disabled) cv.target(x, 52, 180, 35, () => {
            if (!wheelTest.isBusy()) return test.run(stopOnly);
        }, stopOnly ? 'ihka-stop' : 'ihka-test');
    };
    button(82, 'Test driver heat', false);
    button(277, 'Stop A126', true);
    cv.text(test.stopResult(), 480, 76, 18, theme.text);
    cv.text(test.isBusy() ? 'Testing...' : test.detail(), 860, 76, 17, theme.text);
}

function equipmentFromCodes(codes) {
    const heatBothRows = codes.has('4HA');
    return {
        steeringWheelHeating: codes.has('248'),
        mSportSteeringWheel: codes.has('710'),
        frontSeatVentilation: codes.has('453') || undefined,
        rearSeatVentilation: codes.has('454') || undefined,
        frontSeatHeating: (heatBothRows || codes.has('494')) || undefined,
        rearSeatHeating: heatBothRows || undefined,
    };
}

function loadSavedCodes(file, log) {
    try {
        const codes = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(codes) || !codes.length || !codes.every(code =>
            typeof code === 'string' && /^[0-9A-Z]{3}$/.test(code))) {
            throw new Error('Invalid saved vehicle order');
        }
        return new Set(codes);
    } catch (error) {
        if (error.code !== 'ENOENT') log.warn('Climate Comfort: ' + error.message);
        return null;
    }
}

function saveCodes(file, codes, log) {
    const temporary = file + '.tmp';
    try {
        fs.writeFileSync(temporary, JSON.stringify(Array.from(codes)));
        fs.renameSync(temporary, file);
        return true;
    } catch (error) {
        log.warn('Climate Comfort: saving vehicle order failed: ' + error.message);
        return false;
    }
}

function drawUnconfirmed(cv, x, y) {
    const color = '#ff5555';
    cv.arc(x, y, 9, 12, 0, 360, color);
    cv.polyline([[x - 7, y - 7], [x + 7, y + 7]], 3, color);
}

function renderEquipment(cv, theme, equipment, rows, voStatus) {
    const center = { align: 'center' };
    cv.text('Equipment', 66, 96, 19, theme.dim);
    cv.text('Installed', 1450, 96, 19, theme.dim, center);
    if (voStatus) cv.text(voStatus, 800, 96, 19, theme.dim, center);

    rows.forEach(({ key, label }, index) => {
        const y = 140 + index * 62;
        cv.fillRect(55, y - 25, 1490, 1, theme.dim);
        cv.text(label, 66, y + 13, 24, theme.text);
        if (equipment[key] === true) {
            cv.polyline([[1438, y - 1], [1446, y + 7], [1462, y - 9]], 4, '#55d884');
        } else if (equipment[key] === false) {
            cv.text('-', 1450, y + 13, 19, theme.dim, center);
        } else {
            drawUnconfirmed(cv, 1450, y);
        }
    });

    if (rows.some(({ key }) => equipment[key] === undefined)) {
        drawUnconfirmed(cv, 77, 488);
        cv.text('Unconfirmed equipment', 100, 494, 17, theme.dim);
    }
}

mgu.run({
    start(ctx) {
        const rows = ctx.spec.config.previewEquipment;
        const link = ctx.isPreview ? null : new ReadOnlyDiag(ctx.signals, ctx.log);
        const cacheFile = link && path.join(ctx.dataDir, 'vehicle-order.json');
        const savedCodes = cacheFile && loadSavedCodes(cacheFile, ctx.log);
        let equipment = savedCodes ? equipmentFromCodes(savedCodes) : {};
        const wheelTest = createWheelTest(ctx);
        const ihkaTest = link ? createIhkaTest(ctx) : null;
        let tabs = [];
        let page = 'Info';
        let voStatus = savedCodes ? 'Saved vehicle order' : null;
        let readRequested = !savedCodes;

        let equipmentAttempts = 0;
        let nextEquipmentRead = 0;

        async function detectEquipment() {
            if (!link || !readRequested || equipmentAttempts >= 3 || Date.now() < nextEquipmentRead ||
                voStatus === 'Reading vehicle order...' || ihkaTest.isBusy() || wheelTest.isBusy()) return;
            equipmentAttempts++;
            voStatus = 'Reading vehicle order...';
            try {
                const { codes, error } = await readVehicleOrder(link);
                if (!codes) {
                    voStatus = error;
                    ctx.log.warn('Climate Comfort: ' + error);
                    return;
                }
                equipment = equipmentFromCodes(codes);
                readRequested = false;
                voStatus = saveCodes(cacheFile, codes, ctx.log) ? 'Vehicle order saved' : 'Vehicle order read, save failed';
            } catch (error) {
                voStatus = 'Vehicle order: transport error';
                ctx.log.warn('Climate Comfort: Vehicle Order read failed: ' + error.message);
            } finally {
                nextEquipmentRead = Date.now() + 3000;
            }
        }

        function reloadEquipment() {
            if (!link || voStatus === 'Reading vehicle order...') return;
            link.wake();
            readRequested = true;
            equipmentAttempts = 0;
            nextEquipmentRead = 0;
            return detectEquipment();
        }

        ctx.onTab(index => {
            if (tabs[index]) page = tabs[index];
        });

        ctx.loop('MAIN', 4, () => {
            if (!ihkaTest || !ihkaTest.isBusy()) wheelTest.tick();
            detectEquipment();
            if (ctx.isPreview) {
                rows.forEach(({ key }) => { equipment[key] = ctx.settings.get(key) === true; });
            }
            tabs = equipmentTabs(equipment);
            if (!tabs.includes(page)) page = 'My Car';
            const theme = ctx.theme();
            const cv = ctx.canvas(1600, 520).clear(theme.bg);
            G.panel(cv, theme, 24, 44, 1552, 468, null);

            if (page === 'Info') {
                NOTICE.forEach((line, index) => {
                    cv.text(line, 800, 218 + index * 42, 30, theme.text, { align: 'center' });
                });
            } else if (page === 'Front' || page === 'Rear') {
                renderSeats(cv, theme, ctx.settings, equipment, page);
                if (page === 'Front' && ihkaTest && equipment.frontSeatHeating === true) {
                    renderIhkaTest(cv, theme, ihkaTest, wheelTest);
                }
            } else if (page === 'Steering') {
                renderSteering(cv, theme, ctx.settings, equipment.mSportSteeringWheel === true, wheelTest);
            } else if (page === 'My Car') {
                renderEquipment(cv, theme, equipment, rows, voStatus);
                if (link) {
                    const busy = voStatus === 'Reading vehicle order...';
                    cv.roundRect(1245, 465, 245, 40, 10, '#ffffff19');
                    cv.text('Reload equipment', 1367, 491, 19, busy ? theme.dim : theme.text, { align: 'center' });
                    if (!busy) cv.target(1245, 465, 245, 40, reloadEquipment, 'reload-equipment');
                }
            } else if (page === 'About') {
                renderAbout(cv, theme);
            }

            G.frame(cv, theme, tabs, tabs.indexOf(page), []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
