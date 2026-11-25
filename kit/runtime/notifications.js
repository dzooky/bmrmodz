'use strict';

const fs = require('fs');
const path = require('path');

function preferencePath(dataDir, key) {
    return path.join(dataDir, 'notifications', key);
}

function read(dataDir, key, fallback) {
    try {
        return fs.readFileSync(preferencePath(dataDir, key), 'utf8') === 'on';
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return fallback;
    }
}

function write(dataDir, key, enabled) {
    const file = preferencePath(dataDir, key);
    const dir = path.dirname(file);
    try { fs.mkdirSync(dir); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const temporary = file + '.' + process.pid + '.tmp';
    try {
        fs.writeFileSync(temporary, enabled ? 'on' : 'off', { mode: 0o664 });
        fs.renameSync(temporary, file);
    } catch (error) {
        try { fs.unlinkSync(temporary); } catch (ignored) {}
        throw error;
    }
}

function discover(oapDir, appId, key) {
    for (const name of fs.readdirSync(oapDir)) {
        if (!name.startsWith('oap_')) continue;
        const root = path.join(oapDir, name);
        try {
            const spec = JSON.parse(fs.readFileSync(path.join(root, 'source', 'javascript', 'kit', 'app-spec.json'), 'utf8'));
            if (spec.id !== appId) continue;
            const setting = (spec.settings || []).find(s => s.key === key && s.type === 'bool' && s.notification === true);
            if (setting) return { dataDir: path.join(root, 'data'), setting };
        } catch (error) {
            if (!(error instanceof SyntaxError) && !['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
        }
    }
    return null;
}

module.exports = { read, write, discover };
