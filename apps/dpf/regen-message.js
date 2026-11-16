'use strict';

const cluster = require('./kit/cluster-icon');
const { Canvas } = require('./kit/canvas');
const WIDTH = 430;
const HEIGHT = 76;
const BASELINE = 47;
const PREFIX = 'DPF Status:';
const FONT_SIZE = 28;
const STATE_GAP = 8;
const HALF_BLINK_MS = 500;
const BLINK_MS = 6 * HALF_BLINK_MS;
const ACTIVE_REPEAT_MS = 60000;
const REQUESTED = { text: 'Requested', colour: '#ffd700' };
const ACTIVE = { text: 'In Progress', colour: '#ff2a2a' };
const COMPLETE = { text: 'Finished', colour: '#23dc5a' };
const BLANK = { text: '' };

function blink(message, elapsed) {
    if (elapsed >= BLINK_MS) return null;
    return Math.floor(elapsed / HALF_BLINK_MS) % 2 === 0 ? message : BLANK;
}

function testMessage(elapsed) {
    const message = [REQUESTED, ACTIVE, COMPLETE][Math.floor(elapsed / BLINK_MS)];
    return message ? blink(message, elapsed % BLINK_MS) : null;
}

function createIndicator() {
    let previous = null;
    let message = null;
    let startedAt = 0;
    return (state, now) => {
        if (state !== previous) {
            message = state === 'requested' ? REQUESTED : state === 'active' ? ACTIVE
                : state === 'idle' && previous === 'active' ? COMPLETE : null;
            startedAt = now;
            previous = state;
        }
        if (!message) return null;
        const elapsed = now - startedAt;
        return blink(message, state === 'active' ? elapsed % ACTIVE_REPEAT_MS : elapsed);
    };
}

function draw(socket, message, frame) {
    const canvas = new Canvas(WIDTH, HEIGHT);
    if (message.text) {
        const style = { font: 'bold', literal: true };
        const prefixWidth = canvas.textWidth(PREFIX, FONT_SIZE, style);
        const stateWidth = canvas.textWidth(message.text, FONT_SIZE, style);
        const x = Math.round((WIDTH - prefixWidth - STATE_GAP - stateWidth) / 2);
        const stateX = x + prefixWidth + STATE_GAP;
        const shadow = [0, 0, 0, 190];
        canvas.text(PREFIX, x + 1, BASELINE + 2, FONT_SIZE, shadow, style);
        canvas.text(message.text, stateX + 1, BASELINE + 2, FONT_SIZE, shadow, style);
        canvas.text(PREFIX, x, BASELINE, FONT_SIZE, '#ffffff', style);
        canvas.text(message.text, stateX, BASELINE, FONT_SIZE, message.colour, style);
    }
    const body = Buffer.alloc(14 + canvas.d.length);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(frame, 4);
    body.set(canvas.d, 14);
    cluster.send(socket, 0x46, body);
}

function start(log, getMessage) {
    cluster.start(log, getMessage, { app: 'dpf', x: 745, y: 539, width: WIDTH, height: HEIGHT,
        key: message => message.text, draw });
}

module.exports = { start, createIndicator, testMessage };
