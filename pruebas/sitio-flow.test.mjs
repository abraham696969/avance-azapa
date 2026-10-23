// Recorrido en modo EN LÍNEA con una base de datos simulada (no necesita internet ni Supabase):
// pago con Flow, pantalla de retorno en sus distintos estados y panel admin con la base.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = `window.DK_CONFIG={SUPABASE_URL:"https://fake.supabase.co",SUPABASE_ANON_KEY:"anon",PAGO_ONLINE:true,PAGO_PRUEBAS:true};window.DK_NEGOCIO={};`;
// Cliente de Supabase simulado; el estado vive en localStorage para sobrevivir a la ida y vuelta a Flow
const FAKE = `(function(){
const SEED=[['castillo','Castillo inflable','juegos',45000,2,4.5,4.5,3.5,'#ff5fa2','castle'],['parcela','Arriendo de la parcela','local',150000,1,30,20,0,'#7ccf7a','land']]
 .map(r=>({item_id:r[0],nombre:r[1],descripcion:'',categoria:r[2],precio:r[3],stock:r[4],ancho:r[5],largo:r[6],alto:r[7],color:r[8],color_tope:null,forma:r[9],activo:true,orden:1}));
const load=()=>{try{return JSON.parse(localStorage.__F)}catch(e){return {cat:SEED,res:[],blocked:[],calls:[],status:null,session:null}}};
const save=F=>{localStorage.__F=JSON.stringify(F)};
const mk=t=>{const o={t,a:'select',f:[],p:null};const b={select:()=>b,order:()=>b,gte:(c,v)=>{o.f.push(['gte',c,v]);return b},eq:(c,v)=>{o.f.push(['eq',c,v]);return b},
 upsert:p=>{o.a='upsert';o.p=p;return b},update:p=>{o.a='update';o.p=p;return b},insert:p=>{o.a='insert';o.p=p;return b},delete:()=>{o.a='delete';return b},
 then:(ok,ko)=>Promise.resolve(run(o)).then(ok,ko)};return b};
function run(o){const F=load();let data=[];const key={catalogo:'item_id',reservas:'folio',fechas_bloqueadas:'fecha'}[o.t],tab={catalogo:'cat',reservas:'res',fechas_bloqueadas:'blocked'}[o.t];
 const match=r=>o.f.every(([k,c,v])=>k==='eq'?r[c]===v:true);
 if(o.a==='select'){data=F[tab].filter(r=>(o.t!=='catalogo'||F.session||r.activo));}
 if(o.a==='upsert'){const i=F[tab].findIndex(r=>r[key]===o.p[key]);i>=0?F[tab][i]=Object.assign(F[tab][i],o.p):F[tab].push(o.p)}
 if(o.a==='update'){F[tab].filter(match).forEach(r=>Object.assign(r,o.p))}
 if(o.a==='insert'){F[tab].push(o.p)} if(o.a==='delete'){F[tab]=F[tab].filter(r=>!match(r))}
 F.calls.push({tabla:o.t,accion:o.a,datos:o.p});save(F);return {data,error:null}}
window.supabase={createClient:()=>({
 from:mk,
 rpc:async(n,a)=>{const F=load();F.calls.push({rpc:n,args:a});let data=null;
  if(n==='disponibilidad')data=[];
  if(n==='es_admin')data=true;
  if(n==='crear_reserva'){const folio='R-1006';data={folio,codigo:'COD1',total:195000,abono:58500,estado:a.p_online?'por_pagar':'pendiente'};
    F.res.push({folio,fecha:a.p_fecha,franja:a.p_franja,nombre:a.p_nombre,email:a.p_email,telefono:a.p_telefono,invitados:a.p_invitados,items:a.p_items,parcela:a.p_parcela,layout:a.p_layout,total:195000,abono:58500,metodo_pago:a.p_metodo,transaccion:'',estado:data.estado,nota:''})}
  if(n==='estado_reserva')data=F.status;
  save(F);return {data,error:null}},
 functions:{invoke:async(n,o)=>{const F=load();F.calls.push({fn:n,body:o.body});save(F);return {data:{url:'https://sandbox.flow.cl/pay?token=T'},error:null}}},
 auth:{getSession:async()=>({data:{session:load().session}}),signInWithPassword:async({email})=>{const F=load();F.session={user:{email}};save(F);return {error:null}},signOut:async()=>{const F=load();F.session=null;save(F);return {}}}
})}})();`;

