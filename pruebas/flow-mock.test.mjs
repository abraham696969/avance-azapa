// Pago del abono con Flow a través del servidor de Railway, contra un Flow simulado y una base PostgreSQL en memoria.
// Ejecutar:  node pruebas/flow-mock.test.mjs
import assert from 'node:assert/strict';
import { servidor, cliente, futura, flowSimulado, FLOW_KEY } from './_railway.mjs';

let n = 0; const ok = (m) => console.log('  ✓', m, `(${++n})`);
const s = await servidor();
const c = cliente(s.url);
const nueva = async (dias, franja = 'tarde') => (await c('POST', '/api/reservas', {
  p_fecha: futura(dias), p_franja: franja, p_nombre: 'Ana Pérez', p_email: 'ana@ejemplo.cl', p_telefono: '+56 9 1234 5678', p_invitados: 20,
  p_items: { tobogan: 1, papas: 1 }, p_parcela: true, p_layout: [], p_metodo: 'Flow', p_online: true, p_nino: 'Sofía', p_nacimiento: '2020-03-05', p_acepta: true })).datos;
const fila = async (folio) => (await s.db.query('select estado, nota, flow_token, flow_orden, metodo_pago from reservas where folio = $1', [folio])).rows[0];

// crear pago
const r1 = await nueva(15);
let r = await c('POST', '/api/pago', { folio: r1.folio, codigo: r1.codigo });
assert.equal(r.status, 200); assert.match(r.datos.url, /\/pay\?token=TOK1$/);
const creado = s.flow.log.find((x) => x.path === '/api/payment/create').params;
assert.equal(creado.amount, String(r1.abono)); assert.equal(creado.amount, '78000'); assert.equal(creado.commerceOrder, r1.folio); assert.equal(creado.currency, 'CLP');
assert.equal(creado.apiKey, FLOW_KEY); assert.equal(creado.urlConfirmation, `${s.url}/api/flow/confirmacion`); assert.equal(creado.urlReturn, `${s.url}/api/flow/retorno`);
ok('crear pago: firma válida, monto (30 % de 260.000) tomado de la base y direcciones de aviso del servidor');
assert.equal((await fila(r1.folio)).flow_token, 'TOK1'); ok('guarda el token de Flow en la reserva');
r = await c('POST', '/api/pago', { folio: r1.folio, codigo: 'MALO' });
assert.equal(r.status, 404); ok('código secreto incorrecto → 404');
const r2 = await nueva(16);
await s.db.query("update reservas set expira = now() - interval '1 minute' where folio = $1", [r2.folio]);
r = await c('POST', '/api/pago', { folio: r2.folio, codigo: r2.codigo });
assert.equal(r.status, 409); ok('reserva con plazo de 30 minutos vencido → 409');

// confirmación (Flow llama al servidor)
r = await c('POST', '/api/flow/confirmacion', 'token=TOK1', { sinDk: true });
assert.equal(r.status, 200);
const conf = await fila(r1.folio);
assert.equal(conf.estado, 'confirmada'); assert.equal(conf.metodo_pago, 'Flow'); assert.equal(conf.flow_orden, 700);
const gs = s.flow.log.find((x) => x.path === '/api/payment/getStatus').params;
assert.equal(gs.token, 'TOK1'); ok('confirmación: consulta a Flow el estado real (firmado) y la reserva queda confirmada');
r = await c('POST', '/api/flow/confirmacion', 'token=TOK1', { sinDk: true });
assert.equal(r.status, 200); assert.equal((await fila(r1.folio)).estado, 'confirmada'); ok('si Flow avisa dos veces, no cambia nada (idempotente)');
r = await c('POST', '/api/flow/confirmacion', '', { sinDk: true });
assert.equal(r.status, 400); ok('confirmación sin token → 400');

// retorno del cliente
r = await c('GET', '/api/flow/retorno?token=TOK1');
assert.equal(r.status, 303);
const cod1 = (await s.db.query('select codigo from reservas where folio = $1', [r1.folio])).rows[0].codigo;
assert.equal(r.headers.get('location'), `/index.html?folio=${r1.folio}&c=${cod1}`); ok('retorno: vuelve al sitio con el folio y el código de la reserva');
r = await c('POST', '/api/flow/retorno', '', { sinDk: true });
assert.equal(r.headers.get('location'), '/index.html'); ok('retorno sin token → vuelve al sitio sin romperse');

// monto distinto y pago anulado
const r3 = await nueva(17);
await c('POST', '/api/pago', { folio: r3.folio, codigo: r3.codigo });
s.flow.monto = 1000;
await c('POST', '/api/flow/confirmacion', 'token=TOK2', { sinDk: true });
let f3 = await fila(r3.folio);
assert.equal(f3.estado, 'pendiente'); assert.match(f3.nota, /pago de 1000 y el abono era 78000/); ok('si Flow informa otro monto, la reserva queda pendiente con una nota para revisar');
s.flow.monto = null;
const r4 = await nueva(18); await c('POST', '/api/pago', { folio: r4.folio, codigo: r4.codigo });
s.flow.status = 4; await c('POST', '/api/flow/confirmacion', 'token=TOK3', { sinDk: true });
assert.equal((await fila(r4.folio)).estado, 'cancelada'); ok('pago anulado en Flow → la reserva se cancela y libera el cupo');
s.flow.status = 2;

// clave secreta equivocada
const otroFlow = await flowSimulado();
const mal = await servidor({ flow: otroFlow, env: { FLOW_SECRET_KEY: 'otra' } });
const cm = cliente(mal.url);
const r5 = (await cm('POST', '/api/reservas', { p_fecha: futura(19), p_franja: 'tarde', p_nombre: 'Ana Pérez', p_email: 'ana@ejemplo.cl', p_telefono: '+56912345678',
  p_invitados: 20, p_items: {}, p_parcela: true, p_online: true, p_nino: 'Sofía', p_nacimiento: '2020-03-05', p_acepta: true })).datos;
r = await cm('POST', '/api/pago', { folio: r5.folio, codigo: r5.codigo });
assert.equal(r.status, 502); assert.match(r.datos.error, /No se pudo iniciar el pago/);
r = await cm('POST', '/api/flow/confirmacion', 'token=TOK1', { sinDk: true });
assert.equal(r.status, 500); ok('con una clave secreta equivocada Flow rechaza la firma: no se cobra y la confirmación responde 500 (Flow reintentaría)');
mal.close();

s.close();
console.log(`\nTodo bien: ${n} comprobaciones.`);
process.exit(0);
