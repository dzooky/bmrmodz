'use strict';

const net = require('net');
const socketPath = '/dev/shm/cluster-render/render.sock';

function send(socket, type, body) {
    const header = Buffer.alloc(5);
    header.writeUInt32LE(body.length + 1, 0);
    header[4] = type;
    socket.write(Buffer.concat([header, body]));
}
const command = (socket, value) => send(socket, 0x4a, Buffer.from(JSON.stringify(value)));
// Keep the cluster pictogram independent of the currently visible iDrive page.
function start(log, getColour, { app, x, y, size, width = size, height = size, key = colour => colour.join(','), draw }) {
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
            command(socket, { op: 'hello', app, proto: 1 });
            command(socket, { op: 'layer', ref: 1, kind: 'image', target: 'panel', class: 'overlay',
                x, y, w: width, h: height, iw: width, ih: height, exclusive: 0, contend: 0 });
            connection.ready = true;
            refresh();
            log.info(app + ': connected to cluster-render');
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
            const connection = client;
            client = null;
            retryAt = 0;
            if (connection && connection.ready && !connection.socket.destroyed) {
                const socket = connection.socket;
                command(socket, { op: 'drop', ref: 1 });
                socket.end();
                const deadline = setTimeout(() => socket.destroy(), 1000);
                deadline.unref();
                socket.once('close', () => clearTimeout(deadline));
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
        const colourKey = key(colour);
        if (colourKey === client.colourKey) return;
        client.colourKey = colourKey;
        client.frame = (client.frame + 1) >>> 0;
        draw(client.socket, colour, client.frame);
    }

    refresh();
    setInterval(refresh, 250).unref();
}

module.exports = { send, start };
