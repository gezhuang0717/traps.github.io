const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/game_workflows.json'), 'utf8'));
const languages = ['en', 'zh', 'fi', 'de', 'ja', 'fr'];
const fields = ['purpose', 'inputs', 'outputs', 'gain', 'hint', 'limits'];

test('Games workflow registry has explicit complete six-language role labels and topic text', () => {
  assert.equal(registry.schema_version, 1);
  assert.deepEqual(registry.languages, languages);
  assert.deepEqual(Object.keys(registry.labels).sort(), [...languages].sort());
  for (const lang of languages) {
    assert.deepEqual(Object.keys(registry.labels[lang]).sort(), ['title', ...fields].sort());
    for (const text of Object.values(registry.labels[lang])) assert.ok(typeof text === 'string' && text.trim());
  }
  for (const [key, topic] of Object.entries(registry.topics)) {
    assert.deepEqual(Object.keys(topic.text).sort(), [...languages].sort(), key);
    for (const lang of languages) {
      assert.deepEqual(Object.keys(topic.text[lang]).sort(), [...fields].sort(), `${key}/${lang}`);
      for (const field of fields) {
        const text = topic.text[lang][field];
        assert.ok(typeof text === 'string' && text.trim().length >= 10, `${key}/${lang}/${field}`);
        assert.ok(!/<\/?(?:script|button|input|canvas|section)\b/i.test(text), 'Copy must not create duplicate controls or cards');
        if (lang !== 'en') assert.notEqual(text, topic.text.en[field], `Silent English fallback: ${key}/${lang}/${field}`);
      }
    }
  }
});

test('Games topics target existing group containers once and cite only existing public source files', () => {
  assert.deepEqual(Object.keys(registry.topics).sort(), ['half_life', 'tof', 'pi', 'mr', 'rfq', 'quiz', 'periodic', 'cooling', 'gallery', 'spectroscopy_trail'].sort());
  const used = new Set();
  for (const [key, topic] of Object.entries(registry.topics)) {
    assert.ok(Array.isArray(topic.source_files) && topic.source_files.length > 0, key);
    const sources = topic.source_files.map(file => {
      assert.ok(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), file);
      assert.ok(fs.statSync(path.join(root, file)).isFile(), file);
      return fs.readFileSync(path.join(root, file), 'utf8');
    }).join('\n');
    assert.equal(topic.selectors.length, 1, 'One guide per topic group; variants retain their own control hints');
    for (const selector of topic.selectors) {
      assert.ok(!used.has(selector), `Duplicate target ${selector}`);
      used.add(selector);
      if (selector.startsWith('#')) assert.ok(sources.includes(`id="${selector.slice(1)}"`), `${key}: missing ${selector}`);
      else if (selector.startsWith('.')) {
        assert.equal(selector, '.zg-trapzoo');
        assert.ok(sources.includes('class="zg-trapzoo"'));
      } else {
        assert.equal(selector, '[data-spectroscopy-games]');
        assert.match(sources, /\sdata-spectroscopy-games(?:\s|>)/);
      }
    }
  }
});

test('Documented exported formats have corresponding source actions, while quizzes and gallery claim no numeric export', () => {
  const source = key => registry.topics[key].source_files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  for (const key of ['tof', 'pi', 'mr', 'rfq', 'cooling']) {
    const text = source(key);
    assert.match(text, /(?:data-act|data-wb|data-paul-act)="png"/, key);
    assert.match(text, /(?:data-act|data-wb|data-paul-act)="csv"/, key);
  }
  assert.match(source('rfq'), /recordPanel/);
  assert.match(source('cooling'), /data-(?:act|paul-act)="video"/);
  for (const key of ['half_life', 'quiz', 'gallery', 'spectroscopy_trail']) assert.doesNotMatch(registry.topics[key].text.en.outputs, /\b(?:PNG|CSV|JSON|video export)\b/);
});
