'use strict';

const { pause } = require('./belt-test');

module.exports = function createDiagnosticQueue(gapMs = 350, clock = Date.now, wait = pause) {
    let tail = Promise.resolve(), nextRequest = 0;
    const enqueue = operation => {
        const result = tail.then(async () => {
            const remaining = nextRequest - clock();
            if (remaining > 0) await wait(remaining);
            try {
                return await operation();
            } finally {
                nextRequest = Math.max(nextRequest, clock() + gapMs);
            }
        });
        tail = result.catch(() => {});
        return result;
    };
    enqueue.backoff = milliseconds => {
        nextRequest = Math.max(nextRequest, clock() + milliseconds);
    };
    return enqueue;
};
