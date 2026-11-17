'use strict';

const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const frontBeltReader = require('./front-belts');
const { ReadOnlyDiag } = require('./kit/readonly-diag');
const { readVehicleOrder } = require('./vehicle-order');
const renderAbout = require('./about');
const renderSeats = require('./seats');
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

const ENGINE_IFACE = 'de.bmw.infotainment.vehicle.CDS';

const VO_CODES = { steeringWheelHeating: '248', mSportSteeringWheel: '710' };

function drawUnconfirmed(cv, x, y) {
    const color = '#ff5555';
    cv.arc(x, y, 9, 12, 0, 360, color);
    cv.polyline([[x - 7, y - 7], [x + 7, y + 7]], 3, color);
}

function renderEquipment(cv, theme, equipment, rows, voStatus, beltStatus) {
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

    if (beltStatus) cv.text(beltStatus, 850, 494, 17, theme.text, center);
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
        let tabs = [];
        let page = 'Info';
        let voStatus = null;
        let beltStatus = 'Belts: Reading...';
        let nextBeltRead = 0;
        let beltReadPending = false;
        let engineStatus = 'Unknown';
        const link = ctx.isPreview ? null : new ReadOnlyDiag(ctx.signals, ctx.log);
        const readFrontBelts = ctx.isPreview ? null : frontBeltReader(ctx.signals, ctx.log);

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

        async function readBelts() {
            if (!readFrontBelts || beltReadPending || voStatus === 'Reading vehicle order...' ||
                Date.now() < nextBeltRead) return;

            beltReadPending = true;
            try {
                const status = await readFrontBelts(() => page === 'My Car');
                if (page === 'My Car' && status) beltStatus = status;
            } catch (error) {
                beltStatus = 'Belts: Read failed';
                ctx.log.warn('Climate Comfort: belt contact read failed: ' + error.message);
            } finally {
                nextBeltRead = Date.now() + 1000;
                beltReadPending = false;
            }
        }

        if (link) {
            ctx.signals.watch(ENGINE_IFACE, '1', {
                statusEngineStatus(value) {
                    const state = value && value.statusEngineRunDrive;
                    if (state === 'MOTOR_LAEUFT' || state === 2) engineStatus = 'Running';
                    else if (state === 'MOTOR_STARTET' || state === 1) engineStatus = 'Starting';
                    else if (state === 'MOTOR_AUS' || state === 0) engineStatus = 'Off';
                    else engineStatus = 'Unknown';
                },
            }, ctx.log).catch(error => ctx.log.warn('Climate Comfort: engine status unavailable: ' + error.message));
        }

        detectEquipment();
        ctx.onTab(index => {
            if (!tabs[index] || tabs[index] === page) return;
            page = tabs[index];
            if (page === 'My Car' && link) {
                nextBeltRead = 0;
                beltStatus = 'Belts: Reading...';
                detectEquipment();
            }
        });

        ctx.loop('MAIN', 4, () => {
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
            } else if (page === 'Steering') {
                renderSteering(cv, theme, ctx.settings, equipment.mSportSteeringWheel === true);
            } else if (page === 'My Car') {
                readBelts();
                const belts = readFrontBelts && beltStatus;
                renderEquipment(cv, theme, equipment, rows, voStatus,
                    belts && belts + '   |   Engine: ' + engineStatus);
            } else if (page === 'About') {
                renderAbout(cv, theme);
            }

            G.frame(cv, theme, tabs, tabs.indexOf(page), []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
