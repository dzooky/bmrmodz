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
        let selected = -1;
        let testing = false;
        let testLines = [];
        const dids = [['SOOT',0x44BE,2,0.01525902],['ASH',0x44BD,2,0.01525902],['SINCE',0x44BF,4,1],['AVERAGE',0x4B2F,4,1]];
        const hexBytes = a => a.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
        async function testSelected() {
            if(testing || scanning || selected < 0 || !units[selected]) return;
            testing = true;
            testLines = [];
            const address = units[selected].address;
            link.wake(address);
            try {
                for(const [name,did,len,factor] of dids) {
                    const response = await link.read(address,did,1800);
                    let result = 'TIMEOUT';
                    if(response) {
                        if(response[0] === 0x7F) result = 'NRC '+hexBytes(response);
                        else if(response[0] === 0x62 && response[1] === (did>>8) && response[2] === (did&255)) {
                            const bytes = response.slice(3);
                            if(bytes.length === len) {
                                let raw = 0;
                                for(const b of bytes) raw = raw*256+b;
                                result = hexBytes(bytes)+' = '+(raw*factor).toFixed(factor===1?0:2);
                            } else result = 'LEN '+bytes.length+' '+hexBytes(bytes);
                        } else result = 'UNEXPECTED '+hexBytes(response);
                    }
                    const line = name+' '+did.toString(16).toUpperCase()+': '+result;
                    testLines.push(line);
                    log.info('DPF READ ECU '+address.toString(16)+' '+line);
                }
            } catch(e) {log.warn('DPF test: '+String(e));}
            finally {testing = false;}
        }


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
                selected = -1;
                testLines = [];
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


            cv.text('DDE READ-ONLY TEST',48,425,17,t.text,{font:'bold'});
            cv.text(selected < 0 ? 'SELECT ECU WITH NEXT ECU BUTTON' : 'SELECTED ECU 0x'+units[selected].address.toString(16).toUpperCase()+' / '+units[selected].sgbd,48,451,16,t.warn);
            cv.text(testing ? 'READING...' : 'DISCOVERED '+units.length+' ECUS',850,451,16,t.dim);
            testLines.forEach((line,i)=>cv.text(line,48+(i%2)*770,480+Math.floor(i/2)*24,15,t.text,{font:'num'}));
            return ui.image('MAIN_GFX', cv);
        }

        ui.onClick('BTN_SCAN', () => {
            scan().then(() => render()).catch((e) => log.warn('DPF scan: ' + e));
        });

        ui.onClick('BTN_NEXT_ECU', () => {
            if(scanning || testing || !units.length) return;
            selected = (selected+1)%units.length;
            testLines = [];
            render();
        });
        ui.onClick('BTN_TEST_DPF', () => {
            testSelected().then(render).catch(e=>log.warn('DPF test: '+e));
        });
        ctx.loop('MAIN', 4, render);
        await scan();
        render()
            .then(() => log.info('DPF Status first frame rendered'))
            .catch((e) => log.warn('DPF Status first render: ' + e));
    }
});
