(() => {
  "use strict";
  // These are page shortcuts. Every original tool remains on the page.
  const games=document.querySelector("[data-games]");
  if(games){
    const titles={en:{"g-hl":"Half-life","g-rfq":"RFQ / Paul trap","g-laser":"Laser cooling","g-quiz":"Quiz"},zh:{"g-hl":"半衰期","g-rfq":"RFQ / 保罗阱","g-laser":"激光冷却","g-quiz":"问答"},fi:{"g-hl":"Puoliintumisaika","g-rfq":"RFQ / Paul-loukku","g-laser":"Laserjäähdytys","g-quiz":"Tietovisa"},de:{"g-hl":"Halbwertszeit","g-rfq":"RFQ / Paul-Falle","g-laser":"Laserkühlung","g-quiz":"Quiz"},ja:{"g-hl":"半減期","g-rfq":"RFQ / ポールトラップ","g-laser":"レーザー冷却","g-quiz":"クイズ"}};
    const lang=document.documentElement.lang.split("-")[0],nav=document.createElement("nav");nav.className="zg-topic-nav";
    [...games.children].filter(e=>e.tagName==="SECTION"&&e.id).forEach(section=>{const link=document.createElement("a");link.href="#"+section.id;link.textContent=titles[lang]?.[section.id]||section.id.replace("g-","").toUpperCase().replace("TOF","TOF-ICR").replace("PI","PI-ICR").replace("MR","MR-TOF");nav.append(link);});games.prepend(nav);
  }
  document.querySelectorAll("[data-local-tabs]").forEach(root=>{
    const buttons=[...root.querySelectorAll(":scope > .zg-local-tabs [data-local-tab]")],panels=[...root.querySelectorAll(":scope > [data-local-panel]")];
    const select=name=>{buttons.forEach(b=>{const on=b.dataset.localTab===name;b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1;b.classList.toggle("zg-btn-ghost",!on);});panels.forEach(p=>p.hidden=p.dataset.localPanel!==name);dispatchEvent(new Event("resize"));};
    buttons.forEach((b,i)=>{const p=panels.find(p=>p.dataset.localPanel===b.dataset.localTab);p.id=b.id+"-panel";p.setAttribute("role","tabpanel");p.setAttribute("aria-labelledby",b.id);b.setAttribute("aria-controls",p.id);b.addEventListener("click",()=>select(b.dataset.localTab));b.addEventListener("keydown",e=>{let n;if(e.key==="ArrowRight")n=(i+1)%buttons.length;if(e.key==="ArrowLeft")n=(i+buttons.length-1)%buttons.length;if(e.key==="Home")n=0;if(e.key==="End")n=buttons.length-1;if(n!=null){e.preventDefault();select(buttons[n].dataset.localTab);buttons[n].focus();}});});select("classic");
  });
})();
