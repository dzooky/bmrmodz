'use strict';

const OPTIONS = [
    ['outside', 'Outside'],
    ['inside', 'Inside'],
];

module.exports = function createSettingsPage(settings) {
    let expanded = null;
    return {
        close() { expanded = null; },
        render(cv, theme, equipment) {
            const enabled = settings.get('appEnabled') === true;
            const selectionColor = theme.sel || theme.accent || '#e1001a';
            cv.roundRect(55, 66, 1490, 60, 12, '#ffffff12');
            cv.text('Enable Climate Comfort', 80, 105, 28, theme.text);
            cv.roundRect(1430, 77, 76, 38, 19, enabled ? selectionColor : '#ffffff28');
            cv.circle(enabled ? 1487 : 1449, 96, 14, '#ffffff');
            cv.target(55, 66, 1490, 60, () => {
                expanded = null;
                settings.set('appEnabled', !enabled);
            }, 'app-enabled', 12);
            if (!enabled) { expanded = null; return; }
            const rows = [
                { key: 'temperatureSource', label: 'Front seat temperature source', id: 'temperature-source' },
            ];
            if (equipment && (equipment.rearSeatHeating === true || equipment.rearSeatVentilation === true)) {
                rows.push({ key: 'rearTemperatureSource', label: 'Rear seat temperature source', id: 'rear-temperature-source',
                    insideLabel: equipment.fourZoneClimate === true ? 'Inside' : 'Inside (front)' });
            }
            if (equipment && equipment.steeringWheelHeating === true) {
                rows.push({ key: 'steeringTemperatureSource', label: 'Steering wheel temperature source', id: 'steering-temperature-source' });
            }
            if (!rows.some(row => row.key === expanded)) expanded = null;
            let y = 136;
            rows.forEach(row => {
                const options = OPTIONS.map(([key, label]) => [key, key === 'inside' && row.insideLabel ? row.insideLabel : label]);
                const selected = settings.get(row.key) === 'outside' ? 'outside' : 'inside';
                const value = options.find(option => option[0] === selected)[1];
                const open = expanded === row.key;
                cv.roundRect(55, y, 1490, 64, 12, open ? selectionColor : '#ffffff12');
                cv.text(row.label, 80, y + 41, 28, theme.text);
                cv.text(value, 1455, y + 41, 26, theme.text, { align: 'right' });
                const cy = y + 32, direction = open ? -1 : 1;
                cv.polyline([[1480, cy - direction * 4], [1488, cy + direction * 4],
                    [1496, cy - direction * 4]], 2, theme.dim);
                cv.target(55, y, 1490, 64, () => { expanded = open ? null : row.key; }, row.id, 12);
                y += 72;
                if (!open) return;
                options.forEach(([key, label]) => {
                    const on = key === selected;
                    cv.roundRect(80, y, 1440, 54, 10, on ? selectionColor : '#ffffff0c');
                    cv.text(label, 108, y + 36, 26, theme.text);
                    if (on) cv.polyline([[1462, y + 25], [1470, y + 33], [1484, y + 17]], 3, theme.text);
                    cv.target(80, y, 1440, 54, () => {
                        settings.set(row.key, key);
                        expanded = null;
                    }, row.id + '-' + key, 10);
                    y += 62;
                });
            });
            const usesInside = rows.some(row => settings.get(row.key) !== 'outside');
            if (equipment && equipment.auxiliaryHeating === true && usesInside) {
                cv.text('Inside temperature is affected by auxiliary heating while it is running.',
                    80, 504, 20, theme.dim);
            }
        },
    };
};
