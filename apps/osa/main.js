'use strict';

/**
 * Oil Service Assistant
 *
 * Engine oil temperature comes from BMW's native CDS vehicle signal.
 * Transmission oil temperature is read from the verified EGS variant using
 * the shared read-only diagnostic transport.
 */
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const Car = require('./kit/car');
const { withAlpha } = require('./kit/canvas');
const TransmissionReader = require('./transmission');

const W = 1600, H = 520;

mgu.run({
    async start(ctx) {
        const { ui, log } = ctx;
        let page = 0;
        const car = new Car(ctx, ['rpm', 'speed', 'temps']);
        const transmission = new TransmissionReader(ctx);

        const hist = [];
        const mono = () => { const h = process.hrtime(); return h[0] * 1000 + h[1] / 1e6; };
        let lastHist = 0;
        car.onSample((d) => {
            const now = mono();
            if (now - lastHist > 5000 && (G.isNum(d.oil) || G.isNum(d.coolant))) {
                lastHist = now;
                hist.push([now, d.oil, d.coolant]);
                while (hist.length > 240) hist.shift();
            }
        }, () => { hist.length = 0; lastHist = 0; });

        const TYPICAL = { oil: { drive: 4, idle: 1.5 }, coolant: { drive: 7, idle: 3 } };
        function measured(idx) {
            const last = hist.length ? hist[hist.length - 1][0] : 0;
            const pts = hist.filter((h) => G.isNum(h[idx]) && last - h[0] < 180000);
            if (pts.length < 4) return { rate: null, span: 0 };
            const n = pts.length;
            const mx = pts.reduce((a, p) => a + p[0], 0) / n;
            const my = pts.reduce((a, p) => a + p[idx], 0) / n;
            let num = 0, den = 0;
            pts.forEach((p) => { num += (p[0] - mx) * (p[idx] - my); den += (p[0] - mx) * (p[0] - mx); });
            return { rate: den ? num / den * 60000 : null, span: pts[n - 1][0] - pts[0][0] };
        }
        function eta(key, temp, target, d) {
            if (!G.isNum(temp)) return { state: 'none' };
            if (temp >= target) return { state: 'ready' };
            if (G.isNum(d.rpm) && d.rpm < 300) return { state: 'off' };
            const m = measured(key === 'oil' ? 1 : 2);
            const typ = TYPICAL[key][G.isNum(d.speed) && d.speed > 10 ? 'drive' : 'idle'];
            const w = G.clamp(m.span / 120000, 0, 1);
            const rate = G.isNum(m.rate) ? w * m.rate + (1 - w) * typ : typ;
            if (w > 0.8 && rate < 0.15) return { state: 'stalled', rate };
            return { state: 'warming', min: (target - temp) / Math.max(0.15, rate), rate, est: w < 0.5 };
        }
        function etaRow(cv, t, y, label, e, target) {
            cv.text(label, 952, y, 22, t.dim, { font: 'bold', spacing: 1.5 });
            let big, color = t.text, unit = '', right = '';
            if (e.state === 'ready') { big = 'READY'; color = t.ok; }
            else if (e.state === 'off') { big = 'ENGINE OFF'; color = t.dim; }
            else if (e.state === 'stalled') { big = 'NOT WARMING'; color = t.warn; right = 'drive to warm up'; }
            else if (e.state === 'warming') { big = e.min > 60 ? '>60' : '~' + Math.max(1, Math.round(e.min)); unit = 'min'; }
            else { big = '--'; color = t.dim; }
            const bw = cv.text(big, 952, y + 54, unit ? 52 : 38, color, { font: unit || big === '--' ? 'num' : 'bold', spacing: unit ? 0 : 1 });
            if (unit) cv.text('min', 960 + bw, y + 54, 25, t.dim);
            cv.text('target ' + Math.round(target) + '°C', 1552, y, 21, t.dim, { align: 'right' });
            if (right) cv.text(right, 1552, y + 48, 21, t.dim, { align: 'right' });
            if (e.state === 'warming' && e.est) cv.text('estimate', 1552, y + 48, 18, t.dim, { align: 'right' });
        }

        function render() {
            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            if (page === 0) {
                const d = car.data();
                const oil = G.isNum(d.oil) ? d.oil : null;
                const status = oil === null ? 'NO OIL TEMP' : (d.demo ? 'DEMO DATA' : 'LIVE');
                const statusColor = oil === null ? t.dim : (d.demo ? t.warn : t.ok);

                // Engine page keeps BOTH Warm-Up temperature gauges:
                // engine oil and engine coolant. Transmission page is oil-only.
                G.segBar(cv, t, 24, 44, 880, 225, {
                    label: 'Oil',
                    value: oil,
                    unit: '°C',
                    decimals: 0,
                    min: 0,
                    max: 150,
                    step: 10,
                    scale: { every: 25 },
                    zones: [
                        { from: 120, to: 135, color: 'warn' },
                        { from: 135, to: 160, color: 'crit' }
                    ],
                    ramp: 'hot',
                    limit: 120
                });
                G.segBar(cv, t, 24, 286, 880, 225, {
                    label: 'Coolant',
                    value: G.isNum(d.coolant) ? d.coolant : null,
                    unit: '°C',
                    decimals: 0,
                    min: 0,
                    max: 150,
                    step: 10,
                    scale: { every: 25 },
                    zones: [
                        { from: 105, to: 120, color: 'warn' },
                        { from: 120, to: 150, color: 'crit' }
                    ],
                    ramp: 'hot',
                    limit: 105
                });

                const oilTarget = Number(ctx.settings.get('warmOil')) || 80;
                const coolantTarget = Number(ctx.settings.get('warmCoolant')) || 80;
                G.panel(cv, t, 928, 44, 648, 468, null);
                cv.roundRect(952, 70, 600, 60, 10, withAlpha(statusColor, 0.22));
                cv.text(status, 1252, 110, status.length > 14 ? 30 : 38, statusColor, {
                    align: 'center', font: 'bold', spacing: 3
                });
                etaRow(cv, t, 190, 'OIL READY IN', eta('oil', d.oil, oilTarget, d), oilTarget);
                etaRow(cv, t, 305, 'COOLANT READY IN', eta('coolant', d.coolant, coolantTarget, d), coolantTarget);
                cv.text('BMW native vehicle signals · CDS', 952, 455, 19, t.dim);
            } else {
                const live = transmission.fresh;
                const value = live ? transmission.temp : null;
                const status = live ? 'LIVE' :
                    transmission.statusText === 'LIVE' ? 'LINK STALE' : transmission.statusText;
                const statusColor = live ? t.ok : t.dim;

                // Match the Engine oil page layout; only the data source and
                // transmission-specific temperature zones differ.
                G.segBar(cv, t, 24, 44, 880, 468, {
                    label: 'Oil',
                    value,
                    unit: '°C',
                    decimals: 0,
                    min: 0,
                    max: 150,
                    step: 10,
                    scale: { every: 25 },
                    zones: [
                        { from: 90, to: 110, color: 'warn' },
                        { from: 110, to: 150, color: 'crit' }
                    ],
                    ramp: 'hot',
                    limit: 110
                });

                G.panel(cv, t, 928, 44, 648, 468, null);
                cv.roundRect(952, 70, 600, 60, 10, withAlpha(statusColor, 0.22));
                cv.text(status, 1252, 110, status.length > 14 ? 30 : 38, statusColor, {
                    align: 'center', font: 'bold', spacing: 3
                });

                cv.text('TRANSMISSION OIL TEMPERATURE', 952, 190, 22, t.dim, {
                    font: 'bold', spacing: 1.5
                });
                cv.text(value === null ? '--' : String(Math.round(value)), 952, 289, 80, value === null ? t.dim : t.text, {
                    font: 'num'
                });
                cv.text('°C', value === null ? 1010 : 1040, 289, 30, t.dim);
                cv.text(transmission.sgbd ? ('EGS ' + transmission.sgbd + ' · DID 6000') : 'EGS · DID 6000', 952, 350, 21, t.dim);
                if (transmission.error) {
                    cv.text(transmission.error, 952, 390, 19, t.warn, { maxWidth: 590 });
                }
            }

            G.frame(cv, t, ['Engine', 'Transmission'], page, []);
            return ui.image('MAIN_GFX', cv);
        }

        const switchPage = (next) => {
            page = next;
            return render();
        };

        ui.onClick('BTN_PAGE', () => switchPage(1 - page));
        ui.onClick('BTN_PREV', () => switchPage(1 - page));
        ctx.onTab((i) => i !== page && switchPage(i));

        ui.onVisible((name, on) => {
            if (name === 'MAIN') transmission.setVisible(on);
        });
        transmission.setVisible(ui.isVisible('MAIN'));
        transmission.init().catch((e) => log.warn('OSA diagnostic link: ' + e));

        ctx.loop('MAIN', 4, render);
        render()
            .then(() => log.info('OSA first frame rendered'))
            .catch((e) => log.warn('OSA first render: ' + e));
    },
});
