'use strict';

const cluster = require('./kit/cluster-icon');
const { Canvas } = require('./kit/canvas');
const WIDTH = 430;
const HEIGHT = 76;
const BASELINE = 47;
const HALF_BLINK_MS = 500;
const COMPLETE_MS = 6 * HALF_BLINK_MS;
const TEST_STATE_MS = 2000;
const REQUESTED = { text: 'DPF regeneration requested', colour: '#ffd700' };
const ACTIVE = { text: 'DPF regeneration in progress', colour: '#ff2a2a' };
const COMPLETE = { text: 'DPF regeneration complete', colour: '#23dc5a' };
const BLANK = { text: '' };

function completionMessage(elapsed) {
    return Math.floor(elapsed / HALF_BLINK_MS) % 2 === 0 ? COMPLETE : BLANK;
}

function testMessage(elapsed) {
    if (elapsed < TEST_STATE_MS) return REQUESTED;
    if (elapsed < 2 * TEST_STATE_MS) return ACTIVE;
    const completionElapsed = elapsed - 2 * TEST_STATE_MS;
    return completionElapsed < COMPLETE_MS ? completionMessage(completionElapsed) : null;
}

function createIndicator() {
    let previous = null;
    let completedAt = null;
    return (state, now) => {
        if (state === null || state === 'active') completedAt = null;
        else if (previous === 'active') completedAt = now;
        previous = state;
        if (state === 'active') return ACTIVE;
        if (completedAt !== null && now - completedAt < COMPLETE_MS) {
            return completionMessage(now - completedAt);
        }
        return state === 'requested' ? REQUESTED : null;
    };
}

function draw(socket, message, frame) {
    const canvas = new Canvas(WIDTH, HEIGHT);
    if (message.text) {
        const style = { align: 'center', font: 'bold', literal: true };
        canvas.text(message.text, WIDTH / 2 + 1, BASELINE + 2, 28, [0, 0, 0, 190], style);
        canvas.text(message.text, WIDTH / 2, BASELINE, 28, message.colour, style);
    }
    const body = Buffer.alloc(14 + canvas.d.length);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(frame, 4);
    body.set(canvas.d, 14);
    cluster.send(socket, 0x46, body);
}

function start(log, getMessage) {
    cluster.start(log, getMessage, { app: 'dpf', x: 745, y: 507, width: WIDTH, height: HEIGHT,
        key: message => message.text, draw });
}

module.exports = { start, createIndicator, testMessage };
