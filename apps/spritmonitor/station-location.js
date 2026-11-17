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
    for (const address of [road.address, road]) {
        if (!address || typeof address !== 'object') continue;
        const city = [address.city, address.locality, address.town].find(value =>
            typeof value === 'string' && value.trim());
        const country = [address.countryCode, address.country].find(value =>
            typeof value === 'string' && value.trim());
        const code = country && countryCodes[country.trim().toUpperCase()];
        if (city && code) return { location: city.trim().slice(0, 255), country: code };
    }
    return null;
}

function watch(ctx, onAddress) {
    let logged = false;
    ctx.signals.watch(GUIDANCE, 'Main_Instance', {
        currentRoad(road) {
            const address = stationAddress(road);
            if (!logged && road && typeof road === 'object' && Object.keys(road).length) {
                logged = true;
                ctx.log.info('currentRoad fields: ' + Object.keys(road).join(', '));
                if (road.address && typeof road.address === 'object') {
                    ctx.log.info('currentRoad address fields: ' + Object.keys(road.address).join(', '));
                }
            }
            onAddress(address);
        }
    }, ctx.log, { pollMs: 3000 }).catch(error => ctx.log.warn('Station location: ' + error.message));
}

module.exports = { watch, POSITION_MAX_AGE_MS };
