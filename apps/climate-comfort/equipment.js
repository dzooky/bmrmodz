'use strict';

// Climate Comfort equipment derived from the shared read-only Car Equipment tool.
// Unknown differs from false: no guess when FA/VO is unavailable.
const CODES = Object.freeze(['248','710','4NB','536','453','454','4HA','494']);
function combineOr(a,b) {
    if (a === true || b === true) return true;
    if (a === false && b === false) return false;
    return 'unknown';
}
function fromResults(results) {
    const state = code => results && (results[code] === true || results[code] === false)
        ? results[code] : 'unknown';
    const bothRows = state('4HA');
    return {
        steeringWheelHeating: state('248'),
        mSportSteeringWheel: state('710'),
        fourZoneClimate: state('4NB'),
        auxiliaryHeating: state('536'),
        frontSeatVentilation: state('453'),
        rearSeatVentilation: state('454'),
        frontSeatHeating: combineOr(bothRows,state('494')),
        rearSeatHeating: bothRows
    };
}
module.exports = {CODES,fromResults,combineOr};
