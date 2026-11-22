'use strict';
// Test the visible preview action even when no DDE profile has been identified.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const main = fs.readFileSync(__dirname + '/main.js', 'utf8');
const m = main.match(/ctx\.settings\.onAction\('regenClusterTest', \(\) => \{([\s\S]*?)\n        \}\);/);
assert(m, 'Missing regeneration preview action');
const callbacks = {};
let clock = null;
const sandbox = {
  ctx: {settings: {onAction: (key,cb) => {callbacks[key] = cb;},
    values: {cluster6wbAvailable: true}}},
  // These must not be needed to trigger a manual visual preview:
  profile: undefined,
  log: {info: () => {}},
  Date: {now: () => 12345},
  clusterTestStartedAt: null
};
vm.runInNewContext("ctx.settings.onAction('regenClusterTest', () => {" + m[1] + "\n});", sandbox);
callbacks.regenClusterTest();
assert.strictEqual(sandbox.clusterTestStartedAt,12345,'Preview must run without a DDE');
assert(!m[1].includes('profile'),'Preview action must never depend on a DDE profile');
assert(!m[1].includes('regeneration'),'Preview action must never depend on a regeneration state');
assert(main.includes("ctx.settings.values.cluster6wbAvailable === true && ctx.settings.get('regenCluster') === true"),
       'Live cluster equipment/user gate must remain');
assert(main.includes('profile && profile.regeneration'),'Live B47 guard must remain');
assert(!main.includes("': detected'"),'Settings must not expose detected message');
console.log('DPF preview without DDE: passed');
