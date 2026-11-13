'use strict';

const path = require('path');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const { decode: decodePng } = require('./png');

const TABS = ['Info', 'Fuelling', 'My Car', 'About'];

mgu.run({
    start(ctx) {
        let entry = '';
        let page = 0;
        let artwork;
        let pairingQr;
        let vehicle;
        let accountStatus = '';
        const isEmulator = typeof process.send === 'function' && process.env.MGU_EMU_CLOSED !== undefined;
        if (isEmulator && process.env.SP_APPLICATION_ID && process.env.SP_ACCESS_TOKEN) {
            accountStatus = 'Loading vehicles from Spritmonitor...';
            const api = require('./sp-api');
            api.loadVehicle(process.env.SP_APPLICATION_ID, process.env.SP_ACCESS_TOKEN, process.env.SP_VEHICLE_ID)
                .then(result => { vehicle = result; accountStatus = ''; })
                .catch(error => { accountStatus = error.message; });
        }
        ctx.ui.onClick('BTN_FUEL', () => { page = 1; entry = 'Fuel'; });
        ctx.ui.onClick('BTN_ADBLUE', () => { page = 1; entry = 'AdBlue'; });
        ctx.onTab(index => {
            if (TABS[index]) page = index;
        });

        const rasterRuns = src => {
            const d = src.d, w = src.w, h = src.h;
            // Join matching runs across rows to avoid seams inside solid areas.
            let previousRuns = new Map();
            const runs = [];
            const keepRun = run => runs.push(run);
            for (let y = 0; y < h; y++) {
                const currentRuns = new Map();
                let run = -1, last = -1;
                for (let x = 0; x <= w; x++) {
                    let color = -1;
                    if (x < w) {
                        const p = (y * w + x) * 4;
                        const a = Math.round(d[p + 3] / 17) * 17;
                        if (a >= 32) {
                            const r = Math.round(d[p] / 17) * 17;
                            const g = Math.round(d[p + 1] / 17) * 17;
                            const b = Math.round(d[p + 2] / 17) * 17;
                            color = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
                        }
                    }
                    if (color !== last) {
                        if (last !== -1) {
                            const id = run + ':' + x + ':' + last;
                            const rect = previousRuns.get(id);
                            if (rect) {
                                rect.height++;
                                previousRuns.delete(id);
                                currentRuns.set(id, rect);
                            } else {
                                currentRuns.set(id, { x: run, y, width: x - run, height: 1, color: last });
                            }
                        }
                        run = color === -1 ? -1 : x;
                        last = color;
                    }
                }
                previousRuns.forEach(keepRun);
                previousRuns = currentRuns;
            }
            previousRuns.forEach(keepRun);
            return runs;
        };

        function renderAbout(cv, theme) {
            if (!artwork) {
                artwork = [
                    ['brmodz_logo.png', 300, 124, 490, 58],
                    ['qr_instagram.png', 116, 120, 332, 375, 'Instagram'],
                    ['qr_facebook.png', 116, 120, 496, 375, 'Facebook'],
                    ['qr_report_bug.png', 102, 102, 667, 384, 'Report a bug', true],
                    ['qr_request_feature.png', 102, 102, 831, 384, 'Request a feature', true]
                ].map(([file, width, height, x, y, label, feedback]) => ({
                    x, y, width, height, label, feedback,
                    runs: rasterRuns(decodePng(path.join(__dirname, file), width, height))
                        .filter(run => !feedback || run.color !== 0xffffffff)
                }));
            }
            const scale = cv.place ? cv.place.scale : 1;
            const edge = coordinate => Math.round(coordinate * scale) / scale;
            for (const { x, y, width, height, label, feedback, runs } of artwork) {
                if (feedback) cv.fillRect(edge(x), edge(y), edge(x + width) - edge(x),
                    edge(y + height) - edge(y), 0xffffffff);
                for (const run of runs) {
                    const left = edge(x + run.x);
                    const top = edge(y + run.y);
                    cv.fillRect(left, top, edge(x + run.x + run.width) - left,
                        edge(y + run.y + run.height) - top, run.color);
                }
                cv.text(label, x + width / 2, 512, 15, theme.text, { align: 'center' });
            }

            const center = { align: 'center' };
            const heading = { align: 'center', font: 'bold', spacing: 2.5 };
            cv.text('SPRITMONITOR', 640, 225, 30, theme.text, heading);
            cv.text('Log fuel and AdBlue fill-ups in Spritmonitor', 640, 258, 19, theme.dim, center);
            cv.text('directly from BMW iDrive 7.', 640, 285, 19, theme.dim, center);
            cv.text('Developed by dzooky@bmrmodz', 640, 353, 18, theme.text, center);
            cv.text("WHAT'S NEW", 1120, 80, 22, theme.text, { font: 'bold' });
            cv.text('0.1.5', 1120, 105, 14, theme.text, { font: 'bold' });
            cv.text('Fuelling and My Car preview', 1186, 105, 14, theme.dim);
            cv.text('0.1.4', 1120, 185, 14, theme.text, { font: 'bold' });
            cv.text('Trip reset setting', 1186, 185, 14, theme.dim);
            cv.text('0.1.3', 1120, 125, 14, theme.text, { font: 'bold' });
            cv.text('Settings tab', 1186, 125, 14, theme.dim);
            cv.text('0.1.2', 1120, 145, 14, theme.text, { font: 'bold' });
            cv.text('Feedback QR codes in About', 1186, 145, 14, theme.dim);
            cv.text('0.1.1', 1120, 165, 14, theme.text, { font: 'bold' });
            cv.text('BMRMODZ layout and About', 1186, 165, 14, theme.dim);
        }

        ctx.loop('MAIN', 4, () => {
            const theme = ctx.theme();
            const cv = ctx.canvas(1600, 520).clear(theme.bg);
            G.panel(cv, theme, 24, 44, 1552, 468, null);
            if (page === 3) {
                renderAbout(cv, theme);
            } else if (page === 2 && vehicle) {
                cv.text(vehicle.name, 800, 180, 42, theme.text, { align: 'center', font: 'bold' });
                cv.text(vehicle.tanks.join(' / '), 800, 232, 28, theme.text, { align: 'center' });
                cv.text('Connected to Spritmonitor', 800, 286, 22, theme.dim, { align: 'center' });
            } else if (page === 2 && accountStatus) {
                cv.text(accountStatus, 800, 240, 26, theme.text, { align: 'center' });
            } else if (page === 2) {
                const centered = { align: 'center' };
                cv.text('No vehicle paired', 800, 108, 34, theme.text,
                    { align: 'center', font: 'bold' });
                cv.text('Scan the QR code with your phone', 800, 152, 24, theme.dim, centered);

                // Preview only. A live QR must carry a session-specific pairing link.
                if (!pairingQr) {
                    pairingQr = rasterRuns(decodePng(path.join(__dirname, 'qr_pairing_preview.png'), 180, 180))
                        .filter(run => run.color !== 0xffffffff);
                }
                const scale = cv.place ? cv.place.scale : 1;
                const edge = value => Math.round(value * scale) / scale;
                const x = 710, y = 180, size = 180;
                cv.fillRect(edge(x), edge(y), edge(x + size) - edge(x), edge(y + size) - edge(y), 0xffffffff);
                for (const run of pairingQr) {
                    const left = edge(x + run.x);
                    const top = edge(y + run.y);
                    cv.fillRect(left, top, edge(x + run.x + run.width) - left,
                        edge(y + run.y + run.height) - top, run.color);
                }
                cv.text('Preview QR code. Pairing is not available yet.',
                    800, 408, 19, theme.dim, centered);
            } else if (page === 0) {
                const centered = { align: 'center' };
                cv.text('This application is still in development phase and not ready for public use.',
                    800, 218, 30, theme.text, centered);
                cv.text('We still working on it and will be available soon.',
                    800, 260, 30, theme.text, centered);
                cv.text('Thank you', 800, 302, 30, theme.text, centered);
            } else {
                cv.text(entry || 'Spritmonitor', 48, 80, 32, theme.text, { font: 'bold' });
                cv.text(entry ? 'Form preview' : 'Choose an entry type', 48, 126, 24, theme.dim);
                if (vehicle) cv.text(vehicle.name, 48, 166, 24, theme.text);
            }
            G.frame(cv, theme, TABS, page, []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
