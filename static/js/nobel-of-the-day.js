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
  const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function filterDirectory(people,query='',category='',year=''){
    const words=normalized(query).trim().split(/\s+/).filter(Boolean);
    return people.filter(person=>words.every(word=>normalized(person.name).includes(word))&&person.awards.some(a=>(!category||a.category===category)&&(!year||a.year===Number(year))));
  }
  const pageOf=(people,count=40)=>people.slice(0,count);
  function mount(root){
    const T=JSON.parse(root.dataset.labels),lang=root.dataset.lang,next=root.querySelector('[data-nobel-next]'),today=root.querySelector('[data-nobel-today]'),retry=root.querySelector('[data-nobel-retry]');
    const chooser=root.querySelector('[data-nobel-choose]');
    let entries=[],current=0,day=helsinkiDay(),loading=false;
    const text=(selector,value)=>{root.querySelector(selector).textContent=value;};
    const place=value=>T.place_words?value.replace(/\b(Russian Empire|United Kingdom|Germany|Poland|China|Kenya|USA|India|Pakistan|Egypt|France|now)\b/g,key=>T.place_words[key]||key):value;
    function show(index){
      current=index;const entry=entries[index],copy=entry.texts[lang];
      root.dataset.nobelId=entry.id;root.dataset.nobelCategory=entry.category;
      text('.zg-nobel-name',entry.names?.[lang]?entry.names[lang]+' · '+entry.name:entry.name);text('.zg-nobel-award',entry.year+' · '+T.categories[categories.indexOf(entry.category)]);
      text('.zg-nobel-origin',T.born+' · '+place(entry.birthplace));
      for(const field of ['reason','work','context','question'])text('.zg-nobel-'+field,copy[field]);
      chooser.value=String(index);
      const recipients=root.querySelector('.zg-nobel-recipients');recipients.replaceChildren();
      for(const person of entry.award_people){
        const li=document.createElement('li'),link=document.createElement('a');link.href=person.url;link.textContent=person.name;link.target='_blank';link.rel='noopener';
        li.append(link,document.createTextNode(' · '+(person.share==='1'?'1/1':person.share)));recipients.append(li);
      }
      root.querySelector('.zg-nobel-economics').hidden=entry.category!=='eco';
      const facts=root.querySelector('.zg-nobel-facts');facts.replaceChildren();
      const rows=[[T.born,entry.born+' · '+place(entry.birthplace)],...(entry.affiliations_local?.[lang]||entry.affiliations).map(a=>[T.affiliation,place(a)]),...entry.residences.map(a=>[T.residence,place(a)]),[T.share,entry.portion==='1'?'1/1':entry.portion],[T.announced,entry.announced]];
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
        entries=data.entries;chooser.replaceChildren();
        entries.forEach((e,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(e.names?.[lang]||e.name)+' · '+e.year+' · '+T.categories[categories.indexOf(e.category)];chooser.append(option);});
        chooser.disabled=false;day=helsinkiDay();show(indexForDay(day,entries.length));root.querySelector('.zg-nobel-error').hidden=true;
      }catch(_){root.querySelector('.zg-nobel-error').hidden=false;text('.zg-nobel-count','');next.disabled=true;today.disabled=true;}
      finally{loading=false;retry.disabled=false;}
    }
    next.addEventListener('click',()=>{checkDay();if(entries.length)show(nextIndex(current,entries.length));});
    today.addEventListener('click',()=>{checkDay();if(entries.length)show(indexForDay(day,entries.length));});
    retry.addEventListener('click',load);
    chooser.addEventListener('change',()=>{const i=Number(chooser.value);if(Number.isInteger(i)&&entries[i])show(i);});
    const directory=root.querySelector('[data-nobel-directory]'),search=root.querySelector('[data-nobel-search]'),category=root.querySelector('[data-nobel-category]'),year=root.querySelector('[data-nobel-year]'),more=root.querySelector('[data-nobel-more]'),directoryRetry=root.querySelector('[data-nobel-directory-retry]');
    let registry=null,directoryLoading=false,visible=40;
    function drawDirectory(){
      if(!registry)return;
      const matches=filterDirectory(registry.people,search.value,category.value,year.value),list=root.querySelector('[data-nobel-directory-list]');list.replaceChildren();
      for(const person of pageOf(matches,visible)){
        const li=document.createElement('li'),link=document.createElement('a'),awards=document.createElement('span');
        link.href=person.url;link.textContent=person.name;link.target='_blank';link.rel='noopener';
        awards.textContent=person.awards.filter(a=>(!category.value||a.category===category.value)&&(!year.value||a.year===Number(year.value))).map(a=>a.year+' · '+T.categories[categories.indexOf(a.category)]+' · '+(a.share==='1'?'1/1':a.share)).join('; ');
        li.append(link,awards);list.append(li);
      }
      text('[data-nobel-directory-count]',T.directory_count.replace('{count}',matches.length).replace('{min}',registry.min_year).replace('{max}',registry.max_year).replace('{date}',registry.reviewed));
      more.hidden=matches.length<=visible;
    }
    async function loadDirectory(){
      if(registry||directoryLoading)return;directoryLoading=true;directoryRetry.hidden=true;text('[data-nobel-directory-count]',T.loading);
      try{
        const response=await fetch(root.dataset.directorySrc);if(!response.ok)throw Error('directory');
        const data=await response.json();
        if(!Array.isArray(data.people)||!data.people.length||data.people.some(p=>!p.name||!Array.isArray(p.awards)||new URL(p.url).hostname!=='www.nobelprize.org'||p.awards.some(a=>!categories.includes(a.category))))throw Error('directory schema');
        registry=data;
        [...new Set(data.people.flatMap(p=>p.awards.map(a=>a.year)))].sort((a,b)=>b-a).forEach(y=>{const option=document.createElement('option');option.value=String(y);option.textContent=String(y);year.append(option);});
        search.disabled=false;category.disabled=false;year.disabled=false;drawDirectory();
      }catch(_){text('[data-nobel-directory-count]',T.error);directoryRetry.hidden=false;}
      finally{directoryLoading=false;}
    }
    directory.addEventListener('toggle',()=>{if(directory.open)loadDirectory();});
    for(const control of [search,category,year])control.addEventListener(control===search?'input':'change',()=>{visible=40;drawDirectory();});
    more.addEventListener('click',()=>{visible+=40;drawDirectory();});
    directoryRetry.addEventListener('click',loadDirectory);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
    setInterval(checkDay,30000);load();
  }
  return {helsinkiDay,indexForDay,nextIndex,filterDirectory,pageOf,mount};
});
