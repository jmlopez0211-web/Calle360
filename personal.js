/* CALLE360 Personal: importación privada de contactos y ubicación de compañeros */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const api = () => window.C360Store;
const esc = s => String(s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pendingPointId = null;

function status(message){const el=$('personalImportStatus');if(el)el.textContent=message;}

function decodeQuotedPrintable(value,charset='utf-8'){
  const bytes=[];
  for(let i=0;i<value.length;i++){
    if(value[i]==='=' && /^[0-9a-f]{2}$/i.test(value.slice(i+1,i+3))){bytes.push(parseInt(value.slice(i+1,i+3),16));i+=2;}
    else{const cp=value.codePointAt(i);if(cp<=0x7f)bytes.push(cp);else{bytes.push(...new TextEncoder().encode(String.fromCodePoint(cp)));if(cp>0xffff)i++;}}
  }
  try{return new TextDecoder(charset,{fatal:false}).decode(new Uint8Array(bytes));}
  catch(e){return new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(bytes));}
}
function parseVcf(text){
  const physical=String(text||'').replace(/\r\n?/g,'\n').split('\n'),lines=[];
  for(const line of physical){
    if(!lines.length){lines.push(line);continue;}
    const previous=lines[lines.length-1],colon=previous.indexOf(':'),header=colon>=0?previous.slice(0,colon):'';
    const qp=/;ENCODING="?QUOTED-PRINTABLE"?/i.test(header),isProperty=/^(?:BEGIN|END|[A-Z0-9.-]+)(?:;[^:]*)?:/i.test(line);
    if(qp&&previous.endsWith('=')&&!isProperty)lines[lines.length-1]=previous.slice(0,-1)+line;
    else if(/^[ \t]/.test(line))lines[lines.length-1]+=line.slice(1);
    else{if(qp&&previous.endsWith('='))lines[lines.length-1]=previous.slice(0,-1);lines.push(line);}
  }
  return lines.join('\n').split(/BEGIN:VCARD/i).slice(1).map(chunk=>{
    const out={};
    chunk.split('\n').forEach(line=>{
      const i=line.indexOf(':');if(i<0)return;
      const header=line.slice(0,i),raw=line.slice(i+1),parts=header.split(';'),key=parts.shift().split('.').pop().toUpperCase();
      const params=parts.map(part=>part.split('=')).reduce((o,p)=>{if(p.length>1)o[p[0].toUpperCase()]=p.slice(1).join('=').replace(/^"|"$/g,'');return o;},{});
      const qp=params.ENCODING?.toUpperCase()==='QUOTED-PRINTABLE';
      let value=qp?decodeQuotedPrintable(raw.replace(/=$/,'').replace(/=\n/g,''),params.CHARSET||'utf-8'):raw;
      value=value.replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
      if(key==='FN')out.name=value;
      if(key==='N'){const n=value.split(';'),structured=[n[1],n[0],n[2],n[3],n[4]].filter(Boolean).join(' ').trim();if(!out.name||out.name.endsWith('='))out.name=structured;}
      if(key==='TEL'&&!out.tel)out.tel=value.replace(/^tel:/i,'');
      if(key==='EMAIL'&&!out.email)out.email=value;
      if(key==='ORG')out.org=value;if(key==='TITLE')out.role=value;
      if(key==='ADR'&&!out.address)out.address=value.split(';').filter(Boolean).join(', ');
    });
    return out;
  }).filter(c=>c.name||c.tel||c.email);
}

