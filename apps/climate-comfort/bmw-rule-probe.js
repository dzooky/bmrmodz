'use strict';

const POLL_MS = 5000;

module.exports = function createBmwRuleProbe(ctx, timing = {}) {
    const clock = timing.now || Date.now;
    const startTimer = timing.setInterval || setInterval;
    const stopTimer = timing.clearInterval || clearInterval;
    const definitions = ctx.spec.config.nativeRuleProbe || [];
    let rows = [], active = false, generation = 0, timer = null, busy = false;
    const valid = token => active && token === generation;
    const format = value => {
        try { const text = JSON.stringify(value); return text === undefined ? String(value) : text; }
        catch (error) { return String(value); }
    };

    function receive(row, value, token) {
        if (!valid(token)) return;
        const raw = format(value);
        if (row.raw !== null && row.raw !== raw) { row.previous = row.raw; row.changes++; }
        row.raw = raw;
        row.updatedAt = clock();
        row.error = null;
    }

    async function poll(token = generation) {
        if (busy || !valid(token)) return;
        busy = true;
        try {
            for (const row of rows) {
                if (!valid(token)) break;
                const subscription = row.subscription;
                if (!subscription || !subscription.available || !subscription.proxy) continue;
                try {
                    const value = await subscription.proxy.getValue(row.field, 3000);
                    receive(row, value, token);
                } catch (error) {
                    if (valid(token)) row.error = error.message || String(error);
                }
            }
        } finally { busy = false; }
    }

    async function stop() {
        active = false;
        generation++;
        if (timer !== null) { stopTimer(timer); timer = null; }
        const subscriptions = rows.map(row => row.subscription).filter(Boolean);
        rows.forEach(row => { row.subscription = null; });
        await Promise.all(subscriptions.map(subscription => Promise.resolve().then(() => subscription.shutdown()).catch(() => {})));
    }

    async function start() {
        if (active) return;
        await stop();
        const token = ++generation;
        active = true;
        rows = definitions.map(definition => Object.assign({}, definition,
            { raw: null, previous: null, updatedAt: null, changes: 0, error: null, subscription: null }));
        for (const row of rows) {
            if (!valid(token)) break;
            try {
                const subscription = await ctx.signals.watch(row.interface, row.instance,
                    { [row.field]: value => receive(row, value, token) }, ctx.log);
                if (!valid(token)) { await subscription.shutdown(); break; }
                row.subscription = subscription;
                if (subscription.error) row.error = subscription.error;
            } catch (error) { if (valid(token)) row.error = error.message || String(error); }
        }
        if (valid(token) && rows.length) {
            timer = startTimer(() => { poll(token).catch(error => ctx.log.warn('BMW rule probe: ' + error.message)); }, POLL_MS);
            await poll(token);
        }
    }

    function snapshot() {
        return { active, configured: definitions.length, rows: rows.map(row => ({
            field: row.field, raw: row.raw, previous: row.previous, changes: row.changes,
            updatedAt: row.updatedAt, error: row.error,
            available: !!(row.subscription && row.subscription.available),
        })) };
    }

    function lines() {
        if (!definitions.length) return [
            'No probe getters configured in this build.',
            'The vehicle catalog must be accessible when the Store builds this version.',
            'Original BMW rule state remains unverified.',
        ];
        const output = [];
        rows.forEach(row => {
            output.push(row.field);
            output.push((active ? row.error ? 'Read error: ' + row.error : row.raw === null ? 'Waiting for service/data' : 'Reading every 5 seconds' : 'Reading stopped') +
                ' | Changes: ' + row.changes);
            if (row.updatedAt !== null) output.push('Updated: ' + new Date(row.updatedAt).toISOString().slice(11, 19) + ' UTC');
            for (const [label, raw] of [['Current: ', row.raw], ['Previous: ', row.previous]]) {
                const value = raw === null ? '(no value)' : raw;
                const limited = value.length > 1200 ? value.slice(0, 1200) + ' [truncated]' : value;
                for (let offset = 0; offset < limited.length; offset += 100) {
                    output.push((offset === 0 ? label : '    ') + limited.slice(offset, offset + 100));
                }
            }
            output.push('');
        });
        return output;
    }

    function maxScroll() { return Math.max(0, lines().length * 25 - 315); }
    function render(cv, theme, scroll) {
        cv.text('BMW automatic climate values (read-only)', 66, 86, 27, theme.text);
        cv.text('Toggle the original BMW rule, then compare Current / Previous.', 66, 117, 18, theme.dim);
        cv.clip(55, 135, 1490, 315);
        lines().forEach((line, index) => {
            const y = 156 + index * 25 - scroll;
            if (y - 18 >= 135 && y <= 450) {
                cv.text(line, 66, y, Math.min(18, 1460 * 18 / Math.max(1, cv.textWidth(line, 18))), theme.text);
            }
        });
        cv.noclip();
        cv.text('No setters or methods are called. Rule meaning is not yet verified.', 66, 497, 17, theme.dim);
        const max = maxScroll();
        if (max) {
            const bar = { x: 1555, y: 135, w: 6, h: 315 };
            const height = Math.max(20, bar.h * bar.h / (bar.h + max));
            cv.scroll = { y: 135, bar };
            cv.roundRect(bar.x, bar.y + scroll / max * (bar.h - height), bar.w, height, 3, theme.dim);
        }
    }
    return { start, stop, poll, snapshot, render, maxScroll, isActive: () => active };
};
