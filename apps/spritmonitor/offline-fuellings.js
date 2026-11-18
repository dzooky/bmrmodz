'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function open(dataDir) {
    const file = path.join(dataDir, 'sp-offline.json');
    let saved;
    try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        saved = {};
    }
    const key = account => account && account.vehicleId && crypto.createHash('sha256')
        .update(JSON.stringify([account.applicationId, account.token, String(account.vehicleId)])).digest('hex');
    function read(account) {
        return saved[key(account)] || { entries: [] };
    }

    function write(account, next) {
        const scope = key(account);
        if (!scope) throw new Error('Select a vehicle before saving.');
        const updated = Object.assign({}, saved, { [scope]: next });
        persist(updated);
    }

    function persist(updated) {
        const temporary = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
        try {
            fs.writeFileSync(temporary, JSON.stringify(updated), { mode: 0o600, flag: 'wx' });
            fs.renameSync(temporary, file);
        } catch (error) {
            try { fs.unlinkSync(temporary); } catch (_) {}
            throw error;
        }
        saved = updated;
    }

    // Earlier versions kept all details of the last successful upload in the local receipt.
    let migrated = false;
    for (const scope of Object.values(saved)) {
        for (const [kind, entry] of Object.entries(scope.lastFuelling || {})) {
            if (entry.state !== 'sent' || (!entry.fields && !entry.upload)) continue;
            scope.lastFuelling[kind] = { id: entry.id, state: 'sent' };
            migrated = true;
        }
    }
    if (migrated) {
        try { persist(saved); } catch (_) { /* Keep the local queue usable if migration cannot be written yet. */ }
    }

    function clearLocal(account) {
        const current = read(account);
        const next = Object.assign({}, current, { entries: [], lastFuelling: {} });
        delete next.conditions;
        write(account, next);
    }

    function cache(account, vehicle) {
        const current = read(account);
        const previous = current.vehicle;
        const fresh = vehicle;
        if (previous) {
            vehicle = Object.assign({}, vehicle, {
                latestFuelings: vehicle.latestFuelings.map(history => history.unavailable
                    ? previous.latestFuelings.find(item => item.id === history.id && !item.unavailable) || history
                    : history),
                tankCapacity: vehicle.configAvailable ? vehicle.tankCapacity : previous.tankCapacity,
                tripUnit: vehicle.tripUnit || previous.tripUnit,
                bcConsumptionUnit: vehicle.configAvailable ? vehicle.bcConsumptionUnit : previous.bcConsumptionUnit,
                currencies: vehicle.currencies.length ? vehicle.currencies : previous.currencies,
                fuelSorts: vehicle.fuelSorts.length ? vehicle.fuelSorts : previous.fuelSorts
            });
        }
        const fuelHistoryFresh = fresh.latestFuelings.some(item => !item.unavailable && !/ad\s*blue/i.test(item.name));
        const pendingFuel = current.entries.some(entry => entry.kind === 'Fuel' && entry.state === 'pending');
        const conditions = fuelHistoryFresh && !pendingFuel ? undefined : current.conditions;
        write(account, Object.assign({}, current, { vehicle, conditions }));
        return vehicle;
    }

    function enqueue(account, kind, fields, conditions) {
        const current = read(account);
        const entry = { id: crypto.randomBytes(12).toString('hex'), kind, fields, state: 'pending' };
        if (current.vehicle) entry.upload = uploadFields(current.vehicle, entry);
        write(account, Object.assign({}, current, {
            entries: current.entries.concat(entry),
            lastFuelling: Object.assign({}, current.lastFuelling, { [kind]: { id: entry.id, state: entry.state } }),
            conditions: kind === 'Fuel' ? conditions : current.conditions
        }));
        return entry.id;
    }

    function change(account, id, state, details) {
        const current = read(account);
        const entries = state ? current.entries.map(entry => entry.id === id
            ? Object.assign({}, entry, { state }, details) : entry) : current.entries.filter(entry => entry.id !== id);
        const lastFuelling = Object.assign({}, current.lastFuelling);
        for (const [kind, entry] of Object.entries(lastFuelling)) {
            if (entry.id === id) lastFuelling[kind] = { id: entry.id, state: state || 'sent' };
        }
        const confirmedIds = details && details.confirmedId
            ? (current.confirmedIds || []).concat(details.confirmedId).slice(-128)
            : current.confirmedIds;
        write(account, Object.assign({}, current, { entries, lastFuelling, confirmedIds }));
    }

    return { read, cache, enqueue, change, clearLocal };
}

