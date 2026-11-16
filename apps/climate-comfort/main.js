'use strict';

const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
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
    if (equipment.frontSeatHeating !== false || equipment.frontSeatVentilation !== false) tabs.push('Front');
    if (equipment.rearSeatHeating !== false || equipment.rearSeatVentilation !== false) tabs.push('Rear');
    if (equipment.steeringWheelHeating !== false) tabs.push('Steering');
    tabs.push('My Car', 'About');
    return tabs;
}

const VO_CODES = { steeringWheelHeating: '248', mSportSteeringWheel: '710' };
const VO_STATES = ['unknown', 'present', 'absent'];

function renderEquipment(cv, theme, equipment, rows, voSettings) {
    const center = { align: 'center' };
    cv.text('Equipment', 66, 96, 19, theme.dim);
    cv.text('Installed', 1450, 96, 19, theme.dim, center);

    rows.forEach(({ key, label }, index) => {
        const y = 140 + index * 62;
        cv.fillRect(55, y - 25, 1490, 1, theme.dim);
        cv.text(label, 66, y + 13, 24, theme.text);
        const code = VO_CODES[key];
        if (voSettings && code) {
            const setting = 'vo' + code;
            const status = equipment[key] === true ? 'Present' : equipment[key] === false ? 'Absent' : 'Unknown';
            cv.text('VO ' + code, 1220, y + 13, 19, theme.dim);
            cv.roundRect(1368, y - 14, 164, 46, 10, '#ffffff12');
            cv.text(status, 1450, y + 15, 19, theme.text, center);
            cv.target(1368, y - 14, 164, 46, () => {
                const index = VO_STATES.indexOf(voSettings.get(setting));
                voSettings.set(setting, VO_STATES[(index + 1) % VO_STATES.length]);
            }, setting);
        } else if (equipment[key] === true) {
            cv.polyline([[1438, y - 1], [1446, y + 7], [1462, y - 9]], 4, '#55d884');
        } else {
            const status = equipment[key] === false ? '-' : 'Unknown';
            cv.text(status, 1450, y + 13, 19, theme.dim, center);
        }
    });
}

mgu.run({
    start(ctx) {
        const rows = ctx.spec.config.previewEquipment;
        // Vehicle equipment will be populated from diagnostics when available.
        const equipment = {};
        let tabs = [];
        let page = 'Info';
        ctx.onTab(index => {
            if (tabs[index]) page = tabs[index];
        });

        ctx.loop('MAIN', 4, () => {
            if (ctx.isPreview) {
                rows.forEach(({ key }) => { equipment[key] = ctx.settings.get(key) === true; });
            } else {
                Object.keys(VO_CODES).forEach(key => {
                    const status = ctx.settings.get('vo' + VO_CODES[key]);
                    equipment[key] = status === 'present' ? true : status === 'absent' ? false : undefined;
                });
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
                renderEquipment(cv, theme, equipment, rows, ctx.isPreview ? null : ctx.settings);
            } else if (page === 'About') {
                renderAbout(cv, theme);
            }

            G.frame(cv, theme, tabs, tabs.indexOf(page), []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