const srv = await servir(root, { '/config.js': CONFIG });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.route(/(cdnjs|googleapis|gstatic)/, r => r.abort());
await ctx.route(/jsdelivr/, r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
let flowVisit = null;
await ctx.route('https://sandbox.flow.cl/**', r => { flowVisit = r.request().url(); r.fulfill({ contentType: 'text/html', body: '<h1>Flow (simulado)</h1>' }); });
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
const F = () => p.evaluate(() => JSON.parse(localStorage.__F));
const setStatus = s => p.evaluate(v => { const F = JSON.parse(localStorage.__F); F.status = v; localStorage.__F = JSON.stringify(F); }, s);

await p.goto(srv.url + '/index.html'); await p.waitForTimeout(800);
await p.click('[data-add="castillo"]'); await p.click('#payBtn'); await p.waitForTimeout(200);
assert(!(await p.isVisible('#cardBlock'))); assert(await p.isVisible('#onlineNote')); ok('con pago en línea se ocultan los campos de tarjeta de prueba y se explica el pago en Flow');
assert((await p.textContent('#payGo')).includes('Flow')); ok('el botón dice "Ir a pagar a Flow"');
await p.click('#payGo'); await p.waitForURL(/sandbox\.flow\.cl/, { timeout: 5000 });
assert.equal(flowVisit, 'https://sandbox.flow.cl/pay?token=T'); ok('el navegador es enviado a la dirección de pago que entregó la función de servidor');
await p.goto(srv.url + '/index.html'); await p.waitForTimeout(500);
const calls = (await F()).calls; const cr = calls.find(c => c.rpc === 'crear_reserva'), inv = calls.find(c => c.fn);
assert.equal(cr.args.p_online, true); assert.equal(cr.args.p_metodo, 'Flow'); ok('la reserva se crea "online" (queda por pagar y guarda el cupo)');
assert.deepEqual(inv.body, { folio: 'R-1006', codigo: 'COD1' }); assert.equal(inv.fn, 'flow-crear-pago'); ok('a la función de pago solo se le envían folio y código (el monto lo pone el servidor)');

const ver = async (estado, texto, extra) => {
  await setStatus(estado); await p.goto(srv.url + '/index.html?folio=R-1006&c=COD1'); await p.waitForTimeout(1200);
  const t = await p.textContent('#bookArea'); assert(t.includes(texto), `${estado}: esperaba "${texto}" y salió "${t.slice(0, 120)}"`);
  assert(!p.url().includes('folio='));
};
await ver({ folio: 'R-1006', fecha: '2026-12-12', franja: 'tarde', total: 195000, abono: 58500, estado: 'confirmada' }, '¡Pago recibido!'); ok('retorno con pago confirmado muestra la confirmación y limpia la dirección');
await ver({ folio: 'R-1006', fecha: '2026-12-12', franja: 'tarde', total: 195000, abono: 58500, estado: 'pendiente' }, 'Recibimos tu pago'); ok('retorno con revisión pendiente lo explica');
await ver({ folio: 'R-1006', fecha: '2026-12-12', franja: 'tarde', total: 195000, abono: 58500, estado: 'expirada' }, 'El pago no se completó'); ok('retorno con plazo vencido ofrece reservar de nuevo');
await ver(null, 'No encontramos esa reserva'); ok('retorno con código incorrecto no muestra datos');

// panel admin contra la base
const a = await ctx.newPage(); a.on('pageerror', e => errs.push('admin: ' + e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500);
assert(await a.isVisible('#loginView')); assert(!(await a.isVisible('#demoHint'))); ok('con base conectada no aparece la clave de demo');
await a.fill('#lMail', 'jefa@divertikids.cl'); await a.fill('#lPass', 'xx'); await a.click('#lBtn'); await a.waitForTimeout(600);
assert(await a.isVisible('#panelView')); assert((await a.textContent('#modeBadge')).includes('Base de datos')); ok('login contra la base y panel visible');
assert(await a.locator('[data-st="R-1006"]').inputValue() === 'por_pagar'); ok('la reserva por pagar se ve con su estado');
await a.selectOption('[data-st="R-1006"]', 'confirmada'); await a.waitForTimeout(400);
assert((await a.evaluate(() => JSON.parse(localStorage.__F))).res.find(r => r.folio === 'R-1006').estado === 'confirmada'); ok('cambiar el estado se guarda en la base');
await a.fill('#sName', 'Trampolín'); await a.selectOption('#sShape', 'box'); await a.fill('#sPrice', '25000'); await a.fill('#sStock', '2');
await a.fill('#sW', '3'); await a.fill('#sD', '3'); await a.fill('#sH', '1.2'); await a.click('#sSave'); await a.waitForTimeout(500);
const fila = (await a.evaluate(() => JSON.parse(localStorage.__F))).cat.find(r => r.nombre === 'Trampolín');
assert(fila && fila.forma === 'box' && /^#[0-9a-f]{6}$/i.test(fila.color) && fila.precio === 25000 && fila.ancho === 3 && fila.activo === true); ok('el servicio nuevo se guarda con las columnas que espera la base (forma, color, medidas, precio)');
await b.close(); srv.close();
console.log(errs.length ? '\nERRORES DE PÁGINA:\n' + errs.join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length ? 1 : 0);
