'use strict';

/**
 * DPF Status
 *
 * Read-only DDE monitor. Identifies DDE 0x12 via physical UDS 22 F1 50.
 * Displays DPF measurements for the identified B57 DDE.
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
        let transportStatus = 'NOT STARTED';
        const link = new ReadOnlyDiag(ctx.signals, log, {
            gapMs: 50, busyMs: 500,
            onDebug: message => {
                if (/^(SENDING|TRANSPORT|FRAME|NO MATCHING RESPONSE|REPLY|SKIPPED)/.test(message)) {
                    transportStatus = message.slice(0, 100);
                    log.info('DPF TASU ' + transportStatus);
                }
            }
        });
        const DDE = 0x12;
        const EXPECTED = '0F1FE8';
        let scanState = 'CONNECTING';
        let scanError = '';
        let identified = false;
        let testing = false;
        let testLines = [];
        let testProgress = '';
        const readings = {};
        let page = 'overview';
        let detailReadPending = false;
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const requestOptions = { maxRetries: 2, retryBaseMs: 500, callTimeoutMs: 2500, hardTimeoutMs: 6500, pendingTimeoutMs: 2500 };
        const dids = [
            ['SOOT', 0x44BE, 2, 0.01525902],
            ['ASH', 0x44BD, 2, 0.01525902],
            ['SINCE', 0x44BF, 4, 1],
            ['AVERAGE', 0x4B2F, 4, 1],
            ['REQUEST', 0x44BB, 1, 1],
            ['MODE', 0x467E, 4, 1]
        ];
        // D83BX7C0A ReadDataByIdentifier scalings and offsets.
        const detailDids = [
            ['PRESSURE', 0x44EB, 2, 0.03814755, 500],
            ['TEMP', 0x44EF, 2, 0.03128099, -50],
            ['RUNTIME', 0x44B7, 4, 1],
            ['LOCK', 0x44C2, 1, 1],
            ['AVG TEMP', 0x4B4A, 2, 0.1, -3276.7],
            ['REMAINING', 0x4C78, 2, 10]
        ];
        const hexBytes = a => a.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
        async function testSelected(includeDetails = page === 'detail') {
            if (!identified) return;
            if (testing) {
                if (includeDetails) detailReadPending = true;
                return;
            }
            testing = true;
            testLines = [];
            testProgress = 'STARTING';
            const address = DDE;
            const selected = includeDetails ? dids.concat(detailDids) : dids;
            try {
                link.wake(address);
                for (const [name, did, len, factor, offset = 0] of selected) {
                    testProgress = 'READING '+name+' '+did.toString(16).toUpperCase();
                    const response = await link.physical(address, 0x22, [(did >> 8) & 255, did & 255], 1800,
                        u => u && ((u[0] === 0x62 && u[1] === (did >> 8) && u[2] === (did & 255)) || (u[0] === 0x7F && u[1] === 0x22)),
                        requestOptions);
                    let result = 'TIMEOUT';
                    if(response) {
                        if(response[0] === 0x7F) result = 'NRC '+hexBytes(response);
                        else if(response[0] === 0x62 && response[1] === (did>>8) && response[2] === (did&255)) {
                            const bytes = response.slice(3);
                            if(bytes.length === len) {
                                let raw = 0;
                                for(const b of bytes) raw = raw*256+b;
                                result = hexBytes(bytes)+' = '+(raw * factor + offset).toFixed(Number.isInteger(factor) ? 0 : 2);
                            } else result = 'LEN '+bytes.length+' '+hexBytes(bytes);
                        } else result = 'UNEXPECTED '+hexBytes(response);
                    }
                    if (response && response[0] === 0x62 && response[1] === (did >> 8) && response[2] === (did & 255) && response.length === len + 3) {
                        let raw = 0;
                        for (const b of response.slice(3)) raw = raw * 256 + b;
                        readings[name] = { raw, value: raw * factor + offset, at: Date.now() };
                    } else if (name === 'REQUEST' || name === 'MODE' || name === 'LOCK') {
                        delete readings[name];
                    }
                    const line = name+' '+did.toString(16).toUpperCase()+': '+result;
                    testLines.push(line);
                    testProgress = 'DONE '+testLines.length+'/'+selected.length;
                    log.info('DPF READ ECU '+address.toString(16)+' '+line);
                }
            } catch(e) {testLines.push('ERROR: '+String(e).slice(0,95));log.warn('DPF test: '+String(e));}
            finally {
                testing = false;
                testProgress = 'TEST FINISHED ' + testLines.length + '/' + selected.length;
                if (detailReadPending) {
                    detailReadPending = false;
                    if (page === 'detail') await testSelected(true);
                }
            }
        }


        const identify = async () => {
            scanState = 'IDENTIFYING DDE';
            scanError = '';
            transportStatus = 'STARTING IDENTIFICATION';
            identified = false;
            try {
                if (!link.ready) await link.init();
                if (!link.available) {
                    scanState = 'NO DIAGNOSTIC LINK';
                    scanError = link.error || 'TASU unavailable';
                    return;
                }
                link.wake(DDE);
                const u = await link.physical(DDE, 0x22, [0xF1, 0x50], 1800,
                    b => b && ((b[0] === 0x62 && b[1] === 0xF1 && b[2] === 0x50) || (b[0] === 0x7F && b[1] === 0x22)),
                    requestOptions);
                if (!u) { scanState = 'DDE NO RESPONSE'; return; }
                if (u[0] !== 0x62 || u.length < 6) {
                    scanState = 'DDE IDENTIFICATION REFUSED';
                    scanError = hexBytes(u);
                    return;
                }
                const actual = hexBytes(u.slice(3, 6)).replace(/ /g, '');
                if (actual !== EXPECTED) {
                    scanState = 'UNEXPECTED DDE';
                    scanError = actual + ' (expected ' + EXPECTED + ')';
                    return;
                }
                identified = true;
                scanState = 'DDE IDENTIFIED';
            } catch (e) {
                scanState = 'DDE LINK ERROR';
                scanError = String(e.message || e);
                log.warn('DPF identify: ' + scanError);
            }
        };

        const hasReading = key => !!readings[key];
        const stale = key => hasReading(key) && Date.now() - readings[key].at >= 90000;

        function renderDetail(cv, t) {
            cv.text('DPF DETAIL', 48, 75, 32, t.text, { font: 'bold' });
            const measurement = (key, digits, unit) => hasReading(key)
                ? readings[key].value.toFixed(digits) + ' ' + unit : '--';
            const runtime = readings.RUNTIME?.raw;
            const duration = runtime === undefined ? '--' : [
                Math.floor(runtime / 3600),
                Math.floor(runtime / 60) % 60,
                runtime % 60
            ].map(part => String(part).padStart(2, '0')).join(':');
            const release = hasReading('LOCK') && !stale('LOCK')
                ? (readings.LOCK.raw === 0 ? 'ON' : 'OFF') : 'UNKNOWN';
            const rows = [
                ['PRESSURE BEFORE DPF', measurement('PRESSURE', 1, 'hPa'), 'PRESSURE'],
                ['TEMPERATURE BEFORE DPF', measurement('TEMP', 1, '°C'), 'TEMP'],
                ['ENGINE TIME SINCE REGEN', duration, 'RUNTIME'],
                ['REGEN RELEASE', release],
                ['AVG TEMP DURING REGEN', measurement('AVG TEMP', 1, '°C'), 'AVG TEMP'],
                ['AVG REGEN DURATION / 100 KM', 'UNAVAILABLE'],
                ['EST. FILTER DISTANCE LEFT', measurement('REMAINING', 0, 'km'), 'REMAINING']
            ];
            rows.forEach(([label, value, key], i) => {
                const x = 48 + (i % 2) * 768;
                const y = 94 + Math.floor(i / 2) * 48;
                cv.roundRect(x, y, 736, 42, 8, t.panel || t.bg);
                cv.text(label, x + 16, y + 27, 16, t.dim, { font: 'bold' });
                cv.text(value, x + 716, y + 27, 20, t.text, { align: 'right' });
                if (stale(key)) cv.text('STALE', x + 470, y + 27, 14, t.warn);
            });

            cv.text('DDE READ-ONLY TEST', 48, 322, 17, t.text, { font: 'bold' });
            cv.text('DDE 0x12 / ' + EXPECTED, 48, 347, 16, t.warn);
            cv.text(testProgress || scanError || scanState, 816, 347, 16, t.dim);
            cv.text(transportStatus, 816, 322, 14, t.warn);
            testLines.forEach((line, i) =>
                cv.text(line, 48 + (i % 2) * 768, 375 + Math.floor(i / 2) * 22, 15, t.text, { font: 'num' }));
        }

        function render() {
            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);

            if (page === 'detail') {
                renderDetail(cv, t);
                return ui.image('MAIN_GFX', cv);
            }

            cv.text('DPF OVERVIEW', 48, 78, 32, t.text, { font: 'bold', spacing: 2 });
            cv.text('READ-ONLY DIESEL PARTICULATE FILTER MONITOR', 48, 112, 17, t.dim, {
                font: 'bold', spacing: 1
            });

            const stateColor = scanState === 'DDE IDENTIFIED' ? t.ok
                : (scanState === 'IDENTIFYING DDE' || scanState === 'CONNECTING' ? t.warn : t.dim);
            cv.roundRect(48, 145, 1504, 54, 9, t.panel || t.bg);
            cv.text(scanState, 72, 180, 23, stateColor, { font: 'bold', spacing: 1.5 });

            // Preserve the last successful measurement through diagnostic timeouts.
            // An old value is explicitly marked STALE rather than shown as live.
            const mass = key => hasReading(key) ? readings[key].value.toFixed(2) : '--';
            const distance = key => hasReading(key) ? (readings[key].raw / 1000).toFixed(1) : '--';
            const cards = [
                ['SOOT MASS', mass('SOOT'), 'g', 'SOOT'],
                ['ASH MASS', mass('ASH'), 'g', 'ASH'],
                ['SINCE REGEN', distance('SINCE'), 'km', 'SINCE'],
                ['AVG REGEN', distance('AVERAGE'), 'km', 'AVERAGE']
            ];
            const cardW = 354;
            cards.forEach((item, i) => {
                const x = 48 + i * 384;
                cv.roundRect(x, 220, cardW, 118, 10, t.panel || t.bg);
                cv.text(item[0], x + 20, 253, 16, t.dim, { font: 'bold', spacing: 1 });
                cv.text(item[1], x + 20, 310, 38, t.dim, { font: 'num' });
                if (item[2]) cv.text(item[2], x + 20, 330, 14, t.dim);
                if (stale(item[3])) cv.text('STALE', x + cardW - 16, 253, 14, t.warn, { font: 'bold', align: 'right' });
            });

            // D83BX7C0A STATUS_REGENERATION_CSF decoding, using direct ReadDataByIdentifier.
            // PFltRgn_numRgn modes 4–6 mean requested. CoEOM_stOpModeAct bit 1 means active.
            const regenStatus = (key, isOn) => {
                if (!hasReading(key) || stale(key)) return ['UNKNOWN', t.warn];
                return isOn(readings[key].raw) ? ['ON', t.ok] : ['OFF', t.dim];
            };
            const [activeText, activeColor] = regenStatus('MODE', mode => (mode & 0x02) !== 0);
            const [requestText, requestColor] = regenStatus('REQUEST', mode => mode >= 4 && mode <= 6);
            cv.roundRect(48, 352, 736, 48, 9, t.panel || t.bg);
            cv.roundRect(816, 352, 736, 48, 9, t.panel || t.bg);
            cv.text('REGEN IN PROGRESS', 68, 383, 18, t.dim, { font: 'bold' });
            cv.text(activeText, 764, 383, 20, activeColor, { font: 'bold', align: 'right' });
            cv.text('REGEN REQUEST', 836, 383, 18, t.dim, { font: 'bold' });
            cv.text(requestText, 1532, 383, 20, requestColor, { font: 'bold', align: 'right' });


            return ui.image('MAIN_GFX', cv);
        }

        ui.onClick('BTN_OVERVIEW', () => {
            page = 'overview';
            return render();
        });
        ui.onClick('BTN_DETAIL', () => {
            const opening = page !== 'detail';
            page = 'detail';
            if (opening) testSelected();
            return render();
        });
        ui.onClick('BTN_TEST_DPF', () => {
            page = 'detail';
            return testSelected(true).then(render).catch(e => log.warn('DPF test: ' + e));
        });
        ctx.loop('MAIN', 4, render);
        await identify();
        if (ui.isVisible('MAIN')) testSelected();
        // Read-only periodic updates while the page is visible; never overlap requests.
        (async () => {
            while (true) {
                await sleep(60000);
                if (identified && !testing && ui.isVisible('MAIN')) await testSelected();
            }
        })().catch(e => log.warn('DPF polling: ' + e));
        render()
            .then(() => log.info('DPF Status first frame rendered'))
            .catch((e) => log.warn('DPF Status first render: ' + e));
    }
});
