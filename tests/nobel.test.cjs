const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const N=require('../static/js/nobel-of-the-day.js');
const data=JSON.parse(fs.readFileSync('static/data/nobel-laureates.json','utf8'));
test('daily Nobel date follows Helsinki midnight through both DST transitions',()=>{
  for(const [before,after] of [['2026-10-09T20:59:59Z','2026-10-09T21:00:00Z'],['2026-03-28T21:59:59Z','2026-03-28T22:00:00Z'],['2026-10-25T21:59:59Z','2026-10-25T22:00:00Z']])assert.equal(N.helsinkiDay(new Date(after))-N.helsinkiDay(new Date(before)),1);
  assert.equal(N.helsinkiDay(new Date('2026-03-29T00:59:59Z')),N.helsinkiDay(new Date('2026-03-29T01:00:00Z')));
});
test('daily and Another sequence change subject and region, wrap once, and cover the collection',()=>{
  const entries=data.entries,start=N.indexForDay(20735,entries.length),seen=new Set();let index=start;
  for(let n=0;n<entries.length;n++){
    seen.add(entries[index].id);const next=N.nextIndex(index,entries.length);
    assert.notEqual(entries[index].category,entries[next].category);
    assert.notEqual(entries[index].region,entries[next].region);index=next;
  }
  assert.equal(index,start);assert.equal(seen.size,12);
  assert.equal(new Set(entries.map(e=>e.category)).size,6);
});
test('all five languages provide sourced reason, work and context for every profile',()=>{
  assert.equal(new Set(data.entries.map(e=>e.id)).size,data.entries.length);
  for(const e of data.entries){
    for(const l of ['en','zh','fi','de','ja'])for(const k of ['reason','work','context'])assert.ok(e.texts[l][k].trim().length>3,e.id+' '+l+' '+k);
    for(const url of Object.values(e.sources))assert.equal(new URL(url).hostname,'www.nobelprize.org');
    assert.ok(e.born&&e.birthplace);assert.ok(e.affiliations.length||e.residences.length);
    assert.ok(['1','1/2','1/3','1/4'].includes(e.portion));
  }
  assert.equal(data.entries.find(e=>e.id==='26-1921').year,1921);
  assert.match(JSON.parse(fs.readFileSync('data/nobel_labels.json')).en.economics,/Sveriges Riksbank/);
});
const directory=JSON.parse(fs.readFileSync('static/data/nobel-directory.json','utf8'));
test('complete registry preserves distinct recipients and multiple awards without duplication',()=>{
  assert.equal(directory.people.length,1026);assert.equal(directory.prize_records,688);
  assert.equal(new Set(directory.people.map(p=>p.id)).size,1026);
  assert.equal(directory.min_year,1901);assert.equal(directory.max_year,2026);
  assert.equal(directory.people.find(p=>p.id==='6').awards.length,2);
  for(const p of directory.people){assert.ok(p.name);assert.equal(new URL(p.url).hostname,'www.nobelprize.org');for(const a of p.awards)assert.ok(a.year>=1901&&a.year<=2026);}
});
test('directory combines category and year on the same award and searches accents',()=>{
  const fake=[{name:'Émile Person',awards:[{year:1903,category:'phy'},{year:1911,category:'che'}]}];
  assert.equal(N.filterDirectory(fake,'emile','phy','1911').length,0);
  assert.equal(N.filterDirectory(fake,'EMILE person','che','1911').length,1);
  assert.ok(N.filterDirectory(directory.people,'curie').length>=2);
  assert.equal(N.filterDirectory(directory.people,'not a laureate name').length,0);
  assert.equal(N.pageOf(directory.people).length,40);assert.equal(N.pageOf(directory.people,80).length,80);
  assert.equal(N.pageOf(directory.people,1040).length,1026);
});
test('each featured prize lists every recipient and shares sum to the whole prize',()=>{
  for(const e of data.entries){
    const expected=directory.people.filter(p=>p.awards.some(a=>a.year===e.year&&a.category===e.category));
    assert.deepEqual(e.award_people.map(p=>p.id).sort(),expected.map(p=>p.id).sort());
    assert.ok(e.award_people.some(p=>e.id.startsWith(p.id+'-')));
    assert.ok(Math.abs(e.award_people.reduce((s,p)=>s+Number(p.share.split('/')[0])/Number(p.share.split('/')[1]||1),0)-1)<1e-10);
    assert.match(e.announced,/^\d{4}-\d{2}-\d{2}$/);
    for(const lang of ['en','zh','fi','de','ja'])assert.ok(e.texts[lang].question.length>5);
  }
  assert.equal(data.entries.find(e=>e.id==='26-1921').announced,'1922-11-09');
});
