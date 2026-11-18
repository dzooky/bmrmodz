'use strict';

const HMI_CONTEXT = 'de.bmw.infotainment.hmi.hmicontext.HMIContext';
const supported = {
    DEUTSCH: 'de',
    SPANISCH: 'es',
    SPANISCH__US: 'es',
    FRANZOESISCH: 'fr',
    FRANZOESISCH__CA: 'fr',
    UNGARISCH: 'hu',
    POLNISCH: 'pl',
    SLOWAKISCH: 'sk',
    TSCHECHISCH: 'cs',
    ITALIENISCH: 'it',
    RUSSISCH: 'ru'
};

function watch(ctx, onLanguage) {
    let previous;
    ctx.signals.watch(HMI_CONTEXT, 'HMI_CID', {
        currentDisplayLanguage(value) {
            const language = Object.prototype.hasOwnProperty.call(supported, value) ? supported[value] : 'en';
            if (language === previous) return;
            previous = language;
            onLanguage(language);
        }
    }, ctx.log).catch(error => ctx.log.warn('Cannot read the iDrive display language: ' + error.message));
}

module.exports = { watch };
