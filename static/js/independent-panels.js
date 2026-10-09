/* Isolated, opt-in chart panels. Never transfer mass-table data between frames. */
(function(host){
'use strict';
const MAX=4;
function parse(value){
 const m=String(value||'').trim().match(/^(\d{1,3}(?:m\d*)?[A-Z][a-z]?)(?::(\d{1,2}))?$/);
 return m?{nuclide:m[1],state:Number(m[2]||0)}:null;
}
function selection(search){return (new URLSearchParams(search).get('panels')||'').split(',').map(parse).filter(Boolean).slice(0,MAX);}
function storageKey(search){const id=new URLSearchParams(search).get('panelId');return 'traps.measured-masses.v1'+(id&&/^[a-zA-Z0-9-]{1,64}$/.test(id)?'.panel.'+id:'');}
const api={MAX,parse,selection,storageKey};host.ZGIndependentPanels=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
const root=document.querySelector('[data-independent-panels]');if(!root)return;
const T=JSON.parse(root.dataset.labels),list=root.querySelector('.nc-panel-grid'),status=root.querySelector('[role=status]'),input=root.querySelector('[name=panel-nuclide]'),add=root.querySelector('[data-panel-add]'),items=[];
let sequence=0;
function fullURL(item){const u=new URL(root.dataset.lab,location.href);u.searchParams.set('nuclide',item.spec.nuclide);u.searchParams.set('state',item.spec.state);u.searchParams.set('panelId',item.id);return u.href;}
function refresh(){add.disabled=items.length>=MAX;status.textContent=T.count.replace('{n}',items.length).replace('{max}',MAX);}
function addPanel(spec){
 if(!spec){status.textContent=T.invalid;return;}if(items.length>=MAX){refresh();return;}
 const id=crypto.randomUUID(),number=++sequence,box=document.createElement('section'),head=document.createElement('header'),title=document.createElement('strong'),link=document.createElement('a'),close=document.createElement('button'),frame=document.createElement('iframe');
 const item={id,spec,box,frame,link,dirty:false};items.push(item);
 box.className='nc-independent-panel';title.textContent=T.panel+' '+number;link.textContent=T.open;link.href=fullURL(item);link.target='_blank';link.rel='noopener';
 close.type='button';close.className='zg-btn zg-btn-ghost';close.textContent=T.close;close.setAttribute('aria-label',T.close+' '+number);
 close.onclick=()=>{if(item.dirty&&!confirm(T.close_warning))return;box.remove();items.splice(items.indexOf(item),1);refresh();};
 const u=new URL(root.dataset.child,location.href);u.searchParams.set('nuclide',spec.nuclide);u.searchParams.set('state',spec.state);u.searchParams.set('panelId',id);
 frame.src=u.href;frame.title=T.panel+' '+number+' — '+spec.nuclide;frame.loading='lazy';
 head.append(title,link,close);box.append(head,frame);list.append(box);refresh();
}
root.querySelector('[data-panel-start]').onclick=()=>{root.querySelector('.nc-panel-workspace').hidden=false;if(!items.length){const name=document.querySelector('[name=nc-search]')?.value.replace(/\[.*\]$/,'');addPanel(parse(name)||parse('116Sn'));}list.scrollIntoView({behavior:'smooth',block:'start'});};
add.onclick=()=>addPanel(parse(input.value));input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add.click();}};
root.querySelector('[name=panel-layout]').onchange=e=>{list.dataset.layout=e.target.value;};
root.querySelector('[data-panel-share]').onclick=()=>{const u=new URL(location.href);u.searchParams.set('panels',items.map(i=>i.spec.nuclide+(i.spec.state?':'+i.spec.state:'')).join(','));history.replaceState(null,'',u);const out=root.querySelector('[name=panel-link]');out.hidden=false;out.value=u.href;out.select();};
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;const item=items.find(i=>i.frame.contentWindow===e.source);if(!item)return;
 if(e.data?.type==='zg-panel-input'){item.dirty=!!e.data.dirty;return;}
 if(e.data?.type!=='zg-panel-state')return;const spec=parse(e.data.nuclide+':'+e.data.state);if(!spec)return;
 item.spec=spec;item.link.href=fullURL(item);item.frame.title=T.panel+' — '+spec.nuclide+(spec.state?' ['+spec.state+']':'');
});
const initial=selection(location.search);if(initial.length){root.querySelector('.nc-panel-workspace').hidden=false;initial.forEach(addPanel);}refresh();
})(typeof window!=='undefined'?window:globalThis);
