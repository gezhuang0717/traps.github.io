/* One physical-quantity order shared by chart, chain and affected-value menus. */
(function(host){
  'use strict';
  const groups={
    basic:['me','BE','BEA'],
    separation:['sn','s2n','sp','s2p'],
    q:['qbm','qec','qa'],
    gap:['d2n','d2p','D1nS1n','D1pS1p'],
    pairing:['d3n','d3p','d5n','d5p'],
    pn:['vpn','wig','D2pS2n','D1pS1n','D1pS2n','D2pS1n'],
    higher:['D1nS2n','D1pS2p','Gplus','Gsym'],
  };
  const aliases={BE:'be',BEA:'bea'};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function html(items,labels){
    const used=new Set(),option=key=>{used.add(key);return '<option value="'+escape(key)+'">'+escape(items[key])+'</option>';};
    let out='';
    for(const [group,keys]of Object.entries(groups)){
      const present=keys.map(k=>Object.hasOwn(items,k)?k:aliases[k]).filter(k=>k&&Object.hasOwn(items,k));
      if(present.length)out+='<optgroup label="'+escape(labels['mf_group_'+group])+'">'+present.map(option).join('')+'</optgroup>';
    }
    const other=Object.keys(items).filter(k=>!used.has(k));
    if(other.length)out+='<optgroup label="'+escape(labels.mf_group_other)+'">'+other.map(option).join('')+'</optgroup>';
    return out;
  }
  const api={groups,aliases,html};host.ZGMassQuantityMenu=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
