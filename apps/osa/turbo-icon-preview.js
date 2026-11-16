'use strict';

const net = require('net');
const size = 38;
const socketPath = '/dev/shm/cluster-render/render.sock';

function send(socket, type, body) {
    const header = Buffer.alloc(5);
    header.writeUInt32LE(body.length + 1, 0);
    header[4] = type;
    socket.write(Buffer.concat([header, body]));
}
const command = (socket, value) => send(socket, 0x4a, Buffer.from(JSON.stringify(value)));
function drawDrop(socket, colour, frame) {
    const body = Buffer.alloc(14 + size * size * 4);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(frame, 4);
    const centreX = (size - 1) / 2;
    const tip = 2;
    const widest = 25;
    const bottom = 36;
    const halfWidth = 9.5;
    for (let row = tip; row <= bottom; row++) {
        const taper = (row - tip) / (widest - tip);
        const base = (row - widest) / (bottom - widest);
        const radius = halfWidth * (row <= widest
            ? Math.sin(taper * Math.PI / 2) ** 1.35
            : Math.sqrt(Math.max(0, 1 - base ** 2)));
        for (let col = 0; col < size; col++) {
            const coverage = Math.max(0, Math.min(1, radius + 1 - Math.abs(col - centreX)));
            if (!coverage) continue;
            const offset = 14 + (row * size + col) * 4;
            body.set(colour, offset);
            body[offset + 3] = Math.round(colour[3] * coverage);
        }
    }
    send(socket, 0x46, body);
}

const BLINK_MS = 10000;
const BLINK_HALF_PERIOD_MS = 500;
const REARM_MARGIN_C = 2;
const TRANSPARENT = [0, 0, 0, 0];

function createWarmupIndicator(colourAt) {
    let previousTarget = null;
    let warming = false;
    let reachedAt = null;

    return (temperature, target, now) => {
        if (target !== previousTarget) {
            previousTarget = target;
            warming = temperature < target;
            reachedAt = null;
        }
        if (temperature <= target - REARM_MARGIN_C) {
            warming = true;
            reachedAt = null;
        }
        if (warming && temperature < target) return colourAt(temperature, target);
        if (warming) {
            warming = false;
            reachedAt = now;
        }
        if (reachedAt === null || now - reachedAt >= BLINK_MS) return null;
        return Math.floor((now - reachedAt) / BLINK_HALF_PERIOD_MS) % 2 === 0
            ? colourAt(target, target) : TRANSPARENT;
    };
}

function readEvents(socket, report) {
    let pending = Buffer.alloc(0);
    socket.on('data', chunk => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 5) {
            const length = pending.readUInt32LE(0);
            if (length < 1 || length > 1024 * 1024) { socket.destroy(); return; }
            if (pending.length < length + 4) return;
            const type = pending[4];
            const body = pending.slice(5, length + 4);
            pending = pending.slice(length + 4);
            if (type !== 0x4a) continue;
            let event;
            try { event = JSON.parse(body.toString('utf8')); } catch (error) { continue; }
            if (!event) continue;
            if (event.ev === 'target' && event.target === 'panel') {
                report(['Panel:', event.state, event.holder, event.reason].filter(Boolean).join(' '));
            } else if (event.ev === 'status' && typeof event.text === 'string') {
                const slots = event.text.split(/\r?\n/).map(line => line.trim())
                    .filter(line => /^slot 0x[0-9a-f]+\b/i.test(line));
                if (slots.length) report(slots);
            } else if (event.ev === 'error') {
                report('Renderer: ' + (event.reason || event.op || 'error'));
            }
        }
    });
}

// Keep the cluster pictogram independent of the currently visible iDrive page.
function start(log, getColour, report, testing) {
    if (process.env.MGU_RENDERD_SOCKET && /mgu-emu-/.test(process.env.MGU_RENDERD_SOCKET)) return;

    let client = null;
    let retryAt = 0;

    function connect() {
        const socket = net.createConnection(socketPath);
        const connection = { socket, ready: false, frame: 0, colourKey: null, nextStatus: 0, layer: false };
        client = connection;
        const deadline = setTimeout(() => socket.destroy(), 4000);
        deadline.unref();
        socket.unref();
        socket.once('connect', () => {
            clearTimeout(deadline);
            command(socket, { op: 'hello', app: 'osa', proto: 1 });
            connection.ready = true;
            refresh();
            log.info('OSA: connected to cluster-render for oil drop');
        });
        readEvents(socket, report);
        socket.on('error', error => report('Renderer socket: ' + (error.code || error.message)));
        socket.once('close', () => {
            clearTimeout(deadline);
            if (client === connection) {
                client = null;
                retryAt = Date.now() + 5000;
            }
        });
    }

    function refresh() {
        const colour = getColour();
        if (!colour && !testing()) {
            const connection = client;
            client = null;
            retryAt = 0;
            if (connection && connection.ready && !connection.socket.destroyed) {
                if (connection.layer) command(connection.socket, { op: 'drop', ref: 1 });
                connection.socket.end();
                const deadline = setTimeout(() => connection.socket.destroy(), 1000);
                deadline.unref();
                connection.socket.once('close', () => clearTimeout(deadline));
            } else if (connection) {
                connection.socket.destroy();
            }
            return;
        }
        if (!client) {
            if (Date.now() >= retryAt) connect();
            return;
        }
        if (!client.ready || client.socket.destroyed) return;
        const socket = client.socket;
        if (colour && !client.layer) {
            command(socket, { op: 'layer', ref: 1, kind: 'image', target: 'panel', class: 'overlay',
                x: 1728, y: 665, w: size, h: size, iw: size, ih: size, exclusive: 0, contend: 0 });
            client.layer = true;
        } else if (!colour && client.layer) {
            command(socket, { op: 'drop', ref: 1 });
            client.layer = false;
            client.colourKey = null;
        }
        if (testing() && Date.now() >= client.nextStatus) {
            command(socket, { op: 'status' });
            client.nextStatus = Date.now() + 750;
        }
        if (!colour) return;
        const colourKey = colour.join(',');
        if (colourKey === client.colourKey) return;
        client.colourKey = colourKey;
        client.frame = (client.frame + 1) >>> 0;
        drawDrop(client.socket, colour, client.frame);
    }

    refresh();
    setInterval(refresh, 250).unref();
}

module.exports = { start, createWarmupIndicator, readEvents };
