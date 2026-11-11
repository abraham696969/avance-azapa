// Recorrido completo en el navegador con el servidor de Railway, una base PostgreSQL en memoria y un Flow simulado:
// reservar, pagar en Flow, volver al sitio, y usar el panel con login real, cambios y archivos.
import { createRequire } from 'node:module'; import assert from 'node:assert/strict';
import { servidor, ADMIN } from './_railway.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const s = await servidor();
const db = (sql, p) => s.db.query(sql, p).then((r) => r.rows);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, (r) => r.abort());
const errs = []; let n = 0; const ok = (m) => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));

// --- reservar y pagar ---
await p.goto(s.url + '/index.html?todo=1'); await p.waitForTimeout(900);
const vacios = await p.evaluate(() => ['cName', 'cMail', 'cPhone', 'cGuests', 'cKid'].map((id) => document.getElementById(id).value));
assert.deepEqual(vacios, ['', '', '', '', '']); assert(!(await p.textContent('#reservar')).includes('ejemplo'));
ok('en el sitio publicado el formulario parte vacío, sin datos de ejemplo');
await p.click('[data-add="castillo"]');
await p.fill('#cName', 'Ana Pérez'); await p.fill('#cMail', 'ana@ejemplo.cl'); await p.fill('#cPhone', '+56 9 1234 5678'); await p.fill('#cGuests', '20');
await p.fill('#cKid', 'Sofía'); await p.fill('#cKidBirth', '2020-03-05'); await p.check('#cConsent'); await p.click('#payBtn'); await p.waitForTimeout(200);
assert(!(await p.isVisible('#payOv'))); assert.match(await p.textContent('#formErr'), /correo real/); ok('no deja reservar con un correo de ejemplo');
// Flow rechaza el correo: el cliente ve qué corregir y puede reintentar en la misma fecha
await p.fill('#cMail', 'ana@rechazado.cl'); await p.click('#payBtn'); await p.waitForTimeout(200); await p.click('#payGo'); await p.waitForTimeout(1200);
assert.match(await p.textContent('#payMsg'), /no aceptó el correo ana@rechazado\.cl/); assert(!(await p.locator('#payGo').isDisabled()));
assert.equal((await db("select estado from reservas"))[0].estado, 'cancelada'); ok('si Flow rechaza el correo se explica en pantalla y la fecha no queda apartada');
await db('delete from reservas');
await p.click('#payCancel'); await p.fill('#cMail', 'ana@gmail.com'); await p.click('#payBtn'); await p.waitForTimeout(200);
assert(!(await p.isVisible('#cardBlock'))); assert(await p.isVisible('#onlineNote')); ok('con el servidor y Flow activos se ocultan los campos de tarjeta de prueba y se explica el pago en Flow');
assert((await p.textContent('#payGo')).includes('Flow')); ok('el botón dice "Ir a pagar a Flow"');
await p.click('#payGo'); await p.waitForURL(/\/pay\?token=TOK1/, { timeout: 8000 });
ok('el navegador es enviado a la página de pago que entregó Flow');
const [res] = await db('select * from reservas');
assert.equal(res.estado, 'por_pagar'); assert.equal(res.nombre_nino, 'Sofía'); assert.equal(res.nacimiento_nino, '2020-03-05'); assert.equal(res.acepta_datos, true);
assert.equal(res.modalidad, 'parcela'); assert.equal(res.metodo_pago, 'Flow'); assert.equal(res.total, 195000);
ok('la reserva quedó en la base "por pagar", con los datos del niño, el consentimiento y el total calculado por el servidor');
const pago = s.flow.log.find((x) => x.path === '/api/payment/create').params;
assert.equal(pago.amount, '58500'); ok('a Flow se le cobró el abono que fijó el servidor (58.500)');

// Flow confirma el pago y devuelve al cliente al sitio
await fetch(s.url + '/api/flow/confirmacion', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'token=TOK1' });
await p.goto(s.url + '/api/flow/retorno?token=TOK1'); await p.waitForTimeout(1300);
assert((await p.textContent('#bookArea')).includes('¡Pago recibido!')); assert(!p.url().includes('folio=')); assert.equal((await db('select estado from reservas'))[0].estado, 'confirmada');
ok('al volver de Flow se ve "¡Pago recibido!", la reserva está confirmada en la base y la dirección queda limpia');
const ver = async (texto, codigo = res.codigo) => {
  await p.goto(s.url + `/index.html?todo=1&folio=${res.folio}&c=${codigo}`); await p.waitForTimeout(1200);
  const t = await p.textContent('#bookArea'); assert(t.includes(texto), `esperaba "${texto}" y salió "${t.slice(0, 120)}"`);
};
await db("update reservas set estado = 'pendiente'"); await ver('Recibimos tu pago'); ok('retorno con revisión pendiente lo explica');
await db("update reservas set estado = 'por_pagar', expira = now() - interval '1 minute'"); await ver('El pago no se completó'); ok('retorno con plazo vencido ofrece reservar de nuevo');
await ver('No encontramos esa reserva', 'otro'); ok('retorno con código incorrecto no muestra datos');
await db("update reservas set estado = 'confirmada', expira = null");

