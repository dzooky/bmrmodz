'use strict';

const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const { ReadOnlyDiag } = require('./kit/readonly-diag');
const { readVehicleOrder } = require('./vehicle-order');
const renderAbout = require('./about');
const renderSeats = require('./seats');
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

const BDC_ADDRESS = 0x40;
const DRIVER_HEATING_DID = 0xE432;

function heatingLevel(reply) {
    if (!reply) return 'No response';
    if (reply[0] === 0x7F) return 'NRC ' + (reply.length >= 3
        ? reply[2].toString(16).toUpperCase().padStart(2, '0') : '?');
    if (reply.length !== 12 || reply[0] !== 0x62 ||
        ((reply[1] << 8) | reply[2]) !== DRIVER_HEATING_DID || reply[3] > 1 ||
        (reply[3] === 1 && reply[4] > 3)) return 'Unsupported reply';
    return 'Level ' + (reply[3] === 0 ? 0 : reply[4]);
}

function formatReply(reply) {
    if (!reply || reply.length === 0) return '-';
    return Array.from(reply.slice(0, 12), byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const VO_CODES = { steeringWheelHeating: '248', mSportSteeringWheel: '710' };

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
        // Vehicle equipment will be populated from diagnostics when available.
        const equipment = {};
        const wheelTest = createWheelTest(ctx);
        let tabs = [];
        let page = 'Info';
        let voStatus = null;
        const link = ctx.isPreview ? null : new ReadOnlyDiag(ctx.signals, ctx.log);
        let driverHeating = 'Reading...';
        let driverHeatingReply = '-';
        let nextRead = 0;
        let readPending = false;

        async function readDriverHeating() {
            if (!link || !link.ready || readPending || wheelTest.isBusy() || Date.now() < nextRead) return;
            readPending = true;
            try {
                const reply = await link.read(BDC_ADDRESS, DRIVER_HEATING_DID, 1200);
                driverHeating = heatingLevel(reply);
                driverHeatingReply = formatReply(reply);
            } catch (error) {
                driverHeating = 'Read failed';
                driverHeatingReply = '-';
                ctx.log.warn('Climate Comfort: BDC driver heating read failed: ' + error.message);
            } finally {
                readPending = false;
                nextRead = Date.now() + 1000;
            }
        }

        async function detectEquipment() {
            if (!link || voStatus === 'Reading vehicle order...' || voStatus === 'Vehicle order read') return;
            voStatus = 'Reading vehicle order...';
            try {
                const codes = await readVehicleOrder(link);
                if (!codes) {
                    // A later visit to My Car can retry after the gateway wakes up.
                    voStatus = 'Vehicle order unavailable';
                    ctx.log.warn('Climate Comfort: no supported Vehicle Order response from gateway 10 DID 3F06');
                    return;
                }
                Object.keys(VO_CODES).forEach(key => { equipment[key] = codes.has(VO_CODES[key]); });
                if (codes.has('453')) equipment.frontSeatVentilation = true;
                if (codes.has('454')) equipment.rearSeatVentilation = true;
                const heatedFrontAndRear = codes.has('4HA');
                if (heatedFrontAndRear || codes.has('494')) equipment.frontSeatHeating = true;
                if (heatedFrontAndRear) equipment.rearSeatHeating = true;
                voStatus = 'Vehicle order read';
            } catch (error) {
                voStatus = 'Vehicle order unavailable';
                ctx.log.warn('Climate Comfort: Vehicle Order read failed: ' + error.message);
            }
        }

        detectEquipment();
        ctx.onTab(index => {
            if (!tabs[index] || tabs[index] === page) return;
            page = tabs[index];
            if (page === 'Front' && link) {
                driverHeating = 'Reading...';
                driverHeatingReply = '-';
                nextRead = 0;
                link.wake(BDC_ADDRESS);
            }
            if (page === 'My Car') detectEquipment();
        });

        ctx.loop('MAIN', 4, () => {
            wheelTest.tick();
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
                if (page === 'Front' && link && equipment.frontSeatHeating === true) {
                    readDriverHeating();
                    cv.text('Driver heat E432', 130, 77, 22, theme.dim);
                    cv.text(driverHeating, 410, 77, 22, theme.text);
                    cv.text('Reply  ' + driverHeatingReply, 750, 77, 22, theme.text);
                }
            } else if (page === 'Steering') {
                renderSteering(cv, theme, ctx.settings, equipment.mSportSteeringWheel === true, wheelTest);
            } else if (page === 'My Car') {
                renderEquipment(cv, theme, equipment, rows, voStatus);
            } else if (page === 'About') {
                renderAbout(cv, theme);
            }

            G.frame(cv, theme, tabs, tabs.indexOf(page), []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
