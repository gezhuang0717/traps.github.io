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