function normalize(c){
  const first=v=>Array.isArray(v)?v[0]:v,clean=v=>String(first(v)||'').trim();
  return {name:clean(c.name||c.fn)||'Contacto sin nombre',role:clean(c.role||c.org),province:'',method:clean(c.tel)||clean(c.email),phone:clean(c.tel),email:clean(c.email),address:clean(c.address),notes:'Importado desde la agenda del teléfono'};
}
function contactPhoneKey(c){return String(c.phone||c.method||'').replace(/\D/g,'');}
function contactNameKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();}
function isDamagedContactName(contact){const name=String(contact.name||'');return !!contact._nameNeedsRefresh||name.endsWith('=')||/(?:=[0-9a-f]{2}){2,}/i.test(name);}
function importContacts(items,source){
  const store=api();if(!store)return;const existing=store.read('contacts'),added=[];let updated=0;
  items.map(normalize).forEach(c=>{
    const phone=contactPhoneKey(c),name=contactNameKey(c.name);
    const match=existing.find(old=>{const oldPhone=contactPhoneKey(old);return(phone.length>=7&&oldPhone.length>=7&&phone===oldPhone)||(name&&contactNameKey(old.name)===name);});
    if(match){
      if(isDamagedContactName(match)&&c.name&&!isDamagedContactName(c)){match.name=c.name;delete match._nameNeedsRefresh;updated++;}
      [['phone','phone'],['email','email'],['address','address'],['role','role'],['method','method']].forEach(([field,key])=>{if(!match[field]&&c[key]){match[field]=c[key];updated++;}});
      return;
    }
    const item={...c,id:'c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),source};
    added.push(item);existing.push(item);
  });
  if(!added.length&&!updated){status('No hay contactos nuevos; los duplicados se han omitido.');return;}
  if(store.save('contacts',existing)){renderContacts();updateDashboard();status([added.length?added.length+' contacto(s) importado(s)':null,updated?updated+' dato(s) actualizado(s) en contactos existentes':null].filter(Boolean).join('. ')+'. Los datos permanecen en este dispositivo.');}
}

function repairStoredQuotedPrintableNames(){
  const store=api();if(!store)return;const contacts=store.read('contacts');let changed=0,needsRefresh=0;
  contacts.forEach(contact=>{
    if(typeof contact.name!=='string')return;
    if(/(?:=[0-9a-f]{2}){2,}/i.test(contact.name)){
      const decoded=decodeQuotedPrintable(contact.name,'utf-8').trim();
      if(decoded&&decoded!==contact.name){contact.name=decoded;if(contact.name.endsWith('=')){contact.name=contact.name.slice(0,-1).trim();contact._nameNeedsRefresh=true;needsRefresh++;}changed++;}
    }else if(contact.name.endsWith('=')){contact.name=contact.name.slice(0,-1).trim();contact._nameNeedsRefresh=true;changed++;needsRefresh++;}
  });
  if(changed&&store.save('contacts',contacts)){renderContacts();updateDashboard();status(needsRefresh?changed+' nombre(s) limpiado(s). Comparte de nuevo la ficha para recuperar cualquier final que Samsung hubiera cortado; se conservarán los teléfonos.':changed+' contacto(s) descodificado(s).');}
}

async function pickPhoneContacts(){
  if(!navigator.contacts||typeof navigator.contacts.select!=='function'){
    status('Este navegador no ofrece selector directo de agenda. Instala CALLE360 como aplicación desde Chrome (no solo acceso directo); después, en Contactos de Samsung, elige Compartir > Archivo vCard (VCF) > CALLE360. Si no aparece, actualiza o reinstala la PWA.');return;
  }
  try{
    const chosen=await navigator.contacts.select(['name','tel','email','address'],{multiple:true});
    if(!chosen.length){status('No has seleccionado contactos.');return;}
    importContacts(chosen,'Agenda del teléfono');
  }catch(e){
    status(e&&e.name==='SecurityError'?'El selector requiere HTTPS y un navegador compatible.':'No se ha podido abrir la agenda. Prueba con un archivo VCF.');
  }
}


function takeSharedVCard(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('calle360-share-target',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('inbox'))request.result.createObjectStore('inbox');};
    request.onerror=()=>reject(request.error||new Error('No se pudo abrir el buzón de contactos.'));
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('inbox','readwrite'),box=tx.objectStore('inbox'),get=box.get('latest');
      let item=null;get.onsuccess=()=>{item=get.result||null;box.delete('latest');};
      tx.oncomplete=()=>{db.close();resolve(item);};
      tx.onerror=()=>{const error=tx.error;db.close();reject(error||new Error('No se pudo leer el contacto compartido.'));};
    };
  });
}
async function handleSharedVCard(){
  const url=new URL(location.href);
  if(url.searchParams.has('importSharedContactError')){
    url.searchParams.delete('importSharedContactError');history.replaceState({},'',url.pathname+url.search+url.hash);
    status('Android no pudo entregar el contacto. Abre Contactos, selecciona una ficha y usa Compartir > CALLE360.');return;
  }
  if(!url.searchParams.has('importSharedContact'))return;
  url.searchParams.delete('importSharedContact');history.replaceState({},'',url.pathname+url.search+url.hash);
  try{
    const item=await takeSharedVCard();
    if(!item||!item.blob){status('No se recibió ningún archivo de contacto. En Contactos, selecciona una ficha y pulsa Compartir > CALLE360.');return;}
    const text=await item.blob.text(),items=parseVcf(text);
    if(!items.length){status('El archivo compartido no contiene una ficha vCard reconocible.');return;}
    if(confirm('Android ha compartido '+items.length+' contacto(s). ¿Añadirlos a tu agenda privada de CALLE360?'))importContacts(items,'Compartido desde Contactos de Android');
    else status('Importación cancelada. No se ha añadido ningún contacto.');
  }catch(error){status(error.message||'No se pudo procesar el contacto compartido.');}
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
  panel.innerHTML='<div class="personal-panel-head"><div><span class="personal-eyebrow">AGENDA PERSONAL</span><h3>Mis contactos</h3><p>En Android, comparte una ficha desde Contactos de Samsung: Compartir → Archivo vCard (VCF) → CALLE360. Si CALLE360 no aparece, instala la PWA desde Chrome. Importa solo los contactos que elijas.</p></div><div class="personal-actions"><button type="button" class="personal-btn primary" id="pickPhoneContacts">Importar desde el teléfono</button><button type="button" class="personal-btn" id="chooseVcf">Importar archivo VCF</button><input type="file" id="vcfFile" accept=".vcf,text/vcard,text/x-vcard,application/vcard,application/x-vcard,application/octet-stream" hidden></div></div><div class="personal-import-status" id="personalImportStatus" role="status" aria-live="polite">La importación requiere tu selección. No se copia toda la agenda automáticamente.</div><label class="personal-search-label" for="personalContactSearch">Buscar en mis contactos</label><input id="personalContactSearch" class="personal-contact-search" type="search" placeholder="Nombre, teléfono o correo…"><div class="personal-contact-list" id="personalContactList"></div>';
  module.appendChild(panel);
  $('pickPhoneContacts').addEventListener('click',pickPhoneContacts);
  $('chooseVcf').addEventListener('click',()=>$('vcfFile').click());
  $('vcfFile').addEventListener('change',importVcf);
  $('personalContactSearch').addEventListener('input',renderContacts);
  panel.addEventListener('click',handleContactAction);
}

