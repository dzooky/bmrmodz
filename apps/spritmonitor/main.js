'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const { toggle } = require('./kit/sheet');
const { withAlpha } = require('./kit/canvas');
const { decode: decodePng } = require('./png');

const TABS = ['Info', 'Fuelling', 'My Car', 'About'];

mgu.run({
    start(ctx) {
        let entry = '';
        let draft;
        let activeField = null;
        let formStatus = '';
        let formScroll = 0;
        const maxFormScroll = () => entry === 'Fuel' ? 915 : 184;
        let page = 0;
        let artwork;
        let vehicle;
        const readings = {};
        const consumptionUnits = {
            VERBRAUCH_IN_L_S_100KM: 'L/100 km', VERBRAUCH_IN_MPG_UK: 'mpg UK',
            VERBRAUCH_IN_MPG_US: 'mpg US', VERBRAUCH_IN_KM_S_L: 'km/L',
            1: 'L/100 km', 2: 'mpg UK', 3: 'mpg US', 4: 'km/L'
        };
        const speedUnits = { KM_S_H__KM: 'km/h', MPH__MLS: 'mph', 1: 'km/h', 2: 'mph' };
        const fields = ['statusRangeTankStatus', 'statusBordcomputerTravelData', 'statusBordcomputerAverage'];
        const subscriptions = {};
        fields.forEach(field => {
            subscriptions[field] = value => { readings[field] = { value, at: Date.now() }; };
        });
        ctx.signals.watch('de.bmw.infotainment.KombiIF', '1', subscriptions, ctx.log, { pollMs: 3000 })
            .catch(error => ctx.log.warn('KOMBI: ' + error.message));

        function latest(field) {
            const sample = readings[field];
            return sample && Date.now() - sample.at <= 15000 && sample.value ? sample.value : {};
        }

        function liveData() {
            const tank = latest(fields[0]);
            const trip = latest(fields[1]);
            const averages = latest(fields[2]);
            const read = (value, invalid) => Number.isFinite(value) && value >= 0 && value < invalid ? value : null;
            const average = key => {
                const value = read(averages[key], 65535);
                return value === null ? null : value / 10;
            };
            return {
                odometer: read(tank.mileageKilometre, 16777215),
                fuelLevel: read(tank.fluidLevelFuelTank, 255),
                trip: read(trip.wayPassed, 65535),
                consumption: average('consumptionAverage1BC1'),
                speed: average('speedAverage1BC1'),
                consumptionUnit: consumptionUnits[averages.statusUnitOfMeasurementConsumptionBC],
                speedUnit: speedUnits[averages.statusUnitOfMeasurementSpeedBC]
            };
        }

        function reading(value, unit, decimals) {
            return value === null ? 'Unavailable' : value.toFixed(decimals) + (unit ? ' ' + unit : '');
        }

        function renderLiveData(cv, theme) {
            const data = liveData();
            const rows = [
                ['Odometer', reading(data.odometer, 'km', 0)],
                ['Trip distance (test)', reading(data.trip, 'km', 0)],
                ['Average consumption', reading(data.consumption, data.consumptionUnit, 1)],
                ['Average speed', reading(data.speed, data.speedUnit, 1)]
            ];
            rows.forEach(([label, value], index) => {
                const y = 165 + index * 62;
                cv.roundRect(40, y, 1520, 54, 12, withAlpha('#ffffff', 0.05));
                cv.text(label, 65, y + 35, 24, theme.text);
                cv.text(value, 1520, y + 35, 24, theme.dim, { align: 'right' });
            });
        }
        let accountStatus = '';
        const isEmulator = typeof process.send === 'function' && process.env.MGU_EMU_CLOSED !== undefined;
        let account;
        if (isEmulator && process.env.SP_APPLICATION_ID && process.env.SP_ACCESS_TOKEN) {
            account = {
                applicationId: process.env.SP_APPLICATION_ID,
                token: process.env.SP_ACCESS_TOKEN,
                vehicleId: process.env.SP_VEHICLE_ID
            };
        } else {
            try {
                account = JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'sp-account.json'), 'utf8'));
            } catch (error) {
                if (error.code !== 'ENOENT') accountStatus = 'Could not read the Spritmonitor account setup.';
            }
        }
        const api = require('./sp-api');
        const accountFile = path.join(ctx.dataDir, 'sp-account.json');
        const uplinkDir = isEmulator ? undefined : ctx.dataDir;
        let loadingAccount = false;
        let vehicleOptions = null;
        let phonePairing;
        let vehiclePage = 0;

        async function refreshVehicle() {
            if (!account || loadingAccount || !account.applicationId || !account.token) return;
            loadingAccount = true;
            accountStatus = 'Loading vehicles from Spritmonitor...';
            try {
                if (account.vehicleId) {
                    vehicle = await api.loadVehicle(account.applicationId, account.token,
                        String(account.vehicleId), uplinkDir);
                    accountStatus = '';
                } else {
                    vehicleOptions = await api.listVehicles(account.applicationId, account.token, uplinkDir);
                    vehiclePage = 0;
                    accountStatus = vehicleOptions.length ? '' : 'No vehicles found in this account.';
                }
            } catch (error) {
                accountStatus = error.message;
            } finally {
                loadingAccount = false;
            }
        }

        async function selectVehicle(option) {
            if (loadingAccount) return;
            loadingAccount = true;
            accountStatus = 'Loading selected vehicle...';
            try {
                const next = Object.assign({}, account, { vehicleId: String(option.id) });
                const selected = await api.loadVehicle(next.applicationId, next.token,
                    next.vehicleId, uplinkDir, vehicleOptions);
                const temporary = accountFile + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
                fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
                try { fs.renameSync(temporary, accountFile); }
                catch (error) { fs.unlinkSync(temporary); throw error; }
                account = next;
                vehicle = selected;
                vehicleOptions = null;
                accountStatus = '';
            } catch (error) {
                accountStatus = error.message;
            } finally {
                loadingAccount = false;
            }
        }

        function startPhonePairing() {
            accountStatus = '';
            try {
                phonePairing = require('./phone-pairing').start(uplinkDir, token => {
                    phonePairing = null;
                    account = { applicationId: '6106f958398125d79a1fddfa6b0d60d8', token };
                    vehicleOptions = null;
                    refreshVehicle();
                }, message => {
                    phonePairing = null;
                    accountStatus = message;
                });
            } catch (_) {
                accountStatus = 'Could not start phone pairing.';
            }
        }

        function renderAccount(cv, theme) {
            cv.text('MY CAR', 65, 95, 34, theme.text, { font: 'bold' });
            if (accountStatus && (!vehicleOptions || loadingAccount)) cv.text(accountStatus, 65, 141, 24, theme.dim);
            if (loadingAccount) return;
            if (phonePairing) {
                cv.text('Scan the QR code with your phone', 800, 142, 28, theme.text, { align: 'center' });
                const qr = phonePairing.qr;
                const count = qr.getModuleCount();
                const cell = Math.floor(276 / (count + 8));
                const size = (count + 8) * cell;
                const x = 800 - Math.floor(size / 2), y = 158;
                cv.fillRect(x, y, size, size, 0xffffffff);
                for (let row = 0; row < count; row++) {
                    for (let col = 0; col < count; col++) {
                        if (qr.isDark(row, col)) cv.fillRect(x + (col + 4) * cell,
                            y + (row + 4) * cell, cell, cell, 0x000000ff);
                    }
                }
                G.button(cv, theme, 1210, 425, 315, 50, 'Cancel pairing', () => {
                    phonePairing.stop();
                    phonePairing = null;
                });
                return;
            }
            G.button(cv, theme, 1160, 420, 365, 50, 'Connect with phone', startPhonePairing);
            if (vehicleOptions && vehicleOptions.length) {
                cv.text(accountStatus || 'Select your vehicle', 65, 141, 24, theme.dim);
                const onPage = 4;
                vehicleOptions.slice(vehiclePage * onPage, (vehiclePage + 1) * onPage).forEach((option, index) => {
                    const label = [option.make, option.model, option.sign].filter(Boolean).join(' ');
                    G.button(cv, theme, 65, 159 + index * 62, 1460, 53, label || String(option.id),
                        () => selectVehicle(option), { key: 'vehicle-' + option.id });
                });
                if (vehiclePage) G.button(cv, theme, 65, 420, 250, 50, 'Previous', () => { vehiclePage--; });
                if ((vehiclePage + 1) * onPage < vehicleOptions.length) {
                    G.button(cv, theme, 330, 420, 250, 50, 'Next', () => { vehiclePage++; });
                }
            } else if (!accountStatus) {
                cv.text('No vehicle connected', 65, 141, 24, theme.dim);
            }

        }

        refreshVehicle();
        function openFuelling(type) {
            if (phonePairing) { phonePairing.stop(); phonePairing = null; }
            page = 1;
            formScroll = 0;
            entry = type;
            const now = new Date();
            const date = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            draft = {
                date, type: '', manualType: false, odometer: '', trip: '', quantity: '', unit: 'L',
                price: '', currency: 'EUR', priceMode: 'Total', note: '', company: '', country: '', location: '', conditions: {}
            };
            activeField = null;
            formStatus = '';
        }

        ctx.ui.onClick('BTN_FUEL', () => openFuelling('Fuel'));
        ctx.ui.onClick('BTN_ADBLUE', () => openFuelling('AdBlue'));

        const basicFields = [
            ['date', 'Date'], ['type', 'Type'], ['odometer', 'Odometer'],
            ['trip', 'Trip odometer'], ['quantity', 'Refilled quantity'], ['fuel', 'Fuel sort'],
            ['price', 'Price'], ['note', 'Note']
        ];
        const stationFields = [
            ['company', 'Company'], ['country', 'Country'], ['location', 'Location']
        ];
        const computerFields = [
            ['consumption', 'Consumption'], ['consumedQuantity', 'Quantity'], ['averageSpeed', 'Avg. speed']
        ];

        const choices = {
            type: ['Full', 'Partial'],
            unit: ['L', 'US gal', 'Imp gal', 'kg'],
            currency: ['EUR', 'CZK', 'HUF', 'PLN', 'GBP', 'CHF', 'USD'],
            priceMode: ['Total', 'Per unit']
        };
        const labels = { unit: 'Quantity unit', currency: 'Currency', priceMode: 'Price mode' };

        function editField(key) {
            activeField = key;
            formStatus = '';
        }

        function renderEditor(cv, theme) {
            const key = activeField;
            const label = labels[key] || basicFields.concat(stationFields).find(field => field[0] === key)[1];
            cv.text(label, 48, 80, 32, theme.text, { font: 'bold' });
            G.button(cv, theme, 1350, 53, 195, 42, 'Done', () => editField(null));
            if (choices[key]) {
                choices[key].forEach((value, index) => {
                    G.button(cv, theme, 48, 105 + index * 54, 900, 46,
                        value + (draft[key] === value ? ' (selected)' : ''), () => {
                            draft[key] = value;
                            if (key === 'type') draft.manualType = true;
                            editField(null);
                        });
                });
                return;
            }
            if (key === 'quantity') G.button(cv, theme, 1100, 95, 445, 44, 'Unit: ' + draft.unit, () => editField('unit'));
            if (key === 'price') {
                G.button(cv, theme, 950, 95, 290, 44, draft.currency, () => editField('currency'));
                G.button(cv, theme, 1255, 95, 290, 44, draft.priceMode, () => editField('priceMode'));
            }
            cv.text(draft[key].slice(-78) || '--', 48, 132, 27, theme.text);
            const textField = ['note', 'company', 'country', 'location'].includes(key);
            const keys = textField
                ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').concat(['Space', '.', ',', 'Delete', 'Clear'])
                : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'Delete', 'Clear'];
            const columns = textField ? 10 : 5;
            const width = textField ? 140 : 280;
            keys.forEach((character, index) => {
                G.button(cv, theme, 48 + index % columns * (width + 10), 160 + Math.floor(index / columns) * 58,
                    width, 48, character, () => {
                        const value = draft[key];
                        if (character === 'Clear') draft[key] = '';
                        else if (character === 'Delete') draft[key] = value.slice(0, -1);
                        else if (character === '.' && !textField && value.includes('.')) return;
                        else if (value.length < (textField ? 255 : 10)) {
                            draft[key] = value + (character === 'Space' ? ' ' : character);
                        }
                    });
            });
        }

        function renderDrivingConditions(cv, theme, offset) {
            cv.text('Driving conditions', 65, 480 - offset, 26, theme.text, { font: 'bold' });

            const conditions = draft.conditions;
            const choices = [
                ['Tires', ['Summer', 'Winter', 'All-season']],
                ['Driving style', ['Slow', 'Normal', 'Fast']]
            ];
            choices.forEach(([label, options], row) => {
                const y = 496 + row * 63 - offset;
                cv.roundRect(40, y, 1520, 55, 12, withAlpha('#ffffff', 0.05));
                cv.text(label, 65, y + 36, 26, theme.text);
                options.forEach((option, index) => {
                    const selected = conditions[label] === option;
                    G.button(cv, theme, 420 + index * 372, y + 5, 340, 45,
                        option + (selected ? ' (selected)' : ''), y >= 92 && y + 55 <= 446 ? () => {
                            conditions[label] = selected ? undefined : option;
                        } : null);
                });
            });

            const groups = [
                ['Routes', ['Motorway', 'City', 'Country roads']],
                ['Extras', ['A/C', 'Trailer', 'Park heating']]
            ];
            groups.forEach(([label, options], group) => {
                const x = 40;
                cv.text(label, x + 25, 650 + group * 205 - offset, 24, theme.dim);
                options.forEach((option, index) => {
                    const y = 662 + group * 205 + index * 54 - offset;
                    const selected = !!conditions[option];
                    cv.roundRect(x, y, 1520, 48, 14, withAlpha('#ffffff', 0.05));
                    cv.text(option, x + 28, y + 33, 24, theme.text);
                    toggle(cv, theme, x + 1416, y + 5, selected);
                    if (y >= 92 && y + 48 <= 446) cv.target(x, y, 1520, 48, () => { conditions[option] = !selected; }, option);
                });
            });
        }

        function renderDetails(cv, theme, title, fields, start, editable) {
            cv.text(title, 65, start, 26, theme.text, { font: 'bold' });
            fields.forEach(([key, label], index) => {
                const y = start + 12 + index * 44;
                const canEdit = editable;
                const value = canEdit ? (draft[key] || '--').slice(0, 52) : (draft[key] || 'Unavailable');
                cv.roundRect(40, y, 1520, 40, 10, withAlpha('#ffffff', 0.05));
                cv.text(label, 65, y + 28, 23, theme.text);
                cv.text(value, 1506, y + 28, 22, theme.dim, { align: 'right' });
                if (canEdit) {
                    cv.text('>', 1534, y + 28, 22, theme.dim);
                    if (y >= 92 && y + 40 <= 446) cv.target(40, y, 1520, 40, () => editField(key), key);
                }
            });
        }

        function renderFuelling(cv, theme) {
            if (draft && activeField) return renderEditor(cv, theme);
            cv.text(draft ? 'Basic data' : 'Fuelling', 48, 80, 32, theme.text, { font: 'bold' });
            if (!draft) {
                cv.text('Live vehicle data', 48, 126, 24, theme.dim);
                renderLiveData(cv, theme);
                return;
            }
            cv.text(vehicle ? vehicle.name + ' / ' + entry : entry, 1545, 80, 22, theme.dim, { align: 'right' });
            const data = liveData();
            draft.odometer = data.odometer;
            draft.trip = data.trip;
            if (entry === 'Fuel' && !draft.manualType) {
                const capacity = Number(ctx.settings.get('fuelTankCapacity')) || (vehicle && vehicle.tankCapacity);
                const threshold = Number(ctx.settings.get('fullTankThreshold'));
                draft.type = capacity > 0 && data.fuelLevel !== null
                    ? (data.fuelLevel / capacity * 100 >= threshold ? 'Full' : 'Partial') : '';
            }
            const tankNames = vehicle ? vehicle.tanks : [];
            const matchingTanks = tankNames.filter(name => /ad\s*blue/i.test(name) === (entry === 'AdBlue'));
            const fuelSort = matchingTanks.length === 1 ? matchingTanks[0] : 'Unavailable';
            const values = {
                fuel: fuelSort,
                odometer: reading(draft.odometer, 'km', 0),
                trip: reading(draft.trip, 'km', 0),
                quantity: (draft.quantity || '--') + ' ' + draft.unit,
                price: (draft.price || '--') + ' ' + draft.currency + ' / ' + draft.priceMode,
                note: draft.note ? draft.note.slice(0, 52) + (draft.note.length > 52 ? '...' : '') : '--'
            };
            const offset = formScroll;
            cv.clip(40, 92, 1520, 354);
            basicFields.forEach(([key, label], index) => {
                const y = 92 + index * 44 - offset;
                const editable = !['date', 'odometer', 'trip', 'fuel'].includes(key);
                cv.roundRect(40, y, 1520, 40, 10, withAlpha('#ffffff', 0.05));
                cv.text(label, 65, y + 28, 23, theme.text);
                cv.text(values[key] || draft[key] || '--', 1506, y + 28, 22, theme.dim, { align: 'right' });
                if (editable) {
                    cv.text('>', 1534, y + 28, 22, theme.dim);
                    if (y >= 92 && y + 40 <= 446) cv.target(40, y, 1520, 40, () => editField(key), key);
                }
            });
            if (entry === 'Fuel') renderDrivingConditions(cv, theme, offset);
            const stationY = entry === 'Fuel' ? 1040 : 480;
            renderDetails(cv, theme, 'Gas Station', stationFields, stationY - offset, true);
            if (entry === 'Fuel') {
                draft.consumption = reading(data.consumption, data.consumptionUnit, 1);
                draft.averageSpeed = reading(data.speed, data.speedUnit, 1);
                renderDetails(cv, theme, 'Board Computer (BC1)', computerFields, 1216 - offset, false);
            }
            cv.noclip();
            {
                const bar = { x: 1572, y: 92, w: 6, h: 354 };
                cv.scroll = { y: 92, bar };
                cv.roundRect(bar.x, bar.y + offset / maxFormScroll() * 224, bar.w, 130, 3, theme.dim);
            }
            G.button(cv, theme, 48, 452, 220, 44, 'Check entry', () => {
                const date = new Date(draft.date);
                const validDate = Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === draft.date;
                if (!validDate) formStatus = 'Enter a valid date (YYYY-MM-DD).';
                else if (!draft.type) formStatus = 'Select a fuelling type.';
                else if (!(Number(draft.quantity) > 0)) formStatus = 'Enter the refilled quantity.';
                else if (!/^\d+(?:\.\d+)?$/.test(draft.price)) formStatus = 'Enter the price.';
                else if (!(Number(draft.odometer) > 0 || Number(draft.trip) > 0)) {
                    formStatus = 'Odometer and trip data are unavailable.';
                } else if (fuelSort === 'Unavailable') {
                    formStatus = 'Fuel sort is unavailable for this vehicle.';
                } else formStatus = 'Entry is ready. Preview only.';
            });
            G.button(cv, theme, 286, 452, 170, 44, 'Cancel', () => { draft = null; entry = ''; });
            if (formStatus) cv.text(formStatus, 775, 482, 20, theme.text);
        }

        ctx.onScroll(delta => {
            if (page !== 1 || !draft || activeField) return false;
            const next = Math.max(0, Math.min(maxFormScroll(), formScroll + delta));
            if (next === formScroll) return false;
            formScroll = next;
            return true;
        });

        ctx.onTab(index => {
            if (!TABS[index]) return;
            if (index !== 2 && phonePairing) { phonePairing.stop(); phonePairing = null; }
            page = index;
            if (page === 2 && !vehicle && !vehicleOptions && !accountStatus) refreshVehicle();
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
            cv.text('Third-party app for Spritmonitor.de.', 640, 258, 19, theme.dim, center);
            cv.text('Log fuel and AdBlue refills from BMW iDrive 7.', 640, 285, 19, theme.dim, center);
            cv.text('Developed by dzooky@bmrmodz', 640, 353, 18, theme.text, center);
            cv.text("WHAT'S NEW", 1120, 80, 22, theme.text, { font: 'bold' });
            const releases = [
                ['0.1.10', 'Secure phone pairing with a QR code'],
                ['0.1.9', 'Removed token entry from iDrive'],
                ['0.1.8', 'Select a vehicle from the connected account'],
                ['', 'BC1 averages and manual refilled quantity'],
                ['0.1.7', 'Tank capacity from Spritmonitor'],
                ['0.1.6', 'Live fuel and trip readings'],
                ['0.1.4', 'Trip reset setting'],
                ['0.1.3', 'Settings tab'],
                ['0.1.2', 'Feedback QR codes in About'],
                ['0.1.1', 'BMRMODZ layout and About']
            ];
            releases.forEach(([version, description], index) => {
                const y = 105 + index * 20;
                if (version) cv.text(version, 1120, y, 14, theme.text, { font: 'bold' });
                cv.text(description, 1186, y, 14, theme.dim);
            });
        }

        ctx.loop('MAIN', 4, () => {
            const theme = ctx.theme();
            const cv = ctx.canvas(1600, 520).clear(theme.bg);
            G.panel(cv, theme, 24, 44, 1552, 468, null);
            if (page === 3) {
                renderAbout(cv, theme);
            } else if (page === 2 && vehicle) {
                cv.text(vehicle.name, 65, 100, 42, theme.text, { font: 'bold' });
                cv.text('Latest fill-ups', 65, 150, 26, theme.dim);
                if (vehicle.tankCapacity) {
                    cv.text('Fuel tank: ' + vehicle.tankCapacity + ' L', 1525, 100, 26, theme.dim, { align: 'right' });
                }
                if (!vehicle.latestFuelings.length) cv.text('No tanks found', 65, 218, 26, theme.dim);
                vehicle.latestFuelings.forEach(({ name, entry, unavailable }, index) => {
                    const y = 175 + index * 96;
                    cv.roundRect(50, y, 1500, 84, 14, withAlpha('#ffffff', 0.05));
                    cv.text(name, 75, y + 51, 30, theme.text, { font: 'bold' });
                    const parts = entry ? [entry.date, entry.quantity != null
                        ? [entry.quantity, entry.quantityunit].filter(Boolean).join(' ') : null] : [];
                    const detail = unavailable ? 'Could not load fill-ups'
                        : entry ? parts.filter(Boolean).join('  /  ') || 'Details unavailable' : 'No fill-ups yet';
                    cv.text(detail, 1525, y + 51, 26, theme.dim, { align: 'right' });
                });
            } else if (page === 2) {
                renderAccount(cv, theme);
            } else if (page === 0) {
                const centered = { align: 'center' };
                cv.text('This application is still in development phase and not ready for public use.',
                    800, 218, 30, theme.text, centered);
                cv.text('We still working on it and will be available soon.',
                    800, 260, 30, theme.text, centered);
                cv.text('Thank you', 800, 302, 30, theme.text, centered);
            } else {
                renderFuelling(cv, theme);
            }
            G.frame(cv, theme, TABS, page, []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
