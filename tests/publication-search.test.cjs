const {test}=require('node:test'), assert=require('node:assert/strict');
const {normalize,matches,mount}=require('../static/js/publication-search.js');
test('combined search, accent folding, second and independent corresponding roles',()=>{
  const record={e:{dataset:{year:'2026',role:'first',position:'1',corresponding:'false',themes:'nz detectors'}},text:normalize('Jyväskylä Ge detector DOI 10.1234/test')};
  const filter={words:['jyvaskyla','ge'],year:'2026',role:'first',topic:'detectors'};
  assert.equal(matches(record,filter),true);
  for(const change of [{role:'corresponding'},{role:'second'},{year:'2025'},{topic:'neutrino'},{words:['missing']}])assert.equal(matches(record,{...filter,...change}),false);
  record.e.dataset.role='coauthor';record.e.dataset.position='2';record.e.dataset.corresponding='true';
  assert.equal(matches(record,{...filter,role:'corresponding'}),true);
  assert.equal(matches(record,{...filter,role:'second'}),true);
});
test('filter and reset update descending numbers, section counts, empty headings and years',()=>{
  const element=(dataset={})=>({dataset,hidden:false,attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.listeners[k]=v;}});
  const papers=Array.from({length:24},(_,i)=>({...element({year:i<2?'2026':'2025',role:'first',position:'1',corresponding:'true',themes:'neutrino'}),textContent:'Ge test '+i,querySelectorAll:()=>[]}));
  const controls=Object.fromEntries(['query','year','role','topic'].map(k=>[k,{value:'',focus(){this.focused=true;}}]));
  const count=element(),empty=element(),reset=element(),heading={tagName:'H2'},sectionCount={dataset:{total:'24'}},year={nextElementSibling:{querySelectorAll:()=>papers}};
  const list={...element(),querySelectorAll:()=>papers};
  const section={...element(),previousElementSibling:heading,querySelector:()=>sectionCount,querySelectorAll:()=>papers};
  const root={...element({papersLabel:'records'}),querySelector(s){return s.startsWith('[name=pub-')?controls[s.slice(10,-1)]:({'[data-pub-count]':count,'[data-pub-empty]':empty,'[data-pub-reset]':reset})[s];}};
  const doc={querySelector:()=>root,querySelectorAll:s=>({'.zg-paper':papers,'[data-pub-section]':[section],'ol.zg-papers':[list],'.zg-year':[year]})[s]};
  mount(doc);
  assert.equal(list.attrs.start,'24');assert.equal(papers[0].attrs.value,'24');assert.equal(papers[23].attrs.value,'1');
  controls.year.value='2026';root.listeners.change();
  assert.equal(count.textContent,'2 / 24 records');assert.equal(sectionCount.textContent,'2 / 24 records');assert.equal(papers[0].attrs.value,'2');assert.equal(papers[1].attrs.value,'1');
  controls.query.value='no-such-paper';root.listeners.input();
  assert.equal(empty.hidden,false);assert.equal(section.hidden,true);assert.equal(heading.hidden,true);assert.equal(year.hidden,true);
  reset.listeners.click();
  assert.equal(count.textContent,'24 / 24 records');assert.equal(empty.hidden,true);assert.equal(heading.hidden,false);assert.equal(year.hidden,false);assert.equal(controls.query.focused,true);assert.equal(papers[0].attrs.value,'24');
});
