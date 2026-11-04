// Divertí Kids · servidor para Railway.
// Entrega el sitio, guarda los datos en PostgreSQL y cobra el abono con Flow.
// Variables de entorno (Railway > servicio > Variables):
//   DATABASE_URL     dirección de la base PostgreSQL de Railway (obligatoria)
//   ADMIN_EMAIL      correo del administrador del panel
//   ADMIN_PASSWORD   su contraseña (mínimo 10 caracteres). Cambiarla aquí cambia la del panel.
//   FLOW_API_KEY, FLOW_SECRET_KEY   claves de Flow (si faltan, el abono lo valida el equipo a mano)
//   FLOW_API_URL     opcional: https://sandbox.flow.cl/api (pruebas, por defecto) o https://www.flow.cl/api
//   SITE_URL         opcional: dirección pública del sitio; si falta se usa la que entrega Railway
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Archivos públicos del sitio (solo estos se entregan; nunca el código del servidor) ----------
const PUBLIC = new Set(['index.html', 'admin.html', 'app.js', 'admin.js', 'shared.js', 'styles.css', 'sitio.css', 'sitio.js', 'config.js',
  'favicon.png', 'logo.png', 'logo-sm.png', 'apple-touch-icon.png']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };

// ---------- Conversión de tipos de PostgreSQL (igual en Railway y en las pruebas) ----------
// fechas como 'AAAA-MM-DD', numéricos y bigint como número de JavaScript
export const PARSERS = {
  1082: (v) => v,                 // date
  1184: (v) => v,                 // timestamptz
  1114: (v) => v,                 // timestamp
  1700: (v) => parseFloat(v),     // numeric
  20: (v) => Number(v),           // bigint
};

// ---------- Tablas que el panel puede modificar: columnas y acciones permitidas ----------
const CAT_COLS = ['item_id', 'nombre', 'descripcion', 'categoria', 'precio', 'stock', 'ancho', 'largo', 'alto', 'color', 'color_tope',
  'forma', 'activo', 'imagen', 'modelo3d', 'modelo_rot', 'domicilio', 'orden'];
const CLI_COLS = ['apoderado', 'nino', 'nacimiento', 'celular', 'correo', 'arrendo', 'fecha_evento', 'monto', 'notas'];
const OFE_COLS = ['titulo', 'texto', 'hasta', 'activa'];
const TABLES = {
  reservas: { key: 'folio', update: ['estado'] },
  catalogo: { key: 'item_id', upsert: CAT_COLS, update: ['activo'] },
  fechas_bloqueadas: { key: 'fecha', insert: ['fecha', 'motivo', 'aplica'], delete: true },
  terreno: { key: 'id', upsert: ['id', 'ancho', 'largo', 'suelo', 'cerco', 'foto', 'modelo3d', 'modelo_rot', 'elementos'], json: ['elementos'] },
  zonas_despacho: { key: 'id', upsert: ['id', 'nombre', 'precio', 'activa', 'orden'], delete: true },
  clientes_extra: { key: 'id', insert: CLI_COLS, update: CLI_COLS, delete: true },
  ofertas: { key: 'id', insert: OFE_COLS, update: OFE_COLS, delete: true },
  propuestas: { key: 'clave', upsert: ['clave'] },
};

const LIMITE_JSON = 1024 * 1024;                     // 1 MB
const LIMITE_FOTO = 5 * 1024 * 1024;                 // 5 MB
const LIMITE_MODELO = 30 * 1024 * 1024;              // 30 MB
const SESION_HORAS = 12;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const q = (id) => '"' + id + '"';                    // solo se usa con nombres de la lista blanca

