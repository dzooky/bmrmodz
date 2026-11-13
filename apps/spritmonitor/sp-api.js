'use strict';

const https = require('https');

function getJson(endpoint, applicationId, token) {
    return new Promise((resolve, reject) => {
        const fail = () => reject(new Error('Could not reach Spritmonitor.'));
        const request = https.get({
            hostname: 'api.spritmonitor.de',
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
                    if (!Array.isArray(data)) throw new Error();
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

async function loadVehicle(applicationId, token, vehicleId) {
    const vehicles = await getJson('vehicles.json', applicationId, token);
    const vehicle = vehicleId
        ? vehicles.find(item => String(item.id) === vehicleId)
        : vehicles.length === 1 ? vehicles[0] : null;
    if (!vehicle) {
        throw new Error(vehicles.length
            ? 'Set SP_VEHICLE_ID to an existing vehicle ID from your account.'
            : 'No vehicles found in your Spritmonitor account.');
    }
    const tanks = await getJson('vehicle/' + encodeURIComponent(vehicle.id) + '/tanks.json', applicationId, token);
    return {
        name: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
        tanks: tanks.map(tank => tank.name).filter(Boolean)
    };
}

module.exports = { loadVehicle };