// --- panel de administración con login real ---
const a = await ctx.newPage(); a.on('pageerror', (e) => errs.push('admin: ' + e.message)); a.on('dialog', (d) => d.accept());
await a.goto(s.url + '/admin.html'); await a.waitForTimeout(600);
assert(await a.isVisible('#loginView')); assert(!(await a.isVisible('#demoHint'))); ok('con el servidor no aparece la clave de demo');
await a.fill('#lMail', ADMIN.email); await a.fill('#lPass', 'equivocada'); await a.click('#lBtn'); await a.waitForTimeout(500);
assert((await a.textContent('#lErr')).includes('incorrectos')); ok('una clave equivocada se rechaza');
await a.fill('#lPass', ADMIN.clave); await a.click('#lBtn'); await a.waitForTimeout(900);
assert(await a.isVisible('#panelView')); assert((await a.textContent('#modeBadge')).includes('Base de datos')); ok('login real y panel visible con "Base de datos conectada"');
await a.reload(); await a.waitForTimeout(900); assert(await a.isVisible('#panelView')); ok('la sesión se mantiene al recargar la página');
assert.equal(await a.locator(`[data-st="${res.folio}"]`).inputValue(), 'confirmada'); ok('la reserva pagada se ve confirmada');
await a.selectOption(`[data-st="${res.folio}"]`, 'finalizada'); await a.waitForTimeout(500);
assert.equal((await db('select estado from reservas'))[0].estado, 'finalizada'); ok('cambiar el estado se guarda en la base');
await a.click('[data-tab=catalogo]');
await a.fill('#sName', 'Trampolín'); await a.selectOption('#sShape', 'box'); await a.fill('#sPrice', '25000'); await a.fill('#sStock', '2');
await a.fill('#sW', '3'); await a.fill('#sD', '3'); await a.fill('#sH', '1.2'); await a.click('#sSave'); await a.waitForTimeout(600);
const [tr] = await db("select * from catalogo where nombre = 'Trampolín'");
assert(tr && tr.forma === 'box' && /^#[0-9a-f]{6}$/i.test(tr.color) && tr.precio === 25000 && tr.ancho === 3 && tr.activo === true); ok('el servicio nuevo se guarda en la base con sus columnas (forma, color, medidas, precio)');
// foto y modelo 3D
const png = Buffer.from(await a.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#3e4095'; x.fillRect(0, 0, 2400, 1200); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
assert(!(await a.locator('#sModel').isDisabled())); ok('con el servidor el modelo 3D real sí se puede subir');
await a.fill('#sName', 'Castillo con modelo'); await a.selectOption('#sShape', 'castle'); await a.fill('#sPrice', '60000'); await a.fill('#sStock', '1');
await a.fill('#sW', '5'); await a.fill('#sD', '5'); await a.fill('#sH', '4');
await a.setInputFiles('#sImg', { name: 'f.png', mimeType: 'image/png', buffer: png });
await a.setInputFiles('#sModel', { name: 'castillo.glb', mimeType: 'model/gltf-binary', buffer: Buffer.concat([Buffer.from('glTF'), Buffer.alloc(2044, 1)]) });
await a.selectOption('#sModelRot', '90'); await a.click('#sSave'); await a.waitForTimeout(1200);
const arch = await db('select id, tipo, length(datos) as peso from archivos order by id');
assert(arch.length === 2 && arch.some((x) => x.tipo === 'image/jpeg' && /\.jpg$/.test(x.id)) && arch.some((x) => x.tipo === 'model/gltf-binary' && /\.glb$/.test(x.id)), JSON.stringify(arch));
ok('la foto (reducida a JPG) y el modelo .glb quedan guardados en la base');
const [cm] = await db("select imagen, modelo3d, modelo_rot from catalogo where nombre = 'Castillo con modelo'");
assert(cm.imagen.startsWith('/archivos/') && cm.modelo3d.endsWith('.glb') && cm.modelo_rot === 90); ok('en el servicio quedan las direcciones de los archivos y el giro del modelo');
assert((await a.textContent('#priceBody')).includes('3D real')); ok('la lista del panel marca los servicios con modelo 3D real');
await p.goto(s.url + '/index.html?todo=1'); await p.waitForTimeout(1000);
const im = p.locator('#catalog article:has-text("Castillo con modelo") .plan img');
await im.scrollIntoViewIfNeeded(); await p.waitForFunction(() => { const i = document.querySelector('#catalog article:has(img) .plan img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
assert((await im.getAttribute('src')).startsWith('/archivos/')); ok('la foto subida se ve en el catálogo público, servida por el servidor');
await a.click('#logout'); await a.waitForTimeout(400); assert(await a.isVisible('#loginView'));
await a.reload(); await a.waitForTimeout(700); assert(await a.isVisible('#loginView')); ok('cerrar sesión vuelve al login y la sesión ya no sirve al recargar');

await b.close(); s.close();
const e2 = s.errores.map(String).filter((e) => !e.includes('ana@rechazado.cl'));   // ese rechazo de Flow es parte de la prueba
console.log(errs.length || e2.length ? '\nERRORES:\n' + [...errs, ...e2].join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length || e2.length ? 1 : 0);
