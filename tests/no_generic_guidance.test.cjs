const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

test('cached pages cannot generate generic guides or alter existing instructions', () => {
  let touched = false;
  const document = new Proxy({}, {get() { touched = true; throw Error('Existing page must remain untouched'); }});
  const window = {document};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'static/js/tool-workflows.js'), 'utf8'), {window});
  window.TrapsToolWorkflows.mount(document);
  window.TrapsToolWorkflows.mount(document);
  assert.equal(touched, false);
});

test('new pages load no automatic guidance payload/assets or generic media profile', () => {
  const partial = fs.readFileSync(path.join(root, 'layouts/_partials/zg/tool-workflows.html'), 'utf8');
  assert.doesNotMatch(partial, /<(?:script|link|div)|data-tool-workflows-config/);
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/lab_workflows.json'), 'utf8'));
  assert.equal(data.topics.media, undefined);
  assert.doesNotMatch(JSON.stringify(data), /Use this figure or video|pixels do not add measurement precision/);
});
