// Geoportal ENOS V6 — unidades de atención, corte septiembre de 2026.
// Puntos geográficos únicamente. No se calcula exposición a amenazas pendientes de validación.
(()=>{
 const unitCheck={checked:false,addEventListener:()=>{}},svc=document.getElementById('unit-service'),mod=document.getElementById('unit-modality'),count=document.getElementById('unit-count');
 const renderer=L.canvas({padding:0.5});let records=[],unitLayer=L.layerGroup(),loaded=false;
 const palette={'DESARROLLO INFANTIL INTEGRAL':'#39c9f4','PERSONAS ADULTOS MAYORES - PEJ':'#ffcf27','PERSONAS CON DISCAPACIDAD':'#ba8cff','PROTECCION ESPECIAL':'#ff8b82'};
 const clean=s=>String(s||'').trim().toUpperCase();
 const htmlEscape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const same=(a,b)=>clean(a)===clean(b);
 function fill(el,values,label){const old=el.value;el.replaceChildren(new Option(label,''));[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(x=>el.add(new Option(x,x)));if([...el.options].some(o=>o.value===old))el.value=old;}
 function redraw(){unitLayer.clearLayers();if(!loaded)return;const province=document.getElementById('province').value,canton=document.getElementById('canton').value,parish=document.getElementById('parish').value;
 const subset=records.filter(x=>(!province||same(x.p,province))&&(!canton||same(x.c,canton))&&(!parish||same(x.r,parish)));
 fill(svc,subset.map(x=>x.s),'Todos los servicios');fill(mod,subset.filter(x=>!svc.value||x.s===svc.value).map(x=>x.m),'Todas las modalidades');
 const selected=subset.filter(x=>(!svc.value||x.s===svc.value)&&(!mod.value||x.m===mod.value)&&(!window.ENOS_EXPOSURE||window.ENOS_EXPOSURE.accept(x)));
 count.textContent=`${selected.length.toLocaleString('es-EC')} unidades de ${subset.length.toLocaleString('es-EC')} en el territorio seleccionado · Corte septiembre 2026`;
 if(!unitCheck.checked)return;
 for(const x of selected){const marker=L.circleMarker([x.a,x.o],{renderer,radius:4,weight:1,color:'#061b2d',opacity:.85,fillColor:palette[x.s]||'#d8e9ff',fillOpacity:.85});
 marker.bindPopup(`<div class="unit-popup"><b>${htmlEscape(x.n||'Unidad de atención')}</b><br><span>Servicio:</span> ${htmlEscape(x.s)}<br><span>Modalidad:</span> ${htmlEscape(x.m)}<br><span>Territorio:</span> ${htmlEscape([x.p,x.c,x.r].filter(Boolean).join(' · '))}<br><span>Tipo:</span> ${htmlEscape(x.t)}<br><span>Código:</span> ${htmlEscape(x.i)}<br><small>Fuente: MTDH · Septiembre 2026</small></div>`);unitLayer.addLayer(marker);}
 }
 async function ensure(){if(loaded){redraw();return}count.textContent='Cargando unidades de atención...';try{const r=await fetch('capas/unidades_atencion_0926.json');if(!r.ok)throw Error('No se encontró la base');records=await r.json();loaded=true;redraw()}catch(e){count.textContent='Error al cargar las unidades. Abre el proyecto mediante Live Server.';console.error(e)}}
 window.ENOS_UNITS={show(){unitCheck.checked=true;unitLayer.addTo(map);ensure()},hide(){unitCheck.checked=false;map.removeLayer(unitLayer)},refresh:ensure};
 window.addEventListener('enos:exposure-change',()=>{if(loaded)redraw()});
 svc.addEventListener('change',()=>{mod.value='';redraw()});mod.addEventListener('change',redraw);
 ['province','canton','parish'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{if(loaded)setTimeout(redraw,0)}));
 window.addEventListener('enos:module-change',e=>{if(e.detail==='unidades')window.ENOS_UNITS.show();else window.ENOS_UNITS.hide()});
})();
