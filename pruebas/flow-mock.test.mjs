// Prueba de las 3 funciones de servidor contra un Flow simulado y una base simulada (sin internet).
// Ejecutar:  node --experimental-strip-types pruebas/flow-mock.test.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'clave-secreta-de-prueba', APIKEY = 'api-key-de-prueba';
const sigOk = (p) => { const s = p.s; const q = { ...p }; delete q.s;
  const str = Object.keys(q).sort().map(k => k + q[k]).join('');
  return s === crypto.createHmac('sha256', SECRET).update(str).digest('hex'); };

// ---- Flow simulado
const flowLog = []; let flowStatus = 2;
const flow = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let params = Object.fromEntries(u.searchParams);
  if (req.method === 'POST') { let b = ''; for await (const c of req) b += c; params = Object.fromEntries(new URLSearchParams(b)); }
  flowLog.push({ path: u.pathname, params });
  res.setHeader('Content-Type', 'application/json');
  if (!sigOk(params) || params.apiKey !== APIKEY) { res.statusCode = 401; return res.end(JSON.stringify({ code: 105, message: 'firma inválida' })); }
  if (u.pathname === '/api/payment/create') return res.end(JSON.stringify({ url: 'https://sandbox.flow.cl/app/web/pay.php', token: 'TOK123', flowOrder: 777 }));
  if (u.pathname === '/api/payment/getStatus') return res.end(JSON.stringify({ commerceOrder: 'R-1001', flowOrder: 777, status: flowStatus, amount: 70500 }));
  res.statusCode = 404; res.end('{}');
});
// ---- Base simulada (PostgREST)
const db = { rpc: [], patch: [], reserva: { folio: 'R-1001', codigo: 'SECRETO', abono: 70500, email: 'a@b.cl', estado: 'por_pagar', expira: new Date(Date.now() + 600000).toISOString() } };
const sb = http.createServer(async (req, res) => {
  let b = ''; for await (const c of req) b += c;
  assert.equal(req.headers.apikey, 'SERVICE'); assert.equal(req.headers.authorization, 'Bearer SERVICE');
  const u = new URL(req.url, 'http://x'); res.setHeader('Content-Type', 'application/json');
  if (u.pathname.endsWith('/rpc/marcar_pago')) { db.rpc.push(JSON.parse(b)); return res.end(JSON.stringify('confirmada')); }
  if (req.method === 'PATCH') { db.patch.push(JSON.parse(b)); return res.end('[]'); }
  const q = u.searchParams;
  if (u.pathname.endsWith('/reservas')) {
    const okFolio = q.get('folio') === 'eq.' + db.reserva.folio;
    const okCod = !q.get('codigo') || q.get('codigo') === 'eq.' + db.reserva.codigo;
    return res.end(JSON.stringify(okFolio && okCod ? [db.reserva] : []));
  }
  res.statusCode = 404; res.end('{}');
});
const listen = (s) => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const fp = await listen(flow), sp = await listen(sb);
globalThis.__v = 0;
const env = { FLOW_API_URL: `http://127.0.0.1:${fp}/api`, FLOW_API_KEY: APIKEY, FLOW_SECRET_KEY: SECRET,
  SUPABASE_URL: `http://127.0.0.1:${sp}`, SUPABASE_SERVICE_ROLE_KEY: 'SERVICE', SITE_URL: 'https://sitio.test/' };
import fs from 'node:fs'; import os from 'node:os';
async function load(name) {   // copia cada función a un archivo nuevo para que se vuelva a leer la configuración
  let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dkfn-')), name + '.ts');
  fs.copyFileSync(path.join(root, 'supabase/functions', name, 'index.ts'), tmp);
  await import(pathToFileURL(tmp).href);
  return handler;
}
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
let n = 0; const ok = (m) => console.log('  ✓', m, `(${++n})`);

const crear = await load('flow-crear-pago');
let r = await crear(new Request('http://f/', { method: 'POST', body: JSON.stringify({ folio: 'R-1001', codigo: 'SECRETO' }) }));
let j = await r.json(); assert.equal(r.status, 200); assert.equal(j.url, 'https://sandbox.flow.cl/app/web/pay.php?token=TOK123');
const created = flowLog.find(x => x.path === '/api/payment/create').params;
assert.equal(created.amount, '70500'); assert.equal(created.commerceOrder, 'R-1001'); assert.equal(created.currency, 'CLP');
assert.equal(created.urlConfirmation, `http://127.0.0.1:${sp}/functions/v1/flow-confirmacion`);
ok('crear pago: firma válida, monto tomado de la base, devuelve la URL de Flow');
assert.deepEqual(db.patch[0], { flow_token: 'TOK123' }); ok('guarda el token de Flow en la reserva');
r = await crear(new Request('http://f/', { method: 'POST', body: JSON.stringify({ folio: 'R-1001', codigo: 'MALO' }) }));
assert.equal(r.status, 404); ok('código secreto incorrecto → 404');
db.reserva.expira = new Date(Date.now() - 1000).toISOString();
r = await crear(new Request('http://f/', { method: 'POST', body: JSON.stringify({ folio: 'R-1001', codigo: 'SECRETO' }) }));
assert.equal(r.status, 409); ok('reserva con plazo vencido → 409');
db.reserva.expira = new Date(Date.now() + 600000).toISOString();

const conf = await load('flow-confirmacion');
r = await conf(new Request('http://f/', form({ token: 'TOK123' })));
assert.equal(r.status, 200); assert.deepEqual(db.rpc.at(-1), { p_folio: 'R-1001', p_status: 2, p_flow_orden: 777, p_monto: 70500 });
ok('confirmación: consulta getStatus firmado y marca el pago (status 2, monto 70500)');
r = await conf(new Request('http://f/', form({}))); assert.equal(r.status, 400); ok('confirmación sin token → 400');

const ret = await load('flow-retorno');
r = await ret(new Request('http://f/', form({ token: 'TOK123' })));
assert.equal(r.status, 303); assert.equal(r.headers.get('location'), 'https://sitio.test/index.html?folio=R-1001&c=SECRETO');
ok('retorno: redirige al sitio con folio y código');
r = await ret(new Request('http://f/')); assert.equal(r.headers.get('location'), 'https://sitio.test/index.html'); ok('retorno sin token → vuelve al sitio sin romperse');

env.FLOW_SECRET_KEY = 'otra'; const conf2 = await load('flow-confirmacion'); r = await conf2(new Request('http://f/', form({ token: 'TOK123' })));
assert.equal(r.status, 500); ok('con una clave secreta equivocada Flow rechaza la firma → 500 (Flow reintentaría)');
console.log(`\nTodo bien: ${n} comprobaciones.`);
flow.close(); sb.close();
