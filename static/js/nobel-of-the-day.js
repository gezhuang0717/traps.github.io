(function (factory) {
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document!=='undefined')document.querySelectorAll('[data-nobel-card]').forEach(root=>api.mount(root));
})(function () {
  'use strict';
  const categories=['phy','che','med','lit','pea','eco'];
  function helsinkiDay(date=new Date()){
    const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Helsinki',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date);
    const value=type=>+parts.find(p=>p.type===type).value;
    return Math.floor(Date.UTC(value('year'),value('month')-1,value('day'))/864e5);
  }
  const indexForDay=(day,count)=>((day%count)+count)%count;
  const nextIndex=(current,count)=>(current+1)%count;
  function mount(root){
    const T=JSON.parse(root.dataset.labels),lang=root.dataset.lang,next=root.querySelector('[data-nobel-next]'),today=root.querySelector('[data-nobel-today]'),retry=root.querySelector('[data-nobel-retry]');
    let entries=[],current=0,day=helsinkiDay(),loading=false;
    const text=(selector,value)=>{root.querySelector(selector).textContent=value;};
    const place=value=>T.place_words?value.replace(/\b(Russian Empire|United Kingdom|Germany|Poland|China|Kenya|USA|India|Pakistan|Egypt|France|now)\b/g,key=>T.place_words[key]||key):value;
    function show(index){
      current=index;const entry=entries[index],copy=entry.texts[lang];
      root.dataset.nobelId=entry.id;root.dataset.nobelCategory=entry.category;
      text('.zg-nobel-name',entry.names?.[lang]?entry.names[lang]+' · '+entry.name:entry.name);text('.zg-nobel-award',entry.year+' · '+T.categories[categories.indexOf(entry.category)]);
      text('.zg-nobel-origin',T.born+' · '+place(entry.birthplace));
      for(const field of ['reason','work','context'])text('.zg-nobel-'+field,copy[field]);
      root.querySelector('.zg-nobel-economics').hidden=entry.category!=='eco';
      const facts=root.querySelector('.zg-nobel-facts');facts.replaceChildren();
      const rows=[[T.born,entry.born+' · '+place(entry.birthplace)],...entry.affiliations.map(a=>[T.affiliation,place(a)]),...entry.residences.map(a=>[T.residence,place(a)]),[T.share,entry.portion==='1'?'1/1':entry.portion],[T.shared,entry.co_laureates.join('; ')||T.sole]];
      for(const [label,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;facts.append(dt,dd);}
      for(const kind of ['facts','lecture','summary'])root.querySelector('[data-source='+kind+']').href=entry.sources[kind];
      text('.zg-nobel-count',T.count.replace('{index}',index+1).replace('{count}',entries.length)+' · '+new Date(day*864e5).toISOString().slice(0,10));
      next.disabled=entries.length<2;today.disabled=current===indexForDay(day,entries.length);
    }
    function checkDay(){const fresh=helsinkiDay();if(fresh!==day){day=fresh;if(entries.length)show(indexForDay(day,entries.length));}}
    async function load(){
      if(loading)return;loading=true;retry.disabled=true;text('.zg-nobel-count',T.loading);
      try{
        const response=await fetch(root.dataset.src);if(!response.ok)throw Error('collection');
        const data=await response.json();if(!Array.isArray(data.entries)||!data.entries.length||data.entries.some(e=>!e.texts?.[lang]||!categories.includes(e.category)))throw Error('schema');
        entries=data.entries;day=helsinkiDay();show(indexForDay(day,entries.length));root.querySelector('.zg-nobel-error').hidden=true;
      }catch(_){root.querySelector('.zg-nobel-error').hidden=false;text('.zg-nobel-count','');next.disabled=true;today.disabled=true;}
      finally{loading=false;retry.disabled=false;}
    }
    next.addEventListener('click',()=>{checkDay();if(entries.length)show(nextIndex(current,entries.length));});
    today.addEventListener('click',()=>{checkDay();if(entries.length)show(indexForDay(day,entries.length));});
    retry.addEventListener('click',load);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
    setInterval(checkDay,30000);load();
  }
  return {helsinkiDay,indexForDay,nextIndex,mount};
});
