'use strict';

// Parked-car placement test: node kit/tools/osa-turbo-icon-preview.js [x] [y] [socket]
// Keep the amber icon visible until Ctrl+C closes the renderer connection.
const net = require('net');
const size = 32;
const [x = 1570, y = 620] = process.argv.slice(2, 4).map(Number);
if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 1888 || y > 688) {
    throw new Error('Expected x y inside the 1920 x 720 panel.');
}

const socket = net.createConnection(process.argv[4] || '/dev/shm/cluster-render/render.sock');
let watchdog;
function send(type, body) {
    const header = Buffer.alloc(5);
    header.writeUInt32LE(body.length + 1, 0);
    header[4] = type;
    socket.write(Buffer.concat([header, body]));
}
const command = value => send(0x4a, Buffer.from(JSON.stringify(value)));
function frame(id, rgb) {
    const body = Buffer.alloc(14 + size * size * 4);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(id, 4);
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const radius = (col - 12) ** 2 + (row - 17) ** 2;
            const housing = radius <= 100 && radius >= 56;
            const outlet = col >= 13 && col <= 28 && (row === 7 || row === 10)
                || col >= 27 && col <= 29 && row >= 6 && row <= 11;
            if (housing || radius <= 9 || outlet) {
                const offset = 14 + (row * size + col) * 4;
                body.set(rgb, offset);
            }
        }
    }
    send(0x46, body);
}
function stop() {
    clearTimeout(watchdog);
    socket.destroy(); // The renderer removes all layers owned by this connection.
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
socket.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
socket.on('close', () => clearTimeout(watchdog));
watchdog = setTimeout(stop, 14000);
socket.once('connect', () => {
    command({ op: 'hello', app: 'osa_turbo_preview', proto: 1 });
    command({ op: 'layer', ref: 1, kind: 'image', target: 'panel', class: 'overlay',
        x, y, w: size, h: size, iw: size, ih: size, exclusive: 0, contend: 0 });
    frame(1, [255, 174, 42, 255]);
    clearTimeout(watchdog);
});
socket.on('data', () => {}); // Drain renderer notifications.
