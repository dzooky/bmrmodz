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

function stationAddress(road) {
    if (!road || typeof road !== 'object' || road.valid === false || road.isValid === false) return null;
    const addresses = [road.address, road].filter(value => value && typeof value === 'object');
    const text = names => addresses.map(address => names.map(name => address[name]))
        .reduce((values, group) => values.concat(group), [])
        .find(value => typeof value === 'string' && value.trim());
    const city = text(['city', 'locality', 'town']);
    const country = text(['countryCode', 'country']);
    const code = country && countryCodes[country.trim().toUpperCase()];
    return city || code ? { location: city ? city.trim().slice(0, 255) : '', country: code || '' } : null;
}

function watch(ctx, onAddress) {
    let logged = false;
    let subscription;
    let failed = false;
    let lastReport;
    ctx.signals.watch(GUIDANCE, 'Main_Instance', {
        currentRoad(road) {
            const address = stationAddress(road);
            lastReport = { address, at: Date.now() };
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
        if (!address) return 'Navigation sent no city or country';
        if (!address.location) return 'Navigation sent country only';
        if (!address.country) return 'Navigation sent city only';
        return 'City and country received from navigation';
    };
}

module.exports = { watch, POSITION_MAX_AGE_MS };
