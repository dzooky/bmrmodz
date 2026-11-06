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
        const car = new Car(ctx, ['temps']);
        const transmission = new TransmissionReader(ctx);

        function render() {
            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            if (page === 0) {
                const d = car.data();
                const oil = G.isNum(d.oil) ? d.oil : null;
                const status = oil === null ? 'NO OIL TEMP' : (d.demo ? 'DEMO DATA' : 'LIVE');
                const statusColor = oil === null ? t.dim : (d.demo ? t.warn : t.ok);

                // Match the Warm-Up oil gauge: same position, dimensions,
                // temperature range, segment scale and hot-zone colours.
                G.segBar(cv, t, 24, 44, 880, 468, {
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

                // Warm-Up-style right information panel, currently focused
                // only on oil data. No estimated warm-up values are invented.
                G.panel(cv, t, 928, 44, 648, 468, null);
                cv.roundRect(952, 70, 600, 60, 10, withAlpha(statusColor, 0.22));
                cv.text(status, 1252, 110, status.length > 14 ? 30 : 38, statusColor, {
                    align: 'center', font: 'bold', spacing: 3
                });

                cv.text('ENGINE OIL TEMPERATURE', 952, 190, 22, t.dim, {
                    font: 'bold', spacing: 1.5
                });
                cv.text(oil === null ? '--' : String(Math.round(oil)), 952, 289, 80, oil === null ? t.dim : t.text, {
                    font: 'num'
                });
                cv.text('°C', oil === null ? 1010 : 1040, 289, 30, t.dim);
                cv.text('BMW native vehicle signal · CDS', 952, 350, 21, t.dim);
            } else {
                const live = transmission.fresh;
                const status = live ? 'LIVE' :
                    transmission.statusText === 'LIVE' ? 'LINK STALE' : transmission.statusText;
                const value = live ? transmission.temp : null;

                G.segBar(cv, t, 24, 44, 880, 468, {
                    label: 'Transmission oil',
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
                cv.roundRect(952, 70, 600, 60, 10, withAlpha(live ? t.ok : t.dim, 0.16));
                cv.text(status, 1252, 110, 30, live ? t.ok : t.dim, {
                    align: 'center', font: 'bold', spacing: 2
                });

                cv.text('Transmission oil temperature', 952, 190, 24, t.dim);
                cv.text(live ? (value + ' °C') : '-- °C', 952, 258, 48, t.text, { font: 'bold' });
                cv.text(transmission.sgbd ? ('EGS ' + transmission.sgbd) : 'ZF 8HP · EGS identification', 952, 310, 22, t.dim);
                if (transmission.error) {
                    cv.text(transmission.error, 952, 370, 19, t.warn, { maxWidth: 590 });
                } else {
                    cv.text('Read-only live data · DID 6000', 952, 370, 19, t.dim);
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