function uploadFields(vehicle, entry) {
    const tanks = vehicle.tankDetails.filter(tank => (Number(tank.type) === 6) === (entry.kind === 'AdBlue'));
    if (tanks.length !== 1) return null;
    const tank = tanks[0];
    const sorts = vehicle.fuelSorts.filter(sort => Number(sort.type) === Number(tank.type));
    const history = vehicle.latestFuelings.find(item => item.id === tank.id);
    const lastSort = history && history.entry && history.entry.fuelsortid;
    const sort = sorts.find(item => String(item.id) === String(lastSort)) ||
        sorts.find(item => item.name.toLowerCase() === tank.name.toLowerCase()) ||
        (sorts.length === 1 ? sorts[0] : null);
    const { currency, bcSpeed, bcSpeedUnit, bcConsumption, bcConsumptionUnit, ...fields } = entry.fields;
    const currencyInfo = vehicle.currencies.find(item => item.name === currency);
    if (!sort || !currencyInfo || !['km', 'mi'].includes(vehicle.tripUnit)) return null;
    fields.currencyid = currencyInfo.id;
    fields.fuelsortid = sort.id;
    if (vehicle.tripUnit === 'mi') {
        fields.trip = Number((fields.trip / 1.609344).toFixed(1));
        if (fields.odometer != null) fields.odometer = Math.round(fields.odometer / 1.609344);
    }
    if (bcSpeed != null && bcSpeedUnit) {
        const kmh = bcSpeedUnit === 'mph' ? bcSpeed * 1.609344 : bcSpeed;
        fields.bc_speed = Number((vehicle.tripUnit === 'mi' ? kmh / 1.609344 : kmh).toFixed(1));
    }
    const units = { 1: 'km/L', 2: 'L/100 km', 3: 'mpg US', 4: 'mpg UK' };
    if (bcConsumption != null && bcConsumptionUnit && units[vehicle.bcConsumptionUnit] === bcConsumptionUnit) {
        fields.bc_consumption = bcConsumption;
    }
    return { tankId: tank.id, fields };
}

function matchesUpload(remote, fields) {
    const equalNumber = (actual, expected) => actual != null && actual !== '' && expected != null && expected !== '' &&
        Math.abs(Number(actual) - Number(expected)) < 0.0001;
    if (remote.date !== fields.date || remote.type !== fields.type) return false;
    for (const key of ['odometer', 'quantity', 'quantityunitid', 'fuelsortid', 'currencyid']) {
        if (!equalNumber(remote[key], fields[key])) return false;
    }
    const cost = fields.pricetype === 1 ? fields.price * fields.quantity : fields.price;
    if (!equalNumber(remote.cost, Math.round(cost * 100) / 100)) return false;
    return String(remote.note || '').trim() === String(fields.note || '').trim();
}

async function verifyUnconfirmed(store, account, vehicle, loadTankHistory, stillSelected) {
    const state = store.read(account);
    const confirmed = new Set(state.confirmedIds || []);
    const byTank = new Map();
    for (const entry of state.entries) {
        if (entry.state !== 'sending') continue;
        const upload = entry.upload || uploadFields(vehicle, entry);
        if (!upload) continue;
        const tank = String(upload.tankId);
        if (!byTank.has(tank)) byTank.set(tank, []);
        byTank.get(tank).push({ entry, fields: upload.fields });
    }
    let verified = false;
    for (const [tank, entries] of byTank) {
        if (!stillSelected()) return verified;
        const history = await loadTankHistory(tank);
        if (!stillSelected()) return verified;
        const candidates = history.filter(row => row && row.id != null && !confirmed.has(String(row.id)));
        for (const { entry, fields } of entries) {
            const matches = candidates.filter(row => matchesUpload(row, fields));
            if (matches.length !== 1) continue;
            const remote = matches[0];
            if (entries.some(other => other.entry.id !== entry.id && matchesUpload(remote, other.fields))) continue;
            const confirmedId = String(remote.id);
            store.change(account, entry.id, null, { confirmedId });
            confirmed.add(confirmedId);
            verified = true;
        }
    }
    return verified;
}

module.exports = { open, uploadFields, verifyUnconfirmed };
