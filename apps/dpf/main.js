'use strict';

/**
 * DPF Status
 *
 * Read-only DDE monitor. The first stage discovers ECUs through the permitted
 * UDS 22 F1 50 identification request. DPF measurements remain unavailable
 * until their B57/DDE 8.32 identifiers and decoding have been verified.
 *
 * No diagnostic service other than the read-only services exposed by
 * ReadOnlyDiag can be sent by this app.
 */
const mgu = require('./kit/mgu');
const { ReadOnlyDiag } = require('./kit/readonly-diag');

const W = 1600;
const H = 520;

mgu.run({
    async start(ctx) {
        const { ui, log } = ctx;
        const link = new ReadOnlyDiag(ctx.signals, log, { gapMs: 50 });
        let scanState = 'CONNECTING';
        let scanError = '';
        let units = [];
        let scannedAt = 0;
        let scanning = false;

        const scan = async () => {
            if (scanning) return;
            scanning = true;
            scanState = 'SCANNING';
            scanError = '';
            try {
                if (!link.ready) await link.init();
                if (!link.available) {
                    scanState = 'NO DIAGNOSTIC LINK';
                    scanError = link.error || 'TASU diagnostic transport is unavailable';
                    return;
                }
                const found = await link.discover({ idleMs: 1800, maxMs: 10000 });
                units = Array.from(found.entries())
                    .map(([address, sgbd]) => ({ address, sgbd: sgbd || 'IDENTIFICATION REFUSED' }))
                    .sort((a, b) => a.address - b.address);
                scannedAt = Date.now();
                scanState = units.length ? 'SCAN COMPLETE' : 'NO ECUS FOUND';
                log.info('DPF ECU discovery complete: ' + units.length + ' units');
            } catch (e) {
                scanState = 'SCAN ERROR';
                scanError = String(e.message || e);
                log.warn('DPF ECU discovery: ' + scanError);
            } finally {
                scanning = false;
            }
        };

        function render() {
            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            cv.text('DPF STATUS', 48, 78, 32, t.text, { font: 'bold', spacing: 2 });
            cv.text('READ-ONLY DIESEL PARTICULATE FILTER MONITOR', 48, 112, 17, t.dim, {
                font: 'bold', spacing: 1
            });

            const stateColor = scanState === 'SCAN COMPLETE' ? t.ok
                : (scanState === 'SCANNING' || scanState === 'CONNECTING' ? t.warn : t.dim);
            cv.roundRect(48, 145, 1504, 54, 9, t.panel || t.bg);
            cv.text(scanState, 72, 180, 23, stateColor, { font: 'bold', spacing: 1.5 });

            const cards = [
                ['SOOT MASS', '--', 'g'],
                ['ASH LOAD', '--', ''],
                ['DISTANCE SINCE REGEN', '--', 'km'],
                ['AVG REGEN INTERVAL', '--', 'km']
            ];
            const cardW = 354;
            cards.forEach((item, i) => {
                const x = 48 + i * 384;
                cv.roundRect(x, 220, cardW, 118, 10, t.panel || t.bg);
                cv.text(item[0], x + 20, 253, 16, t.dim, { font: 'bold', spacing: 1 });
                cv.text(item[1], x + 20, 310, 38, t.dim, { font: 'num' });
                if (item[2]) cv.text(item[2], x + 82, 310, 18, t.dim);
            });

            // Independent DDE flags: request pending is not the same as regeneration active.
            // Neither is inferred from soot load or temperature.
            cv.roundRect(48, 352, 736, 48, 9, t.panel || t.bg);
            cv.roundRect(816, 352, 736, 48, 9, t.panel || t.bg);
            cv.text('REGENERATION', 68, 383, 18, t.dim, { font: 'bold' });
            cv.text('UNKNOWN', 764, 383, 20, t.warn, { font: 'bold', align: 'right' });
            cv.text('REGEN REQUEST', 836, 383, 18, t.dim, { font: 'bold' });
            cv.text('UNKNOWN', 1532, 383, 20, t.warn, { font: 'bold', align: 'right' });

            cv.text('ECU DISCOVERY', 48, 425, 17, t.text, { font: 'bold', spacing: 1.5 });
            cv.text('ADDRESS', 48, 448, 14, t.dim, { font: 'bold' });
            cv.text('SGBD IDENTIFICATION', 190, 448, 14, t.dim, { font: 'bold' });

            const visible = units.slice(0, 1);
            visible.forEach((unit, i) => {
                const y = 480 + i * 24;
                cv.text('0x' + unit.address.toString(16).toUpperCase().padStart(2, '0'), 48, y, 17, t.text, { font: 'num' });
                cv.text(unit.sgbd, 190, y, 17, t.text, { font: 'num' });
            });
            if (!units.length && scanState !== 'SCANNING' && scanState !== 'CONNECTING') {
                cv.text(scanError || 'No ECU identification data received.', 48, 482, 17, t.dim);
            }
            if (units.length > 1) {
                cv.text('+' + (units.length - 1) + ' more ECUs', 450, 480, 15, t.dim);
            }
            if (scannedAt) {
                cv.text('Last scan: ' + new Date(scannedAt).toLocaleTimeString(), 1552, 425, 16, t.dim, { align: 'right' });
            }

            return ui.image('MAIN_GFX', cv);
        }

        ui.onClick('BTN_SCAN', () => {
            scan().then(() => render()).catch((e) => log.warn('DPF scan: ' + e));
        });

        ctx.loop('MAIN', 4, render);
        await scan();
        render()
            .then(() => log.info('DPF Status first frame rendered'))
            .catch((e) => log.warn('DPF Status first render: ' + e));
    }
});
