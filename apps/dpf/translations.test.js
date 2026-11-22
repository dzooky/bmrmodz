'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const translations = require('./translations');
const required = [
  'Supports B57 and B47 DDE with validated soot, ash and distances.',
  'Regeneration status and advanced detail are verified on B57 only.',
  'Additional B47 measurements are not verified yet',
  'Soot, ash and regeneration distances are available in Overview',
  'DISTANCE TO AVG REGEN',
  'Countdown to average; +km after average',
  'B47 core gauges with automatic DDE detection',
  'Started alert translated into all languages',
  'New Started alert on regeneration begin',
  'Cluster notification settings require detected 6WB',
  'Reload Equipment', 'Reload',
  'Equipment reload failed', 'Equipment read error',
  'Check in progress', 'Reloading...', 'Reload failed',
  'Read vehicle equipment again',
  'Four alerts: Requested (yellow), Started and In Progress (red), Finished (green)'
];

test('all 21 non-English DPF locales have aligned nonempty translations', () => {
  const codes = Object.keys(translations);
  assert.equal(codes.length, 21);
  const reference = Object.keys(translations.sk).sort();
  for (const code of codes) {
    const catalog = translations[code];
    assert.deepEqual(Object.keys(catalog).sort(), reference, code + ' keys differ');
    for (const key of reference) {
      assert.equal(typeof catalog[key], 'string', code + ': ' + key);
      assert.ok(catalog[key].trim(), code + ': ' + key);
    }
    for (const key of required) {
      assert.ok(catalog[key], code + ' missing ' + key);
      assert.notEqual(catalog[key], key, code + ' untranslated ' + key);
    }
  }
});

test('new Detail B47 texts pass through localization', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.ok(!/Additional B47 measurements are not verified yet'[^;]+literal: true/s.test(main));
  assert.match(main, /page === 'detail' && \(size === 18 \|\| opts\.align === 'right'\)/);
});

test('selected Settings language uses readable type size', () => {
  const sheet = fs.readFileSync(path.join(__dirname, '../../kit/runtime/sheet.js'), 'utf8');
  assert.match(sheet, /row\.key === 'language' \? 32 : 26/);
  assert.match(sheet, /key: s\.key, label: s\.label/);
});
