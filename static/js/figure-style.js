/* Appearance and export settings only. Values, uncertainties and physical spots are untouched. */
(function(host){
  'use strict';
  if(host.ZGFigureStyle){if(typeof module==='object')module.exports=host.ZGFigureStyle;return;}
  const schema='traps-figure-style-v1';
  const defaults=Object.freeze({titleSize:18,axisSize:15,tickSize:13,legendSize:12,markerDiameter:9,lineWidth:1,rasterWidth:2160,filename:''});
  const bounds=Object.freeze({titleSize:[9,24],axisSize:[9,20],tickSize:[8,18],legendSize:[8,18],markerDiameter:[2,16],lineWidth:[.4,3],rasterWidth:[720,8192]});
  const labels={
    en:['Figure style','Title / px','Axis labels / px','Ticks / px','Legend / px','Reference marker diameter / px','Line width ×','Raster width / px','Filename prefix','Reset','Save style JSON','Load style JSON','Display sizes only; physical spot widths and data stay unchanged.','Check the figure style values.'],
    zh:['图形样式','标题 / px','坐标轴标签 / px','刻度 / px','图例 / px','参考点直径 / px','线宽倍数','位图宽度 / px','文件名前缀','重置','保存样式 JSON','读取样式 JSON','仅改变显示尺寸，不改变物理光斑宽度或数据。','请检查图形样式数值。'],
    fi:['Kuvan tyyli','Otsikko / px','Akselien nimet / px','Asteikot / px','Selite / px','Vertailumerkin halkaisija / px','Viivanleveys ×','Rasterin leveys / px','Tiedostonimen alku','Palauta','Tallenna tyyli JSON','Lataa tyyli JSON','Vain esityskoko muuttuu; fysikaaliset pisteleveydet ja tiedot säilyvät.','Tarkista kuvan tyyliasetukset.'],
    de:['Abbildungsstil','Titel / px','Achsenbeschriftung / px','Skalen / px','Legende / px','Referenz-Symboldurchmesser / px','Linienbreite ×','Rasterbreite / px','Dateinamen-Präfix','Zurücksetzen','Stil als JSON speichern','Stil-JSON laden','Nur Darstellungsgrößen ändern sich; physikalische Fleckbreiten und Daten bleiben erhalten.','Abbildungsstil prüfen.'],
    ja:['図のスタイル','タイトル / px','軸ラベル / px','目盛り / px','凡例 / px','基準マーカー直径 / px','線幅倍率','画像幅 / px','ファイル名の接頭辞','リセット','スタイル JSON を保存','スタイル JSON を読込','表示サイズのみ変更します。物理的なスポット幅やデータは変わりません。','図のスタイルの値を確認してください。'],
    fr:['Style de figure','Titre / px','Étiquettes des axes / px','Graduations / px','Légende / px','Diamètre du marqueur de référence / px','Épaisseur des lignes ×','Largeur matricielle / px','Préfixe du fichier','Réinitialiser','Enregistrer le style JSON','Charger le style JSON','Seules les tailles affichées changent ; les largeurs physiques des taches et les données sont conservées.','Vérifiez les valeurs du style de figure.']};
  function normalize(values={},baseline=defaults){
    if(!values||typeof values!=='object'||Array.isArray(values))throw Error('figure_style');
    const out={...defaults,...baseline,...values};
    for(const[key,[lo,hi]]of Object.entries(bounds)){
      const value=out[key];if(value==null||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<lo||Number(value)>hi)throw Error('figure_style_'+key);
      out[key]=Number(value);
    }
    if(!Number.isInteger(out.rasterWidth))throw Error('figure_style_rasterWidth');
    if(typeof out.filename!=='string'||out.filename.length>80||/[\x00-\x1f/\\<>:"|?*]/.test(out.filename))throw Error('figure_style_filename');
    out.filename=out.filename.trim();return Object.fromEntries(Object.keys(defaults).map(k=>[k,out[k]]));
  }
  function serialize(values,baseline){return JSON.stringify({schema,style:normalize(values,baseline)},null,2)+'\n';}
  function parse(text,baseline){if(typeof text!=='string'||text.length>16384)throw Error('figure_style_file');const value=JSON.parse(text);if(!value||value.schema!==schema||!value.style||typeof value.style!=='object'||Array.isArray(value.style))throw Error('figure_style_schema');return normalize(value.style,baseline);}
  const exportName=(style,fallback)=>style.filename?style.filename+'-'+fallback:fallback;
  function rasterSize(viewBox,width){
    const box=typeof viewBox==='string'?viewBox.trim().split(/[\s,]+/).map(Number):viewBox;
    if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0||!Number.isInteger(width)||width<1)throw Error('figure_viewbox');
    return {width,height:Math.max(1,Math.round(width*box[3]/box[2]))};
  }
  function wrapText(text,maxWidth,size,measure){
    const width=measure||((s)=>String(s).length*size*.62),lines=[];let line='';
    for(const word of String(text).split(/\s+/)){
      if(width(word)>maxWidth){if(line){lines.push(line);line='';}let part='';for(const char of word){if(part&&width(part+char)>maxWidth){lines.push(part);part='';}part+=char;}line=part;continue;}
      const next=line?line+' '+word:word;if(line&&width(next)>maxWidth){lines.push(line);line=word;}else line=next;
    }if(line)lines.push(line);return lines.length?lines:[''];
  }
  function controls(parent,{lang='en',prefix='figure',baseline=defaults,onChange=()=>{}}={}){
    const base=normalize({},baseline),doc=parent.ownerDocument||document,L=labels[lang]||labels.en,fields={};let revision=0,current=base;
    const make=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
    const details=make('details'),summary=make('summary',L[0]),grid=make('div');details.className='zg-figure-style';grid.className='zg-figure-fields';details.append(summary,grid);parent.append(details);
    Object.keys(defaults).forEach((key,index)=>{const lab=make('label',L[index+1]),input=make('input');input.name=prefix+'-style-'+key;input.dataset.figureStyle=key;input.type=key==='filename'?'text':'number';input.value=String(base[key]);
      if(bounds[key]){input.min=String(bounds[key][0]);input.max=String(bounds[key][1]);input.step=key==='rasterWidth'?'1':key==='lineWidth'?'.1':'.5';}else{input.maxLength=80;input.placeholder='auto';}lab.append(input);grid.append(lab);fields[key]=input;});
    const actions=make('div');actions.className='zg-figure-actions';const reset=make('button',L[9]),save=make('button',L[10]),load=make('label',L[11]),file=make('input'),status=make('p'),note=make('p',L[12]);
    reset.type=save.type='button';file.type='file';file.accept='.json,application/json';load.append(file);status.setAttribute('role','status');status.className='zg-figure-status';note.className='zg-figure-note';actions.append(reset,save,load);details.append(actions,note,status);
    const read=()=>normalize(Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,f.value])),base);
    const changed=()=>{revision++;try{const value=read();current=value;status.textContent='';onChange(value);}catch{status.textContent=L[13];}};
    for(const f of Object.values(fields))f.addEventListener('input',changed);
    function set(value,notify=true){const normalized=normalize(value,base);revision++;for(const[key,v]of Object.entries(normalized))fields[key].value=String(v);current=normalized;status.textContent='';if(notify)onChange(normalized);return normalized;}
    reset.onclick=()=>set(base);
    save.onclick=()=>{try{const value=read();host.zgExport?.save(new Blob([serialize(value,base)],{type:'application/json'}),exportName(value,prefix)+'-style.json');status.textContent='';}catch{status.textContent=L[13];}};
    file.onchange=async()=>{const f=file.files[0];if(!f)return;const started=++revision;try{if(f.size>16384)throw Error('figure_style_file');const text=await f.text();if(started!==revision)return;set(parse(text,base));}catch{if(started===revision)status.textContent=L[13];}finally{if(file.files[0]===f)file.value='';}};
    return {get:()=>({...current}),validate:read,valid:()=>{try{read();return true;}catch{status.textContent=L[13];return false;}},set,reset:()=>set(base),element:details,fields};
  }
  async function exportSVG(svg,type,name,style,metadata={}){
    const values=normalize(style),clone=svg.cloneNode(true),doc=svg.ownerDocument||document,desc=doc.createElementNS('http://www.w3.org/2000/svg','desc');
    desc.textContent=JSON.stringify({...metadata,figure_style:values});clone.append(desc);
    const xml=new XMLSerializer().serializeToString(clone),filename=exportName(values,name);
    if(type==='SVG'){host.zgExport.save(new Blob([xml],{type:'image/svg+xml'}),filename+'.svg');return;}
    if(!['PNG','PDF'].includes(type))throw Error('figure_export_type');
    const dimensions=rasterSize(clone.getAttribute('viewBox'),values.rasterWidth),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
    try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('figure_export_image'));image.src=url;});const canvas=doc.createElement('canvas');canvas.width=dimensions.width;canvas.height=dimensions.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);host.zgExport[type==='PDF'?'pdf':'png'](canvas,filename);}finally{URL.revokeObjectURL(url);}
  }
  const api={schema,defaults,bounds,labels,normalize,serialize,parse,exportName,rasterSize,wrapText,controls,exportSVG};host.ZGFigureStyle=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
