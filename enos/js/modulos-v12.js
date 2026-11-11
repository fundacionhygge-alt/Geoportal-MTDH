
(()=>{'use strict';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('es-EC',{maximumFractionDigits:0});
let active='amenazas',ua=[],ops={kits:[],bonos:[]},unitPoints=[],overlay=L.layerGroup().addTo(map);
const names={amenazas:'Zonas susceptibles',unidades:'Unidades expuestas',poblacion:'Usuarios en unidades expuestas',eventos:'Eventos y afectaciones',kits:'Kits y brigadas',bonos:'Bonos de contingencia'};
const metric=(label,v)=>`<div class="module-metric"><small>${label}</small><strong>${fmt(v)}</strong></div>`;
const norm=x=>String(x||'').trim().toUpperCase(),p=()=>norm($('province').value),c=()=>norm($('canton').value),r=()=>norm($('parish').value);
const selected=x=>(!p()||norm(x.p)===p())&&(!c()||norm(x.c)===c())&&(!r()||norm(x.r)===r());
const colors=['#dceaf5','#a9c9df','#689ac3','#2e679e','#15436f'];
const centroid={};function initCentroids(){
 const groups={};unitPoints.forEach(x=>{if(!groups[x.p])groups[x.p]=[];groups[x.p].push(x)});
 Object.entries(groups).forEach(([name,pts])=>{let lat=pts.reduce((n,x)=>n+Number(x.a),0)/pts.length,lon=pts.reduce((n,x)=>n+Number(x.o),0)/pts.length;centroid[name]=[lat,lon]});
}
function quantileThresholds(vals){
 let v=vals.filter(x=>x>0).sort((a,b)=>a-b);if(!v.length)return [];
 let thresholds=[.2,.4,.6,.8].map(q=>v[Math.min(v.length-1,Math.floor(q*(v.length-1)))]);
 return [...new Set(thresholds)];
}
function renderLegend(title,thresholds,metricLabel){
 const legend=$('thematic-legend');if(!thresholds.length){legend.innerHTML='';return}
 const groups=[];let previous=0;
 for(let i=0;i<=thresholds.length;i++){
  const upper=thresholds[i];groups.push({text:upper===undefined?`Más de ${fmt(previous)}`:`${fmt(previous?previous+1:1)} – ${fmt(upper)}`,color:colors[Math.min(i,4)]});previous=upper??previous;
 }
 legend.innerHTML=`<strong>${title}</strong><small>${metricLabel}</small>`+groups.map(g=>`<div class="item"><span class="swatch" style="background:${g.color}"></span>${g.text}</div>`).join('')+`<div class="item"><span class="swatch" style="background:#777"></span>Sin registros</div>`;
}
function thematic(rows,key,label,territoryLevel='p'){
 overlay.clearLayers();if(!rows.length){$('thematic-legend').innerHTML='';return}
 const sums=new Map();
 rows.forEach(x=>{let k=x[territoryLevel];if(!k)return;sums.set(k,(sums.get(k)||0)+(Number(x[key])||0))});
 const entries=[...sums].filter(([_,v])=>v>0);
 const thresholds=quantileThresholds(entries.map(x=>x[1]));
 renderLegend(label,thresholds,'Intervalos calculados para la distribución nacional');
 entries.filter(([name])=>!p()||norm(name)===p()).forEach(([name,n])=>{
  let loc=centroid[name];if(!loc)return;
  const idx=thresholds.findIndex(t=>n<=t),ix=idx<0?thresholds.length:idx;
  const radius=8+Math.sqrt(n/Math.max(1,Math.max(...entries.map(e=>e[1]))))*22;
  const circle=L.circleMarker(loc,{radius,weight:1.5,color:'#ffffff',fillColor:colors[Math.min(ix,4)],fillOpacity:.82});
  circle.bindPopup(`<strong>${name}</strong><br>${label}: ${fmt(n)}`);
  overlay.addLayer(circle);
 });
}
function showFlood(){if(layers.flood&&!map.hasLayer(layers.flood))layers.flood.addTo(map)}
function hideFlood(){if(layers.flood&&map.hasLayer(layers.flood))map.removeLayer(layers.flood)}
function uaSelected(){
 return ua.filter(x=>selected(x)&&(!$('unit-service').value||norm(x.s)===norm($('unit-service').value))&&(!$('unit-modality').value||norm(x.m)===norm($('unit-modality').value)));
}
function render(){
 $('module-heading').textContent=names[active];
 $('module-tag').textContent=active==='kits'?'Kobo · corte 08-11-2026':active==='bonos'?'Reporte · corte 07-11-2026':active==='eventos'?'SITREP pendiente de conciliación':'Unidades · septiembre 2026';
 $('unit-controls').hidden=!['unidades','poblacion'].includes(active);
 const m=$('module-metrics');overlay.clearLayers();$('thematic-legend').innerHTML='';
 const threat=$('threat-select').value,field=threat==='f'?'f':'l';
 if(active==='amenazas'){if(window.ENOS_UNITS)window.ENOS_UNITS.hide();
  if(threat==='f')showFlood();else hideFlood();
  const polys=features.filter(filtered);const counts={};polys.forEach(x=>{let k=norm(x.properties?.sui);counts[k]=(counts[k]||0)+1});
  m.innerHTML=metric('Polígonos en vista',polys.length)+metric('Susceptibilidad alta',counts.ALTA||0)+metric('Susceptibilidad media',counts.MEDIA||0);
  if(threat==='f')$('thematic-legend').innerHTML='<strong>Susceptibilidad a inundaciones</strong>'+[['Alta','#D32F2F'],['Media','#FBC02D'],['Baja','#388E3C'],['No aplicable','#BDBDBD'],['Sin clasificación','#90A4AE']].map(([n,col])=>`<div class="item"><span class="swatch" style="background:${col}"></span>${n}</div>`).join('');
  else m.innerHTML=metric('Cartografía pendiente de incorporación',0);
 }else if(['unidades','poblacion'].includes(active)){
  hideFlood();
  const all=uaSelected(),ex=all.filter(x=>['MEDIA','ALTA','MUY ALTA'].includes(norm(x[field]))),users=ex.reduce((n,x)=>n+(Number(x.u)||0),0);
  m.innerHTML=metric('Unidades analizadas',all.length)+metric('Unidades expuestas',ex.length)+metric('Usuarios en UA expuestas',users)+metric('Porcentaje expuesto',all.length?(100*ex.length/all.length).toFixed(1):0);
  const by=ex.map(x=>({...x,k:1,usuarios:Number(x.u)||0}));
  thematic(by,active==='poblacion'?'usuarios':'k',active==='poblacion'?'Usuarios en UA expuestas':'Unidades expuestas');
  if(window.ENOS_UNITS){if(active==='unidades')window.ENOS_UNITS.show();else window.ENOS_UNITS.hide();}
 }else if(active==='kits'){
  hideFlood();if(window.ENOS_UNITS)window.ENOS_UNITS.hide();
  const all=ops.kits.filter(x=>!p()||norm(x.p)===p());
  const total=all.reduce((n,x)=>n+x.kits,0),familias=all.reduce((n,x)=>n+x.familias,0);
  m.innerHTML=metric('Kits reportados entregados',total)+metric('Familias reportadas',familias)+metric('Provincias con entregas',new Set(all.map(x=>x.p)).size);
  thematic(ops.kits,'kits','Kits entregados');
 }else if(active==='bonos'){
  hideFlood();if(window.ENOS_UNITS)window.ENOS_UNITS.hide();
  const all=ops.bonos.filter(x=>(!p()||norm(x.p)===p())&&(!c()||norm(x.c)===c()));
  const sum=k=>all.reduce((n,x)=>n+(Number(x[k])||0),0);
  m.innerHTML=metric('Registros habilitados',sum('habilitados'))+metric('Registros cobrados',sum('cobrados'))+metric('Monto habilitado (USD)',sum('monto_habilitado'))+metric('Monto cobrado (USD)',sum('monto_cobrado'));
  thematic(ops.bonos,'cobrados','Registros cobrados');
 }else{
  hideFlood();if(window.ENOS_UNITS)window.ENOS_UNITS.hide();m.innerHTML=metric('Registros históricos integrados',0);
 }
 $('module-description').textContent='';
}
function choose(topic){
 active=topic;document.querySelectorAll('.modules button').forEach(b=>{const on=b.dataset.topic===topic;b.classList.toggle('chosen',on);b.setAttribute('aria-pressed',String(on))});
 window.dispatchEvent(new CustomEvent('enos:module-change',{detail:topic}));
 render();setTimeout(()=>map.invalidateSize(),100);
}
document.querySelectorAll('.modules button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.topic)));
['province','canton','parish','threat-select','unit-service','unit-modality','exposure-select','exposed-only'].forEach(id=>$(id).addEventListener('change',()=>setTimeout(render,260)));
Promise.all([
 fetch('capas/exposicion_ua_0926.json').then(r=>r.json()),
 fetch('capas/unidades_atencion_0926.json').then(r=>r.json()),
 fetch('capas/operativo_territorial.json').then(r=>r.json())
]).then(([a,b,o])=>{ua=a;unitPoints=b;ops=o;initCentroids();render()}).catch(e=>console.error('Datos territoriales:',e));
choose('amenazas');
window.ENOS_V12={render};
})();
