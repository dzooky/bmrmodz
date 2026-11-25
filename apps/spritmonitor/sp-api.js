'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const net = require('net');
const querystring = require('querystring');

function useUplink(dataDir) {
    return (hostname, options, callback) => {
        let lease;
        for (const file of [path.join(dataDir, 'uplink.json'), '/run/mgu-uplink/lease.json']) {
            try { lease = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
            if (lease && Array.isArray(lease.dns)) break;
        }
        const servers = lease && Array.isArray(lease.dns) ? lease.dns.filter(ip => net.isIP(ip)) : [];
        if (!servers.length) return dns.lookup(hostname, options, callback);
        const resolver = new dns.Resolver();
        resolver.setServers(servers);
        const timer = setTimeout(() => resolver.cancel(), 6000);
        resolver.resolve4(hostname, (error, addresses) => {
            clearTimeout(timer);
            if (error) return callback(error);
            if (!addresses.length) return callback(new Error('No address from the MGU uplink.'));
            if (options.all) return callback(null, addresses.map(address => ({ address, family: 4 })));
            callback(null, addresses[0], 4);
        });
    };
}

function getJson(endpoint, applicationId, token, expectObject, lookup) {
    return new Promise((resolve, reject) => {
        let secure = false;
        const fail = () => {
            const error = new Error('Could not reach Spritmonitor.');
            error.beforeSend = !secure;
            reject(error);
        };
        const request = https.get({
            hostname: 'api.spritmonitor.de',
            lookup,
            agent: false,
            path: '/v1/' + endpoint,
            headers: {
                Accept: 'application/json',
                'APPLICATION-ID': applicationId,
                Authorization: 'Bearer ' + token
            }
        }, response => {
            secure = true;
            response.on('error', fail);
            response.on('aborted', fail);
            if (response.statusCode !== 200) {
                response.resume();
                const error = new Error('Spritmonitor request failed (HTTP ' + response.statusCode + ').');
                error.status = response.statusCode;
                reject(error);
                return;
            }
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (expectObject ? !data || typeof data !== 'object' || Array.isArray(data) : !Array.isArray(data)) throw new Error();
                    resolve(data);
                } catch (_) {
                    reject(new Error('Unexpected response from Spritmonitor.'));
                }
            });
        });
        request.on('socket', socket => socket.once('secureConnect', () => { secure = true; }));
        const deadline = setTimeout(() => request.destroy(new Error('Request timeout')), 12000);
        request.on('close', () => clearTimeout(deadline));
        request.on('error', fail);
    });
}

function listVehicles(applicationId, token, dataDir) {
    return getJson('vehicles.json', applicationId, token, false, dataDir ? useUplink(dataDir) : undefined);
}

function vehicleConfig(vehicleId, applicationId, token, lookup) {
    return getJson('vehicle/' + encodeURIComponent(vehicleId) + '/getconfig.json',
        applicationId, token, true, lookup).catch(() => null);
}

function tankCapacity(config) {
    const volume = config && Number(config.tankvolume);
    return Number.isFinite(volume) && volume > 0 ? volume : null;
}

async function refreshVehicleConfig(account, vehicle, dataDir) {
    const config = await vehicleConfig(account.vehicleId, account.applicationId, account.token,
        dataDir ? useUplink(dataDir) : undefined);
    if (!config) return vehicle;
    return Object.assign({}, vehicle, {
        configAvailable: true,
        tankCapacity: tankCapacity(config),
        bcConsumptionUnit: Number(config.bcunit)
    });
}

