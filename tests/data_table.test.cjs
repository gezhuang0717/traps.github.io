const test = require('node:test');
const assert = require('node:assert/strict');
const DT = require('../static/js/data-table.js');

class Node {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.className = ''; this.textContent = ''; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.value = ''; this.parent = null; }
  append(...n) { n.forEach(c => { c.parent = this; this.children.push(c); }); }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  before(n) { const i = this.parent.children.indexOf(this); n.parent = this.parent; this.parent.children.splice(i, 0, n); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  dispatchEvent(e) { (this.listeners[e.type] || []).forEach(f => f(e)); return true; }
  closest() { return null; }
  querySelector(sel) { const all = n => [n, ...n.children.flatMap(all)]; const tag = sel.split(':')[0].split(' ').pop(); return all(this).slice(1).filter(n => n.tag === tag).pop() || null; }
}
const doc = { createElement: t => new Node(t, doc) };
function setup(opts = {}) {
  const parent = doc.createElement('div'), ta = doc.createElement('textarea'); parent.append(ta);
  const events = []; ta.addEventListener('input', e => events.push(e.type));
  globalThis.Event = class { constructor(type) { this.type = type; } };
  const t = DT.mount(ta, { columns: [{ label: 'x', unit: 'GHz·u', hint: 'x hint' }, { label: 'σ', hint: 'σ hint', optional: true }], labels: {}, ...opts });
  return { ta, t, events, parent };
}
const cells = parent => { const all = n => [n, ...n.children.flatMap(all)]; return all(parent).filter(n => n.tag === 'input'); };

test('text -> table: comments skipped, cells split on comma/semicolon/tab/space, short rows padded', () => {
  const { ta, t } = setup(); ta.value = '# comment\n1,0.1\n2;0.2\n3\t0.3\n4 \n\n'; t.refresh();
  assert.deepEqual(t.rows(), [['1', '0.1'], ['2', '0.2'], ['3', '0.3'], ['4', '']]);
});
test('table -> text: rows are written back as comma lines, empty trailing cells dropped, and an input event is fired once per edit', () => {
  const { ta, t, events, parent } = setup(); ta.value = '1,0.1\n2'; t.refresh();
  const inputs = cells(parent); assert.equal(inputs.length, 4);
  inputs[3].value = '0.5'; inputs[3].listeners.input.forEach(f => f());
  assert.equal(ta.value, '1,0.1\n2,0.5'); assert.equal(events.length, 1);
  inputs[1].value = ''; inputs[1].listeners.input.forEach(f => f());
  assert.equal(ta.value, '1\n2,0.5');
});
test('a text edit rebuilds the table; the table edit does not rebuild itself (focus survives)', () => {
  const { ta, t, parent } = setup(); ta.value = '1,2'; t.refresh();
  const before = cells(parent)[0];
  before.value = '9'; before.listeners.input.forEach(f => f());
  assert.equal(cells(parent)[0], before, 'same input element after a table edit');
  ta.value = '5,6\n7,8'; ta.dispatchEvent(new Event('input'));
  assert.equal(cells(parent).length, 4);
});
test('custom parse/format and parse errors are reported without losing the text', () => {
  const { ta, t } = setup({ parse: text => { if (text === 'bad') throw new Error('nope'); return text.split('|').map(x => [x, '']); }, format: rows => rows.map(r => r[0]).join('|') });
  ta.value = 'a|b'; t.refresh(); assert.deepEqual(t.rows(), [['a', ''], ['b', '']]);
  ta.value = 'bad'; t.refresh(); assert.equal(ta.value, 'bad');
});
test('pure helpers', () => {
  assert.deepEqual(DT.parseText('# x\n1, 2 ,3\n4;5'), [['1', '2', '3'], ['4', '5']]);
  assert.equal(DT.formatRows([['1', '2', ''], ['', '', ''], ['3', '', '']]), '1,2\n3');
});
