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
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const distanceX = Math.abs(col - centreX);
            const roundedBase = distanceX ** 2 + (row - 22) ** 2 <= 15 ** 2;
            const taperedTop = row >= 3 && row <= 22 && distanceX <= (row - 3) * 0.72;
            if (roundedBase || taperedTop) {
                const offset = 14 + (row * size + col) * 4;
                body.set(colour, offset);
            }
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

// Keep the cluster pictogram independent of the currently visible iDrive page.
function start(log, getColour) {
    if (process.env.MGU_RENDERD_SOCKET && /mgu-emu-/.test(process.env.MGU_RENDERD_SOCKET)) return;

    let client = null;
    let retryAt = 0;

    function connect() {
        const socket = net.createConnection(socketPath);
        const connection = { socket, ready: false, frame: 0, colourKey: null };
        client = connection;
        const deadline = setTimeout(() => socket.destroy(), 4000);
        deadline.unref();
        socket.unref();
        socket.once('connect', () => {
            clearTimeout(deadline);
            command(socket, { op: 'hello', app: 'osa', proto: 1 });
            command(socket, { op: 'layer', ref: 1, kind: 'image', target: 'panel', class: 'overlay',
                x: 1728, y: 665, w: size, h: size, iw: size, ih: size, exclusive: 0, contend: 0 });
            connection.ready = true;
            refresh();
            log.info('OSA: connected to cluster-render for oil drop');
        });
        socket.on('data', () => {}); // Drain renderer notifications.
        socket.on('error', () => {}); // The optional renderer may be unavailable.
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
        if (!colour) {
            if (client) client.socket.destroy();
            client = null;
            retryAt = 0;
            return;
        }
        if (!client) {
            if (Date.now() >= retryAt) connect();
            return;
        }
        if (!client.ready || client.socket.destroyed) return;
        const colourKey = colour.join(',');
        if (colourKey === client.colourKey) return;
        client.colourKey = colourKey;
        client.frame = (client.frame + 1) >>> 0;
        drawDrop(client.socket, colour, client.frame);
    }

    refresh();
    setInterval(refresh, 250).unref();
}

module.exports = { start, createWarmupIndicator };
