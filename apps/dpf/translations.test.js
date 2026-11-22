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
  'Four alerts: Requested (yellow), Started and In Progress (red), Finished (green)',
  'Run',
  'Language selection aligned with OSA',
  'English (auto) language value readability',
  'Run button translated into all languages',
  'Additional translations and Detail text sizing'
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

test('DPF Settings uses OSA sheet rendering for English auto language', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const start = main.indexOf("function render() {");
  const canvas = main.indexOf("const cv = ctx.canvas(W, H).clear(t.bg);", start);
  const sheet = main.indexOf("settingsCanvas.draw(cv, t);", canvas);
  const override = main.indexOf("cv.text = (value, x, y, size, colour, options) =>", canvas);
  assert.ok(canvas >= 0 && sheet > canvas && override > sheet,
    'Settings must render before the DPF-specific auto-fit override');
  const settings = main.slice(canvas, override);
  assert.match(settings, /if \(page === 'settings'\)/);
  assert.match(settings, /return ui\.image\('MAIN_GFX', cv\)/);
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
  assert.deepEqual(app.settings.find(s => s.key === 'language').options[0], ['en', 'English']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '../osa/app.json'), 'utf8')).settings.find(s => s.key === 'language').options[0], ['en', 'English']);
});

test('DPF main Settings renders English auto legibly without changing other language rows', () => {
  const { listSheet } = require('../../kit/runtime/sheet');
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
  const language = { ...app.settings.find(s => s.key === 'language') };
  language.options = language.options.map(([code, label]) => code === 'en' ? ['auto', label + ' (auto)'] : [code, label]);
  const canvas = () => {
    const calls = [];
    const r = {
      calls, extra: 0,
      text(value, x, y, size) { calls.push({ value, size }); },
      textWidth(value, size) { return String(value).length * size * 0.5; },
      clear() {}, roundRect() {}, strokeRoundRect() {}, clip() {}, noclip() {},
      circle() {}, line() {}
    };
    return r;
  };
  const theme = { bg: '#000000', text: '#ffffff', dim: '#cccccc', accent: '#4488ff' };
  const current = { value: 'English (auto)' };
  const settings = {
    schema: [language], shown: () => true,
    get: () => 'auto',
    display: () => current.value,
    set() {}, cycle() {}
  };
  const sheet = listSheet(settings, 'Settings', { version: app.version });
  const english = canvas();
  sheet.draw(english, theme);
  assert.ok(english.calls.some(c => c.value === 'English (auto)' && c.size === 32));
  current.value = 'Deutsch';
  const german = canvas();
  sheet.draw(german, theme);
  assert.ok(german.calls.some(c => c.value === 'Deutsch' && c.size === 32));
  sheet.choose(); // open the full language list; list item labels stay at their normal size
  const opened = canvas();
  sheet.draw(opened, theme);
  assert.ok(opened.calls.some(c => c.value === 'English (auto)' && c.size === 28));
});

test('DPF uses the same English auto option normalization as OSA', () => {
  const dpf = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const osa = fs.readFileSync(path.join(__dirname, '../osa/language.js'), 'utf8');
  assert.match(osa, /languageSetting\.options = languages\.map/);
  assert.match(dpf, /setting\.options = options;/);
  assert.match(dpf, /languageOptions = ctx\.settings\.item\('language'\)\.options\.map\(option => option\.slice\(\)\)/);
  assert.ok(!dpf.includes("label.replace(/ \\(auto\\)$/"));
});
