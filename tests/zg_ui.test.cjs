const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class E {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.textContent = ''; this.attrs = {}; this.nodeType = 1; }
  append(...n) { this.children.push(...n); }
  setAttribute(k, v) { this.attrs[k] = v; }
}
function load(notes) {
  const doc = { createElement: t => new E(t), getElementById: id => id === 'zg-figure-notes' && notes ? { textContent: JSON.stringify(notes) } : null };
  const ctx = { window: null, module: undefined }; ctx.window = ctx; ctx.document = doc; ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/zg-ui.js'), 'utf8'), ctx);
  return ctx.ZGUI;
}
const text = n => n.textContent + n.children.map(text).join('|');

test('tile carries label, value, unit, tone and hint', () => {
  const U = load();
  const t = U.tile({ k: 'q', v: '0.4', u: 'mm', tone: 'ok', hint: 'explained' });
  assert.equal(t.className, 'zg-tile ok');
  assert.equal(t.attrs.title, 'explained');
  assert.equal(text(t), '|q|0.4|mm'.replace(/^\|/, ''));
});

test('unknown tones fall back to info; group wraps tiles under a heading', () => {
  const U = load();
  assert.equal(U.badge('x', 'nonsense').className, 'zg-badge info');
  const g = U.group('Plane', 'bad', [{ k: 'a', v: '1' }, { k: 'b', v: '2' }]);
  assert.equal(g.className, 'zg-rgroup bad');
  assert.equal(g.children[0].textContent, 'Plane');
  assert.equal(g.children[1].children.length, 2);
});

test('lead takes the first sentence and shortens long text', () => {
  const U = load();
  assert.equal(U.lead('First sentence here. Second one follows.'), 'First sentence here.');
  assert.ok(U.lead('x'.repeat(300)).length <= 91);
});

test('figure notes: block, plain lines, missing id', () => {
  const U = load({ mathieu: { title: 'Stability', summary: 'Bands.', items: [['q', 'RF'], ['a', 'DC'], ['•', 'selected point']] } });
  assert.equal(U.notes('absent'), null);
  assert.equal(U.notesBlock('absent'), null);
  assert.equal(JSON.stringify(U.notesLines('mathieu', 2)), JSON.stringify(['Stability', 'q: RF', 'a: DC']));
  const block = U.notesBlock('mathieu');
  assert.match(block.className, /zg-fold zg-fig-fold/);
  assert.match(text(block), /selected point/);
});
