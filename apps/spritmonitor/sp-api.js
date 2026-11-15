'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const net = require('net');

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
        const fail = () => reject(new Error('Could not reach Spritmonitor.'));
        const request = https.get({
            hostname: 'api.spritmonitor.de',
            lookup,
            path: '/v1/' + endpoint,
            headers: {
                Accept: 'application/json',
                'APPLICATION-ID': applicationId,
                Authorization: 'Bearer ' + token
            }
        }, response => {
            response.on('error', fail);
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error('Spritmonitor request failed (HTTP ' + response.statusCode + ').'));
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
        request.setTimeout(10000, () => request.destroy());
        request.on('error', fail);
    });
}

function listVehicles(applicationId, token, dataDir) {
    return getJson('vehicles.json', applicationId, token, false, dataDir ? useUplink(dataDir) : undefined);
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
    const [tanks, config, currencies, preferences] = await Promise.all([
        getJson(endpoint + '/tanks.json', applicationId, token, false, lookup),
        getJson(endpoint + '/getconfig.json', applicationId, token, true, lookup).catch(() => null),
        getJson('currencies.json', applicationId, token, false, lookup).catch(() => []),
        getJson('units.json', applicationId, token, true, lookup).catch(() => null)
    ]);
    const adBlue = tank => /ad\s*blue/i.test(tank.name || '');
    const orderedTanks = tanks.filter(tank => tank.name);
    const ordered = orderedTanks.filter(tank => !adBlue(tank)).concat(orderedTanks.filter(adBlue));
    const tankVolume = config ? Number(config.tankvolume) : 0;
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
            return { name: tank.name, entry: entries[0], entries };
        } catch (_) {
            return { name: tank.name, unavailable: true };
        }
    }));
    return {
        name: [vehicle.make, config && config.modelname || vehicle.model].filter(Boolean).join(' '),
        tanks: ordered.map(tank => tank.name),
        tankStats: ordered.map(tank => ({
            name: tank.name,
            consumption: [tank.consumption, tank.consumptionunit],
            distance: [tank.tripsum, tank.tripsumunit],
            quantity: [tank.quantitysum, tank.quantitysumunit],
            cost: [tank.costsum, tank.costsumunit]
        })),
        tankCapacity: Number.isFinite(tankVolume) && tankVolume > 0 ? tankVolume : null,
        latestFuelings,
        currencies,
        preferredCurrency: preferences && preferences.currency
    };
}

module.exports = { listVehicles, loadVehicle, useUplink };
