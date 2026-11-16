'use strict';
// Translation by 小白151 / JackieZ123430. Offline localization regression checks.
const assert = require('assert'), fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const root = path.resolve(__dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'kit/runtime/locales/zh-CN.json'), 'utf8'));
const rows = fs.readFileSync(path.join(root, 'kit/runtime/locales/zh-CN.tsv'), 'utf8').split(/\r?\n/).filter(x => x && !x.startsWith('#'));
const tsv = {}; rows.forEach(x => { const at = x.indexOf('\t'); tsv[x.slice(0, at)] = x.slice(at + 1); });
assert.deepStrictEqual(tsv, catalog);
const source = fs.readFileSync(path.join(root, 'kit/runtime/i18n.js'), 'utf8');
const ctx = {require: n => { assert.strictEqual(n, './locale.json'); return {language:'en',strings:catalog}; }, module:{exports:{}}, Map, Set};
vm.runInNewContext(source, ctx);
Object.keys(catalog).forEach(text => assert.strictEqual(ctx.module.exports.t(text), text, 'English changed'));
const ids = fs.readdirSync(path.join(root,'apps')).filter(id => fs.existsSync(path.join(root,'apps',id,'app.json')));
for (const id of ids) {
    const staged = path.join(root,'dist',id,'source/javascript/kit');
    const locale = JSON.parse(fs.readFileSync(path.join(staged,'locale.json'),'utf8'));
    assert.strictEqual(locale.language,'zh-CN');
    assert.deepStrictEqual(locale.strings,catalog);
    assert.ok(locale.credit.includes('小白151'));
    const fonts = require(path.join(staged,'fonts'));
    let total = 0;
    for (const file of fs.readdirSync(path.join(staged,'fonts')).filter(f=>f.endsWith('.json'))) {
        const atlas=JSON.parse(fs.readFileSync(path.join(staged,'fonts',file),'utf8'));
        for (const size of atlas.sizes) {
            assert.ok(size.atlasW <= 1024 && size.atlasH <= 4096);
            assert.strictEqual(zlib.inflateSync(Buffer.from(size.alpha,'base64')).length,size.atlasW*size.atlasH);
            total += size.atlasH+1;
        }
    }
    assert.ok(total < 8192,'renderer atlas budget');
    for (const text of Object.values(catalog).concat(locale.credit)) {
        const font = fonts.get('label',32,text);
        for (const ch of text) if (!/\s/.test(ch)) assert.ok(font.glyphs[ch.codePointAt(0)], id+': missing '+ch+' in '+text);
    }
    const spec = JSON.parse(fs.readFileSync(path.join(staged,'app-spec.json'),'utf8'));
    const original = JSON.parse(fs.readFileSync(path.join(root,'apps',id,'app.json'),'utf8'));
    assert.strictEqual(spec.id, original.id);
    assert.deepStrictEqual((spec.settings||[]).map(x=>[x.key,x.default,(x.options||[]).map(o=>o[0])]),(original.settings||[]).map(x=>[x.key,x.default,(x.options||[]).map(o=>o[0])]));
    console.log('PASS '+id+': Chinese catalog, credits, glyphs, atlas budget and setting values');
}
console.log('PASS English fallback and TSV/JSON parity');

