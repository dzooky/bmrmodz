'use strict';

const gps = require('./station-gps');
const { t } = require('./kit/i18n');

const GUIDANCE = 'de.bmw.infotainment.navigation.guiding.Guidance';
const POSITION_MAX_AGE_MS = 10000;

// Keep ISO codes in the form and translate them to Spritmonitor's vehicle country codes at save time.
const countries = [
    ['AT', 'Austria', 'A', 'AUT'], ['BE', 'Belgium', 'B', 'BEL'],
    ['HR', 'Croatia', 'HR', 'HRV'], ['CZ', 'Czechia', 'CZ', 'CZE'],
    ['FR', 'France', 'F', 'FRA'], ['DE', 'Germany', 'D', 'DEU'],
    ['HU', 'Hungary', 'H', 'HUN'], ['IT', 'Italy', 'I', 'ITA'],
    ['NL', 'Netherlands', 'NL', 'NLD'], ['PL', 'Poland', 'PL', 'POL'],
    ['RO', 'Romania', 'RO', 'ROU'], ['SK', 'Slovakia', 'SK', 'SVK'],
    ['SI', 'Slovenia', 'SLO', 'SVN'], ['CH', 'Switzerland', 'CH', 'CHE']
];

const countryCodes = new Map();
for (const [iso, , api, iso3] of countries) {
    for (const code of [iso, api, iso3]) countryCodes.set(code, iso);
}

const nonEuroCurrencies = { CH: 'CHF', CZ: 'CZK', HU: 'HUF', PL: 'PLN', RO: 'RON' };

function countryCurrency(code) {
    return nonEuroCurrencies[code] || 'EUR';
}

function apiCountryCode(code) {
    const country = countries.find(([iso]) => iso === code);
    return country ? country[2] : '';
}

function addressParts(road, depth) {
    if (!road || typeof road !== 'object' || road.valid === false || road.isValid === false || depth === 0) return [];
    const elements = Array.isArray(road.elements) ? road.elements.slice(0, 32) : [];
    return [road].concat(addressParts(road.address, depth - 1),
        ...elements.map(element => addressParts(element, depth - 1)));
}

function stationAddress(road) {
    let location = '', country = '';
    for (const part of addressParts(road, 3)) {
        const type = String(part.type || part.kind || '').toUpperCase();
        const text = typeof part.text === 'string' ? part.text : part.value;
        const city = [part.city, part.locality, part.town, /^(CITY|LOCALITY|TOWN)$/.test(type) && text]
            .find(value => typeof value === 'string' && value.trim());
        const code = [part.countryCode, part.country, /^(COUNTRY|COUNTRY_CODE)$/.test(type) && text]
            .filter(value => typeof value === 'string' && value.trim())
            .map(value => countryCodes.get(value.trim().toUpperCase())).find(Boolean);
        if (!location && city) location = city.trim().slice(0, 255);
        if (!country && code) country = code;
        if (location && country) break;
    }
    return location || country ? { location, country } : null;
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
    const positioning = ctx.spec && ctx.spec.config && ctx.spec.config.stationPositioning;
    const source = positioning ? 'currentLocation' : 'currentRoad';
    ctx.signals.watch(positioning ? positioning.interface : GUIDANCE,
        positioning ? positioning.instance : 'Main_Instance', {
        [source](road) {
            const address = stationAddress(road);
            const position = positioning ? gps.coordinates(road) : null;
            lastReport = { address, position, at: Date.now(),
                hasCoordinates: positioning && road && Object.prototype.hasOwnProperty.call(road, 'coordinatesValid'), fields: address ? '' : roadFields(road) };
            if (!logged && road != null) {
                logged = true;
                const keys = typeof road === 'object' ? Object.keys(road).join(', ') : typeof road;
                ctx.log.info(source + ' fields: ' + keys);
                if (road.address && typeof road.address === 'object') {
                    ctx.log.info(source + ' address fields: ' + Object.keys(road.address).join(', '));
                }
            }
            onAddress(address, position);
        }
    }, ctx.log, { pollMs: 3000 }).then(result => { subscription = result; }).catch(error => {
        failed = true;
        ctx.log.warn('Station location: ' + error.message);
    });
    return function status() {
        if (failed || (subscription && subscription.error)) return 'Navigation signal unavailable';
        if (!lastReport || Date.now() - lastReport.at > POSITION_MAX_AGE_MS) return 'No recent navigation data';
        const address = lastReport.address;
        if (!address && lastReport.position) return 'GPS position available';
        if (!address && lastReport.hasCoordinates) return 'GPS coordinates invalid or unsupported';
        if (!address) return t('No city or country') + ' | ' + source + ': ' + lastReport.fields;
        if (!address.location) return 'Navigation sent country only';
        if (!address.country) return 'Navigation sent city only';
        return 'City and country received from navigation';
    };
}

module.exports = { watch, countries, apiCountryCode, countryCurrency, nearbyTown: gps.nearbyTown, POSITION_MAX_AGE_MS };