function renderContacts(){
  const list=$('personalContactList'),store=api();if(!list||!store)return;
  const query=($('personalContactSearch')?.value||'').trim().toLocaleLowerCase('es');
  const contacts=store.read('contacts').slice().reverse().filter(c=>[c.name,c.role,c.phone,c.method,c.email,c.address].join(' ').toLocaleLowerCase('es').includes(query)),points=store.read('points');
  if(!contacts.length){list.innerHTML='<div class="personal-empty">'+(query?'No hay contactos que coincidan con la búsqueda.':'Todavía no hay contactos importados. Añade solo los que necesites.')+'</div>';return;}
  list.innerHTML=contacts.map(c=>{
    const point=points.find(p=>p.contactRef===c.id);
    const action=point
      ? '<button class="personal-btn" data-locate-point="'+esc(point.id)+'">'+(point.lat!==''&&point.lng!==''?'Ver en mapa':'Marcar ubicación')+'</button>'
      : '<button class="personal-btn primary" data-create-point="'+esc(c.id)+'">＋ Añadir al mapa</button>';
    const plan='<button class="personal-btn" data-plan-contact="'+esc(c.id)+'">＋ Planificar visita</button>';
    const phone=c.phone?'<a class="personal-btn" href="tel:'+encodeURIComponent(c.phone)+'">Llamar</a>':'';
    const navigation=point&&point.lat!==''&&point.lng!==''?'<a class="personal-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(point.lat+','+point.lng)+'&travelmode=driving">Cómo llegar</a>':'';
    return '<article class="personal-contact"><div class="personal-avatar">'+esc((c.name||'?').trim().slice(0,1).toUpperCase())+'</div><div class="personal-contact-info"><strong>'+esc(c.name)+'</strong><small>'+esc([c.role,c.phone||c.method,c.email].filter(Boolean).join(' · ')||'Sin teléfono ni correo')+'</small>'+(c.address?'<small>'+esc(c.address)+'</small>':'')+'</div><div class="personal-contact-actions">'+action+plan+phone+navigation+'</div></article>';
  }).join('');
}

