const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../static/js/periodic-table-core.js');
const data=JSON.parse(fs.readFileSync(__dirname+'/../static/data/periodic-table.json','utf8')),m=P.createModel(data);
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}; tol ${t}`);

test('Model loads 118 elements; group and period follow the grid (f-block has period but no group)',()=>{
 assert.equal(m.elements.length,118);
 assert.deepEqual([m.bySym.H,m.bySym.He,m.bySym.Hf].map(P.groupOf),[1,18,4]);
 assert.deepEqual([m.bySym.H,m.bySym.La,m.bySym.Lr,m.bySym.Og].map(P.periodOf),[1,6,7,7]);
 assert.equal(P.groupOf(m.bySym.La),null);
 assert.throws(()=>P.createModel({elements:[]}),TypeError);
});
test('Ionisation energy converts eV to kJ/mol with the stored factor (H: 1312.0 kJ/mol)',()=>{
 near(P.value(m,m.bySym.H,'ie','eV'),13.598,1e-9);near(P.value(m,m.bySym.H,'ie','kJ/mol'),1312.0,0.2);
 assert.equal(P.unitFor(m,'ie','kJ/mol'),'kJ/mol');assert.equal(P.unitFor(m,'ie'),'eV');assert.equal(P.unitFor(m,'mp'),'K');
 assert.equal(P.value(m,m.bySym.Og,'ie','eV'),null);assert.equal(P.value(m,m.bySym.Fe,'year'),null); // "Ancient" is not numeric
});
test('Number formatting uses a decimal comma for fi/de/fr and keeps significant digits',()=>{
 assert.equal(P.formatNumber(13.598,'en'),'13.598');assert.equal(P.formatNumber(13.598,'de'),'13,598');assert.equal(P.formatNumber(3695,'fr'),'3695');
 assert.equal(P.formatNumber(null,'en'),'—');assert.equal(P.formatNumber(0.000123456,'en',3),'0.000123');
 assert.match(P.formatValue(m,m.bySym.Fe,'ie','fi','kJ/mol'),/^762,\d+ kJ\/mol$/);
});
test('Localised values: block, state, origin list and year',()=>{
 assert.equal(P.formatValue(m,m.bySym.Fe,'block','de'),'Übergangsmetall');assert.equal(P.formatValue(m,m.bySym.Hg,'state','ja'),'液体');
 assert.equal(P.formatValue(m,m.bySym.Li,'origin','en'),'Big Bang fusion + Cosmic-ray fission (spallation) + Dying low-mass stars');
 assert.equal(P.formatValue(m,m.bySym.Fe,'year','en'),'Ancient');assert.equal(P.formatValue(m,m.bySym.Og,'year','en'),'2006');
 assert.match(P.formatValue(m,m.bySym.Cd,'iso','en'),/113Cd 12\.22 %/);
});
test('Origin gradient: single colour for one source, equal hard-stop stripes for several',()=>{
 const c=m.i18n.origins.color;assert.equal(P.originGradient(['b'],c),c.b);
 const g=P.originGradient(['y','o'],c);assert.match(g,/^linear-gradient\(135deg, /);assert.ok(g.includes(`${c.y} 0.00% 50.00%`)&&g.includes(`${c.o} 50.00% 100.00%`));
 assert.ok(P.originGradient(['g','c','y'],c).includes('33.33% 66.67%'));
});
test('Cell styles: striped origin cells keep dark text, single-source cells pick contrast text, highlight dims the rest',()=>{
 const s=P.cellStyle(m,m.bySym.Au,'origin');assert.ok(s.striped&&s.color==='#111111'&&s.background.startsWith('linear-gradient'));
 const h=P.cellStyle(m,m.bySym.H,'origin');assert.equal(h.striped,false);assert.equal(h.background,m.i18n.origins.color.b);
 const d=P.cellStyle(m,m.bySym.H,'block',{highlight:new Set(['He'])});assert.equal(d.dim,true);assert.equal(P.cellStyle(m,m.bySym.He,'block',{highlight:new Set(['He'])}).dim,false);
 assert.equal(P.textColor('#ffffff'),'#111111');assert.equal(P.textColor('#000000'),'#ffffff');
});
test('Heat scale spans the ramp ends, handles missing values and logarithmic axis',()=>{
 const s=P.heatScale(m,'mass');near(s.min,m.bySym.H.mass);assert.equal(s.color(s.min),P.RAMP[0]);assert.equal(s.color(s.max),P.RAMP[4]);assert.equal(s.color(null),null);
 const c=P.cellStyle(m,m.bySym.Og,'heat',{key:'ie'});assert.equal(c.missing,true);
 const l=P.heatScale(m,'density',undefined,true);assert.equal(l.log,true);const mid=l.color(Math.sqrt(l.min*l.max));assert.notEqual(mid,P.RAMP[0]);
 assert.equal(P.heatScale(m,'ea',undefined,true).log,false); // zeros present: log is not applicable
});
test('Legend counts match the data and every element has at least one origin class',()=>{
 const n=P.legendCounts(m);for(const [c,k] of Object.entries(n))assert.equal(k,m.elements.filter(e=>e.origin.includes(c)).length);
 assert.ok(m.elements.every(e=>e.origin.length>=1));assert.equal(n.z,26); // Tc, Pm, Am-Lr (9) and Rf-Og (15)
 assert.ok(n.o>40&&n.g>30,JSON.stringify(n));
});
test('Search: symbol first, then Z, then names in any language; diacritics and case ignored',()=>{
 assert.equal(P.search(m,'fe')[0],'Fe');assert.equal(P.search(m,'26')[0],'Fe');assert.equal(P.search(m,'Eisen')[0],'Fe');assert.equal(P.search(m,'鉄')[0],'Fe');
 assert.equal(P.search(m,'hydrogene')[0],'H');assert.equal(P.search(m,'Wasserstoff')[0],'H');assert.equal(P.search(m,'氢')[0],'H');
 assert.equal(P.search(m,'')[0],undefined);assert.ok(P.search(m,'ium').length>40);assert.equal(P.search(m,'zzzz').length,0);
});
test('Trends: group 1 has 7 members, period 6 has 32 (f-block included), Z trend has 118 points with gaps kept',()=>{
 assert.deepEqual(P.trend(m,'group',1,'mass').map(p=>p.sym),['H','Li','Na','K','Rb','Cs','Fr']);
 assert.equal(P.trend(m,'period',6,'mass').length,32);assert.equal(P.trend(m,'period',1,'mass').length,2);
 const t=P.trend(m,'z',0,'ie');assert.equal(t.length,118);assert.equal(t[117].y,null);near(t[0].y,13.598);
});
test('Nice ticks follow the 1-2-5 rule',()=>{
 assert.deepEqual(P.niceTicks(0,100,6),[0,20,40,60,80,100]);assert.deepEqual(P.niceTicks(0,1,6),[0,0.2,0.4,0.6,0.8,1]);assert.deepEqual(P.niceTicks(3,3),[3]);
});
test('Find game: +10 / -5 scoring, new target after a hit, countdown ends the game',()=>{
 const g=P.createFindGame(m,{rng:P.makeRng(7),seconds:3});const t=g.target;
 assert.equal(g.guess(t==='H'?'He':'H').correct,false);assert.equal(g.score,-5);
 const r=g.guess(t);assert.equal(r.correct,true);assert.equal(g.score,5);assert.notEqual(g.target,t);assert.equal(g.rounds,1);
 g.tick(2);assert.equal(g.finished,false);g.tick(2);assert.equal(g.timeLeft,0);assert.equal(g.finished,true);assert.equal(g.guess(g.target).ignored,true);
 const free=P.createFindGame(m,{rng:P.makeRng(1)});assert.equal(free.timeLeft,null);free.tick(100);assert.equal(free.finished,false);
});
test('Origin game (select): finding all members wins; wrong clicks are penalised once',()=>{
 const g=P.createOriginGame(m,{rng:P.makeRng(3),target:'c'});const members=[...g.members];assert.ok(members.includes('Fe')&&!members.includes('H'));
 assert.equal(g.click('H').correct,false);assert.equal(g.score,-5);g.click('H');assert.equal(g.score,-5);
 let last;for(const s of members)last=g.click(s);assert.equal(last.done,true);assert.equal(g.finished,true);assert.equal(g.score,-5+10*members.length);
 assert.equal(g.click('Fe').ignored,true);g.restart('b');assert.equal(g.finished,false);assert.deepEqual([...g.members],['H','He','Li']);
});
test('Origin game (which): four options with one valid source and three invalid ones',()=>{
 const g=P.createOriginGame(m,{rng:P.makeRng(11),mode:'which'});
 for(let k=0;k<50;k++){const q=g.question,e=m.bySym[q.sym];assert.equal(q.options.length,4);assert.equal(q.options.filter(c=>e.origin.includes(c)).length,1);
  const right=q.options.find(c=>e.origin.includes(c)),wrong=q.options.find(c=>!e.origin.includes(c));
  const before=g.score;const res=k%2?g.answer(right):g.answer(wrong);assert.equal(res.correct,!!(k%2));assert.equal(g.score-before,k%2?10:-5);}
});
