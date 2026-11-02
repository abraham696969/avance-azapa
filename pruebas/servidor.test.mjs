// Servidor de Railway con una base PostgreSQL en memoria: sitio, reservas, seguridad del panel y archivos.
// Ejecutar:  node pruebas/servidor.test.mjs
import assert from 'node:assert/strict';
import { servidor, cliente, futura, ADMIN, baseEnMemoria } from './_railway.mjs';
import { crearApp } from '../server/index.mjs';

let n = 0; const ok = (m) => console.log('  ✓', m, `(${++n})`);
const s = await servidor();
const c = cliente(s.url);
const reserva = (extra = {}) => ({ p_fecha: futura(12), p_franja: 'tarde', p_nombre: 'Ana Pérez', p_email: 'ana@ejemplo.cl', p_telefono: '+56 9 1234 5678',
  p_invitados: 20, p_items: { castillo: 1 }, p_parcela: true, p_layout: [{ id: 'castillo', x: 0, z: 0, rot: 0 }], p_metodo: 'Flow', p_transaccion: '',
  p_online: false, p_nino: 'Sofía', p_nacimiento: '2020-03-05', p_acepta: true, ...extra });

// --- arranque y archivos del sitio ---
await crearApp({ db: s.db, env: { ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.clave }, log: { log() {}, warn() {}, error() {} } });
assert.equal((await s.db.query('select count(*)::int as n from catalogo')).rows[0].n, 11);
ok('el esquema se puede aplicar de nuevo sobre una base con datos (no duplica ni borra)');
let r = await c('GET', '/');
assert.equal(r.status, 200); assert(r.datos.toString().includes('<html')); ok('la portada se entrega');
for (const ruta of ['/server/index.mjs', '/schema.sql', '/package.json', '/pruebas/servidor.test.mjs', '/.git/config', '/../server/index.mjs', '/CLAUDE.md'])
  assert.equal((await c('GET', ruta)).status, 404, ruta);
ok('no se entregan el código del servidor, el esquema, las pruebas ni archivos internos');
r = await c('GET', '/config.js');
assert(r.datos.toString().includes('SERVIDOR:true,PAGO_ONLINE:true,PAGO_PRUEBAS:true')); ok('config.js avisa al sitio que hay servidor y pago en Flow (ambiente de pruebas)');

// --- público: catálogo y disponibilidad sin datos personales ---
r = await c('POST', '/api/reservas', reserva());
assert.equal(r.status, 200); assert.equal(r.datos.estado, 'pendiente'); assert.equal(r.datos.total, 195000); assert.equal(r.datos.abono, 58500);
ok('la reserva se crea y el total lo calcula la base (castillo 45.000 + parcela 150.000; abono 30 %)');
r = await c('POST', '/api/reservas', reserva({ p_franja: 'manana', p_items: { castillo: 1 }, total: 1, abono: 1, precio: 1 }));
assert.equal(r.datos.total, 195000); ok('aunque el navegador mande otros precios, la base los ignora');
r = await c('GET', '/api/publico');
assert.equal(r.status, 200); assert.equal(r.datos.catalogo.length, 11); assert.equal(typeof r.datos.catalogo[0].precio, 'number');
assert.equal(r.datos.disponibilidad.length, 2);
assert.deepEqual(Object.keys(r.datos.disponibilidad[0]).sort(), ['fecha', 'franja', 'items', 'parcela']);
assert(!JSON.stringify(r.datos).includes('ana@ejemplo.cl') && !JSON.stringify(r.datos).includes('Sofía'));
ok('la disponibilidad pública solo dice fecha, franja y qué se arrendó: ningún dato de clientes');
r = await c('POST', '/api/reservas', reserva());
assert.equal(r.status, 400); assert.match(r.datos.error, /parcela ya fue reservada/); ok('no permite reservar la parcela dos veces en la misma franja');
r = await c('POST', '/api/reservas', reserva({ p_fecha: futura(13), p_acepta: false }));
assert.equal(r.status, 400); assert.match(r.datos.error, /aceptar el uso de los datos/); ok('sin el consentimiento del apoderado no se puede reservar');
const lugar = { tipo: 'casa', direccion: 'Pasaje Los Olivos 123, Arica', suelo: 'pasto', ancho: 10, largo: 8, luz: 'si', agua: 'si' };
r = await c('POST', '/api/reservas', reserva({ p_modalidad: 'domicilio', p_zona: 'azapa', p_lugar: lugar, p_items: { castillo: 1 } }));
assert.equal(r.status, 200); assert.equal(r.datos.total, 60000);
const dom = (await s.db.query('select parcela, flete, zona, lugar from reservas where folio = $1', [r.datos.folio])).rows[0];
assert.equal(dom.parcela, false); assert.equal(dom.flete, 15000); assert.equal(dom.lugar.direccion, lugar.direccion);
ok('a domicilio: suma el despacho de la zona (45.000 + 15.000), guarda el lugar y no ocupa la parcela, aunque esté reservada');
r = await c('POST', '/api/reservas', reserva({ p_modalidad: 'domicilio', p_zona: 'azapa', p_lugar: lugar, p_items: { castillo: 1 } }));
assert.match(r.datos.error, /Ya no quedan suficientes "Castillo inflable"/); ok('el stock se comparte entre parcela y domicilio (solo hay 2 castillos)');
r = await c('POST', '/api/reservas', reserva({ p_fecha: futura(13), p_online: true }));
assert.equal(r.datos.estado, 'por_pagar'); const folio = r.datos.folio, codigo = r.datos.codigo;
ok('con Flow activo, la reserva en línea queda "por pagar" y guarda el cupo');
r = await c('GET', `/api/reservas/estado?folio=${folio}&c=${codigo}`);
assert.equal(r.datos.estado, 'por_pagar');
r = await c('GET', `/api/reservas/estado?folio=${folio}&c=otro`);
assert.equal(r.datos, null); ok('el estado de una reserva solo se ve con su código secreto');

