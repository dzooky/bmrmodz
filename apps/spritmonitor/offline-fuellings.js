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
            lastFuelling: Object.assign({}, current.lastFuelling, { [kind]: entry }),
            conditions: kind === 'Fuel' ? conditions : current.conditions
        }));
        return entry.id;
    }

    function change(account, id, state) {
        const current = read(account);
        const entries = state ? current.entries.map(entry => entry.id === id
            ? Object.assign({}, entry, { state }) : entry) : current.entries.filter(entry => entry.id !== id);
        const lastFuelling = Object.assign({}, current.lastFuelling);
        for (const [kind, entry] of Object.entries(lastFuelling)) {
            if (entry.id === id) lastFuelling[kind] = Object.assign({}, entry, { state: state || 'sent' });
        }
        write(account, Object.assign({}, current, { entries, lastFuelling }));
    }

    return { read, cache, enqueue, change };
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

module.exports = { open, uploadFields };