// ---------- Claves del panel ----------
export function hashClave(clave) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(clave), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex');
}
function claveOk(clave, guardada) {
  const [tipo, salt, h] = String(guardada || '').split('$');
  if (tipo !== 'scrypt' || !salt || !h) return false;
  const calc = crypto.scryptSync(String(clave), Buffer.from(salt, 'hex'), 64);
  const esp = Buffer.from(h, 'hex');
  return esp.length === calc.length && crypto.timingSafeEqual(esp, calc);
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ---------- Flow ----------
function flowCliente(env) {
  const API = (env.FLOW_API_URL || 'https://sandbox.flow.cl/api').replace(/\/$/, '');
  const KEY = env.FLOW_API_KEY || '', SECRET = env.FLOW_SECRET_KEY || '';
  // Firma de Flow: parámetros ordenados por nombre, "nombre+valor" sin separadores, HMAC-SHA256 con la secretKey (hex)
  const firmar = (p) => crypto.createHmac('sha256', SECRET).update(Object.keys(p).sort().map((k) => k + p[k]).join('')).digest('hex');
  async function llamar(servicio, metodo, extra) {
    const p = { apiKey: KEY, ...extra };
    p.s = firmar(p);
    const qs = new URLSearchParams(p).toString();
    const res = metodo === 'GET'
      ? await fetch(`${API}/${servicio}?${qs}`)
      : await fetch(`${API}/${servicio}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Flow respondió ${res.status}: ${data.message ?? JSON.stringify(data)}`);
    return data;
  }
  return { activo: !!(KEY && SECRET), pruebas: !/\/\/www\.flow\.cl/.test(API), llamar };
}

// ---------- Aplicación ----------
// db = { query(texto, parametros) -> {rows}, exec(sqlCompleto) }
export async function crearApp({ db, env = process.env, log = console }) {
  await db.exec(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));
  // administrador desde las variables de entorno (se crea o se le actualiza la clave)
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) {
    if (String(env.ADMIN_PASSWORD || '').length < 10) throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
    const actual = (await db.query('select clave_hash from admins where email = $1', [adminEmail])).rows[0];
    if (!actual || !claveOk(env.ADMIN_PASSWORD, actual.clave_hash)) {
      await db.query('insert into admins (email, clave_hash) values ($1, $2) on conflict (email) do update set clave_hash = excluded.clave_hash',
        [adminEmail, hashClave(env.ADMIN_PASSWORD)]);
      await db.query('delete from sesiones where email = $1', [adminEmail]);   // clave nueva: se cierran las sesiones abiertas
    }
  } else if (!(await db.query('select 1 from admins limit 1')).rows.length) {
    log.warn('Aviso: no hay administradores. Define ADMIN_EMAIL y ADMIN_PASSWORD en Railway para entrar al panel.');
  }
  await db.query('delete from sesiones where expira < now()');

  const flow = flowCliente(env);
  const sitio = () => (env.SITE_URL || (env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/, '');
  const fallos = new Map();   // intentos fallidos de login por IP

  // --- utilidades de petición y respuesta ---
  const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  function enviar(res, status, cuerpo, headers = {}) {
    const json = typeof cuerpo !== 'string';
    res.writeHead(status, { 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(json ? JSON.stringify(cuerpo) : cuerpo);
  }
  async function leerCuerpo(req, limite) {
    const partes = []; let total = 0;
    for await (const c of req) {
      total += c.length;
      if (total <= limite) partes.push(c);    // si se pasa, se sigue leyendo sin guardar, para responder sin cortar la conexión
    }
    if (total > limite) throw new HttpError(413, 'El archivo o los datos son demasiado grandes.');
    return Buffer.concat(partes);
  }
  async function leerJSON(req) {
    const b = await leerCuerpo(req, LIMITE_JSON);
    if (!b.length) return {};
    try { return JSON.parse(b.toString('utf8')); } catch { throw new HttpError(400, 'Datos no válidos.'); }
  }
  async function leerToken(req, url) {
    let token = url.searchParams.get('token') || '';
    if (!token && req.method === 'POST') {
      const b = (await leerCuerpo(req, LIMITE_JSON)).toString('utf8');
      if (String(req.headers['content-type'] || '').includes('json')) { try { token = String(JSON.parse(b).token || ''); } catch { /* sin token */ } }
      else token = new URLSearchParams(b).get('token') || '';
    }
    return token;
  }
  const cookie = (req, nombre) => {
    const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  };
  const esHttps = (req) => String(req.headers['x-forwarded-proto'] || '').includes('https');
  const cookieSesion = (req, valor, maxAge) =>
    `dk_sesion=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (esHttps(req) ? '; Secure' : '');
  async function sesion(req) {
    const t = cookie(req, 'dk_sesion');
    if (!t) return null;
    const r = (await db.query('select email from sesiones where token_hash = $1 and expira > now()', [sha(t)])).rows[0];
    return r ? r.email : null;
  }

  // --- datos ---
  const unaFila = async (sql, p = []) => (await db.query(sql, p)).rows[0] || null;
  const filas = async (sql, p = []) => (await db.query(sql, p)).rows;
  async function datosPublicos() {
    const [disponibilidad, bloqueos, catalogo, terreno, ofertas, zonas] = await Promise.all([
      filas('select fecha, franja, items, parcela from disponibilidad()'),
      filas('select fecha, motivo, aplica from fechas_bloqueadas where fecha >= current_date order by fecha'),
      filas('select * from catalogo where activo order by orden, item_id'),
      unaFila('select * from terreno where id = 1'),
      filas('select id, titulo, texto, hasta, activa from ofertas where activa and (hasta is null or hasta >= current_date) order by id'),
      filas('select * from zonas_despacho where activa order by orden'),
    ]);
    return { disponibilidad, bloqueos, catalogo, terreno, ofertas, zonas };
  }
  async function datosAdmin() {
    const [reservas, bloqueos, catalogo, terreno, clientes, ofertas, propuestas, zonas] = await Promise.all([
      filas('select * from reservas order by fecha, franja'),
      filas('select fecha, motivo, aplica from fechas_bloqueadas order by fecha'),
      filas('select * from catalogo order by orden, item_id'),
      unaFila('select * from terreno where id = 1'),
      filas('select * from clientes_extra order by id'),
      filas('select * from ofertas order by id'),
      filas('select clave from propuestas'),
      filas('select * from zonas_despacho order by orden'),
    ]);
    reservas.forEach((r) => { delete r.codigo; delete r.flow_token; });   // datos internos del pago
    return { reservas, bloqueos, catalogo, terreno, clientes, ofertas, propuestas: propuestas.map((p) => p.clave), zonas };
  }
  // Cambios del panel: solo tablas, columnas y acciones de la lista blanca
  async function cambiar(tabla, { accion, fila, clave }) {
    const T = TABLES[tabla];
    if (!T) throw new HttpError(404, 'No existe.');
    const permitidas = T[accion];
    if (!permitidas) throw new HttpError(400, 'Acción no permitida.');
    const val = (c, v) => (T.json || []).includes(c) ? JSON.stringify(v) : (v === '' ? null : v);
    if (accion === 'delete') {
      const r = await db.query(`delete from ${q(tabla)} where ${q(T.key)} = $1`, [clave]);
      return { cambios: r.affectedRows ?? r.rowCount ?? 0 };
    }
    fila = fila && typeof fila === 'object' ? fila : {};
    if (tabla === 'terreno') fila.id = 1;
    const cols = permitidas.filter((c) => Object.prototype.hasOwnProperty.call(fila, c));
    if (!cols.length) throw new HttpError(400, 'No hay datos para guardar.');
    const vals = cols.map((c) => val(c, fila[c]));
    if (accion === 'update') {
      if (clave == null || clave === '') throw new HttpError(400, 'Falta indicar qué registro cambiar.');
      const set = cols.map((c, i) => `${q(c)} = $${i + 1}`).join(', ');
      const r = await db.query(`update ${q(tabla)} set ${set} where ${q(T.key)} = $${cols.length + 1}`, [...vals, clave]);
      if (!(r.affectedRows ?? r.rowCount)) throw new HttpError(404, 'No se encontró el registro.');
      return { cambios: 1 };
    }
    const ph = cols.map((_, i) => '$' + (i + 1)).join(', ');
    let sql = `insert into ${q(tabla)} (${cols.map(q).join(', ')}) values (${ph})`;
    if (accion === 'upsert') {
      if (!cols.includes(T.key)) throw new HttpError(400, 'Falta el identificador.');
      const otras = cols.filter((c) => c !== T.key);
      sql += ` on conflict (${q(T.key)}) do ` + (otras.length ? 'update set ' + otras.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ') : 'nothing');
    }
    await db.query(sql, vals);
    return { cambios: 1 };
  }
  // Fotos y modelos: se revisa el contenido real del archivo, no lo que diga el navegador
  function tipoArchivo(b) {
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['jpg', 'image/jpeg'];
    if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['png', 'image/png'];
    if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
    if (b.length > 12 && b.toString('ascii', 0, 4) === 'glTF') return ['glb', 'model/gltf-binary'];
    return null;
  }

  // --- pago con Flow ---
  async function procesarToken(token) {
    const st = await flow.llamar('payment/getStatus', 'GET', { token });   // estado REAL, consultado a Flow
    const r = await unaFila('select marcar_pago($1, $2, $3, $4) as resultado',
      [String(st.commerceOrder), Number(st.status), Number(st.flowOrder), Math.round(Number(st.amount))]);
    return { folio: String(st.commerceOrder), resultado: r.resultado };
  }

  // --- rutas ---
  async function manejar(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const M = req.method;

    if (p === '/api/salud') return enviar(res, 200, { ok: true });

    // --- público ---
    if (p === '/api/publico' && M === 'GET') return enviar(res, 200, await datosPublicos());
    if (p === '/api/reservas' && M === 'POST') {
      const a = await leerJSON(req);
      const r = await unaFila(`select crear_reserva($1::date, $2, $3, $4, $5, $6::integer, $7::jsonb, $8::boolean, $9::jsonb, $10, $11, $12::boolean,
        $13, $14::date, $15::boolean, $16, $17::jsonb, $18) as r`, [
        a.p_fecha ?? null, a.p_franja ?? null, a.p_nombre ?? null, a.p_email ?? null, a.p_telefono ?? null,
        a.p_invitados ?? null, JSON.stringify(a.p_items ?? {}), a.p_parcela ?? true, JSON.stringify(a.p_layout ?? []),
        a.p_metodo ?? null, a.p_transaccion ?? null, !!a.p_online && flow.activo,
        a.p_nino ?? null, a.p_nacimiento || null, !!a.p_acepta,
        a.p_modalidad ?? 'parcela', a.p_lugar == null ? null : JSON.stringify(a.p_lugar), a.p_zona ?? null]);
      return enviar(res, 200, r.r);
    }
    if (p === '/api/reservas/estado' && M === 'GET') {
      const r = await unaFila('select estado_reserva($1, $2) as r', [url.searchParams.get('folio') || '', url.searchParams.get('c') || '']);
      return enviar(res, 200, r.r);
    }
    if (p === '/api/pago' && M === 'POST') {
      if (!flow.activo) return enviar(res, 503, { error: 'El pago en línea no está activado.' });
      const { folio, codigo } = await leerJSON(req);
      if (!folio || !codigo) return enviar(res, 400, { error: 'Faltan datos de la reserva.' });
      const r = await unaFila('select folio, abono, email, estado, expira > now() as vigente from reservas where folio = $1 and codigo = $2', [String(folio), String(codigo)]);
      if (!r) return enviar(res, 404, { error: 'No encontramos esa reserva.' });
      if (r.estado !== 'por_pagar' || !r.vigente) return enviar(res, 409, { error: 'El plazo para pagar esta reserva venció. Vuelve a reservar.' });
      const base = sitio() || `http://${req.headers.host}`;
      try {
        const out = await flow.llamar('payment/create', 'POST', {
          commerceOrder: r.folio, subject: `Abono reserva ${r.folio} · Divertí Kids`, currency: 'CLP',
          amount: String(r.abono), email: r.email,
          urlConfirmation: `${base}/api/flow/confirmacion`, urlReturn: `${base}/api/flow/retorno`, timeout: '1800',
        });
        if (!out.url || !out.token) return enviar(res, 502, { error: 'Flow no entregó la dirección de pago.' });
        await db.query('update reservas set flow_token = $1 where folio = $2', [out.token, r.folio]);
        return enviar(res, 200, { url: `${out.url}?token=${out.token}` });
      } catch (e) {
        log.error(e);
        return enviar(res, 502, { error: 'No se pudo iniciar el pago. Intenta de nuevo en unos minutos.' });
      }
    }
    // Flow avisa aquí cuando cambia un pago. Debe recibir 200; si no, reintenta.
    if (p === '/api/flow/confirmacion' && M === 'POST') {
      const token = await leerToken(req, url);
      if (!token) return enviar(res, 400, 'falta token');
      try { const { folio, resultado } = await procesarToken(token); log.log('Flow confirmación', folio, resultado); return enviar(res, 200, 'ok'); }
      catch (e) { log.error(e); return enviar(res, 500, 'error'); }
    }
    // El cliente vuelve desde Flow: se revisa el pago y se lo lleva al sitio con su folio
    if (p === '/api/flow/retorno' && (M === 'POST' || M === 'GET')) {
      const volver = (qs = '') => { res.writeHead(303, { Location: '/index.html' + qs, 'Cache-Control': 'no-store' }); res.end(); };
      try {
        const token = await leerToken(req, url);
        if (!token) return volver();
        const { folio } = await procesarToken(token);
        const r = await unaFila('select codigo from reservas where folio = $1', [folio]);
        return volver(r ? `?folio=${encodeURIComponent(folio)}&c=${encodeURIComponent(r.codigo)}` : '');
      } catch (e) { log.error(e); return volver(); }
    }

    // --- panel de administración ---
    if (p === '/api/sesion' && M === 'GET') return enviar(res, 200, { email: await sesion(req) });
    if (p === '/api/login' && M === 'POST') {
      const quien = ip(req), f = fallos.get(quien);
      if (f && f.n >= 8 && Date.now() - f.t < 15 * 60e3) return enviar(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
      const { email, clave } = await leerJSON(req);
      const a = await unaFila('select email, clave_hash from admins where email = $1', [String(email || '').trim().toLowerCase()]);
      if (!a || !claveOk(clave, a.clave_hash)) {
        fallos.set(quien, { n: (f && Date.now() - f.t < 15 * 60e3 ? f.n : 0) + 1, t: Date.now() });
        return enviar(res, 401, { error: 'Correo o contraseña incorrectos.' });
      }
      fallos.delete(quien);
      const token = crypto.randomBytes(32).toString('hex');
      await db.query(`insert into sesiones (token_hash, email, expira) values ($1, $2, now() + interval '${SESION_HORAS} hours')`, [sha(token), a.email]);
      return enviar(res, 200, { email: a.email }, { 'Set-Cookie': cookieSesion(req, token, SESION_HORAS * 3600) });
    }
    if (p === '/api/logout' && M === 'POST') {
      const t = cookie(req, 'dk_sesion');
      if (t) await db.query('delete from sesiones where token_hash = $1', [sha(t)]);
      return enviar(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(req, '', 0) });
    }
    if (p.startsWith('/api/admin/')) {
      // Los cambios exigen una cabecera propia: otro sitio no puede enviarla (protección contra CSRF)
      if (M !== 'GET' && req.headers['x-dk'] !== '1') return enviar(res, 403, { error: 'Petición no permitida.' });
      if (!(await sesion(req))) return enviar(res, 401, { error: 'Tu sesión terminó. Vuelve a entrar.' });
      if (p === '/api/admin/datos' && M === 'GET') return enviar(res, 200, await datosAdmin());
      if (p === '/api/admin/archivos' && M === 'POST') {
        const modelo = url.searchParams.get('tipo') === 'model';
        const b = await leerCuerpo(req, modelo ? LIMITE_MODELO : LIMITE_FOTO);
        const t = tipoArchivo(b);
        if (!t || (modelo ? t[0] !== 'glb' : t[0] === 'glb')) return enviar(res, 400, { error: modelo ? 'El modelo debe ser un archivo .glb.' : 'La foto debe ser JPG, PNG o WebP.' });
        const nombre = String(url.searchParams.get('nombre') || 'archivo').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'archivo';
        const id = `${nombre}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}.${t[0]}`;
        await db.query('insert into archivos (id, tipo, datos) values ($1, $2, $3)', [id, t[1], b]);
        return enviar(res, 200, { url: '/archivos/' + id });
      }
      const m = p.match(/^\/api\/admin\/([a-z_]+)$/);
      if (m && M === 'POST') return enviar(res, 200, await cambiar(m[1], await leerJSON(req)));
      return enviar(res, 404, { error: 'No existe.' });
    }

    // --- fotos y modelos guardados ---
    const am = p.match(/^\/archivos\/([a-z0-9-]{3,80}\.(?:jpg|png|webp|glb))$/);
    if (am && M === 'GET') {
      const r = await unaFila('select tipo, datos from archivos where id = $1', [am[1]]);
      if (!r) return enviar(res, 404, 'no existe');
      const datos = Buffer.from(r.datos);
      res.writeHead(200, { 'Content-Type': r.tipo, 'Content-Length': datos.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      return res.end(datos);
    }

    // --- sitio ---
    if (M !== 'GET' && M !== 'HEAD') return enviar(res, 405, 'método no permitido');
    const nombre = p === '/' ? 'index.html' : p.slice(1);
    if (!PUBLIC.has(nombre)) return enviar(res, 404, 'no existe');
    let cuerpo = fs.readFileSync(path.join(ROOT, nombre));
    if (nombre === 'config.js') {
      // el servidor avisa al sitio que hay base de datos y si el pago en Flow está activo
      cuerpo = Buffer.concat([cuerpo, Buffer.from(`\nwindow.DK_CONFIG=Object.assign(window.DK_CONFIG||{},{SERVIDOR:true,PAGO_ONLINE:${flow.activo},PAGO_PRUEBAS:${flow.pruebas}});\n`)]);
    }
    const ext = path.extname(nombre);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.png' ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    return res.end(M === 'HEAD' ? undefined : cuerpo);
  }

  return async function (req, res) {
    try { await manejar(req, res); }
    catch (e) {
      if (res.headersSent) { res.end(); return; }
      if (e instanceof HttpError) return enviar(res, e.status, { error: e.message });
      if (e && e.code === 'P0001') return enviar(res, 400, { error: e.message });          // mensajes de las reglas del negocio
      if (e && /^(22|23)/.test(String(e.code || ''))) return enviar(res, 400, { error: 'Datos no válidos. Revisa lo que escribiste.' });
      log.error(e);
      return enviar(res, 500, { error: 'Ocurrió un error en el servidor. Intenta de nuevo.' });
    }
  };
}

// ---------- Conexión a PostgreSQL (Railway) ----------
export async function conectarPostgres(url) {
  const pg = (await import('pg')).default;
  for (const [oid, fn] of Object.entries(PARSERS)) pg.types.setTypeParser(Number(oid), fn);
  const pool = new pg.Pool({ connectionString: url, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined, max: 5 });
  pool.on('connect', (c) => c.query("set time zone 'America/Santiago'"));
  return { query: (t, p) => pool.query(t, p), exec: (s) => pool.query(s), cerrar: () => pool.end() };
}

// ---------- Arranque ----------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!process.env.DATABASE_URL) { console.error('Falta la variable DATABASE_URL (la base PostgreSQL de Railway).'); process.exit(1); }
  const db = await conectarPostgres(process.env.DATABASE_URL);
  const app = await crearApp({ db });
  const port = Number(process.env.PORT || 3000);
  http.createServer(app).listen(port, () => console.log(`Divertí Kids escuchando en el puerto ${port}`));
}
