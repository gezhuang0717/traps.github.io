/* Physical controls: declared decimal precision, one-unit arrow increments. */
(function(host) {
  // Display stepping uses decimal integers so a fine typed tail survives a
  // coarse increment. Physics continues to use binary64 numbers.
  function decimalParts(raw){
    const s=String(raw).trim(),m=s.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if(!m||!(m[2]||m[3])||!Number.isFinite(Number(s)))throw new Error('finite decimal required');
    const exponent=Number(m[4]||0);if(Math.abs(exponent)>600)throw new Error('decimal exponent too large');
    let scale=(m[3]||'').length-exponent,n=BigInt((m[1]==='-'?'-':'')+(m[2]||'0')+(m[3]||''));
    if(scale<0){n*=10n**BigInt(-scale);scale=0;}return {n,scale};
  }
  function stepDecimal(raw,direction,increment='1',min=-Infinity,max=Infinity){
    if(![1,-1].includes(direction)||!(Number(increment)>0))throw new Error('positive increment required');
    const a=decimalParts(raw),b=decimalParts(increment),scale=Math.max(a.scale,b.scale);
    const n=a.n*10n**BigInt(scale-a.scale)+BigInt(direction)*b.n*10n**BigInt(scale-b.scale);
    const sign=n<0n?'-':'',digits=(n<0n?-n:n).toString().padStart(scale+1,'0');
    let text=scale?sign+digits.slice(0,-scale)+'.'+digits.slice(-scale):sign+digits;
    if(Number(text)<min)text=String(min);if(Number(text)>max)text=String(max);
    if(!Number.isFinite(Number(text)))throw new Error('finite result required');return text;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={stepDecimal};
  if(!host.document)return;
  const lang=(document.documentElement.lang||'en').split('-')[0];
  const words={en:['Increase','Decrease'],zh:['增加','减少'],fi:['Suurenna','Pienennä'],de:['Erhöhen','Verringern'],ja:['増やす','減らす']}[lang]||['Increase','Decrease'];
  const scope='[data-games], [data-workbench], .zg-lab';
  function decorate(n) {
    const precise=!!n.dataset.stepIncrement;
    if(n.dataset.decimalControl||n.readOnly||n.disabled||n.step==='1'||['zg-c-m','zg-r-m1','zg-r-m2','zg-u-v'].includes(n.id)||(n.closest('[data-full-precision]')&&!precise)||!n.closest(scope))return;
    n.dataset.decimalControl='true';
    const digits=[3,10].includes(Number(n.dataset.decimalPlaces))?Number(n.dataset.decimalPlaces):2, factor=10**digits;
    const display=x=>digits===3?x.toFixed(3).replace(/0$/,''):x.toFixed(digits);
    const label=n.getAttribute('aria-label')||n.closest('label')?.childNodes[0]?.textContent.trim()||n.name;
    n.setAttribute('aria-label',label);n.inputMode='decimal';
    // Decimal precision and increment size are independent. "any" permits
    // 7.25 even when the increment arrows move from 7.25 to 8.25.
    n.step='any';
    const wrap=document.createElement('span');wrap.className='zg-decimal-spin';n.before(wrap);wrap.append(n);
    const arrows=document.createElement('span');arrows.className='zg-decimal-arrows';wrap.append(arrows);
    const limits=()=>{const range=n.dataset.for?n.closest('.g-box')?.querySelector(`input[type=range][name="${n.dataset.for}"]`):null;return {min:(range?.min||n.min)===''?-Infinity:Number(range?.min||n.min),max:(range?.max||n.max)===''?Infinity:Number(range?.max||n.max)};};
    const format=()=>{if(precise)return;if(n.value!==''&&Number.isFinite(n.valueAsNumber)){const old=n.valueAsNumber,rounded=Number(old.toFixed(digits)),{min,max}=limits();if(rounded>=min&&rounded<=max){n.value=display(rounded);if(old!==rounded){n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));}}}};
    const move=direction=>{if(n.value==='')return;const old=n.valueAsNumber;if(!Number.isFinite(old))return;const {min,max}=limits(),low=Number.isFinite(min)?Math.ceil(min*factor-1e-9)/factor:min,high=Number.isFinite(max)?Math.floor(max*factor+1e-9)/factor:max;n.setCustomValidity('');
      if(precise){try{n.value=stepDecimal(n.value,direction,n.dataset.stepIncrement,min,max);}catch(_){return;}}
      else n.value=display(Math.max(low,Math.min(high,Math.round((old+direction)*factor)/factor)));
      n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));format();};
    for(const [direction,symbol,word]of [[1,'▴',words[0]],[-1,'▾',words[1]]]){const b=document.createElement('button');b.type='button';b.textContent=symbol;b.setAttribute('aria-label',`${word}: ${label}`);b.addEventListener('click',()=>move(direction));arrows.append(b);}
    n.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();move(e.key==='ArrowUp'?1:-1);}});
    n.addEventListener('change',format);n.addEventListener('blur',format);format();
  }
  const scan=node=>{if(node.nodeType!==1)return;if(node.matches('input[type=number]'))decorate(node);node.querySelectorAll('input[type=number]').forEach(decorate);};
  scan(document.documentElement);new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
})(typeof globalThis!=='undefined'?globalThis:window);
