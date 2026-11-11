'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('es-EC',{maximumFractionDigits:2}).format(n);
const colors={inundaciones:{ALTA:'#d32f2f',MEDIA:'#ffc02e',BAJA:'#2e7d32'},movimientos:{'Muy alta':'#8b1e3f',Alta:'#d32f2f',Media:'#ffc02e'}};
const state={threat:'inundaciones',province:'',canton:'',parish:'',category:'',admin:null,stats:[],bounds:{},geos:{},mapLayer:null,outline:null,token:0};
const map=L.map('map',{preferCanvas:true,zoomControl:false}).setView([-1.9,-78.5],7);L.control.zoom({position:'bottomleft'}).addTo(map);
const bases={light:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}),terrain:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17}),satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:18})};let base=bases.light.addTo(map);
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json()}
function options(id,items,placeholder){const select=$(id);select.replaceChildren(new Option(placeholder,''));items.sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(x=>select.add(new Option(x.name,x.id)));select.disabled=id!=='province'&&items.length===0;}
function updateSelectors(){const a=state.admin;options('province',a.provincias,'Todas las provincias');options('canton',a.cantones.filter(x=>x.province===state.province),'Todos los cantones');options('parish',a.parroquias.filter(x=>x.canton===state.canton),'Todas las parroquias');$('province').value=state.province;$('canton').value=state.canton;$('parish').value=state.parish;}
function categorySelect(){const cats=colors[state.threat];$('category').replaceChildren(new Option('Todos los niveles',''));Object.keys(cats).forEach(c=>$('category').add(new Option(c,c)));$('category').value=state.category;$('legend-items').innerHTML=Object.entries(cats).map(([c,color])=>`<div class="legend-item"><span class="swatch" style="background:${color}"></span>${c}</div>`).join('');}
function selectedRows(){return state.stats.filter(r=>r.amenaza===state.threat&&(!state.province||r.parroquia.startsWith(state.province))&&(!state.canton||r.parroquia.startsWith(state.canton))&&(!state.parish||r.parroquia===state.parish)&&(!state.category||r.categoria===state.category));}
function updateKpis(){const rows=selectedRows(),sum=fn=>rows.filter(fn).reduce((s,r)=>s+r.area_km2,0);const total=sum(r=>state.category||!['SIN','NO APLICABLE'].includes(r.categoria)),hi=sum(r=>['ALTA','Alta','Muy alta'].includes(r.categoria)),med=sum(r=>['MEDIA','Media'].includes(r.categoria));$('k-total').textContent=fmt(total);$('k-high').textContent=fmt(hi);$('k-medium').textContent=fmt(med);$('k-parishes').textContent=new Set(rows.filter(r=>r.area_km2>0).map(r=>r.parroquia)).size.toLocaleString('es-EC');const list=state.admin;const title=state.parish?list.parroquias.find(x=>x.id===state.parish)?.name:state.canton?list.cantones.find(x=>x.id===state.canton)?.name:state.province?list.provincias.find(x=>x.id===state.province)?.name:'Ecuador';$('territory-title').textContent=title+(state.category?' · '+state.category:'');$('detail').textContent=rows.length?`Selección: ${fmt(total)} km² sumados en ${rows.length} combinaciones de parroquia y categoría. La estimación utiliza celdas de 150 m y categorías mutuamente excluyentes por prioridad de amenaza.`:'No existen registros cartográficos para esta combinación. No significa que el territorio carezca de amenaza.';}
function outlineName(){return state.parish?'parroquias':state.canton?'cantones':'provincias'}
function outlineCode(){return state.parish||state.canton||state.province}
function drawOutline(zoom){if(state.outline)map.removeLayer(state.outline);const key=outlineName(),id=outlineCode(),features=state.bounds[key].features;const show=id?features.filter(f=>f.properties.id===id):features;state.outline=L.geoJSON({type:'FeatureCollection',features:show},{style:{color:'#274c70',weight:id?2.2:1.05,fill:false,opacity:.85},onEachFeature:(f,l)=>{l.bindTooltip(f.properties.name);if(!id&&key==='provincias')l.on('click',()=>{state.province=f.properties.id;state.canton='';state.parish='';refresh(true)})}}).addTo(map);if(zoom&&state.outline.getLayers().length)map.fitBounds(!id?L.latLngBounds([[-5.25,-81.4],[1.65,-75.05]]):state.outline.getBounds(),{padding:[25,25],maxZoom:state.parish?13:state.canton?11:9});}
function match(f){const p=f.properties;return (!state.province||p.province===state.province)&&(!state.canton||p.canton===state.canton)&&(!state.parish||p.parish===state.parish)&&(!state.category||p.categoria===state.category)}
async function drawThreat(){
 const token=++state.token;if(state.mapLayer){map.removeLayer(state.mapLayer);state.mapLayer=null}
 const th=state.threat;$('status').textContent='Cargando cartografía…';
 try{
  if(!state.province){
   const cats=state.category?[state.category]:Object.keys(colors[th]).reverse();
   const layers=cats.map(c=>L.imageOverlay('capas/'+th+'_overview_'+c.replaceAll(' ','_')+'.png',[[-5.4,-92.2],[2.0,-74.5]],{opacity:1,interactive:false}));
   if(token!==state.token)return;state.mapLayer=L.layerGroup(layers).addTo(map);
   $('status').textContent='Vista nacional · resolución cartográfica indicativa';
  }else{
   const key=th+'/'+state.province;if(!state.geos[key])state.geos[key]=await getJSON('capas/'+key+'.geojson');
   if(token!==state.token)return;
   const features=state.geos[key].features.filter(f=>match(f)&&!['SIN','NO APLICABLE'].includes(f.properties.categoria));
   state.mapLayer=L.geoJSON({type:'FeatureCollection',features},{style:f=>({stroke:false,fillColor:colors[th][f.properties.categoria]||'#8795a5',fillOpacity:.68}),interactive:false}).addTo(map);
   $('status').textContent=features.length?features.length.toLocaleString('es-EC')+' polígonos visibles · detalle territorial':'Sin cobertura cartográfica para esta selección';
  }
  if(state.outline)state.outline.bringToFront();
 }catch(e){if(token===state.token)$('status').textContent='Error al cargar cartografía: '+e.message;console.error(e)}
}

