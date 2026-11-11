(()=>{'use strict';
const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('es-EC',{maximumFractionDigits:0}),clean=x=>String(x||'').trim().toUpperCase();
let sitrep=null,historical=null,eventMode='sitrep',eventMetric='impactadas',current='amenazas',unit=[],expo=[],ops={kits:[],bonos:[]},dots=L.layerGroup().addTo(map),geoIndex={},centers={};
const names={amenazas:'Zonas susceptibles',unidades:'Unidades de atención expuestas',poblacion:'Población potencialmente expuesta',proyeccion:'Proyección de kits mínimos',eventos:'Eventos y afectaciones',kits:'Kits y brigadas',bonos:'Bonos de contingencia'};
const fields={f:'f',l:'l'},isExp=v=>['MEDIA','ALTA','MUY ALTA'].includes(clean(v)),threat=()=>$('threat-select').value;
const match=x=>(!$('province').value||clean(x.p)===clean($('province').value))&&(!$('canton').value||clean(x.c)===clean($('canton').value))&&(!$('parish').value||clean(x.r)===clean($('parish').value));
function card(k,v,s=''){return `<div class="module-metric"><small>${k}</small><strong>${typeof v==='number'?fmt(v):v}</strong>${s?`<span>${s}</span>`:''}</div>`}
function legend(title,breaks,cols,extra=''){const el=$('thematic-legend');el.innerHTML='<strong>'+title+'</strong>'+breaks.map((x,i)=>`<div class="item"><span class="swatch" style="background:${cols[i]}"></span>${x}</div>`).join('')+(extra?`<small>${extra}</small>`:'')}
const pal=['#d9e9f5','#9dc5e0','#679ec5','#376f9e','#164875'];
function thresholds(vals){let a=vals.filter(v=>v>0).sort((a,b)=>a-b);if(!a.length)return[];return [...new Set([.2,.4,.6,.8].map(q=>a[Math.min(a.length-1,Math.floor(q*(a.length-1)))]))]}
function showChoropleth(rows,valueKey,title){dots.clearLayers();const sums={};rows.forEach(x=>{if(x.p)sums[x.p]=(sums[x.p]||0)+Number(x[valueKey]||0)});const entries=Object.entries(sums).filter(x=>x[1]>0),ts=thresholds(entries.map(x=>x[1]));if(!entries.length){$('thematic-legend').innerHTML='';return}
 const ranges=ts.map((t,i)=>`${fmt(i?ts[i-1]+1:1)}–${fmt(t)}`);ranges.push(`Más de ${fmt(ts.at(-1)||0)}`);legend(title,ranges,pal,'Círculos de magnitud provincial; posición aproximada, no ubicación de cada entrega.');
 const max=Math.max(...entries.map(x=>x[1]));entries.forEach(([name,n])=>{const pt=centers[name];if(!pt)return;let i=ts.findIndex(t=>n<=t);if(i<0)i=ts.length;let mark=L.circleMarker(pt,{radius:7+19*Math.sqrt(n/max),color:'#fff',weight:1,fillColor:pal[Math.min(i,4)],fillOpacity:.87}).bindPopup(`<b>${name}</b><br>${title}: ${fmt(n)}`);dots.addLayer(mark)})}
function hideFlood(){if(layers.flood&&map.hasLayer(layers.flood))map.removeLayer(layers.flood)}
function showFlood(){if(layers.flood&&!map.hasLayer(layers.flood))layers.flood.addTo(map)}
function unitsSelected(){return expo.filter(x=>match(x)&&(!$('unit-service').value||x.s===$('unit-service').value)&&(!$('unit-modality').value||x.m===$('unit-modality').value)&&(!$('exposure-select').value||clean(x[threat()])===clean($('exposure-select').value))&&(!$('exposed-only').checked||isExp(x[threat()]))) }
function fill(el,vals,placeholder){const old=el.value;el.replaceChildren(new Option(placeholder,''));[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(v=>el.add(new Option(v,v)));if([...el.options].some(x=>x.value===old))el.value=old}
function refreshUnitControls(){let a=expo.filter(x=>match(x));fill($('unit-service'),a.map(x=>x.s),'Todos');fill($('unit-modality'),a.filter(x=>!$('unit-service').value||x.s===$('unit-service').value).map(x=>x.m),'Todas');fill($('exposure-select'),a.map(x=>x[threat()]).filter(x=>x&&x!=='-'),'Todas')}
function render(){dots.clearLayers();const sub=$('enos-subcontrols');sub.hidden=current!=='eventos';sub.innerHTML='';$('module-heading').textContent=names[current];$('module-tag').textContent=['kits','bonos'].includes(current)?'Registros operativos · preliminares':current==='proyeccion'?'Modelo en elaboración · cifras preliminares':'Información institucional · consultar fecha de corte';$('module-description').textContent='';$('unit-controls').hidden=!['unidades','poblacion'].includes(current);
 const el=$('module-metrics');const sel=unitsSelected(),ex=sel.filter(x=>isExp(x[threat()])),usr=ex.reduce((n,x)=>n+Number(x.u||0),0);hideFlood();
 if(current==='amenazas'){
  if(threat()==='f'){showFlood();const f=features.filter(filtered),count={};f.forEach(x=>{let k=clean(x.properties?.sui);count[k]=(count[k]||0)+1});el.innerHTML=card('Polígonos en el territorio',f.length)+card('Alta',count.ALTA||0)+card('Media',count.MEDIA||0)+card('Baja',count.BAJA||0);legend('Susceptibilidad a inundaciones',['Alta','Media','Baja','No aplicable','Sin clasificación'],['#D32F2F','#FBC02D','#388E3C','#BDBDBD','#90A4AE'])}
  else{el.innerHTML=card('Unidades con clasificación de movimientos en masa',expo.filter(x=>match(x)&&isExp(x.l)).length)+card('Capa geográfica','No disponible');$('thematic-legend').innerHTML=''}
 }else if(current==='unidades'||current==='poblacion'){
  el.innerHTML=card('Unidades analizadas',sel.length)+card('Unidades expuestas',ex.length)+card('Usuarios en UA expuestas',usr)+card('Porcentaje expuesto',sel.length?(100*ex.length/sel.length).toFixed(1)+'%':'—');
  let rows=ex.map(x=>({...x,unidades:1,usuarios:Number(x.u||0)}));showChoropleth(rows,current==='unidades'?'unidades':'usuarios',current==='unidades'?'Unidades expuestas':'Usuarios en UA expuestas');
  // Actual location markers for selected units (zoomed province), no false georeferencing
  if($('province').value){const ids=new Set(ex.map(x=>String(x.i)));unit.filter(x=>ids.has(String(x.i))&&match(x)).slice(0,2000).forEach(x=>dots.addLayer(L.circleMarker([x.a,x.o],{radius:3,weight:0,fillColor:'#ffd451',fillOpacity:.7}).bindPopup(x.n||'Unidad de atención')))}
 }else if(current==='kits'){
  const all=ops.kits.filter(x=>!$('province').value||clean(x.p)===clean($('province').value));el.innerHTML=card('Kits entregados reportados',all.reduce((n,x)=>n+x.kits,0))+card('Familias reportadas',all.reduce((n,x)=>n+x.familias,0))+card('Provincias con entregas',new Set(all.map(x=>x.p)).size)+card('Brigadas georreferenciadas','—','Base pendiente');showChoropleth(ops.kits,'kits','Kits entregados');
 }else if(current==='bonos'){
  const all=ops.bonos.filter(x=>(!$('province').value||clean(x.p)===clean($('province').value))&&(!$('canton').value||clean(x.c)===clean($('canton').value)));const sum=k=>all.reduce((n,x)=>n+Number(x[k]||0),0);el.innerHTML=card('Registros habilitados',sum('habilitados'))+card('Registros cobrados',sum('cobrados'))+card('Monto habilitado (USD)',sum('monto_habilitado'))+card('Monto cobrado (USD)',sum('monto_cobrado'));showChoropleth(ops.bonos,'cobrados','Registros cobrados');
 }else if(current==='proyeccion'){
  el.innerHTML=card('Modelo base preliminar',45296)+card('Modelo ajustado preliminar',48806)+card('Horizonte','Marzo 2027')+card('Distribución provincial','En validación');$('thematic-legend').innerHTML='<strong>Proyección de kits mínimos</strong><small>El modelo nacional preliminar todavía no permite representar valores provinciales verificados. No se asignan cifras territoriales artificialmente.</small>';
 }else if(current==='eventos'){
  sub.innerHTML='<label for="event-source">Fuente</label><select id="event-source"><option value="sitrep">SITREP El Niño · Esmeraldas Nro. 53</option><option value="historico">Base histórica de eventos 2010–2026</option></select><label for="event-metric">Indicador del mapa</label><select id="event-metric"><option value="impactadas">Personas impactadas</option><option value="afectadas">Personas afectadas</option><option value="damnificadas">Personas damnificadas</option><option value="eventos">Eventos registrados</option></select><small id="event-source-note"></small>';
  $('event-source').value=eventMode;$('event-metric').value=eventMetric;
  $('event-source').onchange=e=>{eventMode=e.target.value;render()};$('event-metric').onchange=e=>{eventMetric=e.target.value;render()};
  if(eventMode==='sitrep'&&sitrep){
    const rows=sitrep.cantons.filter(x=>!$('canton').value||clean(x.c)===clean($('canton').value));const total=k=>rows.reduce((n,x)=>n+Number(x[k]||0),0);
    const all=!$('province').value||clean($('province').value)==='ESMERALDAS';
    el.innerHTML=card('Eventos registrados',all?total('eventos'):0)+card('Personas impactadas',all?total('impactadas'):0)+card('Personas afectadas',all?total('afectadas'):0)+card('Personas damnificadas',all?total('damnificadas'):0);
    $('event-source-note').textContent='Corte 07/11/2026, 18:00 · Cifras acumuladas desde 29/08/2026 · Solo Esmeraldas; no extrapolables a otras provincias.';
    const palette=['#8bcce8','#58a5d0','#2776a9','#0f456d'];legend('SITREP · '+$('event-metric').selectedOptions[0].text,['1–999','1.000–2.999','3.000–5.999','6.000 o más'],palette,'Datos por cantón; círculos aproximados a partir de unidades de atención.');
    if(all){const relevant=unit.filter(x=>clean(x.p)==='ESMERALDAS');const positions={};for(const x of relevant){const k=clean(x.c);if(!positions[k])positions[k]=[0,0,0];positions[k][0]+=Number(x.a);positions[k][1]+=Number(x.o);positions[k][2]++}
      rows.forEach(x=>{const v=Number(x[eventMetric]||0),pt=positions[clean(x.c)];if(!v||!pt||!pt[2])return;const col=v<1000?palette[0]:v<3000?palette[1]:v<6000?palette[2]:palette[3];dots.addLayer(L.circleMarker([pt[0]/pt[2],pt[1]/pt[2]],{radius:8+Math.sqrt(v)/7,color:'#fff',weight:2,fillColor:col,fillOpacity:.85}).bindPopup('<b>'+x.c+'</b><br>'+eventMetric+': '+fmt(v)+'<br>SITREP Esmeraldas Nro. 53'))});
      if(!$('province').value)map.setView([.85,-79.65],9);
    }
  }else{
    el.innerHTML=card('Base histórica','2010–2026')+card('Registros procesados','Pendiente')+card('Cobertura provincial','Por verificar')+card('Atribución a El Niño','No automática');
    $('event-source-note').textContent='La matriz histórica está disponible como insumo, pero requiere depuración de eventos repetidos y validación de series antes de publicar indicadores.';
    $('thematic-legend').innerHTML='<strong>Base histórica</strong><small>Sin cartografía histórica validada en esta entrega.</small>';
  }
 }
 }
function choose(t){current=t;document.querySelectorAll('.modules button').forEach(b=>{b.classList.toggle('chosen',b.dataset.topic===t);b.setAttribute('aria-pressed',String(b.dataset.topic===t))});render();setTimeout(()=>map.invalidateSize(),150)}
document.querySelectorAll('.modules button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.topic)));
['province','canton','parish','threat-select','unit-service','unit-modality','exposure-select','exposed-only'].forEach(id=>$(id).addEventListener('change',()=>setTimeout(()=>{refreshUnitControls();render()},350)));
Promise.all([fetch('capas/unidades_atencion_0926.json').then(r=>r.json()),fetch('capas/exposicion_ua_0926.json').then(r=>r.json()),fetch('capas/operativo_territorial.json').then(r=>r.json())]).then(([u,e,o])=>{unit=u;expo=e;ops=o;const groups={};u.forEach(x=>{if(!groups[x.p])groups[x.p]=[];groups[x.p].push(x)});Object.entries(groups).forEach(([name,arr])=>centers[name]=[arr.reduce((n,x)=>n+Number(x.a),0)/arr.length,arr.reduce((n,x)=>n+Number(x.o),0)/arr.length]);refreshUnitControls();render()}).catch(e=>{console.error(e);$('module-tag').textContent='Error cargando datos; comprueba Live Server'});
fetch('capas/sitrep_esmeraldas_53.json').then(r=>r.json()).then(d=>{sitrep=d;if(current==='eventos')render()}).catch(console.error);
choose('amenazas');
})();