const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../static/js/research-data.js');
const root = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'static/data/research-cache/index.json'), 'utf8'));
function setup() {data.configure(registry, {baseURL:'https://example.test/data/research-cache/'});}
function response(text) {return {ok:true, status:200, text:async()=>text};}
test('offline fallback verifies source, query and SHA; bad responses preserve validated session data', async()=>{
  setup(); const spec=registry.datasets.find(d=>d.key==='livechart-levels');
  const saved=fs.readFileSync(path.join(root,'static/data/research-cache',spec.cache.file),'utf8');
  const fetch=async url=>url.includes('example.test')?response(saved):response('<html>not data</html>');
  const result=await data.load(spec.key,{fetch}); assert.equal(result.origin,'saved-cache');assert.equal(result.data.records[1].values.energy,4439.82);
  const next=await data.load(spec.key,{fetch:async()=>{throw new Error('network down');}});assert.equal(next.origin,'session-cache');assert.equal(next.data.raw_sha256,result.data.raw_sha256);
  await assert.rejects(data.load(spec.key,{query:{nuclides:'16o'},fetch}),/No validated data/);
  setup();await assert.rejects(data.load(spec.key,{fetch:async url=>url.includes('example.test')?response(saved+' '):response('0')}),/SHA-256 mismatch/);
});
test('timeouts fall back and unsupported radiation/query do not hit network',async()=>{
  setup();const spec=registry.datasets.find(d=>d.key==='livechart-ground-states');const saved=fs.readFileSync(path.join(root,'static/data/research-cache',spec.cache.file),'utf8');
  const result=await data.load(spec.key,{timeoutMs:5,fetch:async url=>url.includes('example.test')?response(saved):new Promise(()=>{})});assert.equal(result.origin,'saved-cache');assert.match(result.warnings.join(' '),/timeout/);
  await assert.rejects(data.load('livechart-bin-beta',{query:{rad_types:'g'},fetch:async()=>{throw new Error('must not fetch');}}),/radiation/);
});
test('all saved snapshots have actual SHA and source scientific metadata',()=>{
  for(const spec of registry.datasets){assert.ok(spec.cache,spec.key);const raw=fs.readFileSync(path.join(root,'static/data/research-cache',spec.cache.file));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),spec.cache.sha256);data.validate(JSON.parse(raw),spec,data.canonicalQuery(spec));}
});
test('B(E2) three units, spin factor and source W.u. remain explicit',()=>{
  assert.equal(data.be2Convert(1,40,'e2_b2','e2_fm4'),10000);
  assert.equal(data.be2Convert(1,40,'e2_b2','e2_b2','up','down'),.2);
  // The guide prints a rounded 0.297 coefficient. Preserve the source W.u.
  // separately; this explicit conversion need not reproduce its hidden precision.
  const wu=data.be2Convert(.00397,12,'e2_b2','Wu','up','up');assert.ok(Math.abs(wu-39.7/(.297*12**(4/3)))<1e-12);
  assert.ok(Math.abs(data.be2Convert(wu,12,'Wu','e2_b2','up','up')-.00397)<1e-12);
  assert.throws(()=>data.be2Convert(1,0));
});
test('CSV preserves quoted fields, state shifts, unknown errors and fission identities',()=>{
  const spec=registry.datasets.find(d=>d.key==='livechart-levels'),query=data.canonicalQuery(spec);
  const rows=data.normalizeLivechart('z,n,symbol,energy,unc_e,energy_shift,jp,ENSDF_authors\n6,6,C,120,,X,0+,"A, B"\n',spec,query);
  assert.equal(rows[0].state.kind,'unresolved');assert.equal(rows[0].uncertainties.energy,null);assert.equal(rows[0].source_fields.ENSDF_authors,'A, B');
  assert.throws(()=>data.normalizeLivechart('0',spec,query));
  const fy=registry.datasets.find(d=>d.key==='livechart-cumulative-fy');const body=JSON.parse(fs.readFileSync(path.join(root,'static/data/research-cache',fy.cache.file)));assert.equal(body.records[0].state.parent,'235U');assert.equal(body.records[0].state.id,'0');assert.equal(body.records[0].values.cumulative_thermal_fy,.06614);
});
