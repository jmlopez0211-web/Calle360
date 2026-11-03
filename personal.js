/* CALLE360 Personal: importación privada de contactos y ubicación de compañeros */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const api = () => window.C360Store;
const esc = s => String(s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pendingPointId = null;

function status(message){const el=$('personalImportStatus');if(el)el.textContent=message;}

function parseVcf(text){
  const unfolded=text.replace(/\r?\n[ \t]/g,'');
  return unfolded.split(/BEGIN:VCARD/i).slice(1).map(chunk=>{
    const out={};
    chunk.split(/\r?\n/).forEach(line=>{
      const i=line.indexOf(':');if(i<0)return;
      const key=line.slice(0,i).split(';')[0].toUpperCase();
      const value=line.slice(i+1).replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
      if(key==='FN')out.name=value;
      if(key==='N'&&!out.name)out.name=value.split(';').filter(Boolean).reverse().join(' ');
      if(key==='TEL'&&!out.tel)out.tel=value;
      if(key==='EMAIL'&&!out.email)out.email=value;
      if(key==='ORG')out.org=value;
      if(key==='TITLE')out.role=value;
      if(key==='ADR'&&!out.address)out.address=value.split(';').filter(Boolean).join(', ');
    });
    return out;
  }).filter(c=>c.name||c.tel||c.email);
}

function normalize(c){
  const first=v=>Array.isArray(v)?v[0]:v;
  return {
    name:String(first(c.name||c.fn)||'Contacto sin nombre').trim(),
    role:String(c.role||c.org||'').trim(),
    province:'',
    method:String(first(c.tel)||first(c.email)||'').trim(),
    phone:String(first(c.tel)||'').trim(),
    email:String(first(c.email)||'').trim(),
    address:typeof first(c.address)==='string'?first(c.address):'',
    notes:'Importado desde la agenda del teléfono'
  };
}

function importContacts(items,source){
  const store=api();if(!store)return;
  const existing=store.read('contacts');
  const keys=new Set(existing.map(c=>(c.name||'').toLocaleLowerCase('es')+'|'+(c.phone||c.method||'').replace(/\s/g,'')));
  const added=[];
  items.map(normalize).forEach(c=>{
    const key=c.name.toLocaleLowerCase('es')+'|'+(c.phone||c.method||'').replace(/\s/g,'');
    if(!keys.has(key)){keys.add(key);added.push({...c,id:'c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),source});}
  });
  if(!added.length){status('No hay contactos nuevos; los duplicados se han omitido.');return;}
  if(store.save('contacts',existing.concat(added))){renderContacts();status(added.length+' contacto(s) importado(s). Los datos permanecen en este dispositivo.');}
}

async function pickPhoneContacts(){
  if(!navigator.contacts||typeof navigator.contacts.select!=='function'){
    status('Este navegador no ofrece selector de contactos. Importa un archivo VCF exportado de tu agenda.');return;
  }
  try{
    const chosen=await navigator.contacts.select(['name','tel','email','address'],{multiple:true});
    if(!chosen.length){status('No has seleccionado contactos.');return;}
    importContacts(chosen,'Agenda del teléfono');
  }catch(e){
    status(e&&e.name==='SecurityError'?'El selector requiere HTTPS y un navegador compatible.':'No se ha podido abrir la agenda. Prueba con un archivo VCF.');
  }
}

async function importVcf(e){
  const file=e.target.files&&e.target.files[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('El archivo supera 5 MB.');
    const items=parseVcf(await file.text());
    if(!items.length)throw new Error('No se encontraron contactos en el archivo.');
    if(confirm('Se han encontrado '+items.length+' contactos. Se importarán a tu agenda privada en este navegador. ¿Continuar?'))importContacts(items,'Archivo VCF');
  }catch(err){status(err.message||'No se ha podido leer el archivo VCF.');}
  finally{e.target.value='';}
}

function ensurePanel(){
  const page=$('page-contactos'),module=page&&page.querySelector('.modulepage');
  if(!module||$('personalContactsPanel'))return;
  const panel=document.createElement('section');panel.id='personalContactsPanel';panel.className='personal-panel';
  panel.innerHTML='<div class="personal-panel-head"><div><span class="personal-eyebrow">AGENDA PERSONAL</span><h3>Mis contactos</h3><p>Selecciona contactos concretos del teléfono o importa una agenda VCF.</p></div><div class="personal-actions"><button type="button" class="personal-btn primary" id="pickPhoneContacts">＋ Elegir del teléfono</button><button type="button" class="personal-btn" id="chooseVcf">Importar archivo VCF</button><input type="file" id="vcfFile" accept=".vcf,text/vcard" hidden></div></div><div class="personal-import-status" id="personalImportStatus" role="status" aria-live="polite">La importación requiere tu selección. No se copia toda la agenda automáticamente.</div><div class="personal-contact-list" id="personalContactList"></div>';
  module.appendChild(panel);
  $('pickPhoneContacts').addEventListener('click',pickPhoneContacts);
  $('chooseVcf').addEventListener('click',()=>$('vcfFile').click());
  $('vcfFile').addEventListener('change',importVcf);
  panel.addEventListener('click',handleContactAction);
}

function renderContacts(){
  const list=$('personalContactList'),store=api();if(!list||!store)return;
  const contacts=store.read('contacts').slice().reverse(),points=store.read('points');
  if(!contacts.length){list.innerHTML='<div class="personal-empty">Todavía no hay contactos importados. Añade solo los que necesites.</div>';return;}
  list.innerHTML=contacts.map(c=>{
    const point=points.find(p=>p.contactRef===c.id);
    const action=point
      ? '<button class="personal-btn" data-locate-point="'+esc(point.id)+'">'+(point.lat!==''&&point.lng!==''?'Ver en mapa':'Marcar ubicación')+'</button>'
      : '<button class="personal-btn primary" data-create-point="'+esc(c.id)+'">＋ Añadir al mapa</button>';
    const plan='<button class="personal-btn" data-plan-contact="'+esc(c.id)+'">＋ Planificar visita</button>';
    const phone=c.phone?'<a class="personal-btn" href="tel:'+encodeURIComponent(c.phone)+'">Llamar</a>':'';
    return '<article class="personal-contact"><div class="personal-avatar">'+esc((c.name||'?').trim().slice(0,1).toUpperCase())+'</div><div class="personal-contact-info"><strong>'+esc(c.name)+'</strong><small>'+esc([c.role,c.phone||c.method,c.email].filter(Boolean).join(' · ')||'Sin teléfono ni correo')+'</small>'+(c.address?'<small>'+esc(c.address)+'</small>':'')+'</div><div class="personal-contact-actions">'+action+plan+phone+'</div></article>';
  }).join('');
}

function createPoint(contactId){
  const store=api();if(!store)return;
  const contact=store.read('contacts').find(c=>c.id===contactId);if(!contact)return;
  const points=store.read('points'),id='p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const point={id,createdAt:new Date().toISOString(),contactRef:contact.id,name:contact.name,town:'',province:contact.province||'',type:'Compañero',address:contact.address||'',schedule:'',contact:contact.phone||contact.method||'',notes:[contact.role,contact.email,contact.notes].filter(Boolean).join(' · '),lat:'',lng:'',visitCount:0};
  if(store.save('points',points.concat(point))){renderContacts();store.go('inicio');setTimeout(()=>startMapPlacement(id),350);}
}

function locatePoint(id){
  const store=api();if(!store)return;
  const point=store.read('points').find(p=>p.id===id);if(!point)return;
  store.go('inicio');
  if(point.lat!==''&&point.lng!==''){
    setTimeout(()=>{const map=store.getMap();if(map){map.invalidateSize();map.setView([Number(point.lat),Number(point.lng)],16);}},250);
  }else setTimeout(()=>startMapPlacement(id),350);
}

function startMapPlacement(id){
  const store=api(),map=store&&store.getMap();if(!map){status('El mapa aún no está listo. Abre el mapa principal e inténtalo de nuevo.');return;}
  pendingPointId=id;map.invalidateSize();
  const point=store.read('points').find(p=>p.id===id);
  store.mapMessage('MARCAR UBICACIÓN · Toca el mapa donde debes visitar a '+(point?point.name:'este compañero')+'.');
  const el=$('realMap');if(el)el.classList.add('personal-map-pick');
  map.once('click',saveMapPlacement);
}

function saveMapPlacement(e){
  const store=api();if(!store||!pendingPointId)return;
  const id=pendingPointId;pendingPointId=null;
  const points=store.read('points'),point=points.find(p=>p.id===id);if(!point)return;
  point.lat=Number(e.latlng.lat).toFixed(6);point.lng=Number(e.latlng.lng).toFixed(6);
  if(!store.save('points',points))return;
  const el=$('realMap');if(el)el.classList.remove('personal-map-pick');
  store.drawStoredPoints();store.mapMessage('Ubicación guardada para '+point.name+'. El marcador ya está en el mapa.');
  renderContacts();updateDashboard();
}

function addDashboard(){
  const page=$('page-inicio'),hero=page&&page.querySelector('.hero');if(!hero||$('personalDashboard'))return;
  const dash=document.createElement('section');dash.id='personalDashboard';dash.className='personal-dashboard';
  dash.innerHTML='<div class="personal-dash-title"><span class="personal-eyebrow">CALLE360 COMMAND CENTER · ESPACIO PRIVADO</span><strong>Centro de operaciones</strong><small>Mapa en directo · compañeros · agenda de visitas</small></div><div class="personal-dash-metrics"><div><b id="personalMetricContacts">0</b><span>Contactos</span></div><div><b id="personalMetricPins">0</b><span>Ubicaciones</span></div><div><b id="personalMetricVisits">0</b><span>Visitas</span></div><div><b id="personalMetricPending">0</b><span>Pendientes</span></div></div>';
  hero.insertAdjacentElement('afterend',dash);
}
function updateDashboard(){
  const store=api();if(!store)return;
  const contacts=store.read('contacts'),points=store.read('points').filter(p=>p.type==='Compañero'),visits=store.read('visits');
  if($('personalMetricContacts'))$('personalMetricContacts').textContent=contacts.length;
  if($('personalMetricPins'))$('personalMetricPins').textContent=points.filter(p=>p.lat!==''&&p.lng!=='').length;
  if($('personalMetricVisits'))$('personalMetricVisits').textContent=visits.filter(v=>v.status==='Realizada').length;
  if($('personalMetricPending'))$('personalMetricPending').textContent=visits.filter(v=>v.status!=='Realizada').length;
}
function planContactVisit(contactId){
  const store=api();if(!store)return;
  const contact=store.read('contacts').find(c=>c.id===contactId);if(!contact)return;
  store.go('rutas');
  const place=$('visitPlace'),date=$('visitDate'),statusField=$('visitStatus'),notes=$('visitNotes');
  if(place)place.value=contact.name;
  if(statusField)statusField.value='Planificada';
  if(notes)notes.value=[contact.role,contact.phone||contact.method,contact.address].filter(Boolean).join(' · ');
  if(date)date.focus();else if(place)place.focus();
  status('Visita preparada para '+contact.name+'. Completa la fecha y guarda la visita.');
}
function handleContactAction(e){
  const create=e.target.closest('[data-create-point]'),locate=e.target.closest('[data-locate-point]'),plan=e.target.closest('[data-plan-contact]');
  if(create)createPoint(create.dataset.createPoint);
  if(locate)locatePoint(locate.dataset.locatePoint);
  if(plan)planContactVisit(plan.dataset.planContact);
}
function init(){
  const store=api();if(!store)return;
  ensurePanel();addDashboard();renderContacts();updateDashboard();
  if(!window.__c360PersonalRenderWrapped){
    const original=store.render;
    store.render=function(){original();renderContacts();updateDashboard();};
    window.__c360PersonalRenderWrapped=true;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();