'use strict';

/**
 * DPF Status
 *
 * Read-only DDE monitor. Identifies DDE 0x12 via physical UDS 22 F1 50.
 * Displays validated DPF measurements for identified B57 or B47 DDE.
 *
 * No diagnostic service other than the read-only services exposed by
 * ReadOnlyDiag can be sent by this app.
 */
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const fs = require('fs');
const path = require('path');
const { decode: decodePng } = require('./png');
const regenMessage = require('./regen-message');
const ddeProfiles = require('./dde-profiles');
const dataToolRead = require('./data-tool-read');
const distanceRecord = require('./distance-record');
const { t: translate } = require('./kit/i18n');
const Language = require('./language');
const { ReadOnlyDiag } = require('./kit/readonly-diag');
const CarEquipment = require('./kit/car-equipment');
const createSettingsCanvas = require('./kit/settings-canvas');

const W = 1600;
const H = 520;
const TABS = ['Overview', 'Detail', 'Settings', 'About', 'Diagnostics'];

mgu.run({
    async start(ctx) {
        const { ui, log } = ctx;
        ctx.hideButton('BTN_SETTINGS');
        const settingsCanvas = createSettingsCanvas(ctx.settings, ctx.spec.version, () => openPage('overview'));
        const distanceHistory = distanceRecord.create(ctx.dataDir, log);
        // Enable cluster messages only when VO confirms 6WB or Live Cockpit Professional (6U3).
        // An unresolved VO is a temporary state, not a reason to overwrite user preferences.
        ctx.settings.values.cluster6wbAvailable = false;
        let equipmentChecking = false;
        let equipmentCheckedAt = 0;
        let equipmentRetry = null;
        function scheduleEquipmentCheck() {
            if (equipmentRetry) return;
            equipmentRetry = setTimeout(() => {
                equipmentRetry = null;
                refreshClusterEquipment().catch(error => log.warn('DPF Car Equipment retry: ' + error));
            }, 10000);
        }
        async function refreshClusterEquipment(force = false) {
            if (equipmentChecking || (!force && Date.now() - equipmentCheckedAt < 10000)) return false;
            equipmentChecking = true;
            equipmentCheckedAt = Date.now();
            try {
                let reloadOk = !force;
                if (force) {
                    const reloaded = await CarEquipment.request({ op: 'reload' }, { timeout: 15000 });
                    reloadOk = !!(reloaded && reloaded.ok === true && reloaded.fresh === true);
                    if (!reloaded || reloaded.ok !== true || reloaded.available !== true)
                        log.warn('DPF Car Equipment reload: ' + (reloaded && reloaded.error || 'VO not yet available'));
                }
                const checked = await CarEquipment.check(['6WB', '6U3'], { timeout: 12000 });
                const sixWb = checked.results['6WB'];
                const sixU3 = checked.results['6U3'];
                const supported = sixWb === true || sixU3 === true;
                const confirmed = [sixWb, sixU3].every(value => value === true || value === false);
                ctx.settings.set('cluster6wbAvailable', supported);
                // Keep automatic equipment detection silent in Settings.
                if (force) ctx.settings.actionStatus.reloadEquipment = reloadOk ? '' : 'Equipment reload failed';
                log.info('DPF Car Equipment VO: 6WB=' + sixWb + ', 6U3=' + sixU3);
                if (!confirmed) scheduleEquipmentCheck();
                else if (equipmentRetry) { clearTimeout(equipmentRetry); equipmentRetry = null; }
                return reloadOk;
            } catch (error) {
                ctx.settings.set('cluster6wbAvailable', false);
                log.warn('DPF Car Equipment 6WB: ' + String(error && error.message || error));
                if (force) ctx.settings.actionStatus.reloadEquipment = 'Equipment read error';
                scheduleEquipmentCheck();
                return false;
            } finally { equipmentChecking = false; }
        }
        ctx.settings.actionStatus = {};
        ctx.settings.onAction('reloadEquipment', () => {
            if (equipmentChecking) {
                ctx.settings.actionStatus.reloadEquipment = 'Check in progress';
                return;
            }
            ctx.settings.actionStatus.reloadEquipment = 'Reloading...';
            log.info('DPF manual equipment reload pressed');
            refreshClusterEquipment(true).then(success => {
                if (!success && ctx.settings.actionStatus.reloadEquipment === 'Reloading...')
                    ctx.settings.actionStatus.reloadEquipment = 'Equipment reload failed';
                log.info('DPF manual equipment reload finished: ' + (success ? 'success' : 'failed'));
            }).catch(error => {
                ctx.settings.actionStatus.reloadEquipment = 'Reload failed';
                log.warn('DPF manual equipment reload: ' + error);
            });
        });
        refreshClusterEquipment().catch(error => log.warn('DPF Car Equipment: ' + error));

        Language.start(ctx);

        const link = new ReadOnlyDiag(ctx.signals, log, {
            gapMs: 50, busyMs: 500,
            onDebug: message => {
                if (/^(SENDING|TRANSPORT|FRAME|NO MATCHING RESPONSE|REPLY|SKIPPED)/.test(message)) {
                    log.info('DPF TASU ' + message.slice(0, 100));
                }
            }
        });
        const DDE = 0x12;
        let profile = null;
        let ddeIndex = null;
        let identified = false;
        let identifying = true;
        let readAttempted = false;
        let testing = false;
        const readings = {};
        let page = 'overview';
        let readPending = false;
        let detailReadAttempted = false;
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const requestOptions = { maxRetries: 2, retryBaseMs: 500, callTimeoutMs: 2500, hardTimeoutMs: 6500, pendingTimeoutMs: 2500 };
        const diagnostic = {
            tool: 'Not checked', identification: 'Connecting',
            lastRead: 'Not checked', lastIssue: 'None',
            lastDid: null, source: 'Legacy TASU', reads: 0,
            toolRead: 'Not checked', toolError: 'Not checked',
            tasuRead: 'Not checked', tasuError: 'Not checked',
            ddeRecovery: 'Not checked'
        };
        async function checkDataTool() {
            diagnostic.tool = 'Checking';
            diagnostic.tool = await dataToolRead.status() ? 'Responding' : 'Unavailable';
        }
        const dpfTransport = dataToolRead.create(link, {
            // Match the successful 15-second Data Tool Diagnostics IPC read window.
            timeoutMs: 15000,
            enabled: () => ctx.settings.get('experimentalDataTool') === true,
            requestOptions,
            onRecovery: status => {
                diagnostic.ddeRecovery = status;
                log.info('DPF F150 recovery: ' + status);
            },
            onToolResult: (ecu,did,result) => {
                diagnostic.lastDid = did;
                diagnostic.toolRead = result.ok ? 'Responding' : 'Failed';
                diagnostic.toolError = result.ok ? 'None' : result.code;
            },
            onFallback: error => {
                diagnostic.lastIssue = 'Data Tool request failed';
                log.warn('DPF Data Tool fallback: ' + String(error.message || error));
            },
            onLegacyResult: (ecu, did, response) => {
                diagnostic.source = 'Legacy TASU';
                diagnostic.lastDid = did;
                diagnostic.reads++;
                diagnostic.lastRead = response && response[0] === 0x62 ? 'Responding'
                    : response && response[0] === 0x7f ? 'Negative response' : 'No response';
                diagnostic.tasuRead = diagnostic.lastRead;
                diagnostic.tasuError = response && response[0] === 0x7f && Number.isInteger(response[2])
                    ? 'UDS_NRC_' + response[2].toString(16).toUpperCase().padStart(2,'0')
                    : response && response[0] === 0x62 ? 'None' : 'NO_MATCHING_RESPONSE';
                if (diagnostic.lastRead !== 'Responding') diagnostic.lastIssue = diagnostic.lastRead;
            },
            onSuccess: (ecu,did) => {
                diagnostic.source = 'Data Tool';
                diagnostic.tool = 'Responding';
                diagnostic.lastDid = did;
                diagnostic.reads++;
                diagnostic.lastRead = 'Responding';
                log.info('DPF Data Tool read OK ECU '+ecu.toString(16)+' DID '+did.toString(16));
            }
        });
        // B57 calibration is unchanged; B47 gets only its verified DIDs.
        const overviewDids = () => profile ? profile.overview : [];
        const detailDids = () => profile ? profile.detail : [];
        const regenDids = () => profile && profile.regeneration
            ? profile.overview.filter(([key]) => key === 'REQUEST' || key === 'MODE') : [];
        const hexBytes = a => a.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
        async function testSelected(regenOnly = false) {
            if (!identified || (!regenOnly && (page === 'about' || page === 'settings' || page === 'diagnostics'))) return;
            if (testing) {
                readPending = true;
                return;
            }
            testing = true;
            const address = DDE;
            const readingPage = page;
            const selected = regenOnly ? regenDids() : readingPage === 'detail' ? detailDids() : overviewDids();
            try {
                for (const [name, did, len, factor, offset = 0] of selected) {
                    const response = await dpfTransport.read(address, did);
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
                        if (name === 'SINCE' && profile)
                            distanceHistory.observe(ddeProfiles.km(readings[name], profile.distanceFactor));
                    } else if (name === 'REQUEST' || name === 'MODE' || name === 'LOCK') {
                        delete readings[name];
                    }
                    if (!response) diagnostic.lastIssue = 'DDE did not respond';
                    else if (result.startsWith('LEN ')) diagnostic.lastIssue = 'Unexpected data length';
                    const line = name+' '+did.toString(16).toUpperCase()+': '+result;
                    log.info('DPF READ ECU '+address.toString(16)+' '+line);
                    if (readPending && page !== readingPage) break;
                }
            } catch (e) { log.warn('DPF read: ' + String(e)); }
            finally {
                testing = false;
                if (!regenOnly) {
                    if (readingPage === 'detail') detailReadAttempted = true;
                    else readAttempted = true;
                }
                if (readPending) {
                    readPending = false;
                    if ((regenOnly || page !== readingPage) && ui.isVisible('MAIN')) await testSelected();
                }
            }
        }


        let identifyPending = false;
        const identify = async () => {
            // Guard the entire F150 operation, including async TASU initialization and fallback.
            if (identifyPending) return;
            identifyPending = true;
            identified = false;
            profile = null;
            ddeIndex = null;
            try {
                if (!link.ready) await link.init();
                diagnostic.identification = 'Checking';
                if (!link.available && ctx.settings.get('experimentalDataTool') !== true) {
                    diagnostic.identification = 'TASU unavailable';
                    diagnostic.lastIssue = 'TASU unavailable';
                    log.warn('DPF diagnostic link unavailable: ' + (link.error || 'TASU unavailable'));
                    return;
                }
                const u = await dpfTransport.read(DDE, 0xF150);
                if (!u) {
                    diagnostic.identification = 'No response';
                    diagnostic.lastIssue = 'DDE did not respond';
                    log.warn('DPF DDE did not respond');
                    return;
                }
                if (u[0] !== 0x62 || u.length < 6) {
                    diagnostic.identification = 'Negative response';
                    diagnostic.lastIssue = 'DDE identification failed';
                    log.warn('DPF DDE identification refused: ' + hexBytes(u));
                    return;
                }
                const actual = hexBytes(u.slice(3, 6)).replace(/ /g, '');
                ddeIndex = actual;
                profile = ddeProfiles.forDde(actual);
                if (!profile) {
                    diagnostic.identification = 'Unsupported DDE';
                    diagnostic.lastIssue = 'Unsupported DDE';
                    log.warn('DPF unsupported DDE index: ' + actual);
                    return;
                }
                log.info('DPF DDE ' + profile.engine + ' detected (index ' + actual + ')');
                identified = true;
                diagnostic.identification = 'Identified';
                diagnostic.lastIssue = 'None';
            } catch (e) {
                diagnostic.identification = 'Failed';
                diagnostic.lastIssue = 'DDE identification failed';
                log.warn('DPF identify: ' + String(e.message || e));
            } finally {
                identifyPending = false;
            }
        };

        const hasReading = key => !!readings[key];
        const hasMeasurements = () => ['SOOT', 'ASH', 'SINCE', 'AVERAGE'].some(hasReading);
        const hasDetailMeasurements = () => detailDids().some(([key]) => hasReading(key) && !stale(key));
        const stale = key => hasReading(key) && Date.now() - readings[key].at >= 90000;

        function regenState(maxAge = 90000) {
            // Never reuse B57 mode bit semantics on unverified B47 values.
            if (!profile || !profile.regeneration) return null;
            const now = Date.now();
            const mode = readings.MODE;
            if (!mode || now - mode.at >= maxAge) return null;
            if (mode.raw & 0x02) return 'active';
            const request = readings.REQUEST;
            if (!request || now - request.at >= maxAge) return null;
            return request.raw >= 4 && request.raw <= 6 ? 'requested' : 'idle';
        }

        const clusterEnabled = () => !!(profile && profile.regeneration) &&
            ctx.settings.values.cluster6wbAvailable === true && ctx.settings.get('regenCluster') === true;
        const indicator = regenMessage.createIndicator();
        let clusterTestStartedAt = null;
        ctx.settings.onAction('regenClusterTest', () => {
            // A visual preview must not depend on the DDE profile or regeneration state.
            clusterTestStartedAt = Date.now();
            log.info('DPF notification preview requested (DDE-independent)');
        });
        regenMessage.start(log, () => {
            const now = Date.now();
            const liveMessage = indicator(clusterEnabled() ? regenState(15000) : null, now);
            if (clusterTestStartedAt !== null) {
                const message = regenMessage.testMessage(now - clusterTestStartedAt);
                if (message) return message;
                clusterTestStartedAt = null;
            }
            return liveMessage;
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
        let aboutLogoRuns;
        let aboutLayers;
        function renderAbout(cv, t) {
            if (!aboutLayers) {
                aboutLogoRuns = rasterRuns(decodePng(path.join(__dirname, 'brmodz_logo.png'), 300, 124));
                const feedback = [
                    ['dpf_about_bug', 'qr_report_bug.png', 102, 102, 667, 384, 'Report a bug'],
                    ['dpf_about_feature', 'qr_request_feature.png', 102, 102, 831, 384, 'Request a feature']
                ];
                const hasFeedback = feedback.every(([, file]) => fs.existsSync(path.join(__dirname, file)));
                const y = hasFeedback ? 375 : 390;
                const links = [
                    ['dpf_about_instagram', 'qr_instagram.png', 116, 120, hasFeedback ? 332 : 500, y, hasFeedback ? 'Instagram' : null],
                    ['dpf_about_facebook', 'qr_facebook.png', 116, 120, hasFeedback ? 496 : 664, y, hasFeedback ? 'Facebook' : null]
                ];
                aboutLayers = links.concat(hasFeedback ? feedback : []).map(([key, file, width, height, x, y, label]) => {
                    const runs = rasterRuns(decodePng(path.join(__dirname, file), width, height));
                    const feedback = key === 'dpf_about_bug' || key === 'dpf_about_feature';
                    return { runs: feedback ? runs.filter(run => run.color !== 0xffffffff) : runs,
                        x, y, width, height, label, feedback };
                });
            }
            G.panel(cv, t, 24, 44, 1552, 468, null);
            // Full-screen iDrive scales the canvas. Align adjacent runs to the
            // same display-pixel boundaries so fractional edges cannot leave seams.
            const scale = cv.place ? cv.place.scale : 1;
            const pixelEdge = coordinate => Math.round(coordinate * scale) / scale;
            const drawRect = (x, y, width, height, color) => {
                const left = pixelEdge(x);
                const top = pixelEdge(y);
                const right = pixelEdge(x + width);
                const bottom = pixelEdge(y + height);
                cv.fillRect(left, top, right - left, bottom - top, color);
            };
            const drawRuns = (runs, x, y) => {
                runs.forEach(run => drawRect(x + run.x, y + run.y, run.width, run.height, run.color));
            };
            drawRuns(aboutLogoRuns, 490, 58);
            aboutLayers.forEach(({ runs, x, y, width, height, label, feedback }) => {
                if (feedback) drawRect(x, y, width, height, 0xffffffff);
                drawRuns(runs, x, y);
                if (label) cv.text(label, x + width / 2, 512, 15, t.text, { align: 'center' });
            });
            cv.text('DPF STATUS', 640, 225, 30, t.text,
                { align: 'center', font: 'bold', spacing: 2.5 });
            cv.text('Read-only diesel particulate filter monitor for BMW iDrive 7.', 640, 258, 19, t.dim, { align: 'center' });
            cv.text('Supports B57 and B47 DDE with validated soot, ash and distances.', 640, 285, 19, t.dim, { align: 'center' });
            cv.text('Regeneration status and advanced detail are verified on B57 only.', 640, 312, 19, t.dim, { align: 'center' });

            const newsX = 1120;
            const milestones = [
                ['0.1.72', 'Retry DDE identification after TASU rejection'],
                ['0.1.71', 'Longer Data Tool response window for DDE identification'],
                ['0.1.70', 'Separate Data Tool and TASU read diagnostics'],
                ['0.1.69', 'Built-in DPF connection diagnostics'],
                ['0.1.68', 'Install required Data Tool version for DPF testing'],
                ['0.1.67', 'Experimental Data Tool reads with automatic fallback'],
                ['0.1.66', 'Correct Settings text after repeated page renders'],
                ['0.1.65', 'Language handling now uses the OSA controller'],
                ['0.1.64', 'Language selection aligned with OSA'],
                ['0.1.63', 'English (auto) language value readability'],
                ['0.1.62', 'Run button translated into all languages'],
                ['0.1.61', 'Additional translations and Detail text sizing'],
                ['0.1.38', 'B47 core gauges with automatic DDE detection'],
                ['0.1.37', 'Started alert translated into all languages'],
                ['0.1.36', 'New Started alert on regeneration begin'],
                ['0.1.34', 'Cluster notification settings require detected 6WB'],
                ['0.1.31', 'All 22 iDrive languages'],
                ['0.1.26', 'Cluster regeneration messages'],
                ['0.1.24', 'Equal-height gauges on Overview'],
                ['0.1.23', 'Milestones and clearer regen estimate'],
                ['0.1.21', 'Feedback QR codes in About'],
                ['0.1.17', 'Faster loading of Detail measurements'],
                ['0.1.16', 'Colour gauges'],
                ['0.1.9', 'Three tabs, regen status and distance estimate'],
                ['0.1.6', 'Live readings and periodic refresh'],
                ['0.1.0', 'First read-only DPF diagnostics']
            ];
            cv.text("WHAT'S NEW", newsX, 80, 22, t.text, { font: 'bold' });
            milestones.forEach(([version, label], index) => {
                const y = 104 + index * 17;
                cv.text(version, newsX, y, 14, t.text, { font: 'bold' });
                cv.text(label, newsX + 66, y, 14, t.dim);
            });

            cv.text('Developed by dzooky@bmrmodz', 640, aboutLayers.length > 2 ? 363 : 372, 18, t.text,
                { align: 'center', font: 'bold' });
        }

        function renderDiagnostics(cv, t) {
            G.panel(cv, t, 24, 48, 1552, 452, null);
            cv.text('DPF DIAGNOSTICS', 52, 92, 32, t.text, { font: 'bold' });
            cv.text('Diagnostic checks are passive', 52, 130, 18, t.dim);
            const rows = [
                ['TASU connection', link.available ? 'Ready' : link.ready ? 'Unavailable' : 'Unavailable'],
                ['Data Tool connection', diagnostic.tool],
                ['Selected transport', ctx.settings.get('experimentalDataTool') === true ? 'Data Tool' : 'Legacy TASU'],
                ['DDE identification', diagnostic.identification],
                ['DDE index', ddeIndex || 'Not checked'],
                ['Data Tool read', diagnostic.toolRead],
                ['Data Tool error', diagnostic.toolError],
                ['TASU read', diagnostic.tasuRead],
                ['TASU error', diagnostic.tasuError],
                ['DDE recovery', diagnostic.ddeRecovery],
                ['Last DID', diagnostic.lastDid === null ? 'Not checked' : '0x' + diagnostic.lastDid.toString(16).toUpperCase()],
                ['Last issue', diagnostic.lastIssue]
            ];
            rows.forEach(([label,value], i) => {
                const y = 163 + i * 30;
                cv.text(label, 58, y, 19, t.dim);
                cv.text(value, 640, y, 19, value === 'Unavailable' || value === 'Failed' || value === 'No response'
                    ? t.warn : t.text);
            });
        }
        function renderDetail(cv, t) {
            cv.text('DPF DETAIL', 48, 75, 32, t.text, { font: 'bold' });
            if (profile && !profile.detail.length) {
                cv.text('Additional B47 measurements are not verified yet', 800, 245, 24, t.dim,
                    { align: 'center' });
                cv.text('Soot, ash and regeneration distances are available in Overview',
                    800, 289, 19, t.dim, { align: 'center' });
                return;
            }
            if (!hasDetailMeasurements()) {
                const loading = identifying || (identified && !detailReadAttempted);
                cv.text(loading ? 'LOADING DETAIL DATA' : 'NO DETAIL DATA',
                    1552, 75, 18, loading ? t.dim : t.warn, { align: 'right', font: 'bold' });
            }
            const measurement = (key, digits, unit) => hasReading(key)
                ? readings[key].value.toFixed(digits) + ' ' + unit : '--';
            const runtime = hasReading('RUNTIME') ? readings.RUNTIME.raw : undefined;
            const duration = runtime === undefined ? '--' : [
                Math.floor(runtime / 3600),
                Math.floor(runtime / 60) % 60,
                runtime % 60
            ].map(part => String(part).padStart(2, '0')).join(':');
            const release = hasReading('LOCK') && !stale('LOCK')
                ? (readings.LOCK.raw === 0 ? 'ALLOWED' : 'BLOCKED') : 'UNKNOWN';
            const rows = [
                ['PRESSURE BEFORE DPF', measurement('PRESSURE', 1, 'hPa'), 'PRESSURE'],
                ['TEMPERATURE BEFORE DPF', measurement('TEMP', 1, '°C'), 'TEMP'],
                ['ENGINE TIME SINCE REGEN', duration, 'RUNTIME'],
                ['REGENERATION PERMISSION', release],
                ['AVG TEMP DURING REGEN', measurement('AVG TEMP', 1, '°C'), 'AVG TEMP'],
                ['EST. FILTER DISTANCE LEFT', measurement('REMAINING', 0, 'km'), 'REMAINING']
            ];
            rows.forEach(([label, value, key], i) => {
                const x = 48 + (i % 2) * 768;
                const y = 96 + Math.floor(i / 2) * 128;
                cv.roundRect(x, y, 736, 108, 8, t.panel || t.bg);
                cv.text(label, x + 16, y + 32, 18, t.dim, { font: 'bold' });
                cv.text(value, x + 716, y + 80, 35, t.text, { align: 'right' });
                if (stale(key)) cv.text('STALE', x + 16, y + 80, 14, t.warn);
            });
        }

        function render() {
            const t = ctx.theme();
            const cv = ctx.canvas(W, H).clear(t.bg);
            // Recorder instances are reused across frames. Remove any text auto-fit
            // installed on a prior DPF frame so Settings uses the native OSA renderer.
            delete cv.text;
            // Match OSA: Settings uses the shared sheet renderer without DPF's text auto-fit.
            if (page === 'settings') {
                settingsCanvas.draw(cv, t);
                G.frame(cv, t, TABS.map(label => translate(label)), 2, []);
                return ui.image('MAIN_GFX', cv);
            }
            const drawText = cv.text.bind(cv);
            cv.text = (value, x, y, size, colour, options) => {
                const opts = options || {};
                const text = opts.literal ? String(value) : translate(value);
                let available = opts.align === 'center' ? Math.min(x, W - x) * 2 - 32 : W - x - 24;
                if (page === 'about') available = x >= 1120 ? W - x - 24 : x === 640 ? 880 : 150;
                else if (page === 'detail' && (size === 18 || opts.align === 'right')) available = 700;
                else if (page === 'overview' && x > 1200) available = W - x - 24;
                const measured = cv.textWidth(text, size, { ...opts, literal: true });
                const fitted = measured > available ? size * available / measured : size;
                return drawText(text, x, y, fitted, colour, { ...opts, literal: true });
            };

            if (page === 'diagnostics') {
                renderDiagnostics(cv, t);
                G.frame(cv, t, TABS.map(label => translate(label)), 4, []);
                return ui.image('MAIN_GFX', cv);
            }
            if (page === 'detail') {
                renderDetail(cv, t);
                G.frame(cv, t, TABS.map(label => translate(label)), 1, []);
                return ui.image('MAIN_GFX', cv);
            }
            if (page === 'about') {
                renderAbout(cv, t);
                G.frame(cv, t, TABS.map(label => translate(label)), 3, []);
                return ui.image('MAIN_GFX', cv);
            }

            const gutter = 16;
            const columnWidth = (W - 48 - 2 * gutter) * 0.4;
            const massX = 24;
            const secondX = massX + columnWidth + gutter;
            const statusX = secondX + columnWidth + gutter;
            const statusWidth = W - 24 - statusX;
            const distanceWidth = 2 * columnWidth + gutter;

            // Two mass gauges above one full-width adaptive distance gauge.
            const gaugeHeight = 213;
            const loading = !readAttempted && (identifying || identified);

            function massGauge(key, label, x) {
                const reading = readings[key];
                G.segBar(cv, t, x, 44, columnWidth, gaugeHeight, {
                    label: translate(label), value: reading ? reading.value : null,
                    unit: 'g', decimals: 2, min: 0, max: 100, step: 5,
                    ramp: 'hot', limit: 100,
                    zones: [
                        { from: 60, to: 73.333333, color: 'warn' },
                        { from: 73.333333, to: 100, color: 'crit' }
                    ],
                    scale: { every: 20 }
                });
                if (stale(key)) cv.text('STALE', x + 18, 110, 15, t.warn, { font: 'bold' });
            }
            massGauge('SOOT', 'Soot mass', massX);
            massGauge('ASH', 'Ash mass', secondX);

            const averageKm = profile && readings.AVERAGE
                ? ddeProfiles.km(readings.AVERAGE, profile.averageFactor) : 0;
            const sinceReading = readings.SINCE;
            const distanceKm = sinceReading && profile
                ? ddeProfiles.km(sinceReading, profile.distanceFactor) : null;
            const distanceMax = distanceHistory.scale(averageKm, distanceKm);
            G.segBar(cv, t, massX, 286, distanceWidth, gaugeHeight, {
                label: translate('Since last regen'), value: distanceKm, unit: 'km',
                decimals: 1, min: 0, max: distanceMax, step: distanceMax / 16,
                ramp: 'hot', limit: distanceMax, scale: { every: distanceMax / 4 },
                marks: averageKm > 0 && averageKm <= distanceMax
                    ? [{ value: averageKm, color: 'warn' }] : []
            });
            if (stale('SINCE')) cv.text('STALE', massX + 18, 352, 15, t.warn, { font: 'bold' });
            if (!loading && averageKm <= 0 && !stale('SINCE'))
                cv.text('AVG UNAVAILABLE', massX + 18, 352, 15, t.dim, { font: 'bold' });

            G.panel(cv, t, statusX, 44, statusWidth, 464, null);
            cv.text('REGENERATION', statusX + 18, 83, 20, t.text, { font: 'bold' });
            // Regeneration statuses are B57-only until B47 state bits are validated.
            const state = regenState();
            const inProgress = state === 'active';
            const statusText = inProgress ? 'IN PROGRESS' : state === 'requested' ? 'REQUESTED'
                : state === 'idle' ? 'NOT NEEDED' : 'UNKNOWN';
            const statusColor = inProgress ? t.ok : state === 'idle' ? t.dim : t.warn;
            cv.text(statusText, statusX + 18, 150, 30, statusColor, { font: 'bold' });

            const estimateAvailable = !inProgress && averageKm > 0 && !stale('AVERAGE')
                && hasReading('SINCE') && !stale('SINCE');
            const sinceKm = estimateAvailable ? ddeProfiles.km(readings.SINCE, profile.distanceFactor) : null;
            // Count down to the average interval; once exceeded, show +km beyond it.
            // The average is not a guaranteed regeneration trigger.
            const distanceToAverageKm = estimateAvailable ? averageKm - sinceKm : null;
            const distanceText = distanceToAverageKm === null ? '--'
                : (distanceToAverageKm < 0 ? '+' + (-distanceToAverageKm).toFixed(1)
                    : distanceToAverageKm.toFixed(1)) + ' km';
            cv.text('DISTANCE TO AVG REGEN', statusX + 18, 252, 16, t.dim, { font: 'bold' });
            cv.text('Countdown to average; +km after average',
                statusX + 18, 273, 12, t.dim);
            cv.text(distanceText, statusX + 18, 315, 42, t.text, { font: 'num' });
            if (estimateAvailable) {
                G.segBar(cv, t, statusX + 18, 342, statusWidth - 36, 26, {
                    panel: false, ramp: 'hot', min: 0, max: averageKm, step: averageKm / 12, value: sinceKm
                });
            }

            if (!hasMeasurements()) {
                cv.text(loading ? 'LOADING DPF DATA' : 'NO DPF DATA',
                    statusX + 18, 438, 18, loading ? t.dim : t.warn, { font: 'bold' });
            }

            G.frame(cv, t, TABS.map(label => translate(label)), 0, []);
            return ui.image('MAIN_GFX', cv);
        }

        function openPage(next) {
            const openingDetail = next === 'detail' && page !== 'detail';
            page = next;
            if (next === 'diagnostics') checkDataTool().catch(error => log.warn('DPF diagnostic status: '+error));
            if (openingDetail || next === 'overview') testSelected();
            return render();
        }

        ctx.onScroll(delta => page === 'settings' ? settingsCanvas.scroll(delta) : false);
        ctx.onTab(index => {
            const next = ['overview', 'detail', 'settings', 'about', 'diagnostics'][index];
            if (next && next !== page) return openPage(next);
        });
        ui.onVisible((name, visible) => {
            if (name === 'MAIN' && visible) refreshClusterEquipment().catch(error => log.warn('DPF Car Equipment: ' + error));
            if (name === 'MAIN' && visible && identified && !testing && page !== 'diagnostics'
                && (page === 'detail' ? !hasDetailMeasurements() : !readAttempted)) {
                testSelected();
            }
        });
        ctx.loop('MAIN', 4, render);
        // Let the app initialize while the diagnostic link is connecting.
        (async () => {
            await identify();
            identifying = false;
            if (identified && page !== 'about' && ui.isVisible('MAIN')) await testSelected();
            let nextPageRead = 0;
            while (true) {
                const dataReady = page === 'detail' ? hasDetailMeasurements() : hasMeasurements();
                await sleep(5000);
                const pageVisible = page !== 'about' && page !== 'settings' && page !== 'diagnostics' && ui.isVisible('MAIN');
                const clusterActive = clusterEnabled();
                if (testing || (!pageVisible && !clusterActive)) continue;
                if (!identified) await identify();
                if (!identified) continue;

                const now = Date.now();
                if (pageVisible && now >= nextPageRead) {
                    nextPageRead = now + (dataReady ? 60000 : 5000);
                    await testSelected();
                } else if (clusterActive) {
                    if (profile && profile.regeneration) await testSelected(true);
                }
            }
        })().catch(e => log.warn('DPF polling: ' + e));
        render()
            .then(() => log.info('DPF Status first frame rendered'))
            .catch((e) => log.warn('DPF Status first render: ' + e));
    }
});
