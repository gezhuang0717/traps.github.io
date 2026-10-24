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
  /* What each setting does: shown as a tooltip on the field and as a fold-away list under the fields. Order of items = Object.keys(defaults), then the save/load line. */
  const helpTexts={
    en:{summary:'What do these settings do?',items:['Font size of the figure title, in figure pixels. Saved PNG/PDF images are scaled up, so the proportions stay the same.','Font size of the axis names, e.g. “TOF − t₁ (ns)”.','Font size of the numbers on the axes.','Font size of the legend entries and of the parameter caption under the figure.','Diameter of the data points and markers. It does not change physical sizes such as spot radii or rods.','Multiplier for the line widths: 1 is standard, 2 draws every line twice as thick.','Width of saved PNG and PDF images in pixels; the height follows the aspect ratio. Larger is sharper but gives bigger files. SVG is vector and ignores it.','Text put in front of every saved file name (for example mr-tof-…); empty keeps the automatic name.','Save style / Load style: write these numbers to a small JSON, CSV or TXT file and read them back, to give all figures of a paper the same look.']},
    zh:{summary:'这些设置有什么作用？',items:['图标题的字号（图内像素）。保存的 PNG/PDF 会整体放大，比例不变。','坐标轴名称的字号，例如“TOF − t₁ (ns)”。','坐标轴上数字的字号。','图例条目以及图下方参数说明的字号。','数据点和标记的直径，不改变光斑半径、杆等物理尺寸。','线宽的倍数：1 为标准，2 表示所有线加粗一倍。','保存的 PNG 和 PDF 的像素宽度，高度按纵横比决定。越大越清晰，文件也越大。SVG 是矢量图，不受影响。','加在每个保存文件名前面的文字（例如 mr-tof-…）；留空则使用自动文件名。','保存样式 / 读取样式：把这些数值写入小的 JSON、CSV 或 TXT 文件再读回，让一篇论文的所有图保持相同外观。']},
    fi:{summary:'Mitä nämä asetukset tekevät?',items:['Kuvan otsikon fonttikoko kuvapikseleinä. Tallennetut PNG/PDF-kuvat skaalataan suuremmiksi, joten mittasuhteet säilyvät.','Akselien nimien fonttikoko, esim. “TOF − t₁ (ns)”.','Akseleiden lukujen fonttikoko.','Selitteen rivien ja kuvan alla olevan parametriselityksen fonttikoko.','Datapisteiden ja merkkien halkaisija. Ei muuta fysikaalisia kokoja kuten pisteiden säteitä tai sauvoja.','Viivanleveyksien kerroin: 1 on normaali, 2 piirtää jokaisen viivan kaksi kertaa paksummaksi.','Tallennettujen PNG- ja PDF-kuvien leveys pikseleinä; korkeus seuraa kuvasuhdetta. Suurempi on terävämpi mutta tiedosto kasvaa. SVG on vektoria eikä välitä tästä.','Teksti, joka lisätään jokaisen tallennetun tiedoston nimen eteen (esim. mr-tof-…); tyhjänä käytetään automaattista nimeä.','Tallenna tyyli / Lataa tyyli: kirjoittaa nämä luvut pieneen JSON-, CSV- tai TXT-tiedostoon ja lukee ne takaisin, jotta kaikilla artikkelin kuvilla on sama ulkoasu.']},
    de:{summary:'Was bewirken diese Einstellungen?',items:['Schriftgröße des Abbildungstitels in Abbildungspixeln. Gespeicherte PNG/PDF-Bilder werden hochskaliert, die Proportionen bleiben gleich.','Schriftgröße der Achsennamen, z. B. „TOF − t₁ (ns)“.','Schriftgröße der Zahlen an den Achsen.','Schriftgröße der Legendeneinträge und der Parameterzeile unter der Abbildung.','Durchmesser der Datenpunkte und Markierungen. Physikalische Größen wie Fleckradien oder Stäbe ändern sich nicht.','Faktor für die Linienbreiten: 1 ist Standard, 2 zeichnet jede Linie doppelt so dick.','Breite gespeicherter PNG- und PDF-Bilder in Pixeln; die Höhe folgt dem Seitenverhältnis. Größer ist schärfer, aber die Dateien werden größer. SVG ist Vektorgrafik und ignoriert dies.','Text vor jedem gespeicherten Dateinamen (z. B. mr-tof-…); leer behält den automatischen Namen.','Stil speichern / laden: schreibt diese Zahlen in eine kleine JSON-, CSV- oder TXT-Datei und liest sie zurück, damit alle Abbildungen eines Artikels gleich aussehen.']},
    ja:{summary:'これらの設定は何を変えますか？',items:['図のタイトルの文字サイズ（図内のピクセル）。保存した PNG/PDF は拡大されるので比率は変わりません。','軸名の文字サイズ（例：「TOF − t₁ (ns)」）。','軸の数値の文字サイズ。','凡例の項目と、図の下のパラメータ説明の文字サイズ。','データ点とマーカーの直径。スポット半径やロッドなどの物理的な大きさは変わりません。','線幅の倍率：1 が標準、2 ならすべての線が 2 倍の太さになります。','保存する PNG と PDF の幅（ピクセル）。高さは縦横比で決まります。大きいほど鮮明ですがファイルも大きくなります。SVG はベクターなので影響しません。','保存するすべてのファイル名の先頭に付ける文字（例：mr-tof-…）。空なら自動の名前です。','スタイルの保存／読み込み：これらの数値を小さな JSON・CSV・TXT ファイルに書き出して読み戻し、論文のすべての図を同じ見た目にできます。']},
    fr:{summary:'À quoi servent ces réglages ?',items:['Taille de police du titre de la figure, en pixels de figure. Les PNG/PDF enregistrés sont agrandis, les proportions restent les mêmes.','Taille de police des noms d’axes, par ex. « TOF − t₁ (ns) ».','Taille de police des nombres sur les axes.','Taille de police des entrées de légende et de la ligne de paramètres sous la figure.','Diamètre des points de données et des repères. Ne change pas les tailles physiques (rayons de taches, barreaux).','Multiplicateur des épaisseurs de trait : 1 est standard, 2 trace chaque trait deux fois plus épais.','Largeur en pixels des PNG et PDF enregistrés ; la hauteur suit le rapport d’aspect. Plus grand est plus net mais les fichiers grossissent. Le SVG est vectoriel et l’ignore.','Texte placé devant chaque nom de fichier enregistré (par ex. mr-tof-…) ; vide garde le nom automatique.','Enregistrer / charger le style : écrit ces nombres dans un petit fichier JSON, CSV ou TXT et les relit, pour donner le même aspect à toutes les figures d’un article.']},
  };
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
  const textLabels={en:['Save style CSV','Save style TXT','Load style CSV / TXT / JSON'],zh:['保存样式 CSV','保存样式 TXT','读取样式 CSV / TXT / JSON'],fi:['Tallenna tyyli CSV','Tallenna tyyli TXT','Lataa tyyli CSV / TXT / JSON'],de:['Stil als CSV speichern','Stil als TXT speichern','Stil CSV / TXT / JSON laden'],ja:['スタイル CSV を保存','スタイル TXT を保存','スタイル CSV / TXT / JSON を読込'],fr:['Enregistrer le style CSV','Enregistrer le style TXT','Charger le style CSV / TXT / JSON']};
  function known(values){if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!Object.hasOwn(defaults,k)))throw Error('figure_style_key');for(const[key,value]of Object.entries(values))if(key!=='filename'&&typeof value!=='number'&&(typeof value!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim())))throw Error('figure_style_'+key);return values;}
  function serialize(values,baseline){return JSON.stringify({schema,style:normalize(values,baseline)},null,2)+'\n';}
  const csvCell=value=>/[",\r\n]/.test(String(value))?'"'+String(value).replaceAll('"','""')+'"':String(value);
  function serializeCSV(values,baseline){const style=normalize(values,baseline);return [['name','value'],['schema',schema],...Object.entries(style)].map(row=>row.map(csvCell).join(',')).join('\n')+'\n';}
  function serializeTXT(values,baseline){const style=normalize(values,baseline);return '# '+schema+'\n# name<TAB>value; sizes in px, lineWidth is a multiplier\n'+[['schema',schema],...Object.entries(style)].map(row=>row.join('\t')).join('\n')+'\n';}
  function csvRows(text){
    const rows=[];let row=[],cell='',quoted=false,closed=false;
    const endCell=()=>{row.push(cell);cell='';closed=false;},endRow=()=>{endCell();if(row.some(v=>v!==''))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
      if(c===','){endCell();continue;}if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();continue;}
      if(closed)throw Error('figure_style_csv');if(c==='"'){if(cell)throw Error('figure_style_csv');quoted=true;}else cell+=c;
    }if(quoted)throw Error('figure_style_csv');if(cell||row.length||closed)endRow();return rows;
  }
  function fromRows(rows,baseline){
    const values={},seen=new Set();let version;
    for(const row of rows){if(row.length!==2)throw Error('figure_style_columns');const key=row[0].trim();if(seen.has(key)||key!=='schema'&&!Object.hasOwn(defaults,key))throw Error('figure_style_key');seen.add(key);if(key==='schema')version=row[1].trim();else values[key]=row[1];}
    if(version!==schema||Object.keys(defaults).some(k=>!seen.has(k)))throw Error('figure_style_schema');return normalize(known(values),baseline);
  }
  function parse(text,baseline,filename=''){
    if(typeof text!=='string'||text.length>16384)throw Error('figure_style_file');text=text.replace(/^\uFEFF/,'');const trimmed=text.trim(),hint=String(filename).toLowerCase().split('.').pop();
    const csv=/^"?name"?\s*,\s*"?value"?(?:\r?\n|$)/.test(trimmed),txt=/^#|^[A-Za-z]\w*\s*(?:\t|=)/m.test(trimmed);
    if(trimmed.startsWith('{')||!csv&&!txt&&hint==='json'){const value=JSON.parse(text);if(!value||value.schema!==schema||!value.style)throw Error('figure_style_schema');return normalize(known(value.style),baseline);}
    if(csv||!txt&&hint==='csv'){const rows=csvRows(text);if(rows.shift()?.join(',')!=='name,value')throw Error('figure_style_columns');return fromRows(rows,baseline);}
    const rows=[];for(const line of text.split(/\r?\n/)){if(!line.trim()||/^\s*#/.test(line))continue;const match=line.match(/^([A-Za-z]\w*)\s*(?:\t|=)\s?(.*)$/);if(!match)throw Error('figure_style_txt');rows.push([match[1],match[2]]);}return fromRows(rows,baseline);
  }
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
    const H=helpTexts[lang]||helpTexts.en,help=make('details'),helpList=make('dl');help.className='zg-figure-help';helpList.className='zg-defs';help.append(make('summary',H.summary),helpList);
    Object.keys(defaults).forEach((key,index)=>{fields[key].title=H.items[index];helpList.append(make('dt',L[index+1]),make('dd',H.items[index]));});helpList.append(make('dt',L[10]+' / '+textLabels[lang]?.[2]||L[10]),make('dd',H.items[8]));
    const TL=textLabels[lang]||textLabels.en,actions=make('div');actions.className='zg-figure-actions';const reset=make('button',L[9]),save=make('button',L[10]),saveCSV=make('button',TL[0]),saveTXT=make('button',TL[1]),load=make('label',TL[2]),file=make('input'),status=make('p'),note=make('p',L[12]);
    reset.type=save.type=saveCSV.type=saveTXT.type='button';file.type='file';file.accept='.csv,.txt,.json,text/csv,text/plain,application/json';load.append(file);status.setAttribute('role','status');status.className='zg-figure-status';note.className='zg-figure-note';actions.append(saveCSV,saveTXT,load,reset,save);details.append(actions,note,status,help);
    const read=()=>normalize(Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,f.value])),base);
    const changed=()=>{revision++;try{const value=read();current=value;status.textContent='';onChange(value);}catch{status.textContent=L[13];}};
    for(const f of Object.values(fields))f.addEventListener('input',changed);
    function set(value,notify=true){const normalized=normalize(value,base);revision++;for(const[key,v]of Object.entries(normalized))fields[key].value=String(v);current=normalized;status.textContent='';if(notify)onChange(normalized);return normalized;}
    reset.onclick=()=>set(base);
    save.onclick=()=>{try{const value=read();host.zgExport?.save(new Blob([serialize(value,base)],{type:'application/json'}),exportName(value,prefix)+'-style.json');status.textContent='';}catch{status.textContent=L[13];}};
    for(const[button,format,encode,mime]of [[saveCSV,'csv',serializeCSV,'text/csv'],[saveTXT,'txt',serializeTXT,'text/plain']])button.onclick=()=>{try{const value=read();host.zgExport?.save(new Blob([encode(value,base)],{type:mime}),exportName(value,prefix)+'-style.'+format);status.textContent='';}catch{status.textContent=L[13];}};
    file.onchange=async()=>{const f=file.files[0];if(!f)return;const started=++revision;try{if(f.size>16384)throw Error('figure_style_file');const text=await f.text();if(started!==revision)return;set(parse(text,base,f.name));}catch{if(started===revision)status.textContent=L[13];}finally{if(file.files[0]===f)file.value='';}};
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
  const api={schema,defaults,bounds,labels,textLabels,helpTexts,normalize,serialize,serializeCSV,serializeTXT,parse,exportName,rasterSize,wrapText,controls,exportSVG};host.ZGFigureStyle=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
