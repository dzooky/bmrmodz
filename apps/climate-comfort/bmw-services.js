'use strict';

const fs = require('fs');
const CATALOG = '/etc/oap/someip/someip-interfaces.json';
const STRONG = /connected.?drive|climate.*rule|rule.*climate|automat.*habit|smart.?interior|entitlement|licen[sc]e|subscription|service.*right|customer.*contract|personal.*assistant/i;
const BROAD = /climate|intelligent.*function/i;
const TOP = 135, BOTTOM = 450, STEP = 26;
const GRID_STEP = 34;
const RULE = /rule|habit|automat|smart.?interior/i;

function inspectCatalog(catalog) {
    if (!catalog || !catalog.interfaces || typeof catalog.interfaces !== 'object' || Array.isArray(catalog.interfaces)) {
        throw new Error('Invalid catalog format');
    }
    const matches = [];
    Object.keys(catalog.interfaces).forEach(name => {
        const definition = catalog.interfaces[name] || {};
        const fields = definition.fields && typeof definition.fields === 'object' ? definition.fields : {};
        const methods = Object.keys(definition.methods || {});
        const haystack = [name].concat(Object.keys(fields), methods).join(' ');
        const score = STRONG.test(haystack) ? 2 : BROAD.test(haystack) ? 1 : 0;
        if (!score) return;
        matches.push({
            name, score,
            instances: Object.keys(catalog.instanceIDs && catalog.instanceIDs[name] || {}),
            fields: Object.keys(fields).map(field => ({
                name: field,
                readable: fields[field] && fields[field].getter != null,
                notified: fields[field] && fields[field].notifier != null,
                writable: fields[field] && fields[field].setter != null,
            })),
            methods,
        });
    });
    matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return { ok: true, interfaceCount: Object.keys(catalog.interfaces).length,
        matchCount: matches.length, matches: matches.slice(0, 100),
        subscription: 'Unknown', climateRules: 'Unknown' };
}

function scan() {
    try {
        const info = fs.statSync(CATALOG);
        if (info.size > 32 * 1024 * 1024) throw new Error('Catalog exceeds scan size limit');
        return inspectCatalog(JSON.parse(fs.readFileSync(CATALOG, 'utf8')));
    } catch (error) {
        return { ok: false, error: error.code || error.message, matches: [],
            subscription: 'Unknown', climateRules: 'Unknown' };
    }
}

function detailLines(report, selected) {
    if (!report.ok) return ['The catalog could not be read.', 'Error: ' + report.error,
        'Original climate rules: Not verified'];
    const match = report.matches[selected];
    if (!match) return ['Select an interface from the list.'];
    const output = [
        match.name,
        'Instances: ' + (match.instances.join(', ') || 'Not listed'),
        'Original climate rules: Not verified',
        '',
    ];
    const ruleFields = match.fields.filter(field => RULE.test(field.name));
    const ruleMethods = match.methods.filter(name => RULE.test(name));
    output.push('Fields related to rules or automation: ' + ruleFields.length);
    ruleFields.forEach(field => output.push(field.name + (field.readable ? ' [read]' : '') +
        (field.notified ? ' [event]' : '') + (field.writable ? ' [setter listed]' : '')));
    output.push('Methods related to rules or automation: ' + ruleMethods.length);
    ruleMethods.forEach(name => output.push(name + ' [not called]'));
    if (!ruleFields.length && !ruleMethods.length) {
        output.push('No rule-named entries found in this interface.');
    }
    output.push('', 'Other fields: ' + (match.fields.length - ruleFields.length) + ' (hidden)');
    return output;
}

function maxScroll(report, selected = null) {
    if (selected === null && report.ok) {
        return Math.max(0, Math.ceil(report.matches.length / 2) * GRID_STEP - 4 - (BOTTOM - TOP));
    }
    return Math.max(0, detailLines(report, selected).length * STEP - (BOTTOM - TOP));
}

function render(cv, theme, report, scroll, selected = null, select = () => {}) {
    const overview = selected === null && report.ok;
    cv.text(overview ? 'BMW rule interfaces (read-only)' : 'BMW rule interface details (read-only)', 66, 86, 27, theme.text);
    cv.text(report.ok ? report.interfaceCount + ' interfaces / ' + report.matchCount + ' candidates'
        : 'Catalog unavailable: ' + report.error, 66, 117, 18, theme.dim);
    cv.clip(55, TOP, 1490, BOTTOM - TOP);
    if (overview) {
        if (!report.matches.length) cv.text('No matching names found. Rule state remains unverified.', 66, TOP + 24, 20, theme.dim);
        report.matches.forEach((match, index) => {
            const x = 66 + (index % 2) * 750;
            const y = TOP + Math.floor(index / 2) * GRID_STEP - scroll;
            if (y + 30 <= TOP || y >= BOTTOM) return;
            const label = (index + 1) + '. ' + match.name.replace(/^de\.bmw\.(infotainment|infrastructure)\./, '');
            cv.roundRect(x, y, 725, 30, 6, '#ffffff12');
            cv.text(label, x + 8, y + 21, Math.min(17, 700 * 17 / Math.max(1, cv.textWidth(label, 17))), theme.text);
            const top = Math.max(y, TOP), bottom = Math.min(y + 30, BOTTOM);
            cv.target(x, top, 725, bottom - top, () => select(index), 'bmw-service-' + index, 6);
        });
    } else {
        detailLines(report, selected).forEach((line, index) => {
            const y = TOP + 21 + index * STEP - scroll;
            if (y - 18 >= TOP && y <= BOTTOM) {
                const width = cv.textWidth(line, 18);
                cv.text(line, 66, y, Math.min(18, 1460 * 18 / Math.max(1, width)), theme.text);
            }
        });
    }
    cv.noclip();
    cv.text('Open a candidate to inspect rule fields. Actual rule state is not yet verified.', 66, 497, 17, theme.dim);
    const max = maxScroll(report, selected);
    if (max > 0) {
        const bar = { x: 1555, y: TOP, w: 6, h: BOTTOM - TOP };
        const height = Math.max(20, bar.h * bar.h / (bar.h + max));
        cv.scroll = { y: TOP, bar };
        cv.roundRect(bar.x, bar.y + scroll / max * (bar.h - height), bar.w, height, 3, theme.dim);
    }
}

module.exports = { inspectCatalog, scan, render, maxScroll, detailLines };
