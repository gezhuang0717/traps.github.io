const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../static/js/topic-navigation.js'),'utf8');
function fixture(){
 const element=()=>({dataset:{},children:[],attrs:{},events:{},classList:{toggle(){}},append(n){this.children.push(n);},prepend(n){this.children.unshift(n);},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){(this.events[k]??=[]).push(f);},focus(){this.focused=true;}});
 const group=(id,names)=>{const root=element();root.tagName='SECTION';root.id=id;root.buttons=names.map(name=>Object.assign(element(),{id:id+'-'+name,dataset:{localTab:name}}));root.panels=names.map(name=>Object.assign(element(),{dataset:{localPanel:name},hidden:name!=='classic'}));root.querySelectorAll=selector=>selector.includes('[data-local-tab]')?root.buttons:root.panels;return root;};
 const groups=[group('g-tof',['classic','advanced','fancier']),group('g-pi',['classic','fancier'])],games=element();games.children.push(...groups);
 const context={document:{documentElement:{lang:'en'},querySelector:()=>games,querySelectorAll:()=>groups,createElement:element},dispatchEvent(){},Event:class{constructor(type){this.type=type;}}};
 return {groups,games,run:()=>vm.runInNewContext(source,context)};
}
test('every scientific group shows exactly one variant through mouse and keyboard selection',()=>{
 const f=fixture();f.run();for(const group of f.groups){assert.equal(group.panels.filter(p=>!p.hidden).length,1);group.buttons.at(-1).events.click[0]();assert.equal(group.panels.filter(p=>!p.hidden).length,1);assert.equal(group.panels.at(-1).hidden,false);group.buttons.at(-1).events.keydown[0]({key:'Home',preventDefault(){}});assert.equal(group.panels[0].hidden,false);assert.equal(group.buttons[0].attrs['aria-selected'],'true');}
});
test('re-evaluating the tab script adds no duplicate navigation or handlers and preserves the selected variant',()=>{
 const f=fixture();f.run();f.groups[0].buttons[1].events.click[0]();f.run();assert.equal(f.games.children.filter(n=>n.className==='zg-topic-nav').length,1);assert.equal(f.groups[0].panels[1].hidden,false);for(const group of f.groups)for(const button of group.buttons){assert.equal(button.events.click.length,1);assert.equal(button.events.keydown.length,1);}
});
test('Games secondary cards are hidden in server markup before deferred tab setup',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../layouts/_shortcodes/games.html'),'utf8');const advanced=[...html.matchAll(/<div data-local-panel="advanced"([^>]*)>/g)];assert.equal(advanced.length,2);for(const match of advanced)assert.match(match[1],/\bhidden\b/);assert.match(html,/"g-tof-workbench"/);assert.match(html,/"g-tof-fancier"/);assert.match(html,/"g-mr-workbench"/);
});
