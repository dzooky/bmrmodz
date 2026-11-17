'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const { toggle } = require('./kit/sheet');
const { withAlpha } = require('./kit/canvas');
const { decode: decodePng } = require('./png');

const TABS = ['Info', 'My Car', 'About'];

mgu.run({
    start(ctx) {
        let entry = '';
        let draft;
        let lastStationAddress;
        const stationLocation = require('./station-location');
        let activeField = null;
        let formStatus = '';
        let formScroll = 0;
        let savedEntryId;
        let refreshOnOpen = false;
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
        let offline;
        try { offline = require('./offline-fuellings').open(ctx.dataDir); }
        catch (_) { accountStatus = 'Could not open local fuelling storage.'; }
        if (offline) vehicle = offline.read(account).vehicle;
        let connection = '';
        let syncing = false;
        let loadingAccount = false;
        let vehicleOptions = null;
        let phonePairing;
        let tokenPageQr;
        let vehiclePage = 0;
        let tankPage = 0;
        let chartMetric = null;
        const renderChart = require('./fuelling-chart');

        function cacheVehicle(owner, snapshot) {
            if (owner !== account) return;
            vehicle = snapshot;
            if (offline) {
                try { vehicle = offline.cache(owner, snapshot); }
                catch (_) { accountStatus = 'Could not cache vehicle data.'; }
            }
            updateVehicleControls();
        }

        function syncMessage() {
            const entries = offline ? offline.read(account).entries : [];
            const pending = entries.filter(item => item.state === 'pending').length;
            const review = entries.filter(item => item.state === 'sending').length;
            const rejected = entries.filter(item => item.state === 'rejected').length;
            return [connection, pending ? pending + ' pending' : '',
                review ? review + ' unconfirmed in Spritmonitor' : '',
                rejected ? rejected + ' rejected by Spritmonitor' : '',
                offline ? '' : 'Local storage unavailable'].filter(Boolean).join('  /  ');
        }

        async function syncFuelings() {
            if (!offline || !account || !account.vehicleId || syncing || loadingAccount) return;
            syncing = true;
            const owner = account;
            try {
                const vehicles = await api.listVehicles(owner.applicationId, owner.token, uplinkDir);
                if (owner !== account) return;
                const wasOnline = connection === 'Online';
                connection = 'Online';
                if (!vehicles.some(item => String(item.id) === String(owner.vehicleId))) {
                    connection = 'Selected vehicle unavailable';
                    return;
                }
                const store = offline.read(owner);
                const pending = store.entries.filter(item => item.state === 'pending');
                const opening = refreshOnOpen;
                refreshOnOpen = false;
                if (!wasOnline || !vehicle || pending.some(item => !item.upload)) {
                    // Keep offline defaults in memory unless a fresh snapshot is available.
                    const fresh = await api.loadVehicle(owner.applicationId, owner.token,
                        String(owner.vehicleId), uplinkDir, vehicles);
                    cacheVehicle(owner, fresh);
                } else {
                    if (opening || !vehicle.configAvailable) {
                        const fresh = await api.refreshVehicleConfig(owner, vehicle, uplinkDir);
                        if (fresh !== vehicle) cacheVehicle(owner, fresh);
                    }
                    if (opening && owner === account) {
                        cacheVehicle(owner, await api.refreshLastFuelling(owner, vehicle, uplinkDir));
                    }
                }
                if (owner !== account) return;
                if (draft && entry === 'Fuel' && opening) {
                    const defaults = previousDrivingConditions();
                    for (const key of Object.keys(Object.assign({}, draft.conditions, defaults))) {
                        if (!draft.editedConditions.has(key)) draft.conditions[key] = defaults[key];
                    }
                }
                let sent = false;
                for (const item of pending) {
                    if (owner !== account) return;
                    const upload = item.upload || require('./offline-fuellings').uploadFields(vehicle, item);
                    if (!upload) {
                        connection = 'Waiting for Spritmonitor tank, fuel sort or units';
                        continue;
                    }
                    offline.change(owner, item.id, 'sending');
                    let accepted;
                    try {
                        accepted = await api.addFuelling(owner, upload.tankId, upload.fields, uplinkDir);
                    } catch (error) {
                        if (error.beforeSend || [401, 403, 429].includes(error.status)) {
                            offline.change(owner, item.id, 'pending');
                        }
                        throw error;
                    }
                    offline.change(owner, item.id, accepted ? null : 'rejected');
                    sent = sent || accepted;
                }
                if (sent && owner === account) {
                    cacheVehicle(owner, await api.loadVehicle(owner.applicationId, owner.token,
                        String(owner.vehicleId), uplinkDir, vehicles));
                }
            } catch (error) {
                if (owner === account) {
                    connection = [401, 403].includes(error.status) ? 'Spritmonitor sign-in required'
                        : error.status === 429 ? 'Spritmonitor busy' : 'Spritmonitor unavailable';
                }
            } finally {
                syncing = false;
            }
        }

        async function refreshVehicle() {
            if (!account || loadingAccount || !account.applicationId || !account.token) return;
            loadingAccount = true;
            accountStatus = 'Loading vehicles from Spritmonitor...';
            const owner = account;
            try {
                if (account.vehicleId) {
                    const fresh = await api.loadVehicle(owner.applicationId, owner.token,
                        String(owner.vehicleId), uplinkDir);
                    accountStatus = '';
                    cacheVehicle(owner, fresh);
                    connection = 'Online';
                } else {
                    vehicleOptions = await api.listVehicles(account.applicationId, account.token, uplinkDir);
                    vehiclePage = 0;
                    accountStatus = vehicleOptions.length ? '' : 'No vehicles found in this account.';
                }
            } catch (error) {
                accountStatus = error.message;
            } finally {
                loadingAccount = false;
                syncFuelings();
            }
        }

        function persistAccount(next) {
            const temporary = accountFile + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
            try { fs.renameSync(temporary, accountFile); }
            catch (error) { fs.unlinkSync(temporary); throw error; }
            account = next;
        }

        function clearSelectedVehicle() {
            vehicle = null;
            vehicleOptions = null;
            tankPage = 0;
            chartMetric = null;
            connection = '';
            accountStatus = '';
            updateVehicleControls();
        }

        function removeVehicle() {
            if (!account || !account.vehicleId || loadingAccount) return;
            const next = Object.assign({}, account);
            delete next.vehicleId;
            try { persistAccount(next); }
            catch (_) {
                accountStatus = 'Could not remove the vehicle from iDrive.';
                return;
            }
            clearSelectedVehicle();
            refreshVehicle();
        }

        function disconnectAccount() {
            if (!account || loadingAccount) return;
            try { persistAccount(null); }
            catch (_) {
                accountStatus = 'Could not disconnect the Spritmonitor account.';
                return;
            }
            cancelPairingGuide();
            clearSelectedVehicle();
        }

        async function selectVehicle(option) {
            if (loadingAccount) return;
            loadingAccount = true;
            accountStatus = 'Loading selected vehicle...';
            try {
                const next = Object.assign({}, account, { vehicleId: String(option.id) });
                const selected = await api.loadVehicle(next.applicationId, next.token,
                    next.vehicleId, uplinkDir, vehicleOptions);
                persistAccount(next);
                tankPage = 0;
                chartMetric = null;
                vehicleOptions = null;
                accountStatus = '';
                cacheVehicle(next, selected);
                connection = 'Online';
            } catch (error) {
                accountStatus = error.message;
            } finally {
                loadingAccount = false;
                syncFuelings();
            }
        }

        function openPairingGuide() {
            tokenPageQr = require('./qrcode')(0, 'M');
            tokenPageQr.addData('https://www.spritmonitor.de/en/my_account/change_password.html');
            tokenPageQr.make();
        }

        function cancelPairingGuide() {
            tokenPageQr = null;
            if (phonePairing) phonePairing.stop();
            phonePairing = null;
        }

        function startPhonePairing() {
            tokenPageQr = null;
            accountStatus = '';
            try {
                phonePairing = require('./phone-pairing').start(uplinkDir, token => {
                    phonePairing = null;
                    account = { applicationId: '6106f958398125d79a1fddfa6b0d60d8', token };
                    vehicleOptions = null;
                    vehicle = null;
                    updateVehicleControls();
                    connection = '';
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
            if (account && account.vehicleId) cv.text(syncMessage(), 1525, 95, 20, theme.dim, { align: 'right' });
            if (accountStatus && (!vehicleOptions || loadingAccount)) cv.text(accountStatus, 65, 141, 24, theme.dim);
            if (loadingAccount) return;
            if ((!account || !account.token) && !tokenPageQr && !phonePairing) openPairingGuide();
            if (tokenPageQr || phonePairing) {
                const firstStep = Boolean(tokenPageQr);
                const heading = firstStep ? '1 / 2   Create and copy your token' : '2 / 2   Paste your token';
                const instruction = firstStep ? 'Scan to sign in to Spritmonitor. Create a token and copy it.'
                    : 'Scan to open the pairing page. Paste your token and send it to iDrive.';
                cv.text(heading, 800, 130, 28, theme.text, { align: 'center' });
                cv.text(instruction, 800, 164, 22, theme.dim, { align: 'center' });
                const qr = tokenPageQr || phonePairing.qr;
                const count = qr.getModuleCount();
                const cell = Math.floor(276 / (count + 8));
                const size = (count + 8) * cell;
                const x = 800 - Math.floor(size / 2), y = 178;
                cv.fillRect(x, y, size, size, 0xffffffff);
                for (let row = 0; row < count; row++) {
                    for (let col = 0; col < count; col++) {
                        if (qr.isDark(row, col)) cv.fillRect(x + (col + 4) * cell,
                            y + (row + 4) * cell, cell, cell, 0x000000ff);
                    }
                }
                G.button(cv, theme, 65, 425, 275, 50, 'Cancel', () => {
                    cancelPairingGuide();
                    page = 0;
                });
                if (firstStep) {
                    G.button(cv, theme, 1210, 425, 315, 50, 'Next', startPhonePairing);
                } else {
                    G.button(cv, theme, 1210, 425, 315, 50, 'Back', () => {
                        cancelPairingGuide();
                        openPairingGuide();
                    });
                }
                return;
            }
            if (account) G.button(cv, theme, 760, 420, 360, 50, 'Disconnect account', disconnectAccount);
            if (account && !vehicleOptions) {
                if (account.vehicleId) {
                    G.button(cv, theme, 65, 420, 270, 50, 'Remove vehicle', removeVehicle);
                } else {
                    G.button(cv, theme, 65, 420, 270, 50, 'Choose vehicle', refreshVehicle);
                }
            }
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

        if (account && account.vehicleId && offline) syncFuelings();
        else refreshVehicle();
        const syncTimer = setInterval(syncFuelings, 30000);
        syncTimer.unref();
        function previousDrivingConditions() {
            const local = offline && offline.read(account).conditions;
            if (local) return Object.assign({}, local);
            const history = vehicle && vehicle.latestFuelings.find(tank => !/ad\s*blue/i.test(tank.name));
            const entry = history && history.entry;
            if (!entry) return {};

            const split = value => String(value || '').toLowerCase().split(',').map(item => item.trim());
            const attributes = split(entry.attributes);
            const streets = split(entry.streets);
            const conditions = {};
            const tires = { summertires: 'Summer', wintertires: 'Winter', allyeartires: 'All-season' };
            const styles = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };
            const extras = { ac: 'A/C', trailer: 'Trailer', heating: 'Park heating' };
            const routes = { autobahn: 'Motorway', city: 'City', land: 'Country roads' };
            const tireType = Object.keys(tires).find(key => attributes.includes(key));
            const style = Object.keys(styles).find(key => attributes.includes(key));

            if (tireType) conditions.Tires = tires[tireType];
            if (style) conditions['Driving style'] = styles[style];
            Object.keys(extras).forEach(key => { if (attributes.includes(key)) conditions[extras[key]] = true; });
            Object.keys(routes).forEach(key => { if (streets.includes(key)) conditions[routes[key]] = true; });
            return conditions;
        }

        function saveMessage() {
            if (!savedEntryId || !offline) return formStatus;
            const state = offline.read(account);
            const last = Object.values(state.lastFuelling || {}).find(item => item.id === savedEntryId);
            if (!last) return formStatus;
            if (last.state === 'sent') return 'Saved and sent to Spritmonitor.';
            if (syncing) return 'Saved in iDrive. Syncing with Spritmonitor...';
            if (last.state === 'sending') return 'Saved in iDrive. Check Spritmonitor before adding it again.';
            if (last.state === 'rejected') return 'Saved in iDrive. Spritmonitor rejected the entry.';
            if (connection === 'Spritmonitor unavailable') {
                return 'Saved offline. Will send when the connection returns.';
            }
            return 'Saved in iDrive. Waiting to send.';
        }

        function hasAdBlue() {
            return Boolean(vehicle && vehicle.tankDetails.some(tank => Number(tank.type) === 6));
        }

        function updateVehicleControls() {
            ctx.setButtonVisible('BTN_FUEL', Boolean(account && account.vehicleId));
            ctx.setButtonVisible('BTN_ADBLUE', hasAdBlue());
            const capacity = ctx.settings.item('fuelTankCapacity');
            capacity.labels['0'] = vehicle && vehicle.tankCapacity
                ? 'Auto (' + vehicle.tankCapacity + ' L from Spritmonitor)'
                : 'Auto (Spritmonitor)';
        }

        function prefillStationAddress(address, now) {
            if (!draft || now - draft.openedAt > stationLocation.POSITION_MAX_AGE_MS) return;
            for (const key of ['location', 'country']) {
                if (address[key] && !draft[key] && !draft.editedStation.has(key)) draft[key] = address[key];
            }
        }

        const stationStatus = stationLocation.watch(ctx, address => {
            const now = Date.now();
            lastStationAddress = address ? { address, at: now } : null;
            if (address) prefillStationAddress(address, now);
        });

        function openFuelling(type) {
            if (!account || !account.vehicleId || (type === 'AdBlue' && !hasAdBlue())) return;
            cancelPairingGuide();
            formScroll = 0;
            entry = type;
            const now = new Date();
            const date = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            draft = {
                date, type: '', manualType: false, odometer: '', trip: '', quantity: '', unit: 'L',
                price: '', currency: 'EUR', priceMode: 'Total', note: '', company: '', country: '', location: '',
                conditions: type === 'Fuel' ? previousDrivingConditions() : {}, editedConditions: new Set(),
                openedAt: now.getTime(), editedStation: new Set()
            };
            if (lastStationAddress && now.getTime() - lastStationAddress.at <= stationLocation.POSITION_MAX_AGE_MS) {
                prefillStationAddress(lastStationAddress.address, now.getTime());
            }
            activeField = null;
            formStatus = '';
            savedEntryId = undefined;
            refreshOnOpen = true;
            syncFuelings();
        }

        updateVehicleControls();
        ctx.ui.onClick('BTN_FUEL', () => openFuelling('Fuel'));
        ctx.ui.onClick('BTN_ADBLUE', () => openFuelling('AdBlue'));

        const basicFields = [
            ['date', 'Date'], ['type', 'Type'], ['odometer', 'Odometer'],
            ['trip', 'Trip odometer'], ['quantity', 'Refilled quantity'], ['fuel', 'Fuel sort'],
            ['price', 'Price'], ['note', 'Note']
        ];
        const stationFields = [
            ['company', 'Company'], ['country', 'Country'], ['location', 'City']
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
            if (key === 'country' || key === 'location') draft.editedStation.add(key);
            activeField = key;
            formStatus = '';
        }

        function renderEditor(cv, theme) {
            const key = activeField;
            const label = labels[key] || basicFields.concat(stationFields).find(field => field[0] === key)[1];
            cv.text(label, 48, 80, 32, theme.text, { font: 'bold' });
            G.button(cv, theme, 1350, 53, 195, 42, 'Done', () => editField(null));
            if (key === 'country') {
                const options = [['', 'Clear'], ...stationLocation.countries];
                options.forEach(([code, name], index) => {
                    const x = 48 + index % 3 * 500;
                    const y = 105 + Math.floor(index / 3) * 54;
                    const label = code ? code + ' / ' + name : name;
                    G.button(cv, theme, x, y, 470, 46, label + (draft.country === code ? ' (selected)' : ''), () => {
                        draft.country = code;
                        editField(null);
                    });
                });
                return;
            }
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
            const textField = ['note', 'company', 'location'].includes(key);
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
                            draft.editedConditions.add(label);
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
                    if (y >= 92 && y + 48 <= 446) {
                        cv.target(x, y, 1520, 48, () => {
                            draft.editedConditions.add(option);
                            conditions[option] = !selected;
                        }, option);
                    }
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

        function saveFuelling(data) {
            if (!account || !account.vehicleId) return 'Connect a vehicle in My Car first.';
            if (!offline) return 'Local storage is unavailable.';
            if (!draft.type) return 'Select a fuelling type.';
            if (!(Number.isFinite(Number(draft.quantity)) && Number(draft.quantity) > 0)) {
                return 'Enter the refilled quantity.';
            }
            if (!/^\d+(?:\.\d+)?$/.test(draft.price) || !Number.isFinite(Number(draft.price))) return 'Enter the price.';
            if (draft.trip == null) return 'Trip data are unavailable.';
            const fields = {
                date: draft.date.split('-').reverse().join('.'),
                type: draft.type === 'Full' ? 'full' : 'notfull',
                trip: draft.trip,
                quantity: Number(draft.quantity),
                quantityunitid: { L: 1, kg: 2, 'US gal': 3, 'Imp gal': 4 }[draft.unit],
                price: Number(draft.price),
                pricetype: draft.priceMode === 'Total' ? 0 : 1,
                currency: draft.currency
            };
            if (draft.odometer != null) fields.odometer = draft.odometer;
            for (const [key, apiKey] of [['note', 'note'], ['company', 'stationname'],
                ['location', 'location']]) {
                if (draft[key]) fields[apiKey] = draft[key];
            }
            const country = stationLocation.apiCountryCode(draft.country);
            if (country) fields.country = country;
            if (entry === 'Fuel') {
                const conditions = draft.conditions;
                const codes = {
                    Summer: 'summertires', Winter: 'wintertires', 'All-season': 'allyeartires',
                    Slow: 'slow', Normal: 'normal', Fast: 'fast'
                };
                fields.attributes = [codes[conditions.Tires], codes[conditions['Driving style']],
                    conditions['A/C'] && 'ac', conditions.Trailer && 'trailer',
                    conditions['Park heating'] && 'heating'].filter(Boolean).join(',');
                fields.streets = [conditions.Motorway && 'autobahn', conditions.City && 'city',
                    conditions['Country roads'] && 'land'].filter(Boolean).join(',');
                fields.bcSpeed = data.speed;
                fields.bcSpeedUnit = data.speedUnit;
                fields.bcConsumption = data.consumption;
                fields.bcConsumptionUnit = data.consumptionUnit;
            }
            try { savedEntryId = offline.enqueue(account, entry, fields, draft.conditions); }
            catch (_) { return 'Could not save the entry locally.'; }
            draft = null;
            entry = '';
            syncFuelings();
            return 'Saved in iDrive.';
        }

        function fuelTankCapacity() {
            const manual = Number(ctx.settings.get('fuelTankCapacity'));
            if (manual > 0) return { litres: manual, source: 'Settings' };
            if (vehicle && vehicle.tankCapacity) return { litres: vehicle.tankCapacity, source: 'Spritmonitor' };
            return { litres: null };
        }

        function renderFuelling(cv, theme) {
            if (draft && activeField) return renderEditor(cv, theme);
            cv.text(draft ? 'Basic data' : 'Fuelling', 48, 80, 32, theme.text, { font: 'bold' });
            if (!draft) {
                cv.text(saveMessage(), 48, 153, 28, theme.text);
                cv.text(syncMessage(), 48, 195, 22, theme.dim);
                G.button(cv, theme, 48, 452, 170, 44, 'Back', () => { savedEntryId = undefined; });
                return;
            }
            cv.text(vehicle ? vehicle.name + ' / ' + entry : entry, 1545, 80, 22, theme.dim, { align: 'right' });
            const data = liveData();
            draft.odometer = data.odometer;
            draft.trip = data.trip;
            if (entry === 'Fuel' && !draft.manualType) {
                const capacity = fuelTankCapacity().litres;
                const threshold = Number(ctx.settings.get('fullTankThreshold'));
                draft.type = capacity > 0 && data.fuelLevel !== null
                    ? (data.fuelLevel / capacity * 100 >= threshold ? 'Full' : 'Partial') : '';
            }
            const tanks = vehicle ? vehicle.tankDetails : [];
            const matchingTanks = tanks.filter(tank => (Number(tank.type) === 6) === (entry === 'AdBlue'));
            const fuelSort = matchingTanks.length === 1 ? matchingTanks[0].name : 'Unavailable';
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
            cv.text(stationStatus(), 1506, stationY - offset, 19, theme.dim, { align: 'right' });
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
            G.button(cv, theme, 48, 452, 220, 44, 'Save', () => {
                if (draft) formStatus = saveFuelling(data);
            });
            G.button(cv, theme, 286, 452, 170, 44, 'Cancel', () => { draft = null; entry = ''; });
            cv.text(formStatus || syncMessage(), 490, 482, 20, theme.text);
        }

        ctx.onScroll(delta => {
            if (!draft || activeField) return false;
            const next = Math.max(0, Math.min(maxFormScroll(), formScroll + delta));
            if (next === formScroll) return false;
            formScroll = next;
            return true;
        });

        ctx.onTab(index => {
            if (!TABS[index]) return;
            if (index !== 1) cancelPairingGuide();
            draft = null;
            savedEntryId = undefined;
            activeField = null;
            page = index;
            if (page === 1 && !vehicle && !vehicleOptions && !accountStatus) refreshVehicle();
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
                ['0.1.31', 'Use the MGU current-position interface when available'],
                ['0.1.30', 'Show two-letter country codes in the station form'],
                ['0.1.29', 'Prefill only the city, without the street or road'],
                ['0.1.28', 'Read station location from navigation elements'],
                ['', 'Choose the station country from a list'],
                ['0.1.27', 'Show navigation field names for location diagnostics'],
                ['0.1.26', 'Show navigation status and prefill partial addresses'],
                ['0.1.25', 'Experimental city and country from iDrive'],
                ['0.1.24', 'Open QR pairing automatically in My Car'],
                ['0.1.23', 'Hide phone pairing when connected'],
                ['0.1.22', 'Disconnect the Spritmonitor account'],
                ['', 'Hide fuelling buttons until a vehicle is selected'],
                ['0.1.21', 'Show automatic tank capacity in Settings'],
                ['0.1.20', 'Remove the selected vehicle in My Car'],
                ['', 'Retry fuel tank capacity from Spritmonitor'],
                ['0.1.19', 'Restored the original fuelling buttons'],
                ['0.1.18', 'Bottom fuelling buttons and AdBlue detection'],
                ['0.1.17', 'Fixed startup on BMW iDrive 7'],
                ['0.1.16', 'Offline fuelling and automatic sync'],
                ['', 'Last driving settings available offline'],
                ['0.1.15', 'Prefill driving conditions from last fill-up'],
                ['0.1.14', 'Direct tank selection in charts'],
                ['0.1.13', 'Fuel and AdBlue in one table'],
                ['', 'More history points per chart'],
                ['0.1.12', 'Consumption, distance and unit price charts'],
                ['', 'Fuel tanks shown before AdBlue'],
                ['0.1.11', 'Tank statistics in My Car'],
                ['', 'Two-step phone pairing guide'],
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
            const showingFuelling = Boolean(draft || savedEntryId);
            if (showingFuelling) {
                renderFuelling(cv, theme);
            } else if (page === 2) {
                renderAbout(cv, theme);
            } else if (page === 1 && vehicle) {
                cv.text(vehicle.name, 65, 100, 42, theme.text, { font: 'bold' });
                const capacity = fuelTankCapacity();
                const tankLabel = capacity.litres
                    ? 'Fuel tank: ' + capacity.litres + ' L (' + capacity.source + ')'
                    : 'Fuel tank capacity unavailable';
                cv.text(tankLabel, 1525, 100, 24, theme.dim, { align: 'right' });
                cv.text(accountStatus || syncMessage(), 65, 130, 20, theme.dim);
                G.button(cv, theme, 1245, 447, 280, 45, 'Remove vehicle', removeVehicle);
                G.button(cv, theme, 50, 447, 280, 45, 'Disconnect account', disconnectAccount);
                const statistics = vehicle.tankStats;
                const tank = statistics[tankPage];
                if (!tank) {
                    cv.text('No tanks found', 65, 160, 26, theme.dim);
                } else {
                    if (chartMetric) {
                        renderChart(cv, theme, vehicle, tankPage, chartMetric);
                    } else {
                        const columns = [];
                        const fuel = statistics.findIndex(item => !/ad\s*blue/i.test(item.name));
                        const adBlue = statistics.findIndex(item => /ad\s*blue/i.test(item.name));
                        if (fuel !== -1) columns.push(fuel);
                        if (adBlue !== -1) columns.push(adBlue);
                        const format = (value, unit) => {
                            if (value == null || String(value).trim() === '') return 'Unavailable';
                            return [value, unit].filter(part => part != null && part !== '').join(' ');
                        };
                        const headings = ['Average consumption', 'Recorded distance', 'Recorded quantity',
                            'Fuel costs', 'Latest fill-up'];
                        headings.forEach((label, index) => {
                            const y = 164 + index * 54;
                            cv.roundRect(50, y, 1500, 48, 12, withAlpha('#ffffff', 0.05));
                            cv.text(label, 75, y + 33, 24, theme.text);
                        });
                        const quantityUnits = { 1: 'L', 2: 'kg', 3: 'US gal', 4: 'Imp gal', 5: 'kWh' };
                        columns.forEach((index, column) => {
                            const summary = statistics[index];
                            const latest = vehicle.latestFuelings[index];
                            const entry = latest.entry;
                            const lastFill = latest.unavailable ? 'Unavailable' : !entry ? 'No fill-ups yet'
                                : [entry.date, entry.quantity == null ? null :
                                    format(entry.quantity, quantityUnits[entry.quantityunitid])].filter(Boolean).join('  /  ');
                            const x = columns.length === 1 ? 1240 : 800 + column * 480;
                            const center = { align: 'center' };
                            cv.text(summary.name, x, 150, 26, theme.text, { align: 'center', font: 'bold' });
                            [format(...summary.consumption), format(...summary.distance),
                                format(...summary.quantity), format(...summary.cost), lastFill || 'Unavailable']
                                .forEach((value, row) => cv.text(value, x, 197 + row * 54, 24, theme.dim, center));
                        });
                    }
                    [['consumption', 'Consumption'], ['distance', 'Distance'], ['price', 'Unit price']]
                        .forEach(([metric, label], i) => {
                            G.button(cv, theme, 355 + i * 222, 447, 210, 45,
                                chartMetric === metric ? 'Back to summary' : label,
                                () => { chartMetric = chartMetric === metric ? null : metric; });
                        });
                    if (chartMetric && statistics.length > 1) {
                        const fuel = statistics.findIndex(item => !/ad\s*blue/i.test(item.name));
                        const adBlue = statistics.findIndex(item => /ad\s*blue/i.test(item.name));
                        [fuel, adBlue].filter(index => index >= 0).forEach((index, column) => {
                            const selected = index === tankPage;
                            G.button(cv, theme, 950 + column * 225, 113, 210, 34,
                                statistics[index].name, () => { tankPage = index; },
                                { key: 'chart-tank-' + index, primary: selected });
                        });
                    }
                }
            } else if (page === 1) {
                renderAccount(cv, theme);
            } else if (page === 0) {
                const centered = { align: 'center' };
                cv.text('This application is still in development phase and not ready for public use.',
                    800, 218, 30, theme.text, centered);
                cv.text('We still working on it and will be available soon.',
                    800, 260, 30, theme.text, centered);
                cv.text('Thank you', 800, 302, 30, theme.text, centered);
            }
            G.frame(cv, theme, TABS, showingFuelling ? -1 : page, []);
            return ctx.ui.image('MAIN_GFX', cv);
        });
    },
});
