'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../static/js/mass-quantity-menu.js'),S=require('../static/js/mass-surface.js');
test('all 28 physical mass quantities appear once in the shared menu contract',()=>{
 const keys=Object.values(M.groups).flat();assert.equal(new Set(keys).size,28);
 assert.deepEqual([...keys].sort(),[...S.quantities].sort());
 assert.deepEqual(M.groups.separation,['sn','s2n','sp','s2p']);
});
test('chart, chain and popup share groups, preserving aliases and diagnostic extras',()=>{
 const labels=JSON.parse(fs.readFileSync('data/mass_filter_labels.json','utf8'));
 for(const t of Object.values(labels)){
  for(const k of [...Object.keys(M.groups),'other'])assert.ok(t['mf_group_'+k]);
  const canonical=Object.fromEntries(S.quantities.map(k=>[k,k])),front=Object.fromEntries(Object.entries(canonical).map(([k,v])=>[M.aliases[k]||k,v]));
  for(const items of [canonical,{...front,decay:'Decay',beta2:'β₂'}]){
   const html=M.html(items,t),ids=[...html.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]);
   assert.deepEqual(ids.slice(ids.indexOf('sn'),ids.indexOf('sn')+4),['sn','s2n','sp','s2p']);
   assert.equal(ids.length,Object.keys(items).length);assert.equal(new Set(ids).size,ids.length);
   assert.ok(!html.includes('undefined'));
  }
 }
});
test('all chart and chain physical choices and content-hashed menu dependency are wired',()=>{
 const code=fs.readFileSync('static/js/nuclide-chart.js','utf8'),template=fs.readFileSync('layouts/_shortcodes/nuclide-chart.html','utf8');
 assert.match(code,/be:\s*\{\s*label: T\.mf_be/);assert.match(code,/be:\s*\[T\.mf_be/);
 assert.equal((code.match(/ZGMassQuantityMenu\.html/g)||[]).length,3);
 assert.match(template,/js\/mass-quantity-menu\.js.*readFile.*sha256/);
});
