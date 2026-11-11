// Levanta el servidor real (server/index.mjs) con una base PostgreSQL en memoria (PGlite)
// y un Flow simulado. Así las pruebas no necesitan internet, Railway ni Flow reales.
import http from 'node:http';
import crypto from 'node:crypto';
import { crearApp, PARSERS } from '../server/index.mjs';

export const FLOW_SECRET = 'clave-secreta-de-prueba', FLOW_KEY = 'api-key-de-prueba';
export const ADMIN = { email: 'jefa@divertikids.cl', clave: 'clave-segura-123' };

const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

// Flow simulado: valida la firma, crea pagos y responde su estado
export async function flowSimulado() {
  const f = { log: [], pagos: new Map(), status: 2, monto: null };
  const firmaOk = (p) => {
    const q = { ...p }; const s = q.s; delete q.s;
    return s === crypto.createHmac('sha256', FLOW_SECRET).update(Object.keys(q).sort().map((k) => k + q[k]).join('')).digest('hex');
  };
  f.server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); let p = Object.fromEntries(u.searchParams);
    if (req.method === 'POST') { let b = ''; for await (const c of req) b += c; p = Object.fromEntries(new URLSearchParams(b)); }
    if (u.pathname === '/pay') { res.setHeader('Content-Type', 'text/html'); return res.end('<h1>Flow (simulado)</h1>'); }
    f.log.push({ path: u.pathname, params: p });
    res.setHeader('Content-Type', 'application/json');
    if (!firmaOk(p) || p.apiKey !== FLOW_KEY) { res.statusCode = 401; return res.end(JSON.stringify({ code: 105, message: 'firma inválida' })); }
    if (u.pathname === '/api/payment/create') {
      // como Flow real: rechaza correos que no considera válidos
      if (/@rechazado\./.test(p.email || '')) { res.statusCode = 400; return res.end(JSON.stringify({ code: 1620, message: `The userEmail: ${p.email} is not valid.` })); }
      const token = 'TOK' + (f.pagos.size + 1);
      f.pagos.set(token, { orden: p.commerceOrder, monto: Number(p.amount), flowOrder: 700 + f.pagos.size });
      return res.end(JSON.stringify({ url: `http://127.0.0.1:${f.port}/pay`, token, flowOrder: 777 }));
    }
    if (u.pathname === '/api/payment/getStatus') {
      const x = f.pagos.get(p.token);
      if (!x) { res.statusCode = 400; return res.end(JSON.stringify({ message: 'token desconocido' })); }
      return res.end(JSON.stringify({ commerceOrder: x.orden, flowOrder: x.flowOrder, status: f.status, amount: f.monto ?? x.monto }));
    }
    res.statusCode = 404; res.end('{}');
  });
  f.port = await listen(f.server);
  f.url = `http://127.0.0.1:${f.port}/api`;
  return f;
}

// Base PostgreSQL en memoria con las mismas conversiones de tipos que en Railway
export async function baseEnMemoria() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite({ parsers: PARSERS });
  await pg.exec("set time zone 'America/Santiago'");
  return { query: (t, p) => pg.query(t, p), exec: (s) => pg.exec(s), pg };
}

// Servidor completo. conFlow=false simula Railway sin claves de Flow.
export async function servidor({ conFlow = true, db, flow, env = {} } = {}) {
  db = db || await baseEnMemoria();
  flow = flow || (conFlow ? await flowSimulado() : null);
  const errores = [];
  const app = await crearApp({
    db,
    env: {
      ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.clave,
      ...(conFlow ? { FLOW_API_KEY: FLOW_KEY, FLOW_SECRET_KEY: FLOW_SECRET, FLOW_API_URL: flow.url } : {}),
      ...env,
    },
    log: { log() {}, warn() {}, error: (e) => errores.push(e) },
  });
  const s = http.createServer(app);
  const port = await listen(s);
  return {
    url: `http://127.0.0.1:${port}`, db, flow, errores,
    close: () => { s.close(); if (flow) flow.server.close(); },
  };
}

// Cliente HTTP mínimo con cookie de sesión
export function cliente(base) {
  let galleta = '';
  return async function pedir(metodo, ruta, cuerpo, extra = {}) {
    const headers = { 'x-dk': '1', ...(extra.headers || {}) };
    if (galleta) headers.cookie = galleta;
    let body;
    if (cuerpo !== undefined) {
      if (Buffer.isBuffer(cuerpo)) { body = cuerpo; headers['content-type'] = 'application/octet-stream'; }
      else if (typeof cuerpo === 'string') { body = cuerpo; headers['content-type'] = 'application/x-www-form-urlencoded'; }
      else { body = JSON.stringify(cuerpo); headers['content-type'] = 'application/json'; }
    }
    if (extra.sinDk) delete headers['x-dk'];
    const r = await fetch(base + ruta, { method: metodo, headers, body, redirect: 'manual' });
    const sc = r.headers.get('set-cookie');
    if (sc) { const v = sc.split(';')[0]; galleta = v.endsWith('=') ? '' : v; }
    const tipo = r.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
    return { status: r.status, datos, headers: r.headers };
  };
}

// Fecha futura en formato AAAA-MM-DD
export const futura = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
