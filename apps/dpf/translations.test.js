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
  'Language handling now uses the OSA controller',
  'Correct Settings text after repeated page renders',
  'Install required Data Tool version for DPF testing',
  "Data Tool read", "Data Tool error", "TASU read", "TASU error",
  "Separate Data Tool and TASU read diagnostics",
  "Diagnostics",
  "DPF DIAGNOSTICS",
  "Diagnostic checks are passive",
  "TASU connection",
  "Data Tool connection",
  "Selected transport",
  "DDE identification",
  "DDE index",
  "Last DDE read",
  "Last DID",
  "Last issue",
  "Not checked",
  "Checking",
  "Responding",
  "Unavailable",
  "No response",
  "Negative response",
  "Identified",
  "Unsupported DDE",
  "Failed",
  "Ready",
  "Legacy TASU",
  "None",
  "TASU unavailable",
  "DDE did not respond",
  "DDE identification failed",
  "Data Tool request failed",
  "Unexpected data length",
  "Built-in DPF connection diagnostics",
  'Longer Data Tool response window for DDE identification',
  'DDE recovery', 'Retrying', 'Recovered',
  'Retry DDE identification after TASU rejection',
  'Avoid competing TASU sessions during Data Tool reads',
  'Use Data Tool (experimental)',
  'Experimental Data Tool reads with automatic fallback',
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

test('DPF uses exactly the OSA language controller with app-specific references', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const dpf = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8');
  const osa = fs.readFileSync(path.join(__dirname, '../osa/language.js'), 'utf8');
  const expected = osa
    .replace("require('./locales')", "require('./translations')")
    .replace("        BTN_PAGE: 'Next page',\n        BTN_PREV: 'Previous page',\n        BTN_SETTINGS: 'Settings',",
      "        BTN_SETTINGS: 'Settings',")
    .replace(/SID_OSA_SET_/g, 'SID_DPF_SET_')
    .replace(/OSA setting language/g, 'DPF setting language');
  assert.equal(dpf, expected, 'DPF language implementation must stay identical to OSA');
  assert.match(main, /Language\.start\(ctx\)/);
  assert.doesNotMatch(main, /function updateAutomaticLanguage\(/);
  assert.doesNotMatch(main, /function applyLanguage\(/);
});

test('reused DPF Recorder never stacks text auto-fit and Settings retains native font size', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const start = main.indexOf('function render() {');
  const end = main.indexOf("            if (page === 'detail') {", start);
  assert.ok(start >= 0 && end > start, 'render prefix must be present');
  const prefix = main.slice(start, end);
  assert.match(prefix, /delete cv\.text;/);
  assert.ok(prefix.indexOf('delete cv.text;') < prefix.indexOf("if (page === 'settings')"),
    'must reset the reused Recorder before Settings renders');
  const renderPrefix = new Function(
    'ctx', 'settingsCanvas', 'G', 'ui', 'TABS', 'translate', 'page', 'W', 'H',
    prefix + '\nreturn cv;\n}\nreturn render();'
  );
  const calls = [];
  class FakeRecorder {
    clear() { return this; }
    text(value, x, y, size) { calls.push({ value, size }); return 200; }
    textWidth() { return 200; }
  }
  const recorder = new FakeRecorder();
  const nativeText = recorder.text;
  const ctx = { canvas: () => recorder, theme: () => ({ bg: '#000' }) };
  const settingsCanvas = {
    draw(cv) { cv.text('English (auto)', 1500, 110, 32, '#fff', { align: 'right' }); }
  };
  const G = { frame() {} };
  const ui = { image: () => recorder };
  const args = [ctx, settingsCanvas, G, ui, ['Overview', 'Detail', 'Settings', 'About'], x => x];
  renderPrefix(...args, 'overview', 1600, 520);
  recorder.text('test', 1500, 110, 32, '#fff', { align: 'right' });
  const firstSize = calls.at(-1).size;
  assert.ok(firstSize < 32, 'non-Settings pages must retain width fitting');
  renderPrefix(...args, 'overview', 1600, 520);
  recorder.text('test', 1500, 110, 32, '#fff', { align: 'right' });
  assert.equal(calls.at(-1).size, firstSize, 'auto-fit must not compound across frames');
  renderPrefix(...args, 'settings', 1600, 520);
  assert.equal(calls.at(-1).size, 32, 'Settings language must draw at native size');
  assert.equal(recorder.text, nativeText, 'Settings must use the unmodified Recorder text method');
  renderPrefix(...args, 'overview', 1600, 520);
  renderPrefix(...args, 'settings', 1600, 520);
  assert.equal(calls.at(-1).size, 32, 'font size must survive repeated tab switches');
});
