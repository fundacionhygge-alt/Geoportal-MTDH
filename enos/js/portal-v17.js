(()=>{'use strict';
const $=id=>document.getElementById(id),fmt=x=>Number(x||0).toLocaleString('es-EC',{maximumFractionDigits:0}),money=x=>Number(x||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2}),norm=x=>String(x||'').trim().toLocaleUpperCase('es-EC');
const title={amenazas:'Zonas susceptibles',unidades:'Unidades de atención expuestas',poblacion:'Población potencialmente expuesta',proyeccion:'Proyección de kits mínimos',alojamientos:'Alojamientos temporales identificados',eventos:'Eventos y afectaciones',kits:'Kits entregados',brigadas:'Brigadas de emergencia',bonos:'Bonos de contingencia'};
const pal=['#b9d8e9','#83b9d5','#488ab9','#28628f','#113d68'];
const pin=L.layerGroup().addTo(map);let mode='amenazas',units=[],exposure=[],operations={kits:[],bonos:[]},series=[],esmeraldas=null,centers={},historicalMode='sitrep',indicator='familias',month='noviembre',bonusMetric='cobrados',stock=null,brigades=[],shelters=[],shelterModality='',shelterQualification='';
const selected=x=>(!$('province').value||norm(x.p)===norm($('province').value))&&(!$('canton').value||norm(x.c)===norm($('canton').value))&&(!$('parish').value||norm(x.r)===norm($('parish').value));
const ex=v=>['MEDIA','ALTA','MUY ALTA'].includes(norm(v));const threat=()=>$('threat-select').value;
const card=(name,value,note='')=>`<div class="module-metric"><small>${name}</small><strong>${typeof value==='number'?fmt(value):value}</strong>${note?`<span>${note}</span>`:''}</div>`;
const sum=(a,k)=>a.reduce((v,x)=>v+Number(x[k]||0),0);
function legend(name,items,note=''){ $('thematic-legend').innerHTML=`<strong>${name}</strong>`+items.map(x=>`<div class="item"><span class="swatch" style="background:${x[0]}"></span>${x[1]}</div>`).join('')+(note?`<small>${note}</small>`:''); }
function breaks(values){const a=values.filter(x=>x>0).sort((x,y)=>x-y);if(!a.length)return[];return [...new Set([.2,.4,.6,.8].map(q=>a[Math.min(a.length-1,Math.floor((a.length-1)*q))]))]}
function circles(values,label,unit='registros'){
 pin.clearLayers();
 const entries=Object.entries(values).filter(([p,n])=>Number(n)>0&&centers[norm(p)]&&(!$('province').value||norm(p)===norm($('province').value)));
 if(!entries.length){legend(label,[],'Sin valores positivos con ubicación territorial disponible para los filtros seleccionados.');return}
 // Los cortes se estiman a partir de la distribución nacional para que no cambien al filtrar una provincia.
 const national=Object.values(values).map(Number).filter(n=>Number.isFinite(n)&&n>0);
 const thresholds=breaks(national),max=Math.max(...national);
 const limits=[0,...thresholds,Infinity];
 const ranges=[];
 for(let i=0;i<limits.length-1;i++){
  const lo=i===0?Math.min(...national):thresholds[i-1]+(unit==='USD'?0.01:1);
  const hi=limits[i+1];
  if(Number.isFinite(hi)&&lo>hi)continue;
  ranges.push({i,label:Number.isFinite(hi)?`${unit==='USD'?money(lo):fmt(lo)} – ${unit==='USD'?money(hi):fmt(hi)}`:`Más de ${unit==='USD'?money(thresholds.at(-1)):fmt(thresholds.at(-1))}`});
 }
 $('thematic-legend').innerHTML=`<strong>${label}</strong><small>Unidad: ${unit} · Círculos graduados por cantidad</small>`+ranges.map(({i,label:r})=>`<div class="item"><span class="legend-circle" style="--dot-color:${pal[Math.min(i,4)]};--dot-size:${10+i*5}px"></span><span>${r}</span></div>`).join('')+'<small>Los rangos corresponden a la distribución de los valores territoriales positivos. Los círculos indican concentración territorial, no la ubicación exacta de cada entrega o cobro. Sin dato no equivale a cero.</small>';
 entries.forEach(([p,n])=>{let ix=thresholds.findIndex(x=>n<=x);if(ix<0)ix=thresholds.length;const radius=5+2.5*Math.min(ix,4);pin.addLayer(L.circleMarker(centers[norm(p)],{radius,color:'#e5f4ff',weight:1.2,fillColor:pal[Math.min(ix,4)],fillOpacity:.87}).bindPopup(`<b>${p}</b><br>${label}: ${unit==='USD'?money(n):fmt(n)} ${unit}`))});
}

function grouped(a,key){const r={};a.forEach(x=>{if(x.p)r[x.p]=(r[x.p]||0)+Number(x[key]||0)});return r}
function hideFlood(){if(layers.flood&&map.hasLayer(layers.flood))map.removeLayer(layers.flood)}
function showFlood(){if(layers.flood&&!map.hasLayer(layers.flood))layers.flood.addTo(map)}
function unitSelection(){return exposure.filter(x=>selected(x)&&(!$('unit-service').value||x.s===$('unit-service').value)&&(!$('unit-modality').value||x.m===$('unit-modality').value)&&(!$('exposure-select').value||norm(x[threat()])===norm($('exposure-select').value))&&(!$('exposed-only').checked||ex(x[threat()]))) }
function fill(id,items,label){const el=$(id),old=el.value;el.replaceChildren(new Option(label,''));[...new Set(items.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(x=>el.add(new Option(x,x)));if([...el.options].some(x=>x.value===old))el.value=old}
function refreshControls(){
 const base=exposure.filter(selected);
 fill('unit-service',base.map(x=>x.s),'Todos');
 const byService=base.filter(x=>!$('unit-service').value||x.s===$('unit-service').value);
 fill('unit-modality',byService.map(x=>x.m),'Todas');
 const byModality=byService.filter(x=>!$('unit-modality').value||x.m===$('unit-modality').value);
 fill('exposure-select',byModality.map(x=>x[threat()]).filter(x=>x&&x!=='-'&&!['SIN','NO APLICABLE'].includes(norm(x))),'Todas');
}
function eventControls(){const wrap=$('enos-subcontrols');wrap.hidden=false;wrap.innerHTML=`<label for="event-view">Análisis</label><select id="event-view"><option value="sitrep">Seguimiento El Niño 2026 · SITREP</option><option value="esmeraldas">Detalle cantonal · Esmeraldas</option><option value="historico">Histórico desde 2010 · en depuración</option></select><label for="event-month">Período</label><select id="event-month"><option value="septiembre">Septiembre</option><option value="octubre">Octubre</option><option value="noviembre">Noviembre (01–07)</option><option value="acumulado">Acumulado al 07/11</option></select><small id="event-method"></small>`;
 $('event-view').value=historicalMode;$('event-month').value=month;
 $('event-view').onchange=e=>{historicalMode=e.target.value;render()};$('event-month').onchange=e=>{month=e.target.value;render()};}
function render(){pin.clearLayers();hideFlood();$('module-heading').textContent=title[mode];$('module-description').textContent='';$('module-tag').textContent='';$('enos-subcontrols').hidden=true;$('enos-subcontrols').innerHTML='';$('unit-controls').hidden=!['unidades','poblacion'].includes(mode);
 const el=$('module-metrics');let values={};
 if(mode==='amenazas'){
  $('module-tag').textContent='Cartografía de susceptibilidad · fuente geográfica original';
  if(threat()==='f'){
   showFlood();const list=features.filter(x=>filtered(x)&&['ALTA','MEDIA','BAJA'].includes(norm(x.properties?.sui))),count={};list.forEach(x=>{const k=norm(x.properties?.sui);count[k]=(count[k]||0)+1});
   el.innerHTML=card('Polígonos visualizados',list.length)+card('Susceptibilidad alta',count.ALTA||0)+card('Susceptibilidad media',count.MEDIA||0)+card('Susceptibilidad baja',count.BAJA||0);
   legend('Susceptibilidad a inundaciones',[['#D32F2F','Alta'],['#FBC02D','Media'],['#388E3C','Baja']],'Susceptibilidad no equivale a afectación real. Galápagos: cobertura de esta fuente no validada.');
  }else{el.innerHTML=card('Unidades de atención con exposición media o alta',exposure.filter(x=>selected(x)&&ex(x.l)).length)+card('Polígonos de movimientos en masa','No incorporados');legend('Movimientos en masa',[],'Existe clasificación de exposición de unidades de atención; no se ha incorporado la cartografía de amenaza.');}
 }else if(mode==='unidades'||mode==='poblacion'){
  const all=unitSelection(),a=all.filter(x=>ex(x[threat()])),users=sum(a,'u');
  $('module-tag').textContent='Unidades de atención · septiembre de 2026';
  el.innerHTML=card('Unidades de atención analizadas',all.length)+card('Unidades de atención expuestas',a.length)+card('Usuarios en unidades expuestas',users)+card('Porcentaje de unidades expuestas',all.length?(100*a.length/all.length).toFixed(1)+'%':'—');
  values=grouped(a.map(x=>({...x,unidades:1,usuarios:Number(x.u||0)})),mode==='unidades'?'unidades':'usuarios');circles(values,mode==='unidades'?'Unidades de atención expuestas':'Usuarios en unidades de atención expuestas');
  const cat={};a.forEach(x=>{const k=norm(x[threat()]);cat[k]=(cat[k]||0)+1});$('thematic-legend').insertAdjacentHTML('beforeend','<small>Clasificación de unidades de atención expuestas: '+Object.entries(cat).sort().map(([k,n])=>k+': '+fmt(n)).join(' · ')+'</small>');
  if($('province').value){const ids=new Set(a.map(x=>String(x.i)));units.filter(x=>ids.has(String(x.i))&&selected(x)).forEach(x=>{if(Number.isFinite(Number(x.a))&&Number.isFinite(Number(x.o))&&Number(x.a)!==0&&Number(x.o)!==0)pin.addLayer(L.circleMarker([Number(x.a),Number(x.o)],{radius:4,color:'#9ed7ff',weight:1,fillColor:'#1766a2',fillOpacity:.88}).bindPopup(`<b>${x.n||'Unidad de atención'}</b><br>${x.p} · ${x.c} · ${x.r||'—'}<br>${x.s||'—'}<br>${x.m||'—'}<br>Código: ${x.i||'—'}`))})}
  if($('province').value){$('map-status').textContent=fmt(a.length)+' unidades de atención expuestas georreferenciadas en el territorio seleccionado';}else{$('map-status').textContent='Vista nacional agrupada por provincia · selecciona una provincia para ver puntos individuales';}
  if(mode==='poblacion'){$('module-heading').textContent='Usuarios en unidades de atención expuestas';$('module-tag').textContent='Indicador parcial: no equivale a población potencialmente expuesta total';}
 }else if(mode==='alojamientos'){
  $('module-tag').textContent='Infraestructura identificada · base de evaluación, no activaciones ENOS';
  const base=shelters.filter(selected);
  const wrap=$('enos-subcontrols');wrap.hidden=false;
  const modalities=[...new Set(base.map(x=>x.m).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const qualified=[...new Set(base.map(x=>x.q).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const option=(v,selected)=>'<option value="'+v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"'+(selected===v?' selected':'')+'>'+v.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</option>';
  if(shelterModality&&!modalities.includes(shelterModality))shelterModality='';
  const modalityBase=base.filter(x=>!shelterModality||x.m===shelterModality);
  const quals=[...new Set(modalityBase.map(x=>x.q).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  if(shelterQualification&&!quals.includes(shelterQualification))shelterQualification='';
  wrap.innerHTML='<label for="shelter-modality">Modalidad</label><select id="shelter-modality"><option value="">Todas</option>'+modalities.map(x=>option(x,shelterModality)).join('')+'</select><label for="shelter-qualification">Calificación</label><select id="shelter-qualification"><option value="">Todas</option>'+quals.map(x=>option(x,shelterQualification)).join('')+'</select>';
  $('shelter-modality').onchange=e=>{shelterModality=e.target.value;shelterQualification='';render()};
  $('shelter-qualification').onchange=e=>{shelterQualification=e.target.value;render()};
  const a=modalityBase.filter(x=>!shelterQualification||x.q===shelterQualification);
  const numeric=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;
  const people=a.reduce((n,x)=>n+numeric(x.personas),0),families=a.reduce((n,x)=>n+numeric(x.familias),0);
  el.innerHTML=card('Alojamientos identificados',a.length)+card('Capacidad registrada · personas',people)+card('Capacidad registrada · familias',families)+card('Provincias con registros',new Set(a.map(x=>norm(x.p))).size);
  const groupedByProvince={},shelterCenters={};a.forEach(x=>{const p=norm(x.p);if(p){groupedByProvince[p]=(groupedByProvince[p]||0)+1;if(!shelterCenters[p])shelterCenters[p]=[0,0,0];shelterCenters[p][0]+=Number(x.a);shelterCenters[p][1]+=Number(x.o);shelterCenters[p][2]++}});Object.entries(shelterCenters).forEach(([p,v])=>{if(!centers[p])centers[p]=[v[0]/v[2],v[1]/v[2]]});
  circles(groupedByProvince,'Alojamientos identificados por provincia','alojamientos');
  const qCounts={};a.forEach(x=>{const k=x.q||'Sin calificación';qCounts[k]=(qCounts[k]||0)+1});
  $('thematic-legend').insertAdjacentHTML('beforeend','<small>Calificación: '+Object.entries(qCounts).map(([k,v])=>k.replace(/</g,'&lt;')+': '+fmt(v)).join(' · ')+'</small><small>Identificación o aptitud no acreditan disponibilidad operativa, activación ni ocupación actual.</small>');
  if($('province').value){a.forEach(x=>{pin.addLayer(L.circleMarker([Number(x.a),Number(x.o)],{radius:4,color:'#e7f3ff',weight:1,fillColor:'#3b91c9',fillOpacity:.8}).bindPopup('<b>'+String(x.n).replace(/</g,'&lt;')+'</b><br>'+[x.p,x.c,x.r].map(y=>String(y||'').replace(/</g,'&lt;')).join(' · ')+'<br>Modalidad: '+String(x.m).replace(/</g,'&lt;')+'<br>Calificación: '+String(x.q).replace(/</g,'&lt;')+'<br>Capacidad registrada: '+fmt(x.personas)+' personas / '+fmt(x.familias)+' familias'))});}
  $('module-description').textContent='Registro preventivo de infraestructura evaluada; no representa alojamientos activados desde el 29/08/2026.';
 }else if(mode==='kits'){
  const a=(operations.kits||[]).filter(x=>selected(x)&&(!x.fecha||(x.fecha>='2026-08-29'&&x.fecha<='2026-11-08')));$('module-tag').textContent='Registro institucional de entregas · corte 08/11/2026';
  el.innerHTML=card('Kits entregados reportados',sum(a,'kits'))+card('Familias reportadas',sum(a,'familias'))+card('Provincias con registros',new Set(a.map(x=>x.p)).size)+card('Fecha inicial','29/08/2026');circles(grouped(a,'kits'),'Kits entregados por provincia','kits');
 }else if(mode==='brigadas'){
  const a=brigades.filter(x=>selected(x)&&(!x.fecha||(x.fecha>='2026-08-29'&&x.fecha<='2026-11-05'))),total=a.length;
  $('module-tag').textContent='Brigadas clasificadas como emergencia · 29/08/2026–05/11/2026';
  el.innerHTML=card('Brigadas de emergencia',total)+card('Población alcanzada',sum(a,'alcanzada'))+card('Población atendida',sum(a,'atendida'))+card('Provincias con brigadas',new Set(a.map(x=>x.p)).size);
  circles(grouped(a.map(x=>({...x,n:1})),'n'),'Brigadas de emergencia por provincia','brigadas');
  $('module-description').textContent='La clasificación «Emergencia» no identifica por sí sola la causa del evento. Registros ubicados por territorio, no por coordenada exacta.';
 }else if(mode==='bonos'){
  const a=(operations.bonos||[]).filter(x=>selected(x)&&(!x.fecha||(x.fecha>='2026-08-29'&&x.fecha<='2026-11-08')));$('module-tag').textContent='Registro operativo de bonos · preliminar';
  el.innerHTML=card('Registros habilitados',sum(a,'habilitados'))+card('Registros cobrados',sum(a,'cobrados'))+card('Monto habilitado · USD',money(sum(a,'monto_habilitado')))+card('Monto cobrado · USD',money(sum(a,'monto_cobrado')));
  const names={habilitados:'Familias habilitadas',cobrados:'Familias cobradas',monto_habilitado:'Monto habilitado',monto_cobrado:'Monto cobrado'};
  const wrap=$('enos-subcontrols');wrap.hidden=false;wrap.innerHTML='<label for="bonus-metric">Indicador del mapa</label><select id="bonus-metric"><option value="cobrados">Familias cobradas</option><option value="habilitados">Familias habilitadas</option><option value="monto_cobrado">Monto cobrado (USD)</option><option value="monto_habilitado">Monto habilitado (USD)</option></select>';
  $('bonus-metric').value=bonusMetric;$('bonus-metric').onchange=e=>{bonusMetric=e.target.value;render()};
  circles(grouped(a,bonusMetric),names[bonusMetric]+' por provincia',bonusMetric.startsWith('monto_')?'USD':'familias');
 }else if(mode==='proyeccion'){
  $('module-tag').textContent='Modelo metodológico · noviembre 2026 a marzo 2027';
  const wrap=$('enos-subcontrols');wrap.hidden=false;wrap.innerHTML='<label for="stock-month">Mes de planificación</label><select id="stock-month"><option value="0">Noviembre 2026</option><option value="1">Diciembre 2026</option><option value="2">Enero 2027</option><option value="3">Febrero 2027</option><option value="4">Marzo 2027</option></select>';
  const mi=Number(window.enosStockMonth||0);$('stock-month').value=String(mi);$('stock-month').onchange=e=>{window.enosStockMonth=Number(e.target.value);render()};
  const a=(stock?.rows||[]).filter(selected),national=(stock?.rows||[]).reduce((n,x)=>n+Number(x.v[mi]||0),0),territorial=a.reduce((n,x)=>n+Number(x.v[mi]||0),0);
  el.innerHTML=card('Stock mínimo referencial · selección',territorial)+card('Referencia nacional del mes',national)+card('Mes',stock?.months?.[mi]||'Sin datos')+card('Provincias incluidas',a.length);
  circles(Object.fromEntries(a.map(x=>[x.p,x.v[mi]])),'Stock mínimo referencial por provincia','kits');
  $('module-description').textContent='Niveles de reserva mensual no acumulables. No equivalen a kits entregados ni a cantidades definitivas de compra.';
 }else if(mode==='eventos'){
  eventControls();$('module-tag').textContent='SITREP oficiales · acumulados sujetos a revisión';
  if(historicalMode==='sitrep'){

   const a=series.filter(selected),k=month==='acumulado'?'nov_acum':month;
   const total=sum(a,k);el.innerHTML=card('Familias afectadas · '+(month==='acumulado'?'acumulado':month),total)+card('Provincias con registro',a.filter(x=>Number(x[k])>0).length)+card('Acumulado nacional 07/11',sum(series,'nov_acum'))+card('Cortes nacionales utilizados',3);
   circles(Object.fromEntries(a.map(x=>[x.p,Number(x[k])||0])),'Familias afectadas · '+month);
   $('event-method').textContent='Serie reconstruida por variaciones netas de acumulados SITREP 14, 65 y 77. No corresponde necesariamente al mes de ocurrencia; las correcciones pueden generar valores negativos.';
  }else if(historicalMode==='esmeraldas'&&esmeraldas){
   const a=esmeraldas.cantons.filter(x=>!$('canton').value||norm(x.c)===norm($('canton').value)),ok=!$('province').value||norm($('province').value)==='ESMERALDAS';
   const n=k=>ok?sum(a,k):0;el.innerHTML=card('Eventos',n('eventos'))+card('Personas impactadas',n('impactadas'))+card('Personas afectadas',n('afectadas'))+card('Personas damnificadas',n('damnificadas'));
   const local={};units.filter(x=>norm(x.p)==='ESMERALDAS').forEach(x=>{const k=norm(x.c);if(!local[k])local[k]=[0,0,0];local[k][0]+=Number(x.a);local[k][1]+=Number(x.o);local[k][2]++});
   const data=a.map(x=>[x.c,Number(x.impactadas||0)]).filter(x=>x[1]>0);const t=breaks(data.map(x=>x[1]));legend('Personas impactadas · cantones',t.map((v,i)=>[pal[i],`${fmt(i?t[i-1]+1:1)}–${fmt(v)}`]).concat([[pal[Math.min(t.length,4)],`Más de ${fmt(t.at(-1)||0)}`]]),'SITREP Esmeraldas Nro. 53; ubicaciones aproximadas, no puntos de evento.');
   if(ok)data.forEach(([c,v])=>{const z=local[norm(c)];if(z){pin.addLayer(L.circleMarker([z[0]/z[2],z[1]/z[2]],{radius:8+Math.sqrt(v)/8,color:'#fff',weight:1,fillColor:'#e0a548',fillOpacity:.9}).bindPopup(`<b>${c}</b><br>Personas impactadas: ${fmt(v)}`))}});
   $('event-method').textContent='Esmeraldas: datos cantonales acumulados al 07/11/2026; no sumarlos a las cifras nacionales.';
  }else{el.innerHTML=card('Período','2010–2026')+card('Eventos históricos','Depuración pendiente')+card('Coordenadas','En revisión')+card('Atribución a El Niño','No automática');legend('Base histórica',[],'La matriz histórica aún no está depurada ni validada para publicación cartográfica.');$('event-method').textContent='El histórico desde 2010 no debe mezclarse con los SITREP de El Niño 2026.';}
 }
 if(mode!=='amenazas'&&mode!=='unidades'&&mode!=='poblacion')$('map-status').textContent=title[mode]+' · '+([$('province').value,$('canton').value,$('parish').value].filter(Boolean).join(' · ')||'Ecuador');
}
function choose(topic){mode=topic;document.querySelectorAll('.modules button').forEach(b=>{b.classList.toggle('chosen',b.dataset.topic===topic);b.setAttribute('aria-pressed',String(b.dataset.topic===topic))});render();setTimeout(()=>map.invalidateSize(),100)}
document.querySelectorAll('.modules button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.topic)));
['province','canton','parish','threat-select','unit-service','unit-modality','exposure-select','exposed-only'].forEach(id=>$(id).addEventListener('change',()=>{setTimeout(()=>{refreshControls();render()},120)}));
window.addEventListener('enos:territory',()=>{shelterModality='';shelterQualification='';refreshControls();render()});
// Populate province centers from actual georeferenced unit coordinates; Galápagos remains selectable even when susceptibility polygons absent.
// Carga independiente: un archivo defectuoso no bloquea el resto del geoportal.
const load=(file,apply)=>fetch('capas/'+file).then(r=>{if(!r.ok)throw Error(file+': HTTP '+r.status);return r.json()}).then(apply).catch(err=>{console.error('No se pudo cargar',file,err);$('module-tag').textContent='Datos parcialmente disponibles · comprueba la consola y Live Server';});
const recalcCenters=()=>{const c={};units.forEach(x=>{const a=Number(x.a),o=Number(x.o);if(!Number.isFinite(a)||!Number.isFinite(o)||a===0&&o===0)return;const p=norm(x.p);if(!c[p])c[p]=[0,0,0];c[p][0]+=a;c[p][1]+=o;c[p][2]++});Object.entries(c).forEach(([p,a])=>centers[p]=[a[0]/a[2],a[1]/a[2]]);centers['GALÁPAGOS']=centers['GALÁPAGOS']||[-0.74,-90.35];};
Promise.allSettled([
 load('unidades_atencion_0926.json',u=>{units=u;recalcCenters();render()}),
 load('exposicion_ua_0926.json',e=>{exposure=e;refreshControls();render()}),
 load('operativo_territorial.json',o=>{operations=o;render()}),
 load('serie_familias_2026.json',s=>{series=s.rows||[];render()}),
 load('sitrep_esmeraldas_53.json',es=>{esmeraldas=es;render()}),
 load('stock_minimo_validado.json',s=>{stock=s;render()}),
 load('brigadas_emergencia_enos.json',s=>{brigades=s.rows||[];render()}),
 load('alojamientos_identificados.json',s=>{shelters=s;render()})
]).then(()=>{refreshControls();recalcCenters();render()});
choose('amenazas');
})();
