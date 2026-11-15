'use strict';

const form = document.querySelector('form');
const input = document.querySelector('#token');
const button = document.querySelector('button');
const status = document.querySelector('#status');
const params = new URLSearchParams(location.hash.slice(1));
const keyHex = params.get('key') || '';
const topic = params.get('topic') || '';
const expires = Number(params.get('expires'));
history.replaceState(null, '', location.pathname + location.search);
const ready = /^[a-f0-9]{64}$/.test(keyHex) && /^bmr-sp-[a-f0-9]{32}$/.test(topic)
    && Number.isSafeInteger(expires) && expires > Date.now() && window.isSecureContext && window.crypto && window.crypto.subtle;
button.disabled = !ready;
if (!ready) status.textContent = 'Scan a new QR code from My Car.';

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || button.disabled) return;
    if (Date.now() >= expires) {
        status.textContent = 'Pairing expired. Scan a new QR code.';
        button.disabled = true;
        return;
    }
    const token = input.value.trim();
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(token)) {
        status.textContent = 'Paste your personal access token from Spritmonitor.';
        return;
    }

    button.disabled = true;
    status.textContent = 'Sending encrypted token...';
    try {
        const keyBytes = Uint8Array.from(keyHex.match(/../g), byte => parseInt(byte, 16));
        const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
            additionalData: encoder.encode(topic) }, key, encoder.encode(token));
        const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        const reply = await fetch('https://ntfy.virtualka.dzooky.eu/' + topic, {
            method: 'POST', body: hex(iv) + '.' + hex(new Uint8Array(sealed)),
            credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
        });
        if (!reply.ok) throw new Error('Relay unavailable');
        input.value = '';
        status.textContent = 'Sent. Select your vehicle on the My Car screen.';
    } catch (_) {
        status.textContent = 'Could not send. Check your connection and try again.';
        button.disabled = false;
    }
});