// --- panel: acceso ---
r = await c('GET', '/api/admin/datos');
assert.equal(r.status, 401); ok('sin iniciar sesión el panel no entrega datos');
r = await c('POST', '/api/login', { email: ADMIN.email, clave: 'mala' });
assert.equal(r.status, 401); assert.match(r.datos.error, /incorrectos/); ok('clave incorrecta → rechazada');
const guardada = (await s.db.query('select clave_hash from admins')).rows[0].clave_hash;
assert(guardada.startsWith('scrypt$') && !guardada.includes(ADMIN.clave)); ok('la clave del administrador se guarda cifrada');
r = await c('POST', '/api/login', { email: ' JEFA@divertikids.cl ', clave: ADMIN.clave });
assert.equal(r.status, 200);
const sc = r.headers.get('set-cookie');
assert(/HttpOnly/.test(sc) && /SameSite=Strict/.test(sc)); ok('al entrar se crea una sesión en una cookie protegida (HttpOnly y SameSite)');
assert.equal((await s.db.query('select count(*)::int as n from sesiones where token_hash = $1', [sc.split(';')[0].split('=')[1]])).rows[0].n, 0);
ok('en la base se guarda solo un resumen de la sesión, no el código');
r = await c('GET', '/api/admin/datos');
assert.equal(r.status, 200); assert.equal(r.datos.reservas.length, 4);
assert(r.datos.reservas.every((x) => !('codigo' in x) && !('flow_token' in x))); assert.equal(r.datos.reservas[0].nombre_nino, 'Sofía');
ok('con sesión se ven las reservas con los datos del niño, sin los códigos internos del pago');

// --- panel: cambios ---
r = await c('POST', '/api/admin/reservas', { accion: 'update', fila: { estado: 'confirmada' }, clave: folio }, { sinDk: true });
assert.equal(r.status, 403); ok('un cambio sin la cabecera propia del sitio se rechaza (protección contra CSRF)');
r = await c('POST', '/api/admin/reservas', { accion: 'update', fila: { estado: 'confirmada', total: 1 }, clave: folio });
assert.equal(r.status, 200);
const fila = (await s.db.query('select estado, total from reservas where folio = $1', [folio])).rows[0];
assert.equal(fila.estado, 'confirmada'); assert.equal(fila.total, 195000); ok('el panel cambia el estado, pero no puede tocar el monto');
r = await c('POST', '/api/admin/reservas', { accion: 'update', fila: { estado: 'regalada' }, clave: folio });
assert.equal(r.status, 400); ok('un estado inexistente se rechaza');
r = await c('POST', '/api/admin/reservas', { accion: 'delete', clave: folio });
assert.equal(r.status, 400); r = await c('POST', '/api/admin/admins', { accion: 'insert', fila: { email: 'x@y.cl', clave_hash: 'x' } });
assert.equal(r.status, 404); ok('no se pueden borrar reservas ni tocar tablas fuera de la lista (administradores, sesiones)');
r = await c('POST', '/api/admin/catalogo', { accion: 'upsert', fila: { item_id: 'trampolin', nombre: 'Trampolín', precio: 28000, stock: 2, ancho: 3, largo: 3, alto: 1.2, color: '#ff0000', forma: 'box', categoria: 'juegos', 'precio"; drop table reservas; --': 1 } });
assert.equal(r.status, 200); assert.equal((await s.db.query('select count(*)::int as n from reservas')).rows[0].n, 4);
ok('crear un servicio funciona y las columnas desconocidas se ignoran (no hay inyección SQL)');
r = await c('POST', '/api/admin/catalogo', { accion: 'update', fila: { activo: false }, clave: 'trampolin' });
assert.equal((await c('GET', '/api/publico')).datos.catalogo.some((x) => x.item_id === 'trampolin'), false); ok('ocultar un servicio lo saca del sitio público');
r = await c('POST', '/api/admin/ofertas', { accion: 'insert', fila: { titulo: 'Oferta de prueba', texto: 'Piscina con descuento', hasta: null, activa: true } });
const oferta = (await c('GET', '/api/admin/datos')).datos.ofertas[0];
assert.equal(typeof oferta.id, 'number'); assert.equal((await c('GET', '/api/publico')).datos.ofertas.length, 1);
await c('POST', '/api/admin/ofertas', { accion: 'delete', clave: oferta.id });
assert.equal((await c('GET', '/api/publico')).datos.ofertas.length, 0); ok('ofertas: se crean, se ven en el sitio y se borran');
r = await c('POST', '/api/admin/terreno', { accion: 'upsert', fila: { id: 99, ancho: 48, largo: 44, suelo: 'tierra', cerco: true, elementos: [{ id: 'q1', t: 'quincho', x: 0, z: 0, w: 6, d: 4, rot: 0 }] } });
const t = (await c('GET', '/api/publico')).datos.terreno;
assert.equal(t.ancho, 48); assert.equal(t.elementos.length, 1); assert.equal((await s.db.query('select count(*)::int as n from terreno')).rows[0].n, 1);
ok('el terreno se guarda (siempre una sola fila) con sus elementos');
r = await c('POST', '/api/admin/fechas_bloqueadas', { accion: 'insert', fila: { fecha: futura(20), motivo: 'Mantención', aplica: 'parcela' } });
r = await c('POST', '/api/reservas', reserva({ p_fecha: futura(20) }));
assert.match(r.datos.error, /bloqueada/); ok('una fecha bloqueada desde el panel impide reservar');

