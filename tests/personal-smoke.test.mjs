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
 assert.match(sw,/calle360once-shell-v17/);
 assert.equal(manifest.lang,'es-ES');
 assert.equal(manifest.display,'standalone');
});

test('contactos: selector compatible, importación VCF y búsqueda local',()=>{
 assert.match(personal,/navigator\.contacts\.select/);
 assert.match(personal,/parseVcf/);
 assert.match(personal,/personalContactSearch/);
 assert.match(personal,/data-create-point/);
 assert.match(personal,/data-plan-contact/);
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
 assert.match(css,/map-pin-colleague/);
});

test('Málaga es el punto de partida y aparece primero en la guía',()=>{
 assert.match(html,/const provinces=\['Málaga','Almería'/);
 assert.match(html,/setView\(\[36\.7213,-4\.4214\],12\)/);
 const start=html.indexOf('const TOURISM_PLACES = [');
 const end=html.indexOf('\\n];',start);
 const catalog=html.slice(start,end);
 assert.ok(catalog.indexOf("province:'Málaga'")<catalog.indexOf("province:'Granada'"));
});

test('cartografía clara y paneles oscuros separados',()=>{
 assert.match(css,/#realMap \.leaflet-tile-pane img\{\s*filter:none!important/);
 assert.match(css,/#realMap,\s*\.real-map-wrap/);
 assert.match(css,/\.personal-dashboard/);
});

test('marcador puede planificar una visita vinculada al compañero',()=>{
 assert.match(html,/calle360PlanPointVisit/);
 assert.match(html,/visitColleagueId/);
 assert.match(html,/data-show-colleague/);
 assert.match(html,/colleagueId:p\.id/);
});