async function loadVehicle(applicationId, token, vehicleId, dataDir, knownVehicles) {
    const lookup = dataDir ? useUplink(dataDir) : undefined;
    const vehicles = knownVehicles || await listVehicles(applicationId, token, dataDir);
    const vehicle = vehicleId
        ? vehicles.find(item => String(item.id) === vehicleId)
        : vehicles.length === 1 ? vehicles[0] : null;
    if (!vehicle) {
        throw new Error(vehicles.length
            ? 'Set SP_VEHICLE_ID to an existing vehicle ID from your account.'
            : 'No vehicles found in your Spritmonitor account.');
    }
    const endpoint = 'vehicle/' + encodeURIComponent(vehicle.id);
    const [tanks, config, currencies, preferences, fuelSorts] = await Promise.all([
        getJson(endpoint + '/tanks.json', applicationId, token, false, lookup),
        vehicleConfig(vehicle.id, applicationId, token, lookup),
        getJson('currencies.json', applicationId, token, false, lookup).catch(() => []),
        getJson('units.json', applicationId, token, true, lookup).catch(() => null),
        getJson('fuelsorts.json', applicationId, token, false, lookup).catch(() => [])
    ]);
    const adBlue = tank => /ad\s*blue/i.test(tank.name || '');
    const orderedTanks = tanks.filter(tank => tank.name);
    const ordered = orderedTanks.filter(tank => !adBlue(tank)).concat(orderedTanks.filter(adBlue));
    const latestFuelings = await Promise.all(ordered.map(async tank => {
        try {
            const entries = [];
            const seen = new Set();
            const history = endpoint + '/tank/' + encodeURIComponent(tank.id) + '/fuelings.json';
            for (let offset = 0; offset < 120 && entries.length < 60;) {
                let batch;
                try {
                    batch = await getJson(history + '?limit=20&offset=' + offset, applicationId, token, false, lookup);
                } catch (error) {
                    if (!entries.length) throw error;
                    break;
                }
                if (!batch.length) break;
                const unique = batch.filter(entry => {
                    if (entry.id == null) return true;
                    if (seen.has(entry.id)) return false;
                    seen.add(entry.id);
                    return true;
                });
                if (!unique.length) break;
                entries.push(...unique.slice(0, 60 - entries.length));
                offset += batch.length;
            }
            return { id: tank.id, name: tank.name, entry: entries[0], entries };
        } catch (_) {
            return { id: tank.id, name: tank.name, unavailable: true };
        }
    }));
    return {
        name: [vehicle.make, config && config.modelname || vehicle.model].filter(Boolean).join(' '),
        tanks: ordered.map(tank => tank.name),
        tankDetails: ordered.map(tank => ({ id: tank.id, type: tank.fuelsorttype, name: tank.name })),
        fuelSorts,
        configAvailable: Boolean(config),
        tripUnit: vehicle.tripunit,
        bcConsumptionUnit: config && Number(config.bcunit),
        tankStats: ordered.map(tank => ({
            name: tank.name,
            consumption: [tank.consumption, tank.consumptionunit],
            distance: [tank.tripsum, tank.tripsumunit],
            quantity: [tank.quantitysum, tank.quantitysumunit],
            cost: [tank.costsum, tank.costsumunit]
        })),
        tankCapacity: tankCapacity(config),
        latestFuelings,
        currencies,
        preferredCurrency: preferences && preferences.currency
    };
}

async function refreshLastFuelling(account, vehicle, dataDir) {
    const fuel = vehicle.tankDetails.find(tank => Number(tank.type) !== 6);
    if (!fuel) return vehicle;
    const endpoint = 'vehicle/' + encodeURIComponent(account.vehicleId) +
        '/tank/' + encodeURIComponent(fuel.id) + '/fuelings.json?limit=1';
    const entries = await getJson(endpoint, account.applicationId, account.token, false,
        dataDir ? useUplink(dataDir) : undefined);
    const entry = entries[0];
    return Object.assign({}, vehicle, {
        latestFuelings: vehicle.latestFuelings.map(history => history.id === fuel.id ? {
            id: history.id,
            name: history.name,
            entry,
            entries: entry ? [entry].concat((history.entries || []).filter(item => item.id !== entry.id)).slice(0, 60) : []
        } : history)
    });
}

function recentTankFuelings(account, tankId, dataDir) {
    const endpoint = 'vehicle/' + encodeURIComponent(account.vehicleId) +
        '/tank/' + encodeURIComponent(tankId) + '/fuelings.json?limit=50';
    return getJson(endpoint, account.applicationId, account.token, false,
        dataDir ? useUplink(dataDir) : undefined);
}

async function addFuelling(account, tankId, fields, dataDir) {
    const endpoint = 'vehicle/' + encodeURIComponent(account.vehicleId) +
        '/tank/' + encodeURIComponent(tankId) + '/fueling.json?' + querystring.stringify(fields);
    const result = await getJson(endpoint, account.applicationId, account.token, true,
        dataDir ? useUplink(dataDir) : undefined);
    const errors = typeof result.errors === 'string' && /^\d+$/.test(result.errors)
        ? Number(result.errors) : result.errors;
    if (!Number.isSafeInteger(errors) || errors < 0) {
        throw new Error('Spritmonitor did not confirm the upload.');
    }
    return errors === 0;
}

module.exports = { listVehicles, loadVehicle, refreshVehicleConfig, refreshLastFuelling, recentTankFuelings, addFuelling, useUplink };
