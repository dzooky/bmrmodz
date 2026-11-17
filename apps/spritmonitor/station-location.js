'use strict';

const GUIDANCE = 'de.bmw.infotainment.navigation.guiding.Guidance';
const POSITION_MAX_AGE_MS = 10000;

// Spritmonitor uses vehicle country identifiers (e.g. D rather than DE).
const countryCodes = {
    AT: 'A', AUT: 'A', A: 'A', BE: 'B', BEL: 'B', B: 'B',
    CH: 'CH', CHE: 'CH', CZ: 'CZ', CZE: 'CZ', DE: 'D', DEU: 'D', D: 'D',
    FR: 'F', FRA: 'F', F: 'F', HR: 'HR', HRV: 'HR', HU: 'H', HUN: 'H', H: 'H',
    IT: 'I', ITA: 'I', I: 'I', NL: 'NL', NLD: 'NL', PL: 'PL', POL: 'PL',
    RO: 'RO', ROU: 'RO', SK: 'SK', SVK: 'SK', SI: 'SLO', SVN: 'SLO', SLO: 'SLO'
};

const countries = [
    ['A', 'Austria'], ['B', 'Belgium'], ['HR', 'Croatia'], ['CZ', 'Czechia'], ['F', 'France'],
    ['D', 'Germany'], ['H', 'Hungary'], ['I', 'Italy'], ['NL', 'Netherlands'], ['PL', 'Poland'],
    ['RO', 'Romania'], ['SK', 'Slovakia'], ['SLO', 'Slovenia'], ['CH', 'Switzerland']
];

function addressParts(road, depth) {
    if (!road || typeof road !== 'object' || road.valid === false || road.isValid === false || depth === 0) return [];
    const elements = Array.isArray(road.elements) ? road.elements.slice(0, 32) : [];
    return [road].concat(addressParts(road.address, depth - 1),
        ...elements.map(element => addressParts(element, depth - 1)));
}

function stationAddress(road) {
    let location = '', country = '', street = '';
    for (const part of addressParts(road, 3)) {
        const type = String(part.type || part.kind || '').toUpperCase();
        const text = typeof part.text === 'string' ? part.text : part.value;
        const city = [part.city, part.locality, part.town, /^(CITY|LOCALITY|TOWN)$/.test(type) && text]
            .find(value => typeof value === 'string' && value.trim());
        const code = [part.countryCode, part.country, /^(COUNTRY|COUNTRY_CODE)$/.test(type) && text]
            .filter(value => typeof value === 'string' && value.trim())
            .map(value => countryCodes[value.trim().toUpperCase()]).find(Boolean);
        if (!location && city) location = city.trim().slice(0, 255);
        if (!street) {
            const name = [part.streetName, part.roadName, /^(STREET|ROAD|ROAD_NAME)$/.test(type) && text]
                .find(value => typeof value === 'string' && value.trim());
            if (name) street = name.trim().slice(0, 255);
        }
        if (!country && code) country = code;
        if (location && country) break;
    }
    return location || street || country ? { location: location || street, country } : null;
}

function roadFields(road, nested) {
    if (road == null) return 'empty';
    if (Array.isArray(road)) return 'list';
    if (typeof road !== 'object') return typeof road;
    const paths = [];
    for (const key of Object.keys(road).filter(key => /^[a-zA-Z_][a-zA-Z_0-9]{0,39}$/.test(key))) {
        const value = road[key];
        if (key === 'elements' && Array.isArray(value) && !nested) {
            const samples = Array.from(new Set(value.slice(0, 8).map(element => roadFields(element, true))));
            paths.push('elements[' + value.length + ']' + (samples.length ? ': ' + samples.join(' / ') : ''));
            continue;
        }
        const children = value && typeof value === 'object' && !Array.isArray(value)
            ? Object.keys(value).filter(name => /^[a-zA-Z_][a-zA-Z_0-9]{0,39}$/.test(name)) : [];
        if (children.length) paths.push(key + ' (' + children.join(', ') + ')');
        else paths.push(key);
    }
    const fields = paths.join(', ');
    return fields.length > 100 ? fields.slice(0, 97) + '...' : fields || 'empty object';
}

function watch(ctx, onAddress) {
    let logged = false;
    let subscription;
    let failed = false;
    let lastReport;
    ctx.signals.watch(GUIDANCE, 'Main_Instance', {
        currentRoad(road) {
            const address = stationAddress(road);
            lastReport = { address, at: Date.now(), fields: address ? '' : roadFields(road) };
            if (!logged && road != null) {
                logged = true;
                const keys = typeof road === 'object' ? Object.keys(road).join(', ') : typeof road;
                ctx.log.info('currentRoad fields: ' + keys);
                if (road.address && typeof road.address === 'object') {
                    ctx.log.info('currentRoad address fields: ' + Object.keys(road.address).join(', '));
                }
            }
            onAddress(address);
        }
    }, ctx.log, { pollMs: 3000 }).then(result => { subscription = result; }).catch(error => {
        failed = true;
        ctx.log.warn('Station location: ' + error.message);
    });
    return function status() {
        if (failed || (subscription && subscription.error)) return 'Navigation signal unavailable';
        if (!lastReport || Date.now() - lastReport.at > POSITION_MAX_AGE_MS) return 'No recent navigation data';
        const address = lastReport.address;
        if (!address) return 'No city or country | currentRoad: ' + lastReport.fields;
        if (!address.location) return 'Navigation sent country only';
        if (!address.country) return 'Navigation sent location only';
        return 'Location and country received from navigation';
    };
}

module.exports = { watch, countries, POSITION_MAX_AGE_MS };
