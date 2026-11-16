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
function showAmber(socket) {
    const body = Buffer.alloc(14 + size * size * 4);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(1, 4);
    const rgb = [255, 174, 42, 255];
    const centreX = (size - 1) / 2;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const distanceX = Math.abs(col - centreX);
            const roundedBase = distanceX ** 2 + (row - 22) ** 2 <= 15 ** 2;
            const taperedTop = row >= 3 && row <= 22 && distanceX <= (row - 3) * 0.72;
            if (roundedBase || taperedTop) {
                const offset = 14 + (row * size + col) * 4;
                body.set(rgb, offset);
            }
        }
    }
    send(socket, 0x46, body);
}

// Placement preview: keep the layer for the lifetime of OSA, even outside its page.
function start(log) {
    if (process.env.MGU_RENDERD_SOCKET && /mgu-emu-/.test(process.env.MGU_RENDERD_SOCKET)) return;

    function connect() {
        const socket = net.createConnection(socketPath);
        const deadline = setTimeout(() => socket.destroy(), 4000);
        deadline.unref();
        socket.unref();
        socket.once('connect', () => {
            clearTimeout(deadline);
            command(socket, { op: 'hello', app: 'osa', proto: 1 });
            command(socket, { op: 'layer', ref: 1, kind: 'image', target: 'panel', class: 'overlay',
                x: 1740, y: 665, w: size, h: size, iw: size, ih: size, exclusive: 0, contend: 0 });
            showAmber(socket);
            log.info('OSA: connected to cluster-render for oil drop preview');
        });
        socket.on('data', () => {}); // Drain renderer notifications.
        socket.on('error', () => {}); // The optional renderer may be unavailable.
        socket.once('close', () => {
            clearTimeout(deadline);
            setTimeout(connect, 5000).unref();
        });
    }

    connect();
}

module.exports = { start };
