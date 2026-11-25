'use strict';

const { t } = require('./kit/i18n');

const units = { 1: 'L', 2: 'kg', 3: 'L', 4: 'L', 5: 'kWh' };
const quantityFactor = { 1: 1, 2: 1, 3: 3.785411784, 4: 4.54609, 5: 1 };

module.exports = function renderChart(cv, theme, vehicle, tankIndex, metric) {
    const tank = vehicle.tankStats[tankIndex];
    const history = vehicle.latestFuelings[tankIndex];
    const title = { consumption: 'Consumption', distance: 'Distance per fill-up', price: 'Unit price' }[metric];
    cv.text(tank.name + ' / ' + t(title), 65, 150, 26, theme.text, { font: 'bold' });

    let unit = metric === 'consumption' ? tank.consumption[1] : tank.distance[1];
    const samples = [];
    const positive = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
    let priceGroup;
    const entries = history.entries || [];
    const preferredCurrency = vehicle.preferredCurrency;
    const useConverted = preferredCurrency != null && entries.some(entry => positive(entry.cost_converted));
    entries.forEach((entry, index) => {
        let value = metric === 'consumption' ? entry.consumption : entry.trip;
        if (metric === 'distance' && !positive(value) && entries[index + 1]) {
            const previous = entries[index + 1].odometer;
            if (positive(entry.odometer) && positive(previous)) value = Number(entry.odometer) - Number(previous);
        }
        if (metric === 'price') {
            const amount = useConverted ? entry.cost_converted : entry.cost;
            const currencyId = useConverted ? preferredCurrency : entry.currencyid;
            const quantityUnit = units[entry.quantityunitid];
            if (!positive(amount) || !positive(entry.quantity) || currencyId == null || !quantityUnit) return;
            const group = currencyId + ':' + quantityUnit;
            if (!priceGroup) {
                priceGroup = group;
                const currency = vehicle.currencies.find(item => String(item.id) === String(currencyId));
                unit = (currency ? currency.name : 'Currency #' + currencyId) + ' / ' + quantityUnit;
            }
            if (group !== priceGroup) return;
            value = Number(amount) / (Number(entry.quantity) * quantityFactor[entry.quantityunitid]);
        }
        if (positive(value)) samples.push({ value: Number(value), date: entry.date, odometer: entry.odometer });
    });
    samples.reverse();

    if (samples.length === 0) {
        cv.text(history.unavailable ? 'Could not load fill-ups' : 'No data for this chart', 800, 290, 26, theme.dim, { align: 'center' });
        return;
    }

    const x = 145, y = 192, width = 1350, height = 176;
    const values = samples.map(sample => sample.value);
    const min = Math.min(...values), max = Math.max(...values);
    const pad = Math.max((max - min) * 0.08, min * 0.01);
    const lower = Math.max(0, min - pad), upper = max + pad;
    const decimals = metric === 'price' ? 2 : metric === 'distance' && max >= 100 ? 0 : 1;
    cv.text(samples.length + ' ' + t('points') + (unit ? ' / ' + unit : ''), 1520, 150, 21, theme.dim, { align: 'right' });
    for (let tick = 0; tick <= 4; tick++) {
        const row = y + tick * height / 4;
        cv.line(x, row, x + width, row, 1, theme.dim);
        cv.text((upper - (upper - lower) * tick / 4).toFixed(decimals), x - 14, row + 7, 18, theme.dim, { align: 'right' });
    }
    const points = samples.map((sample, index) => [
        x + (samples.length === 1 ? width / 2 : index * width / (samples.length - 1)),
        y + height * (upper - sample.value) / (upper - lower)
    ]);
    cv.polyline(points, 3, theme.accent);
    points.forEach(([px, py]) => cv.circle(px, py, 4, theme.accent));
    const label = sample => [sample.date, sample.odometer > 0 ? sample.odometer + (tank.distance[1] ? ' ' + tank.distance[1] : '') : null]
        .filter(Boolean).join('  /  ');
    cv.text(label(samples[0]), x, 402, 18, theme.dim);
    if (samples.length > 1) cv.text(label(samples[samples.length - 1]), x + width, 402, 18, theme.dim, { align: 'right' });
};
