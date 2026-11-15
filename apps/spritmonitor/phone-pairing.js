'use strict';

const crypto = require('crypto');
const https = require('https');
const makeQr = require('./qrcode');
const { useUplink } = require('./sp-api');

const HOST = 'ntfy.virtualka.dzooky.eu';
const PAGE = 'https://dzooky.github.io/bmrmodz/pair/';
const DURATION_MS = 5 * 60 * 1000;
const POLL_MS = 8000;

function decrypt(message, key, topic) {
    if (typeof message !== 'string' || !/^[a-f0-9]{24}\.(?:[a-f0-9]{2}){32,272}$/.test(message)) return null;
    try {
        const parts = message.split('.');
        const data = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'hex'));
        decipher.setAAD(Buffer.from(topic, 'utf8'));
        decipher.setAuthTag(data.slice(-16));
        const token = Buffer.concat([decipher.update(data.slice(0, -16)), decipher.final()]).toString('utf8');
        return /^[A-Za-z0-9_-]{16,256}$/.test(token) ? token : null;
    } catch (_) {
        return null;
    }
}

function start(dataDir, onToken, onFailure) {
    const key = crypto.randomBytes(32);
    const topic = 'bmr-sp-' + crypto.randomBytes(16).toString('hex');
    const qr = makeQr(0, 'M');
    const expires = Date.now() + DURATION_MS;
    qr.addData(PAGE + '#topic=' + topic + '&key=' + key.toString('hex') + '&expires=' + expires);
    qr.make();

    let stopped = false;
    let request;
    let next;
    const expiry = setTimeout(() => {
        stop();
        onFailure('Pairing expired. Start again to get a new QR code.');
    }, DURATION_MS);

    function stop() {
        if (stopped) return;
        stopped = true;
        clearTimeout(expiry);
        clearTimeout(next);
        if (request) request.destroy();
        key.fill(0);
    }

    function schedule() {
        if (!stopped && !next) next = setTimeout(() => {
            next = null;
            poll();
        }, POLL_MS);
    }

    function poll() {
        if (stopped) return;
        request = https.get({
            hostname: HOST, path: '/' + topic + '/json?poll=1',
            lookup: dataDir ? useUplink(dataDir) : undefined
        }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                schedule();
                return;
            }
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
                if (body.length > 65536) { request.destroy(); schedule(); }
            });
            response.on('error', schedule);
            response.on('end', () => {
                if (stopped) return;
                for (const line of body.split('\n')) {
                    let item;
                    try { item = JSON.parse(line); } catch (_) { continue; }
                    if (item.event !== 'message' || item.topic !== topic) continue;
                    const token = decrypt(item.message, key, topic);
                    if (token) { stop(); onToken(token); return; }
                }
                schedule();
            });
        });
        request.setTimeout(7000, () => request.destroy());
        request.on('error', schedule);
    }

    poll();
    return { qr, stop };
}

module.exports = { start, decrypt };