function refresh(zoom=false){updateSelectors();categorySelect();updateKpis();drawOutline(zoom);drawThreat()}
$('province').addEventListener('change',e=>{state.province=e.target.value;state.canton='';state.parish='';refresh(true)});
$('canton').addEventListener('change',e=>{state.canton=e.target.value;state.parish='';refresh(true)});
$('parish').addEventListener('change',e=>{state.parish=e.target.value;refresh(true)});
$('category').addEventListener('change',e=>{state.category=e.target.value;refresh(false)});
$('home').addEventListener('click',()=>{state.province='';state.canton='';state.parish='';state.category='';refresh(true)});
$('clear-filters').addEventListener('click',()=>{state.province='';state.canton='';state.parish='';state.category='';refresh(true)});
$('basemap').addEventListener('change',e=>{map.removeLayer(base);base=bases[e.target.value].addTo(map);base.bringToBack()});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.threat=b.dataset.threat;state.category='';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('map-title').textContent='Susceptibilidad a '+(state.threat==='inundaciones'?'inundaciones':'movimientos en masa');refresh(false)}));
Promise.all([getJSON('capas/territorios.json'),getJSON('capas/superficies.json'),getJSON('capas/provincias.geojson'),getJSON('capas/cantones.geojson'),getJSON('capas/parroquias.geojson')]).then(([admin,stats,provinces,cantones,parroquias])=>{Object.assign(state,{admin,stats,bounds:{provincias:provinces,cantones,parroquias}});refresh(true)}).catch(e=>{$('status').textContent='Error al iniciar: '+e.message;console.error(e)});
