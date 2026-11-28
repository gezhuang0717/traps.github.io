const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../static/js/chain-plot.js'),P=require('../static/js/physics.js'),E=require('../static/js/ame-evaluated.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'static/data',name),'utf8'));
const masses26=read('ame2026.json'),reaction26=read('ame2026-reactions.json'),states26=read('nuclear-states2026.json'),nuclides26=read('nubase2026.json'),manifest=read('ame2026-source-manifest.json');
test('AME2026 evaluated ground mass/NUBASE2026 state catalogue source identity',()=>{
 assert.equal(masses26.metadata.name,'AME2026');assert.match(states26.source.name,/NUBASE2026/);
 assert.equal(masses26.rows.length,3723);assert.equal(nuclides26.rows.length,3725);assert.equal(states26.states.length,6151);
 assert.equal(manifest.validation.status,'PASS');assert.equal(manifest.validation.central_values,55120);
 assert.equal(manifest.sources.length,4);assert.ok(manifest.sources.every(s=>s.sha256.length===64));
});
test('2026 evaluated reaction adapter retains published uncertainty and edition, no 2020 source',()=>{
 const e=E.fromData(reaction26);assert.equal(e.edition,'AME2026');
 const table=e.get(1,2,'s2n');assert.ok(table&&table.value>0);
 const out=E.apply(P.primitive('AME2026:1002',table.value+12,50),table);
 assert.equal(out.published,true);assert.equal(out.uncertainty_model,'AME2026 evaluated table; mass correlations retained');
 assert.equal(out.source,'AME2026 published table');assert.equal(out.e,table.uncertainty);
});
test('2020 evaluated adapter remains source compatible',()=>{
 const x=E.fromData(read('ame2020-reactions.json'));assert.equal(x.edition,'AME2020');
 assert.match(E.apply(P.primitive('AME2020:1',3,1),x.get(1,1,'sn')).uncertainty_model,/AME2020/);
});
test('chain merge checkbox classification detects AME2026 source mixed with loaded ion',()=>{
 const terms={
  'loaded:50-66-0':{c:1,v:-100,e:.1},
  'AME2026:51065':{c:-1,v:-200,e:.2},
  'AME2026:1000':{c:1,v:8000,e:0}};
 const result=C.composition({terms});
 assert.deepEqual(result.ame,['AME2026:51065']);assert.equal(result.mixed,true);
 assert.equal(C.composition({terms:{'loaded:X':{c:1,v:1,e:1},'AME2026:1':{c:1,v:1,e:1}}}).mixed,false);
 assert.equal(C.composition({terms:{'loaded:X':{c:1,v:1,e:1},'AME2020:51065':{c:1,v:1,e:1}}}).mixed,true);
});
test('public chart uses default 2026 but historical 2020 data URLs are explicit',()=>{
 const html=fs.readFileSync(path.join(root,'layouts/_shortcodes/nuclide-chart.html'),'utf8');
 const script=fs.readFileSync(path.join(root,'static/js/nuclide-chart.js'),'utf8');
 for(const name of ['ame2026.json','nubase2026.json','nuclear-states2026.json','ame2026-reactions.json',
                    'ame2020.json','nubase2020.json','nuclear-states.json','ame2020-reactions.json'])
   assert.ok(html.includes(name),name);
 assert.ok(script.includes("get('evaluation')==='2020'?'2020':'2026'"));
 assert.match(script,/nc-edition/);assert.match(script,/dataset\.activeEvaluation/);
 assert.ok(!script.includes('P.primitive("AME2020:"+key(Z,N)'), 'mass primitive must follow selected edition');
});
test('RFQ cinema shares ideal integrator and exposes one video recorder for both perspectives',()=>{
 const js=fs.readFileSync(path.join(root,'static/js/rfq-trajectory-cinema.js'),'utf8');
 const tab=fs.readFileSync(path.join(root,'layouts/_partials/zg/rfq-cinema.html'),'utf8');
 for(const action of ['ZGRFQExtras','ZGRFQMotionView','ZGRFQPlayback','run','frames'])
   assert.ok(js.includes(action),action);
 assert.equal((js.match(/ZGRFQPlayback\.mount/g)||[]).length,1);
 assert.ok(tab.includes('data-rfq-cinema-2d')&&tab.includes('data-rfq-cinema-3d'));
 assert.match(js,/NOT a 3D field solver/i);
});

test('AME2026 versus AME2020 uses authenticated masses, not a metadata-only empty heatmap',()=>{
 const script=fs.readFileSync(path.join(root,'static/js/nuclide-chart.js'),'utf8');
 const ST=require('../static/js/chart-stats.js');
 const prev=read('ame2020.json'),latest=read('ame2026.json');
 assert.equal(prev.metadata.name,'AME2020');
 assert.equal(latest.metadata.name,'AME2026');
 const old=new Map(prev.rows.map(r=>[r[0]*1000+r[1]-r[0],r[3]]));
 let differences=0,checked=0;
 for(const r of latest.rows){
   const reference=old.get(r[0]*1000+r[1]-r[0]);
   if(reference===undefined)continue;
   checked++;if(Math.abs(r[3]-reference)>0.005)differences++;
 }
 assert.ok(checked>=3400,'real shared evaluation identities');
 assert.ok(differences>1000,'different editions have physically different mass excesses');
 assert.ok(script.includes('result.ame2020=new Map(oldMass.rows.map'));
 assert.ok(script.includes('Cross-edition covariance unavailable'));
 const overview=ST.editionRows({ame2026:{
   nuclides:3723,measured:3000,estimated:723,
   nubase:{table:'NUBASE2026',isomers:2200,nuclides_with_isomers:1500,
     other_excited_states:300}}});
 assert.equal(overview[0].label,'AME2026');
 assert.equal(overview[0].nuclides,3723);
});

test('2026−2020 evaluation comparison has real localised quantities and no fabricated covariance',()=>{
 const labels=fs.readFileSync(path.join(root,'data/nuclide_chart_labels.yaml'),'utf8');
 const script=fs.readFileSync(path.join(root,'static/js/nuclide-chart.js'),'utf8');
 const values=[...labels.matchAll(/^  m_dame20: "([^"]+)"/gm)].map(m=>m[1]);
 assert.equal(values.length,6,'All six site languages must name the real comparison');
 for(const value of values){
   assert.match(value,/AME2026.*AME2020/);
   assert.match(value,/keV/);
   assert.doesNotMatch(value,/AME2020.*AME2016/);
 }
 assert.match(values[1],/质量过剩差/,'Chinese comparison must not silently fall back to English');
 assert.match(values[4],/質量過剰差/,'Japanese comparison must not silently fall back to English');
 assert.match(script,/dame20: \{label: T\.m_dame20/);
 assert.match(script,/PQ\[name\] = \[T\["m_" \+ name\]/);
 assert.match(script,/Cross-edition covariance unavailable/);
 assert.match(script,/e:null/,'Mass differences are not assigned fake uncertainties');
});
test('changes to user-adopted measured masses invalidate automatic colour range and derived cache',()=>{
 const script=fs.readFileSync(path.join(root,'static/js/nuclide-chart.js'),'utf8');
 assert.match(script,/src = s; memo\.clear\(\); autoCache\.clear\(\); dripCache\.clear\(\)/);
 assert.match(script,/inputTable=table;memo\.clear\(\);autoCache\.clear\(\)/);
 assert.match(script,/drawLegend\(\);draw\(\);syncColourControls\(\);plotChain\(\)/);
});
