/* UI adapter; private inputs stay in memory unless the visitor explicitly saves. */
(function(host){
  'use strict';
  function attach(root,T,catalog,base,onchange){
    const MM=host.ZGMeasuredMasses,P=host.ZGPhysics,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const panel=root.querySelector('.nc-measured'),body=panel.querySelector('tbody'),status=panel.querySelector('.nc-mass-status'),error=panel.querySelector('.nc-mass-error');
    const paste=panel.querySelector('[name=nc-mass-paste]'),policy=panel.querySelector('[name=nc-mass-policy]');
    const storageKey=host.ZGIndependentPanels?.storageKey(location.search)||'traps.measured-masses.v1';let raw=[],table=MM.build(raw,catalog),page=0,hash='',revision=0,timer,previousActive=0;
    const exampleKind=panel.querySelector('[name=nc-mass-example]'),exampleText=panel.querySelector('[name=nc-mass-example-text]');
    function example(){
      const a=base(50,66).v+10,kind=exampleKind.value,unit=kind==='be'?'MeV':kind==='atomic'?'u':'keV',quantity=kind==='be'?'BE':kind==='atomic'?'mass':'ME';
      const value=kind==='be'?((50*base(1,0).v+66*base(0,1).v-a)/1000).toFixed(12):kind==='atomic'?(116+a/P.C.uKeV).toFixed(13):a.toFixed(3);
      const sigma=kind==='be'?'0.001':kind==='atomic'?(1/P.C.uKeV).toPrecision(14):'1';
      const row={nuclide:'116Sn',value,uncertainty:sigma,unit,quantity,reference:'SYNTHETIC +10 keV; not a measurement'};
      const sep=kind==='tsv'?'\t':',';
      exampleText.value=kind==='json'?JSON.stringify([row],null,2):Object.keys(row).join(sep)+'\n'+Object.values(row).join(sep);
    }
    exampleKind.addEventListener('change',example);example();
    const pager=document.createElement('div');pager.className='nc-bar';body.parentElement.parentElement.after(pager);
    const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(9)).toString():'—';
    const message=e=>T.loaded_errors?.[e.message]||String(e.message);
    const flag=x=>x===true||x===1||/^(true|yes|1)$/i.test(String(x));
    const control=(i,f,v,type='text')=>`<input data-row="${i}" data-field="${f}" type="${type}" ${type==='checkbox'?(flag(v)?'checked':''):`value="${esc(v)}"`} aria-label="${esc((T['loaded_'+f]||f)+' '+(i+1))}" ${type==='number'?'step="any"':''}>`;
    // Keep boolean handling identical for UI and parsed CSV values.
    function render(){
      page=Math.max(0,Math.min(page,Math.ceil(raw.length/50)-1));
      body.innerHTML=raw.slice(page*50,page*50+50).map((r,j)=>{
        const i=page*50+j;
        const options=(f,values)=>{const current=r[f]||({unit:'keV',quantity:'me'}[f]);return `<select data-row="${i}" data-field="${f}" aria-label="${esc(T['loaded_'+f]||f)} ${i+1}">${values.some(([v])=>v===current)?'':`<option value="${esc(current)}" selected>${esc(current)} ⚠</option>`}${values.map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${esc(label)}</option>`).join('')}</select>`;};
        return `<tr><td>${i+1} ${control(i,'use',r.use===undefined||r.use===''?!flag(r.mixture):r.use,'checkbox')}</td><td>${control(i,'nuclide',r.nuclide)}<label class="zg-small">${control(i,'mixture',r.mixture,'checkbox')}${esc(T.loaded_mixture)}</label><button type="button" class="zg-btn zg-btn-ghost nc-row-impact" data-inspect="${i}" disabled>${esc(T.loaded_impact_row)}</button></td><td>${control(i,'value',r.value)}</td><td>${control(i,'sigma',r.uncertainty??r.sigma)}</td><td>${options('unit',[['keV','keV'],['MeV','MeV'],['u','u'],['µu','µu']])}</td><td>${options('quantity',[['me',T.loaded_me],['be',T.loaded_be],['atomic',T.loaded_atomic]])}</td><td>${control(i,'label',r.label||'New')}</td><td>${control(i,'reference',r.reference)}<details><summary>${esc(T.loaded_facility)}</summary>${['facility','method','year','note'].map(f=>`<label>${esc(f)}${control(i,f,r[f])}</label>`).join('')}</details></td><td class="nc-row-status" data-row-status="${i}"></td><td><button type="button" class="zg-btn zg-btn-ghost" data-remove="${i}" aria-label="${esc(T.loaded_remove)} ${i+1}">×</button></td></tr>`;
      }).join('');
      pager.innerHTML=raw.length>50?`<button type="button" data-page="-1" ${page===0?'disabled':''}>←</button><span>${page*50+1}–${Math.min(raw.length,page*50+50)} / ${raw.length}</span><button type="button" data-page="1" ${page*50+50>=raw.length?'disabled':''}>→</button>`:'';
      rowStatus();
    }
    function rowStatus(){
      status.textContent=raw.length?T.loaded_summary.replace('{valid}',table.valid.length).replace('{errors}',table.errors.length).replace('{active}',table.active.size).replace('{duplicates}',table.duplicates.length):T.loaded_empty;
      if(host.parent!==host)host.parent.postMessage({type:'zg-panel-input',dirty:raw.length>0},location.origin);
      panel.querySelector('.nc-mass-inactive').hidden=!(table.valid.length>0&&table.active.size===0);
      for(const cell of body.querySelectorAll('[data-row-status]')){
        const i=+cell.dataset.rowStatus,r=table.valid.find(r=>r.row===i+1),e=table.errors.find(e=>e.row===i+1);
        const inspect=body.querySelector(`[data-inspect="${i}"]`),entry=r&&table.active.get(r.id);
        inspect.disabled=!(r?.use&&entry?.rows.includes(r.row));
        inspect.setAttribute('aria-label',T.loaded_impact_row+' · '+(r?.label||raw[i]?.nuclide||String(i+1)));
        inspect.title=inspect.disabled?T.loaded_inactive:T.loaded_impact;
        if(e){cell.textContent=T.loaded_errors[e.code]||e.code;cell.classList.add('nc-invalid');continue;}
        cell.classList.remove('nc-invalid');if(!r){cell.textContent='';continue;}
        const a=table.active.get(r.id),gs=MM.getter(table,base)(r.state.Z,r.state.N),ame=base(r.state.Z,r.state.N);
        const compare=r.state.source_state_index?gs:ame;
        const delta=compare?P.combine([1,r.value||P.primitive('row:'+r.row,r.me,r.e,r.est)],[-1,compare]):null;
        cell.textContent=`${r.label}: ME ${fmt(r.me)} ± ${fmt(r.e)} keV · ${!r.use?T.loaded_unused:a?.rows.includes(r.row)?T.loaded_used:T.loaded_superseded}`;
        if(r.state.source_state_index)cell.textContent+=' · '+T.loaded_isomer;
        if(delta)cell.textContent+=` · ${r.state.source_state_index?'Eₓ':'Δ'} ${fmt(delta.v)} ± ${fmt(delta.e)} keV${delta.e>0?' ('+fmt(delta.v/delta.e)+'σ)':''}${!r.state.source_state_index&&delta.e>0&&Math.abs(delta.v)>5*delta.e?' ⚑ >5σ':''}`;
        if(a?.birge!==null&&a?.birge!==undefined)cell.textContent+=` · weighted ME ${fmt(a.me)} ± ${fmt(a.e)}; inner σ ${fmt(a.inner)}; Birge ${fmt(a.birge)}`;
      }
    }
    function update(){
      clearTimeout(timer);timer=null;table=MM.build(raw,catalog,policy.value);hash='';rowStatus();error.textContent='';
      if(table.active.size&&previousActive===0){root.querySelector('[data-series=loaded]').checked=true;root.querySelector('[data-series=hybrid]').checked=true;}previousActive=table.active.size;
      onchange(table);
      const seq=++revision;
      const canonical=raw.map((r,i)=>{const v=table.valid.find(v=>v.row===i+1);return v?{id:v.id,ME_keV:v.me,sigma_keV:v.e,use:v.use,mixture:v.mixture,estimated:v.est,reference:r.reference||'',label:r.label||'New',facility:r.facility||'',method:r.method||'',year:String(r.year||''),note:r.note||''}:r;});
      if(host.crypto?.subtle)host.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({rows:canonical,policy:policy.value}))).then(b=>{if(seq!==revision)return;hash=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');rowStatus();}).catch(()=>{});
    }
    function replace(rows){raw=rows.map(r=>{r={...r};try{const st=MM.stateFor(r,catalog);r.nuclide=st.A+st.element+'['+st.label+']';delete r.Z;delete r.N;delete r.state;}catch(_){}r.unit=({kev:'keV',mev:'MeV',u:'u','µu':'µu','μu':'µu'}[String(r.unit||'keV').toLowerCase()]||r.unit);r.quantity=/^(?:atomic(?:[ _-]?mass)?|mass)$/i.test(r.quantity||'')?'atomic':/^(?:be|binding[ _-]?energy)$/i.test(r.quantity||'')?'be':/^(?:me|mass[ _-]?excess)$/i.test(r.quantity||'')?'me':r.quantity||'me';return r;});page=0;update();render();}
    function input(e){
      const input=e.target.closest('[data-field]');if(!input)return;
      const r=raw[+input.dataset.row];if(!r)return;const f=input.dataset.field==='sigma'?'uncertainty':input.dataset.field;
      r[f]=input.type==='checkbox'?input.checked:input.value;
      if(f==='nuclide'){delete r.Z;delete r.N;delete r.state;}
      if(f==='mixture'&&input.checked){r.use=false;body.querySelector(`[data-row="${input.dataset.row}"][data-field=use]`).checked=false;}
      clearTimeout(timer);if(e.type==='change')update();else timer=setTimeout(update,120);
    }
    body.addEventListener('input',input);body.addEventListener('change',input);
    body.addEventListener('click',e=>{const inspect=e.target.closest('[data-inspect]');if(inspect){if(timer)update();const r=table.valid.find(r=>r.row===+inspect.dataset.inspect+1);if(r&&table.active.get(r.id)?.rows.includes(r.row))root.dispatchEvent(new CustomEvent('zg-mass-impact',{detail:{id:r.id}}));return;}const b=e.target.closest('[data-remove]');if(b){raw.splice(+b.dataset.remove,1);update();render();}});
    pager.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){page+=+b.dataset.page;render();}});
    policy.addEventListener('change',update);
    panel.querySelector('[name=nc-mass-markers]').addEventListener('change',()=>onchange(table));
    panel.querySelector('[name=nc-mass-file]').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>MM.MAX_TEXT)throw new Error('limit');replace(MM.parse(await f.text()));}catch(e){error.textContent=message(e);}finally{e.target.value='';}});
    panel.addEventListener('click',e=>{
      const b=e.target.closest('[data-mass]');if(!b)return;
      try{
        if(timer)update(); // Finish pending edits before saving, exporting or replacing the table.
        switch(b.dataset.mass){
          case 'import':replace(MM.parse(paste.value));break;
          case 'example':paste.value=exampleText.value;paste.focus();paste.select();break;
          case 'csv':host.zgExport.save(new Blob(['\uFEFF'+MM.csv(raw)],{type:'text/csv;charset=utf-8'}),'measured-mass-inputs-'+host.zgExport.stamp()+'.csv');break;
          case 'add':if(raw.length>=MM.MAX_ROWS)throw new Error('limit');raw.push({nuclide:'',value:'',uncertainty:'',unit:'keV',quantity:'me',label:'New',use:true});page=Math.floor((raw.length-1)/50);update();render();break;
          case 'demo':{if(raw.length>=MM.MAX_ROWS)throw new Error('limit');const a=base(50,66);if(!a)throw new Error('identity');raw.push({nuclide:'116Sn[g]',value:String(a.v+10),uncertainty:'1',unit:'keV',quantity:'me',reference:'SYNTHETIC +10 keV test; not a measurement',use:true});page=Math.floor((raw.length-1)/50);root.querySelector('[data-series=loaded]').checked=true;root.querySelector('[data-series=hybrid]').checked=true;update();render();break;}
          case 'clear':replace([]);break;
          case 'save':localStorage.setItem(storageKey,JSON.stringify({schema:1,rows:raw,policy:policy.value}));error.textContent=T.loaded_saved;break;
          case 'restore':{const data=JSON.parse(localStorage.getItem(storageKey)||'null');if(data?.schema!==1)throw new Error('storage');const rows=MM.parse(JSON.stringify(data.rows));policy.value=data.policy==='weighted'?'weighted':'last';replace(rows);break;}
          case 'forget':localStorage.removeItem(storageKey);error.textContent=T.loaded_forgot;break;
          case 'json':panel.querySelector('.nc-portable').hidden=false;panel.querySelector('[name=nc-mass-json]').value=JSON.stringify({schema:1,rows:raw,policy:policy.value},null,2);break;
        }
      }catch(e){error.textContent=['storage','SecurityError','QuotaExceededError'].includes(e.message)||e.name==='SecurityError'||e.name==='QuotaExceededError'?T.loaded_unavailable:message(e);}
    });
    function annotation(z,n){
      if(!panel.querySelector('[name=nc-mass-markers]').checked)return '';
      const rs=[...table.active.values()].filter(r=>r.state.Z===z&&r.state.N===n);if(!rs.length)return '';
      return `<div class="nc-loaded-card"><strong>★ ${esc(T.loaded_title)}</strong>`+rs.map(r=>{const baseValue=r.state.source_state_index?MM.getter(table,base)(z,n):base(z,n),d=baseValue?P.combine([1,r.value],[-1,baseValue]):null;return `<p>${esc(r.label)}: ME ${fmt(r.me)} ± ${fmt(r.e)} keV; ${r.state.source_state_index?'Eₓ':'Δ(new − AME)'} ${d?fmt(d.v)+' ± '+fmt(d.e):'—'} keV · ${esc(r.rows.map(i=>raw[i-1].reference||'row '+i).join('; '))}</p>`;}).join('')+'</div>';
    }
    render();
    return {flush:()=>{if(timer)update();},table:()=>table,hash:()=>hash,legend:()=>[...table.active.values()].map(r=>({id:r.id,text:r.rows.map(i=>String(raw[i-1].label||'New')).filter((x,i,a)=>a.indexOf(x)===i).join(' / ')+' · '+r.label+': ME '+fmt(r.me)+' ± '+fmt(r.e)+' keV'})),annotation,marked:(z,n)=>panel.querySelector('[name=nc-mass-markers]').checked&&[...table.active.values()].some(r=>r.state.Z===z&&r.state.N===n)};
  }
  host.ZGMeasuredMassUI={attach};
})(typeof window!=='undefined'?window:globalThis);
