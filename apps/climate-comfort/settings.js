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
            let y = 80;
            rows.forEach(row => {
                const options = OPTIONS.map(([key, label]) => [key, key === 'inside' && row.insideLabel ? row.insideLabel : label]);
                const selected = settings.get(row.key) === 'outside' ? 'outside' : 'inside';
                const value = options.find(option => option[0] === selected)[1];
                const open = expanded === row.key;
                cv.roundRect(55, y, 1490, 76, 12, '#ffffff12');
                cv.text(row.label, 80, y + 47, 28, theme.text);
                cv.text(value, 1455, y + 47, 26, theme.text, { align: 'right' });
                const cy = y + 38, direction = open ? -1 : 1;
                cv.polyline([[1480, cy - direction * 4], [1488, cy + direction * 4],
                    [1496, cy - direction * 4]], 2, theme.dim);
                cv.target(55, y, 1490, 76, () => { expanded = open ? null : row.key; }, row.id);
                y += 86;
                if (!open) return;
                options.forEach(([key, label]) => {
                    const on = key === selected;
                    cv.roundRect(80, y, 1440, 64, 10, on ? '#ffffff22' : '#ffffff0c');
                    cv.text(label, 108, y + 41, 26, theme.text);
                    if (on) cv.polyline([[1462, y + 30], [1470, y + 38], [1484, y + 22]], 3, theme.text);
                    cv.target(80, y, 1440, 64, () => {
                        settings.set(row.key, key);
                        expanded = null;
                    }, row.id + '-' + key);
                    y += 72;
                });
            });
        },
    };
};
