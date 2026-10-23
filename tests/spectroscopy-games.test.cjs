const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../static/js/spectroscopy-games.js');

test('eight deterministic rounds span four different reasoning families', () => {
  assert.equal(G.questions.length, 8);
  assert.equal(new Set(G.questions.map(q => q.id)).size, 8);
  assert.deepEqual(G.questions.map(q => q.family), ['source', 'hfs', 'shift', 'gamma', 'source', 'hfs', 'shift', 'gamma']);
  for (const q of G.questions) {
    assert.equal(q.choices.length, 3);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.match(G.sources[q.source].url, /^https:\/\//);
  }
});

test('an answer is counted once; next is gated; final round and reset are bounded', () => {
  const game = G.createSession();
  assert.equal(game.next().index, 0);
  for (let index = 0; index < 8; index++) {
    const q = game.state().question;
    assert.equal(game.answer(-1).answered, false);
    assert.equal(game.answer('0').answered, false);
    assert.equal(game.answer(99).answered, false);
    assert.equal(game.answer(q.answer).score, index + 1);
    assert.equal(game.answer((q.answer + 1) % 3).score, index + 1);
    assert.equal(game.state().tried, index + 1);
    if (index < 7) assert.equal(game.next().index, index + 1);
  }
  assert.equal(game.state().complete, true);
  assert.equal(game.next().index, 7);
  assert.equal(game.state().tried, 8);
  const reset = game.reset();
  assert.deepEqual([reset.index, reset.score, reset.tried, reset.answered, reset.complete], [0, 0, 0, false, false]);
});

test('wrong answers give no score and independent sessions never share progress', () => {
  const first = G.createSession(), second = G.createSession();
  for (const q of G.questions) { first.answer((q.answer + 1) % 3); first.next(); }
  assert.equal(first.state().score, 0);
  assert.equal(first.state().tried, 8);
  assert.equal(second.state().tried, 0);
  first.reset(); first.answer(0); first.next(); first.reset();
  assert.equal(first.state().index, 0);
});

test('independent rule and energy checks include forbidden, reversed and invalid cases', () => {
  assert.equal(G.passesFRule(1, 2), true);
  assert.equal(G.passesFRule(2, 4), false);
  assert.equal(G.passesFRule(0, 0), false);
  assert.equal(G.passesFRule(0, 1), true);
  assert.equal(G.passesFRule(1.5, 2.5), true);
  for (const pair of [[1, 1.5], [-1, 0], [NaN, 1], [0.2, 1.2], [Infinity, 0]]) assert.equal(G.passesFRule(...pair), false);
  assert.equal(G.photonEnergy(900, 300), 600);
  assert.equal(G.photonEnergy(1200, 500) + G.photonEnergy(500, 0), 1200);
  assert.equal(G.isotopeShift(80, 100), -20);
  assert.equal(G.isotopeShift(100, 130), -30);
  assert.equal(G.isotopeShift(130, 100), 30);
  for (const args of [[300, 900], [-1, 0], [Infinity, 0], ['900', 300]]) assert.throws(() => G.photonEnergy(...args));
  assert.throws(() => G.isotopeShift(NaN, 1));
});

test('every prompt, explanation, option and control is present in all five languages', () => {
  for (const value of [...Object.values(G.labels), ...G.questions.flatMap(q => [q.prompt, q.explanation, ...q.choices])]) {
    for (const lang of G.languages) assert.ok(typeof G.getText(value, lang) === 'string' && G.getText(value, lang).trim());
    if (typeof value === 'object') assert.deepEqual(Object.keys(value), G.languages);
  }
  assert.equal(G.getText(G.labels.next, 'unknown'), G.labels.next.en);
});

class Element {
  constructor(doc) { this.ownerDocument = doc; this.dataset = {}; this.children = []; this.attributes = {}; this.events = {}; this.textContent = ''; this.hidden = false; }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, callback) { this.events[name] = callback; }
  click() { if (!this.disabled) this.events.click?.(); }
  focus() { this.ownerDocument.activeElement = this; }
}
function section(lang) {
  const doc = {createElement() { return new Element(doc); }};
  const node = new Element(doc), fields = {};
  node.dataset.lang = lang;
  for (const name of ['stage', 'options', 'feedback', 'next', 'reset', 'question', 'progress', 'round', 'score', 'card', 'family', 'symbol', 'loading']) fields[name] = new Element(doc);
  node.querySelector = selector => fields[selector.slice(9, -1)];
  return {node, fields, doc};
}

test('two mounted components keep local controls, sources, focus and reset state', () => {
  const first = section('zh'), second = section('de');
  const scope = {querySelectorAll: () => [first.node, second.node]};
  G.mountAll(scope); G.mountAll(scope);
  assert.equal(first.fields.reset.events.click instanceof Function, true);
  assert.equal(first.fields.progress.attributes['aria-label'], G.labels.progress.zh);
  assert.equal(first.fields.loading.hidden, true);
  assert.equal(first.fields.stage.hidden, false);
  assert.equal(first.fields.next.disabled, true);
  first.fields.options.children[1].click(); // Wrong first answer.
  assert.equal(first.fields.score.textContent, '得分 0 / 1');
  assert.equal(first.fields.feedback.children[3].href, G.sources.asd.url);
  assert.equal(first.fields.options.children[0].dataset.result, 'correct');
  assert.equal(first.fields.options.children[1].dataset.result, 'wrong');
  assert.equal(first.doc.activeElement, first.fields.feedback);
  assert.equal(second.fields.score.textContent, 'Punkte 0 / 0');
  first.fields.next.click();
  assert.equal(first.fields.question.textContent, G.questions[1].prompt.zh);
  assert.equal(first.doc.activeElement, first.fields.question);
  first.fields.reset.click();
  assert.equal(first.fields.score.textContent, '得分 0 / 0');
  assert.equal(first.fields.feedback.hidden, true);
  for (const q of G.questions) { first.fields.options.children[q.answer].click(); first.fields.next.click(); }
  assert.equal(first.fields.score.textContent, '得分 8 / 8');
  assert.equal(first.fields.progress.value, 8);
  assert.equal(first.fields.next.disabled, true);
  assert.equal(first.fields.next.textContent, G.labels.complete.zh);
});

test('shortcode uses scoped data attributes without global element IDs', () => {
  const html = fs.readFileSync(path.join(__dirname, '../layouts/_shortcodes/spectroscopy-games.html'), 'utf8');
  assert.doesNotMatch(html, /\sid=/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /data-spectroscopy-games/);
});
