const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class E {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.textContent = ''; this.attrs = {}; this.nodeType = 1; this.dataset = {}; this.after_ = []; }
  after(...n) { this.after_.push(...n); }
  replaceChildren(...n) { this.children = n; }
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

test('attachNotes puts one explanation block after each marked figure, once, and skips unknown ids', () => {
  const U = load({ a: { title: 'A', summary: 's', items: [['x', 'y']] }, b: { title: 'B', summary: 's', items: [['x', 'y']] } });
  const one = new E('canvas'); one.dataset.figureNote = 'a';
  const two = new E('div'); two.dataset.figureNote = 'a missing b';
  const root = { querySelectorAll: () => [one, two] };
  assert.equal(U.attachNotes(root), 3);
  assert.equal(one.after_.length, 1);
  assert.equal(two.after_.length, 1);
  assert.equal(two.after_[0].after_.length, 1, 'the second block follows the first');
  assert.equal(U.attachNotes(root), 0, 'second call changes nothing');
});

test('ionText: state letter after the element, charge as superscript', () => {
  const U = load();
  assert.equal(U.ionText('133Xe[m] +1'), '133Xem⁺');
  assert.equal(U.ionText('133Xe +1'), '133Xe⁺');
  assert.equal(U.ionText('133Cs +2'), '133Cs²⁺');
  assert.equal(U.ionText('100Sn +12'), '100Sn¹²⁺');
  assert.equal(U.ionText('94Ag'), '94Ag');
  assert.equal(U.ionText('133Xe[m]'), '133Xem');
  assert.equal(U.ionText('12C11 +1'), '12C11⁺');
  assert.equal(U.ionText('A = 100'), 'A = 100');
  assert.equal(U.ionText('133Xe / 133Xe[m]'), '133Xe / 133Xem');
});

test('pills turn a status line into pills, keep the separators in the text, and leave short or marked-up text alone', () => {
  const U = load();
  const el = new E('p'); el.textContent = '133Xe / 133Xe[m]: Eₓ = 233 keV · Δφ = 27.4° · R ≈ 1.8e6 · ✔ separated';
  assert.equal(U.pills(el), true);
  const row = el.children[0]; assert.equal(row.className, 'zg-pillrow');
  const pillsOnly = row.children.filter(c => /zg-pill/.test(c.className) && c.className !== 'zg-pillrow');
  assert.equal(pillsOnly.length, 4);
  assert.match(pillsOnly[3].className, /ok/);
  assert.equal(row.children.filter(c => c.className === 'zg-sep').length, 3);
  const short = new E('p'); short.textContent = 'one · two'; assert.equal(U.pills(short), false);
  const marked = new E('p'); marked.textContent = 'a · b · c'; marked.children.push(new E('b')); assert.equal(U.pills(marked), false);
});
