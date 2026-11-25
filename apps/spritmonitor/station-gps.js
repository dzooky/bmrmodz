'use strict';

const path = require('path');

const SCALE = 100000;
const MAX_TOWN_KM = 2.5;
const BORDER_KM = 5;
let database;

function coordinates(position) {
    if (!position || (position.coordinatesValid !== true && position.coordinatesValid !== 1)) return null;
    const { latitude, longitude } = position;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (!latitude && !longitude)) return null;
    return { latitude, longitude };
}

function nearbyTown(position) {
    if (!database) database = require('./kit/pack').open(path.join(__dirname, 'station-towns'));
    const { latitude, longitude } = position;
    const north = Math.floor(latitude), east = Math.floor(longitude);
    const longitudeScale = Math.cos(latitude * Math.PI / 180);
    const hits = [];
    for (let lat = north - 1; lat <= north + 1; lat++) {
        for (let lon = east - 1; lon <= east + 1; lon++) {
            const towns = database.json(lat + '_' + lon + '.json');
            if (!Array.isArray(towns)) continue;
            for (const [townLat, townLon, country, location] of towns) {
                const dy = townLat / SCALE - latitude;
                const dx = (townLon / SCALE - longitude) * longitudeScale;
                const distance = Math.sqrt(dx * dx + dy * dy) * 111.2;
                if (distance <= BORDER_KM) hits.push({ location, country, distance });
            }
        }
    }
    hits.sort((a, b) => a.distance - b.distance);
    const nearest = hits[0];
    if (!nearest || nearest.distance > MAX_TOWN_KM || hits.some(hit => hit.country !== nearest.country)) return null;
    if (hits.some(hit => hit.location !== nearest.location && hit.distance < nearest.distance + 0.35)) return null;
    return { location: nearest.location, country: nearest.country };
}

module.exports = { coordinates, nearbyTown };
