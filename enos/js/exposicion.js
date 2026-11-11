// Geoportal ENOS V7 — clasificación de exposición suministrada por DGID, septiembre de 2026.
(()=>{
'use strict';
const $=id=>document.getElementById(id),threat=$('threat-select'),category=$('exposure-select'),only=$('exposed-only'),summary=$('exposure-summary'),bars=$('exposure-bars');
let data=[];
const clean=x=>String(x||'').trim().toLocaleUpperCase('es');
const fmt=n=>Number(n).toLocaleString('es-EC');
const isExposed=x=>['MEDIA','ALTA','MUY ALTA'].includes(clean(x));
const displayCategory=x=>!x||x==='-'?'Sin exposición identificada':x;
const selected=()=>data.filter(x=>(!$('province').value||clean(x.p)===clean($('province').value))&&(!$('canton').value||clean(x.c)===clean($('canton').value))&&(!$('parish').value||clean(x.r)===clean($('parish').value))&&(!$('unit-service').value||clean(x.s)===clean($('unit-service').value))&&(!$('unit-modality').value||clean(x.m)===clean($('unit-modality').value)));
function render(){if(!data.length)return;const subset=selected(),field=threat.value;
const old=category.value;const options=[...new Set(subset.map(x=>displayCategory(x[field])))].sort((a,b)=>a.localeCompare(b,'es'));category.replaceChildren(new Option('Todas',''));options.forEach(x=>category.add(new Option(x,x)));if(options.includes(old))category.value=old;
const matching=subset.filter(x=>(!category.value||displayCategory(x[field])===category.value)&&(!only.checked||isExposed(x[field])));
const exposed=matching.filter(x=>isExposed(x[field]));const users=exposed.reduce((n,x)=>n+(Number(x.u)||0),0);
summary.innerHTML=`<div><strong>${fmt(exposed.length)}</strong> UA expuestas · <strong>${fmt(users)}</strong> usuarios</div><div>${fmt(matching.length)} UA filtradas de ${fmt(subset.length)}</div>`;
const counts=new Map();matching.forEach(x=>{const c=displayCategory(x[field]);counts.set(c,(counts.get(c)||0)+1)});
bars.replaceChildren();[...counts].sort((a,b)=>b[1]-a[1]).forEach(([name,num])=>{const div=document.createElement('div');div.className='exposure-bar';const head=document.createElement('div');head.className='bar-head';const label=document.createElement('span');label.textContent=name;const val=document.createElement('strong');val.textContent=fmt(num);head.append(label,val);const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill '+(clean(name)==='ALTA'||clean(name)==='MUY ALTA'?'high':clean(name)==='MEDIA'?'medium':'other');fill.style.width=(matching.length?num/matching.length*100:0)+'%';track.append(fill);div.append(head,track);bars.append(div)});
// Filter the existing V6 point markers using their code, preserving original georeferencing.
const byId=new Map();data.forEach(x=>{const key=String(x.i);if(!byId.has(key))byId.set(key,[]);byId.get(key).push(x)});
window.ENOS_EXPOSURE={byId,records:data,accept(x){const matches=this.byId.get(String(x.i))||[];const d=matches.find(y=>clean(y.n)===clean(x.n)&&clean(y.p)===clean(x.p)&&clean(y.c)===clean(x.c)&&clean(y.s)===clean(x.s))||matches.find(y=>clean(y.n)===clean(x.n)&&clean(y.p)===clean(x.p))||(matches.length===1?matches[0]:null);if(!d)return !only.checked&&!category.value;return (!only.checked||isExposed(d[threat.value]))&&(!category.value||displayCategory(d[threat.value])===category.value)},render};
window.dispatchEvent(new Event('enos:exposure-change'));
}
fetch('capas/exposicion_ua_0926.json').then(r=>{if(!r.ok)throw Error('Archivo de exposición no disponible');return r.json()}).then(rows=>{data=rows;render();}).catch(e=>{summary.textContent='No se pudieron cargar los resultados. Abre el proyecto con Live Server.';console.error(e)});
[threat,category,only].forEach(el=>el.addEventListener('change',()=>{if(el===threat)category.value='';render()}));
['province','canton','parish','unit-service','unit-modality'].forEach(id=>$(id).addEventListener('change',()=>setTimeout(render,60)));

})();
