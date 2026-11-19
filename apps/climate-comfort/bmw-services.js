'use strict';

const fs = require('fs');
const CATALOG = '/etc/oap/someip/someip-interfaces.json';
const STRONG = /connected.?drive|climate.*rule|rule.*climate|automat.*habit|smart.?interior|entitlement|licen[sc]e|subscription|service.*right|customer.*contract|personal.*assistant/i;
const BROAD = /climate|intelligent.*function/i;
const TOP = 135, BOTTOM = 450, STEP = 26;

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

function lines(report) {
    const output = [];
    const add = text => {
        const words = String(text).split(' ');
        let line = '';
        words.forEach(word => {
            if (line && line.length + word.length + 1 > 112) { output.push(line); line = ''; }
            line += (line ? ' ' : '') + word;
        });
        if (line) output.push(line);
    };
    if (!report.ok) {
        add('The catalog could not be read. No service status has been inferred.');
        add('Error: ' + report.error);
        return output;
    }
    if (!report.matches.length) add('No matching interface names were found. This does not prove the service is unavailable.');
    report.matches.forEach(match => {
        add(match.name);
        add('Instances: ' + (match.instances.join(', ') || 'Not listed'));
        const fields = match.fields.map(field => field.name + (field.readable ? ' [read]' : field.notified ? ' [event]' : ''));
        add('Fields: ' + (fields.join(', ') || 'None listed'));
        if (match.methods.length) add('Methods listed (not called): ' + match.methods.join(', '));
        output.push('');
    });
    if (report.matchCount > report.matches.length) add('Showing the first ' + report.matches.length + ' of ' + report.matchCount + ' candidates.');
    return output;
}

const maxScroll = report => Math.max(0, lines(report).length * STEP - (BOTTOM - TOP));

function render(cv, theme, report, scroll) {
    cv.text('BMW services test (read-only)', 66, 86, 27, theme.text);
    cv.text(report.ok ? report.interfaceCount + ' interfaces / ' + report.matchCount + ' candidates'
        : 'Catalog unavailable: ' + report.error, 66, 117, 18, theme.dim);
    cv.clip(55, TOP, 1490, BOTTOM - TOP);
    lines(report).forEach((line, index) => {
        const y = TOP + 21 + index * STEP - scroll;
        if (y - 18 >= TOP && y <= BOTTOM) {
            const width = cv.textWidth(line, 18);
            cv.text(line, 66, y, Math.min(18, 1460 * 18 / Math.max(1, width)), theme.text);
        }
    });
    cv.noclip();
    cv.text('Catalog presence does not confirm a subscription or enabled rules.', 66, 497, 17, theme.dim);
    const max = maxScroll(report);
    if (max > 0) {
        const bar = { x: 1555, y: TOP, w: 6, h: BOTTOM - TOP };
        const height = Math.max(20, bar.h * bar.h / (bar.h + max));
        cv.scroll = { y: TOP, bar };
        cv.roundRect(bar.x, bar.y + scroll / max * (bar.h - height), bar.w, height, 3, theme.dim);
    }
}

module.exports = { inspectCatalog, scan, render, maxScroll };
