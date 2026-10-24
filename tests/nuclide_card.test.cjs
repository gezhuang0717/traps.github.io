const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const FS=require('../static/js/figure-style.js');
const source=fs.readFileSync('static/js/nuclide-chart.js','utf8');
const catalogue=JSON.parse(fs.readFileSync('static/data/nuclear-states.json'));
const chart=JSON.parse(fs.readFileSync('static/data/nubase2020.json'));
const states=new Map(catalogue.states.map(s=>[s.id,s]));
function helpers(extra={}){
 const context={escape:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),...extra};
 const defs=source.slice(source.indexOf('  const reactionDefinitions='),source.indexOf('  const MODES ='));
 const start=source.indexOf('  /* ---------- source/state presentation'),end=source.indexOf('  /* ---------- formatting:',start);
 assert.ok(start>0&&end>start);
 vm.createContext(context);vm.runInContext(defs+source.slice(start,end),context);return context;
}
test('AME mass display retains source precision and independent value/uncertainty flags',()=>{
 const h=helpers();
 assert.equal(h.referenceMassText({v:-91525.979,e:.096,est:false,sigmaEst:false}),'-91525.979 ± 0.096');
 assert.equal(h.referenceMassText({v:28667,e:2000,est:true,sigmaEst:true}),'28667# ± 2000#');
 assert.equal(h.referenceMassText({v:12,e:.2,est:false,sigmaEst:true}),'12 ± 0.2#');
 assert.equal(h.referenceMassText({v:12,e:null},'unknown'),'12 ± unknown');
 assert.equal(h.referenceMassText(null),'—');
});
test('NUBASE raw state mass and excitation are not replaced by AME ground-state precision',()=>{
 const h=helpers(),s=states.get('50-66-1');
 assert.equal(h.sourceQuantityText(s.mass_excess),'-89160.00 ± 0.10');
 assert.equal(h.sourceQuantityText(s.excitation),'2365.975 ± 0.021');
 assert.equal(h.sourceQuantityText({raw:'<12',raw_uncertainty:'',value:12,uncertainty:null,qualifier:'<'}),'<12');
 assert.equal(h.sourceQuantityText({raw:'stbl',value:null,uncertainty:null}),'stbl');
 assert.equal(h.sourceQuantityText({value:0,uncertainty:0}),'0 ± 0');
 assert.equal(h.sourceQuantityText({value:null,uncertainty:null}),'—');
});
test('derived energy formatting keeps value and uncertainty # markers independent',()=>{
 const h=helpers({unknown:'unknown'}),start=source.indexOf('  function fmtU('),end=source.indexOf('  const DM =',start);
 vm.runInContext(source.slice(start,end)+'\nthis.formatEnergy=fv;',h);
 assert.equal(h.formatEnergy({v:2,e:.1,est:false,sigmaEst:true}),'0.00200 ± 0.00010# MeV');
 assert.equal(h.formatEnergy({v:2,e:.1,est:true,sigmaEst:false}),'0.00200# ± 0.00010 MeV');
 assert.equal(h.formatEnergy({v:2,e:null,est:true,sigmaEst:false}),'0.002# MeV (unknown)');
});
test('every compact isomer preserves the source excitation and uncertainty, including all 256 # entries',()=>{
 const h=helpers();let extrapolated=0,total=0;
 for(const row of chart.rows)for(const iso of row[11]){
  const state=states.get(iso[7]);assert.ok(state,iso[7]);
  const displayed=h.isomerExcitationText(iso,state);
  assert.equal(displayed,h.sourceQuantityText(state.excitation),iso[7]);
  if(state.excitation.value_extrapolated){extrapolated++;assert.ok(displayed.includes('#'),iso[7]);}
  if(state.excitation.raw_uncertainty)assert.ok(displayed.endsWith('± '+state.excitation.raw_uncertainty),iso[7]);
  total++;
 }
 assert.equal(extrapolated,256);assert.ok(total>1000);
 assert.equal(h.isomerExcitationText(['m',4500,'','',200,1,1]),'4500# ± 200#');
});
test('published reaction rendering preserves evaluated σ, units and missing values without public hashes',()=>{
 const h=helpers(),data={quantities:['qbm','BEA','q2bm'],metadata:{quantity_units:{BEA:'keV/nucleon'},sources:[{table:'mass',url:'https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt'}]},records:{'63,92':{element:'Eu',values:{qbm:{value:251.9612,uncertainty:.8682,raw:'251.9612',raw_uncertainty:'0.8682'},BEA:{value:8200,uncertainty:.01,raw:'8200',raw_uncertainty:'0.01'},q2bm:{value:null,uncertainty:null,raw:'*'}}}}};
 const text=h.publishedReferenceHTML(data,63,92,h.cardLabels('en'));
 assert.match(text,/251\.9612 ± 0\.8682 keV/);assert.match(text,/8200 ± 0\.01 keV\/nucleon/);
 assert.match(text,/Q\(2β⁻\)<\/th><td>— keV/);assert.match(text,/155 Eu \[g\]/);
 assert.doesNotMatch(text,/SHA|sha256|null|NaN/);assert.match(text,/mass correlations/);
 assert.match(h.publishedReferenceHTML(null,63,92,h.cardLabels('zh')),/未能载入/);
});
test('chart CSV exports the published 155Eu Qβ uncertainty and every newly available reaction column',()=>{
 const P=require('../static/js/physics.js'),S=require('../static/js/mass-surface.js'),E=require('../static/js/ame-evaluated.js');
 const table=JSON.parse(fs.readFileSync('static/data/ame2020-reactions.json')),evaluated=E.fromData(table);
 const masses=new Map(chart.rows.map(r=>[r[0]*1000+r[1],r]));
 const get=(z,n)=>{const r=masses.get(z*1000+n);return r?P.primitive('AME2020:'+(z*1000+n),r[3],r[4],!!r[5],!!r[13]):null;};
 const surface=S.create(()=>get,{MEn:get(0,1),MEH:get(1,0),MEa:get(2,2)},()=>null,(z,n,q)=>evaluated.get(z,n,q));
 const eu=masses.get(63092),button={},saved=[];
 const context={window:{ZGMassSurface:S},src:'ame',MOD:{},key:(z,n)=>z*1000+n,derived:r=>surface.derive(r[0],r[1]),allRows:()=>[eu],pass:()=>true,filt:'all',root:{querySelector:()=>button},X:{csv:(...args)=>saved.push(args)}};
 const start=source.indexOf('  const csvRow ='),end=source.indexOf('  root.querySelector("[name=nc-line-width]")',start);
 const line=source.split('\n').find(x=>x.includes('root.querySelector("[data-nc=csv]").onclick'));
 vm.runInNewContext(source.slice(start,end)+'\n'+line,context);button.onclick();
 const [header,rows]=saved[0];assert.equal(rows.length,1);assert.equal(rows[0].length,header.length);
 assert.equal(Number(rows[0][header.indexOf('Qbeta-_MeV')]),.2519612);
 assert.equal(Number(rows[0][header.indexOf('dQbeta-_MeV')]),.0008682);
 assert.equal(rows[0][header.indexOf('Qbeta-_source')],'AME2020 published table');
 assert.equal(rows[0][header.indexOf('Qbeta-_uncertainty_basis')],'AME2020 evaluated table; mass correlations retained');
 assert.match(rows[0][header.indexOf('D3n_uncertainty_basis')],/^diagonal primitive covariance/);
 assert.equal(rows[0][header.indexOf('D3n_source')],'AME2020 marginal masses; recalculated');
 assert.ok(header.includes('BE/A_MeV_per_nucleon')&&header.includes('dBE/A_MeV_per_nucleon'));
 assert.ok(!header.includes('BE/A_MeV'));
 for(const q of S.quantities.filter(q=>q.startsWith('q')&&!['qbm','qec','qa'].includes(q)))for(const suffix of ['_MeV','_flag','_value_extrapolated','_uncertainty_extrapolated','_uncertainty_basis','_source'])assert.ok(header.includes(q+suffix),q+suffix);
});
test('actual chart CSV keeps asymmetric # flags, absent quantities and tabulated versus recalculated basis',()=>{
 const S=require('../static/js/mass-surface.js'),row=[50,66,'Sn',0,0,0,0,'','','','',[]],button={},saved=[];
 const d={me:{v:-91525.979,e:.096,est:false,sigmaEst:true,source:'AME2020 published table',uncertainty_model:'AME2020 evaluated table; mass correlations retained'},
  BEA:{v:8523.1166,e:.0009,est:true,sigmaEst:false,source:'AME2020 published table',uncertainty_model:'AME2020 evaluated table; mass correlations retained'},
  d3n:{v:100,e:2,est:false,sigmaEst:true,uncertainty_model:'diagonal primitive covariance; repeated inputs combined'}};
 const context={window:{ZGMassSurface:S},src:'ame',MOD:{},key:(z,n)=>z*1000+n,derived:()=>d,allRows:()=>[row],pass:()=>true,filt:'all',root:{querySelector:()=>button},X:{csv:(...args)=>saved.push(args)}};
 const start=source.indexOf('  const csvRow ='),end=source.indexOf('  root.querySelector("[name=nc-line-width]")',start);
 const line=source.split('\n').find(x=>x.includes('root.querySelector("[data-nc=csv]").onclick'));
 vm.runInNewContext(source.slice(start,end)+'\n'+line,context);button.onclick();
 const [header,rows]=saved[0],get=k=>rows[0][header.indexOf(k)];
 assert.equal(rows[0].length,header.length);assert.equal(new Set(header).size,header.length);
 assert.equal(get('ME_flag'),'');assert.equal(get('ME_value_extrapolated'),false);assert.equal(get('ME_uncertainty_extrapolated'),true);
 assert.equal(get('BE/A_flag'),'#');assert.equal(get('BE/A_value_extrapolated'),true);assert.equal(get('BE/A_uncertainty_extrapolated'),false);
 assert.equal(get('BE/A_MeV_per_nucleon'),'8.5231166');
 assert.equal(get('D3n_flag'),'');assert.equal(get('D3n_uncertainty_extrapolated'),true);
 assert.match(get('D3n_uncertainty_basis'),/^diagonal/);assert.equal(get('D3n_source'),'AME2020 marginal masses; recalculated');
 for(const suffix of ['_MeV','_flag','_value_extrapolated','_uncertainty_extrapolated','_uncertainty_basis','_source'])assert.equal(get('Sn'+suffix),'');
});
test('chain CSV keeps evaluated and independent uncertainty provenance distinct',()=>{
 const button={},saved=[],base={r:[63,92,'Eu'],g:63,x:92,y:.2519612,e:.0008682,est:false,series:'ame',source:'AME2020',valueObj:{uncertainty_model:'AME2020 evaluated table; mass correlations retained',source:'AME2020 published table',sigmaEst:true}};
 const style=FS.normalize();
 const context={root:{querySelector:()=>button},plotDomain:{x0:90,x1:94,y0:0,y1:1},plotPts:[base],modPts:[],residualPts:[],PQ:{qbm:['Q(β⁻)',null,'MeV']},pq:{value:'qbm'},pchain:{value:'Z'},MOD:{},seriesMeta:()=>({shape:'circle'}),MM:{provenance:()=>[]},inputTable:null,measured:{hash:()=>''},residualDomain:null,pointColor:()=>'blue',chainInput:()=>({checked:false}),X:{csv:(...args)=>saved.push(args)},FS,chainStyle:()=>style,chainFigureStyle:{valid:()=>true}};
 const start=source.indexOf('  root.querySelector("[data-nc=pcsv]").onclick'),end=source.indexOf('  /* ---------- events',start);
 vm.runInNewContext(source.slice(start,end),context);button.onclick();
 let [header,rows]=saved[0];assert.equal(rows[0][header.indexOf('uncertainty_basis')],base.valueObj.uncertainty_model);
 assert.equal(rows[0][header.indexOf('uncertainty')],.0008682);
 assert.equal(rows[0].length,header.length);assert.equal(rows[0][header.indexOf('source')],'AME2020 published table');
 assert.deepEqual(JSON.parse(rows[0][header.indexOf('figure_style_json')]),style);assert.equal(saved[0][2],'chain-qbm');
 assert.equal(rows[0][header.indexOf('flag')],'');assert.equal(rows[0][header.indexOf('value_extrapolated')],false);assert.equal(rows[0][header.indexOf('uncertainty_extrapolated')],true);
 base.est=true;base.valueObj={uncertainty_model:'diagonal primitive covariance; repeated inputs combined',sigmaEst:false};button.onclick();
 [header,rows]=saved[1];assert.match(rows[0][header.indexOf('uncertainty_basis')],/^diagonal primitive covariance/);
 assert.equal(rows[0][header.indexOf('flag')],'#');assert.equal(rows[0][header.indexOf('value_extrapolated')],true);assert.equal(rows[0][header.indexOf('uncertainty_extrapolated')],false);
});
function domHarness(language,selected='50-66-1'){
 const empty=()=>({value:'',textContent:'',innerHTML:'',setAttribute(){},appendChild(){},focus(){}});
 const info=empty(),note=empty(),box=empty(),select=empty(),input=empty();select.value='isomer';let buttons=[];
 Object.defineProperty(box,'innerHTML',{get:()=>box.html||'',set:html=>{box.html=html;buttons=[...html.matchAll(/data-state="([^"]+)"/g)].map(m=>({...empty(),dataset:{state:m[1]}}));}});
 box.querySelectorAll=()=>buttons;
 const slots={'select':select,'input':input,'.nc-state-data':info,'.nc-state-buttons':box,'.nc-state-status':empty(),'.nc-state-reset':empty()};
 const panel={...empty(),querySelector:q=>slots[q],querySelectorAll:()=>buttons};
 const card={...empty(),querySelector:q=>q==='.nc-ground-context'?note:empty(),querySelectorAll:()=>[],appendChild:p=>{card.panel=p;},insertAdjacentHTML(){}};
 const group=catalogue.states.filter(s=>s.Z===50&&s.A===116),window={};window.parent=window;
 const T=new Proxy({state_kinds:{ground:'ground',isomer:'isomer'},state_bases:{},state_unknown:'?'},{get:(o,k)=>o[k]??String(k)});
 const ground={me:{v:-91525.979,e:.096},BEA:{v:8523.116587586206,e:.0008646403}};
 const h=helpers({card,T,unknown:'?',catalog:{groups:new Map([['sn116',group]]),states},selectedState:selected,evaluatedData:null,evaluatedWarning:false,
  src:'ame',MOD:{},EL:[],derived:()=>ground,derivedZN:()=>ground,sup:n=>String(n),facts:()=>[],decayText:()=>'',measured:null,
  fv:(v,d=3,f=1000,u=' MeV')=>v?v.v/f+u:'—',channelItems:()=>'',document:{createElement:tag=>tag==='div'?panel:empty()},window,
  location:{href:'https://example.test/lab/?nuclide=116Sn'},URL,history:{pushState(){}}});
 h.cardT=h.cardLabels(language);
 const start=source.indexOf('  function showCard(r)'),end=source.indexOf('  /* ---------- chain plot',start);
 vm.runInContext(source.slice(start,end),h);
 return {h,card,info,note,buttons:()=>buttons};
}
for(const language of ['en','zh'])test(language+': selecting an isomer labels the main card ground-state and changes only the separate NUBASE panel',()=>{
 const t=domHarness(language),row=chart.rows.find(r=>r[0]===50&&r[1]===66);
 t.h.showCard(row);
 assert.ok(t.card.innerHTML.includes(t.h.cardT.ground));assert.ok(t.card.innerHTML.includes(t.h.cardT.ame));
 assert.match(t.card.innerHTML,/-91525\.979 ± 0\.096 keV/);assert.match(t.card.innerHTML,/MeV\/nucleon/);
 assert.match(t.info.innerHTML,/-89160\.00 ± 0\.10/);assert.match(t.info.innerHTML,/2365\.975 ± 0\.021/);
 assert.match(t.note.textContent,/116Sn \[m\]/);
 t.buttons().find(b=>b.dataset.state==='50-66-0').onclick();
 assert.match(t.info.innerHTML,/-91525\.98 ± 0\.10/);assert.match(t.note.textContent,/116Sn \[g\]/);
 assert.match(t.card.innerHTML,/-91525\.979 ± 0\.096 keV/);
 t.buttons().find(b=>b.dataset.state==='50-66-2').onclick();
 assert.match(t.info.innerHTML,/-87978\.82 ± 0\.20/);assert.match(t.note.textContent,/116Sn \[n\]/);
});