function createPoint(contactId){
  const store=api();if(!store)return;
  const contact=store.read('contacts').find(c=>c.id===contactId);if(!contact)return;
  const points=store.read('points'),id='p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const point={id,createdAt:new Date().toISOString(),contactRef:contact.id,name:contact.name,town:'',province:contact.province||$('filterProv')?.value||$('pointProv')?.value||'Málaga',type:'Compañero',address:contact.address||'',schedule:'',contact:contact.phone||contact.method||'',notes:[contact.role,contact.email,contact.notes].filter(Boolean).join(' · '),lat:'',lng:'',visitCount:0};
  if(store.save('points',points.concat(point))){renderContacts();updateDashboard();store.go('inicio');setTimeout(()=>startMapPlacement(id),350);}
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
  store.drawStoredPoints();store.render();store.mapMessage('Ubicación guardada para '+point.name+'. Ya aparece en Resultados y en el mapa.');
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
  const linkedPoint=store.read('points').find(p=>p.contactRef===contact.id);
  const province=$('visitProv'),linkField=$('visitColleagueId');
  if(place)place.value=contact.name;
  if(province)province.value=linkedPoint?.province||contact.province||'';
  if(statusField)statusField.value='Planificada';
  if(notes)notes.value=[contact.role,contact.phone||contact.method,contact.address].filter(Boolean).join(' · ');
  if(linkField)linkField.value=linkedPoint?.id||'';
  if(date)date.focus();else if(place)place.focus();
  status('Visita preparada para '+contact.name+'. Completa la fecha y guarda la visita.');
}
function handleContactAction(e){
  const create=e.target.closest('[data-create-point]'),locate=e.target.closest('[data-locate-point]'),plan=e.target.closest('[data-plan-contact]');
  if(create)createPoint(create.dataset.createPoint);
  if(locate)locatePoint(locate.dataset.locatePoint);
  if(plan)planContactVisit(plan.dataset.planContact);
}

document.addEventListener('click',e=>{
  const mapAction=e.target.closest('[data-result-map],[data-show-point]');
  if(mapAction){locatePoint(mapAction.dataset.resultMap||mapAction.dataset.showPoint);return;}
  const planAction=e.target.closest('[data-result-visit],[data-plan-point]');
  if(planAction){const id=planAction.dataset.resultVisit||planAction.dataset.planPoint;if(typeof window.calle360PlanPointVisit==='function')window.calle360PlanPointVisit(id);return;}
  const visitAction=e.target.closest('[data-visit-point]');
  if(visitAction&&typeof window.calle360RegisterVisit==='function')window.calle360RegisterVisit(visitAction.dataset.visitPoint);
});

function init(){
  const store=api();if(!store)return;
  ensurePanel();addDashboard();repairStoredQuotedPrintableNames();renderContacts();updateDashboard();
  handleSharedVCard();
  if(!window.__c360PersonalRenderWrapped){
    const original=store.render;
    store.render=function(){original();renderContacts();updateDashboard();};
    window.__c360PersonalRenderWrapped=true;
  }
  if(!window.__c360PersonalObserver && 'MutationObserver' in window){
    const observer=new MutationObserver(()=>{renderContacts();updateDashboard();});
    ['pointRecords','visitRecords','contactRecords','taskRecords'].forEach(id=>{
      const target=$(id);
      if(target)observer.observe(target,{childList:true,subtree:true});
    });
    window.__c360PersonalObserver=observer;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();