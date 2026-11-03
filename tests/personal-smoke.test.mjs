import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const personal=readFileSync(new URL('../personal.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../personal.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));

test('HTML sin IDs duplicados ni referencias JavaScript rotas',()=>{
 const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'IDs duplicados');
 const refs=[...new Set([...html.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]))];
 assert.deepEqual(refs.filter(id=>!ids.includes(id)),[],'Referencias a IDs inexistentes');
});

test('scripts inline y módulos propios con sintaxis válida',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/src\s*=/.test(m[1])).map(m=>m[2]).filter(s=>s.trim());
 assert.ok(scripts.length>=1);
 scripts.forEach((script,index)=>assert.doesNotThrow(()=>new Function(script),'Script inline '+(index+1)));
 assert.doesNotThrow(()=>new Function(personal));
 assert.doesNotThrow(()=>new Function(sw));
});

test('PWA enlaza y cachea los módulos personales',()=>{
 assert.match(html,/href=["']\.\/personal\.css["']/);
 assert.match(html,/src=["']\.\/personal\.js["']/);
 assert.match(sw,/personal\.css/);
 assert.match(sw,/personal\.js/);
 assert.match(sw,/calle360once-shell-v25/);
 assert.equal(manifest.lang,'es-ES');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.share_target.method,'POST');
 assert.equal(manifest.share_target.enctype,'multipart/form-data');
 assert.deepEqual(manifest.share_target.params.files[0].accept,['text/vcard','text/x-vcard','application/vcard','application/x-vcard','application/octet-stream','.vcf']);
});

test('contactos: selector compatible, importación VCF y búsqueda local',()=>{
 assert.match(personal,/navigator\.contacts\.select/);
 assert.match(personal,/handleSharedVCard/);
 assert.match(personal,/takeSharedVCard/);
 assert.match(sw,/request\.formData\(\)/);
 assert.match(sw,/saveSharedVCard/);
 assert.match(sw,/requestUrl\.pathname === shareAction\.pathname/);
 assert.match(personal,/Instala CALLE360 como aplicación desde Chrome/);
 assert.match(personal,/parseVcf/);
 assert.match(personal,/contactPhoneKey/);
 assert.match(personal,/isDamagedContactName/);
 assert.match(personal,/_nameNeedsRefresh/);
 assert.match(personal,/Importar desde el teléfono/);
 assert.match(personal,/personalContactSearch/);
 assert.match(personal,/data-create-point/);
 assert.match(personal,/data-plan-contact/);
});

test('Samsung vCard: decodifica Quoted-Printable UTF-8 y repara nombres guardados',()=>{
 const parserSource=personal.slice(personal.indexOf('function decodeQuotedPrintable'),personal.indexOf('\nfunction normalize'));
 const parseVcf=new Function(parserSource+'; return parseVcf;')();
 const sample='BEGIN:VCARD\r\nVERSION:2.1\r\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=46=65=72=6E=61=6E=64=6F=20=48=75=72=74=61=64=6F=20=47=6F=6E=7A=C3=A1=6C=65=7A\r\nTEL;CELL:670317074\r\nEND:VCARD';
 const contacts=parseVcf(sample);
 assert.equal(contacts.length,1);
 assert.equal(contacts[0].name,'Fernando Hurtado González');
 assert.equal(contacts[0].tel,'670317074');
 assert.match(personal,/repairStoredQuotedPrintableNames/);
 assert.match(personal,/se conservarán los teléfonos/);
});

test('Samsung vCard: admite CR, CRLF y líneas Quoted-Printable partidas',()=>{
 const parserSource=personal.slice(personal.indexOf('function decodeQuotedPrintable'),personal.indexOf('\nfunction normalize'));
 const parseVcf=new Function(parserSource+'; return parseVcf;')();
 const body='BEGIN:VCARD\rVERSION:2.1\rFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=46=65=72=6E=61=6E=64=6F=20=48=75=72=74=61=64=6F=20=47=6F=6E=7A=\r=C3=A1=6C=65=7A\rN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=48=75=72=74=61=64=6F;=46=65=72=6E=61=6E=64=6F\rTEL;CELL:670317074\rEND:VCARD';
 const contacts=parseVcf(body);
 assert.equal(contacts.length,1);
 assert.equal(contacts[0].name,'Fernando Hurtado González');
 assert.equal(contacts[0].tel,'670317074');
});

test('mapa: ubicación del compañero y navegación se mantienen locales',()=>{
 assert.match(personal,/startMapPlacement/);
 assert.match(personal,/saveMapPlacement/);
 assert.match(personal,/google\.com\/maps\/dir/);
 assert.match(html,/map-pin-\$\{kind\}/);
});

test('interfaz responsive y tema de centro de operaciones',()=>{
 assert.match(css,/grid-template-columns:68px minmax\(0,1fr\) 285px/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/personal-dashboard/);
 assert.match(css,/renovación visual clara/);
 assert.match(css,/color-scheme:light/);
 assert.match(css,/--paper:#eef4f8/);
 assert.match(css,/map-pin-colleague/);
});

test('los filtros de provincia, municipio y búsqueda ignoran tildes',()=>{
 assert.match(html,/function searchKey\(value\)/);
 assert.match(html,/normalize\('NFD'\)/);
 assert.match(html,/searchKey\(\[r\.town,r\.province,r\.address\]/);
 assert.match(html,/Municipio o provincia/);
});

test('Málaga es el punto de partida y aparece primero en la guía',()=>{
 assert.match(html,/const provinces=\['Málaga','Almería'/);
 assert.match(html,/setView\(\[36\.7213,-4\.4214\],12\)/);
 const start=html.indexOf('const TOURISM_PLACES = [');
 const end=html.indexOf('\n];',start);
 const catalog=html.slice(start,end);
 assert.ok(catalog.indexOf("province:'Málaga'")<catalog.indexOf("province:'Granada'"));
});

test('cartografía clara y paneles oscuros separados',()=>{
 assert.match(css,/#realMap \.leaflet-tile-pane img\{\s*filter:none!important/);
 assert.doesNotMatch(css,/filter:invert/,'No debe quedar ningún filtro de inversión del mapa');
 assert.match(css,/#realMap,\s*\.real-map-wrap/);
 assert.match(css,/\.personal-dashboard/);
});

test('puntos guardados aparecen en resultados con filtros y acciones',()=>{
 assert.match(html,/data-result-map/);
 assert.match(html,/data-result-visit/);
 assert.match(html,/data-show-point/);
 assert.match(html,/!rowProvince\|\|rowProvince===province/);
 assert.match(html,/\$\('pointProv'\)\.value='Málaga'/);
 assert.match(personal,/store\.render\(\);store\.mapMessage\('Ubicación guardada para '/);
 assert.match(personal,/data-plan-point/);
});

test('marcador puede planificar una visita vinculada al compañero',()=>{
 assert.match(html,/calle360PlanPointVisit/);
 assert.match(html,/visitColleagueId/);
 assert.match(html,/data-show-colleague/);
 assert.match(html,/colleagueId:p\.id/);
});


test('Busca vendedores guardados antes de llamar a Nominatim',()=>{
 assert.match(html,/localStore\.read\('points'\)/);
 assert.match(html,/Vendedor encontrado en tus registros/);
 assert.match(html,/Buscar vendedor guardado o lugar en el mapa/);
});

test('Los filtros no ocultan contactos antiguos sin municipio',()=>{
 assert.match(html,/!r\.town&&!r\.address/);
});


test('Accesibilidad incluye recursos LSE y Braille español',()=>{
 assert.match(html,/Diccionario DILSE/);
 assert.match(html,/fundacioncnse-dilse\.org/);
 assert.match(html,/Recursos oficiales CNSE/);
 assert.match(html,/id="brailleText"/);
 assert.match(html,/id="copyBraille"/);
 assert.match(html,/id="clearBraille"/);
 assert.match(html,/convertSpanishBraille/);
 assert.match(html,/Consultar el sistema Braille y materiales oficiales de la ONCE/);
 assert.doesNotMatch(html,/Braille, lengua de signos, subtítulos y perfiles personalizados requieren contenidos/);
});

test('Controles principales tienen áreas táctiles ampliadas',()=>{
 assert.match(html,/button,\.btn,\.personal-btn[^}]*min-height:48px/);
 assert.match(html,/@media\(max-width:600px\)[\s\S]*?min-height:52px/);
});


test('transcribe español básico',()=>{
 const mapStart=html.indexOf('const brailleMap=');
 const fnStart=html.indexOf('function convertSpanishBraille(value)',mapStart);
 const end=html.indexOf("\n$('convertBraille').onclick",fnStart);
 const source=html.slice(mapStart,end);
 const convert=new Function(source+';return convertSpanishBraille;')();
 assert.equal(convert('A1 12 áéíóúñ').text,'⠨⠁⠼⠁⠀⠼⠁⠃⠀⠷⠮⠌⠬⠾⠻');
 assert.equal(convert('Hola').text,'⠨⠓⠕⠇⠁');
});