// --- archivos ---
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 7)]);
r = await c('POST', '/api/admin/archivos?tipo=img&nombre=Castillo Rojo!', jpg);
assert.equal(r.status, 200); assert.match(r.datos.url, /^\/archivos\/castillo-rojo-[a-z0-9]+\.jpg$/);
const foto = await c('GET', r.datos.url);
assert.equal(foto.status, 200); assert.equal(foto.headers.get('content-type'), 'image/jpeg'); assert(foto.datos.equals(jpg));
ok('una foto se guarda en la base y se entrega en /archivos/ con su tipo correcto');
const glb = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(2044, 1)]);
r = await c('POST', '/api/admin/archivos?tipo=model&nombre=castillo', glb);
assert.match(r.datos.url, /\.glb$/); assert.equal((await c('GET', r.datos.url)).headers.get('content-type'), 'model/gltf-binary');
ok('un modelo 3D .glb se guarda y se entrega');
r = await c('POST', '/api/admin/archivos?tipo=img', Buffer.from('<script>alert(1)</script>'));
assert.equal(r.status, 400); r = await c('POST', '/api/admin/archivos?tipo=model', jpg);
assert.equal(r.status, 400); ok('se rechazan archivos que no son imágenes o modelos de verdad (se revisa el contenido)');
r = await c('POST', '/api/admin/archivos?tipo=img', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(6 * 1024 * 1024)]));
assert.equal(r.status, 413); ok('una foto de más de 5 MB se rechaza');

// --- cierre de sesión y límites ---
await c('POST', '/api/logout');
assert.equal((await c('GET', '/api/admin/datos')).status, 401); assert.equal((await s.db.query('select count(*)::int as n from sesiones')).rows[0].n, 0);
ok('cerrar sesión borra la sesión en la base');
const otro = cliente(s.url); let ultimo;
for (let i = 0; i < 9; i++) ultimo = await otro('POST', '/api/login', { email: ADMIN.email, clave: 'mala' + i });
assert.equal(ultimo.status, 429); ok('después de 8 intentos fallidos se bloquea el inicio de sesión por 15 minutos');
await assert.rejects(crearApp({ db: await baseEnMemoria(), env: { ADMIN_EMAIL: 'a@b.cl', ADMIN_PASSWORD: 'corta' }, log: { log() {}, warn() {}, error() {} } }), /al menos 10/);
ok('el servidor no arranca con una clave de administrador corta');
const sinFlow = await servidor({ conFlow: false });
r = await cliente(sinFlow.url)('POST', '/api/reservas', reserva({ p_online: true }));
assert.equal(r.datos.estado, 'pendiente'); assert((await cliente(sinFlow.url)('GET', '/config.js')).datos.toString().includes('PAGO_ONLINE:false'));
ok('sin claves de Flow, las reservas quedan "pendientes" para validar el abono a mano');
sinFlow.close();

assert.deepEqual(s.errores, []);
s.close();
console.log(`\nTodo bien: ${n} comprobaciones.`);
process.exit(0);
