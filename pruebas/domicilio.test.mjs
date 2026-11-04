// Arriendo a domicilio (fuera de la parcela): modalidad, datos del lugar, despacho por zona, revisiones, panel y bloqueo por tipo.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push('público: ' + e.message)); p.on('dialog', d => d.accept());
const pad = x => String(x).padStart(2, '0'); const hoy = new Date();
const st = () => p.evaluate(() => JSON.parse(localStorage['diverti-kids-demo-v2']));
await p.goto(srv.url + '/index.html?todo=1'); await p.waitForTimeout(800);

// ---- selector de modalidad
assert(await p.isVisible('#modo')); assert.equal(await p.getAttribute('[data-modo=parcela]', 'aria-pressed'), 'true'); assert(await p.isVisible('#simulador')); assert(!(await p.isVisible('#lugarFs'))); ok('por defecto la modalidad es la parcela, con simulador 3D y sin datos de lugar');
assert((await p.textContent('#catalog')).includes('Arriendo de la parcela')); 
await p.click('[data-modo=domicilio]'); await p.waitForTimeout(300);
assert.equal(await p.getAttribute('[data-modo=domicilio]', 'aria-pressed'), 'true'); assert(!(await p.isVisible('#simulador'))); assert(await p.isVisible('#lugarFs')); assert(!(await p.isVisible('#navSim'))); ok('en domicilio se oculta el simulador y aparecen los datos del lugar');
assert(!(await p.textContent('#catalog')).includes('Arriendo de la parcela')); assert(await p.locator('[data-dp="castillo"]').count() === 1); ok('en domicilio no se ofrece arrendar la parcela y cada servicio tiene + y −');

// ---- pedido y despacho
await p.click('[data-dp="castillo"]'); await p.waitForTimeout(200);
assert((await p.textContent('#qlines')).includes('Castillo inflable')); assert((await p.textContent('#issues')).includes('zona de despacho')); assert(await p.locator('#payBtn').isDisabled()); ok('sin zona de despacho no se puede pagar');
await p.selectOption('#lZona', 'azapa'); await p.waitForTimeout(200);
assert((await p.textContent('#qlines')).includes('Despacho, montaje y retiro · Valle de Azapa')); assert((await p.textContent('#qtotal')).includes('60.000')); assert((await p.textContent('#qabono')).includes('18.000')); ok('la cotización suma el despacho de la zona (45.000 + 15.000 = 60.000; abono 30 %)');
// revisión de medidas
await p.fill('#lAncho', '3'); await p.fill('#lLargo', '3'); await p.waitForTimeout(150);
assert((await p.textContent('#issues')).includes('no cabe')); assert(await p.locator('#payBtn').isDisabled()); ok('si el juego no cabe en el espacio indicado, no se puede pagar');
await p.fill('#lAncho', '8'); await p.fill('#lLargo', '10'); await p.fill('#lAlto', '3'); await p.waitForTimeout(150);
assert((await p.textContent('#issues')).includes('de alto')); ok('si la altura libre es menor que el juego, tampoco');
await p.fill('#lAlto', '5'); await p.selectOption('#lSuelo', 'cemento'); await p.selectOption('#lLuz', 'no'); await p.waitForTimeout(150);
assert(!(await p.textContent('#issues')).includes('no cabe')); assert(!(await p.locator('#payBtn').isDisabled())); ok('con medidas suficientes se puede pagar');
const w = await p.textContent('#siteWarns'); assert(w.includes('pesas') && w.includes('220 V')); ok('avisa que en piso duro se usan pesas y que falta un enchufe de 220 V (no bloquea)');
await p.click('[data-dp="castillo"]'); await p.waitForTimeout(150);
assert((await p.textContent('#qlines')).includes('× 2')); assert(await p.locator('[data-dp="castillo"]').isDisabled()); ok('se pueden agregar y quitar unidades, hasta el stock disponible (2 castillos)');
while ((await p.textContent('#qlines')).includes('× 2')) await p.click('[data-dm="castillo"]');

// ---- validación y reserva
await p.fill('#cKid', 'Valentina'); await p.fill('#cKidBirth', '2020-03-05'); await p.check('#cConsent');
await p.selectOption('#lAgua', ''); await p.click('#payBtn');
assert((await p.textContent('#formErr')).includes('dirección')); ok('exige la dirección del lugar');
await p.fill('#lDir', 'Av. Siempre Viva 742, población Los Álamos'); await p.click('#payBtn');
assert((await p.textContent('#formErr')).includes('agua')); await p.selectOption('#lAgua', 'si'); ok('exige indicar si hay agua cerca');
await p.fill('#lObs', 'Perro en el patio'); await p.click('#payBtn'); assert(await p.isVisible('#payOv')); await p.click('#payGo'); await p.waitForTimeout(2200);
const done = await p.textContent('#bookArea'); assert(done.includes('confirmada') && done.includes('Servicio a domicilio en Av. Siempre Viva 742')); ok('la reserva a domicilio se confirma y el correo menciona la dirección');
const r = (await st()).res.find(x => x.client.kid === 'Valentina');
assert.equal(r.modalidad, 'domicilio'); assert.equal(r.parcela, false); assert.equal(r.flete, 15000); assert.equal(r.total, 60000); assert.deepEqual(r.layout, []);
assert.equal(r.lugar.suelo, 'cemento'); assert.equal(r.lugar.ancho, 8); assert.equal(r.lugar.largo, 10); assert.equal(r.lugar.luz, 'no'); assert.equal(r.lugar.obs, 'Perro en el patio'); assert.equal(r.zona, 'azapa'); ok('quedan guardados el suelo, las medidas, la luz, el agua, la zona, el despacho y el total');

// ---- el pedido a domicilio no ocupa la parcela
const fecha = r.date;
assert.equal((await st()).res.filter(x => x.date === fecha && x.slot === r.slot && x.parcela).length, 0); ok('el pedido a domicilio no ocupa la parcela: esa fecha y franja siguen libres para arrendarla');

// ---- panel
const a = await ctx.newPage(); a.on('pageerror', e => errs.push('admin: ' + e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500); await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(600);
assert((await a.textContent('#resBody')).includes('Domicilio')); await a.locator('#resBody tr', { hasText: 'Valentina' }).count();
const fila = a.locator('#resBody tr', { hasText: 'Domicilio' }).first(); await fila.locator('[data-det]').click(); await a.waitForTimeout(200);
const det = await a.textContent('#resBody'); assert(det.includes('Lugar:') && det.includes('Av. Siempre Viva 742') && det.includes('Cemento') && det.includes('8 × 10 m') && det.includes('Perro en el patio') && det.includes('Valle de Azapa')); ok('el detalle de la reserva muestra dirección, suelo, medidas, luz, agua, despacho y detalles');
assert(det.includes('220 V') && det.includes('pesas')); ok('el detalle repite las alertas del lugar para el equipo');
await a.click('[data-tab=domicilio]'); const dm = await a.textContent('#domBody'); assert(dm.includes('Av. Siempre Viva 742') && dm.includes('2 alertas')); ok('la pestaña Domicilio lista los pedidos próximos con sus alertas');

// zonas
await a.fill('#zNom', 'Arica centro'); await a.fill('#zPrecio', '8000'); await a.click('#zonaForm button[type=submit]'); await a.waitForTimeout(300);
assert((await a.textContent('#zonaList')).includes('Arica centro')); ok('se agrega una zona de despacho');
await a.locator('#zonaList li', { hasText: 'Arica centro' }).locator('[data-zedit]').click(); await a.fill('#zPrecio', '9000'); await a.click('#zonaForm button[type=submit]'); await a.waitForTimeout(300);
assert((await a.textContent('#zonaList')).includes('$9.000')); ok('se edita el precio de una zona');
await p.reload(); await p.waitForTimeout(800); await p.click('[data-modo=domicilio]');
assert((await p.locator('#lZona option').allTextContents()).some(t => t.includes('Arica centro') && t.includes('$9.000'))); ok('la zona nueva aparece en el sitio con su precio');

// bloqueo solo parcela
const d = new Date(hoy); d.setDate(d.getDate() + 12); const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
await a.click('[data-tab=reservas]'); await a.fill('#bDate', ds); await a.selectOption('#bApl', 'parcela'); await a.click('#blockForm button[type=submit]'); await a.waitForTimeout(300);
assert((await a.textContent('#blockList')).includes('solo la parcela')); ok('se bloquea una fecha solo para la parcela');
await p.reload(); await p.waitForTimeout(800);
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
for (let i = 0; i < 12 && !(await p.textContent('#monthT')).toLowerCase().includes(MESES[d.getMonth()]); i++) await p.click('#nextM');
const dayBtn = () => p.locator('#cal .day', { hasText: new RegExp('^' + d.getDate() + '$') }).first();
assert(await dayBtn().isDisabled()); ok('en modalidad parcela esa fecha aparece bloqueada');
await p.click('[data-modo=domicilio]'); await p.waitForTimeout(200); assert(!(await dayBtn().isDisabled())); ok('en domicilio esa misma fecha sigue disponible');

// servicio solo parcela
await a.click('[data-tab=catalogo]'); await a.locator('#priceBody tr', { hasText: 'Castillo inflable' }).locator('[data-edit]').click(); await a.uncheck('#sDom'); await a.click('#sSave'); await a.waitForTimeout(400);
assert((await a.textContent('#priceBody')).includes('Solo parcela')); ok('un servicio se puede marcar como "solo parcela"');
await p.reload(); await p.waitForTimeout(800); await p.click('[data-modo=domicilio]'); assert(!(await p.textContent('#catalog')).includes('Castillo inflable')); assert((await p.textContent('#catalog')).includes('Tobogán')); await p.click('[data-modo=parcela]'); assert((await p.textContent('#catalog')).includes('Castillo inflable')); ok('ese servicio no se ofrece a domicilio pero sigue en la parcela');

// chatbot
await p.click('#chatFab'); await p.fill('#chatIn', '¿Llevan los juegos a mi casa?'); await p.press('#chatIn', 'Enter'); await p.waitForTimeout(700);
const bot = await p.locator('#msgs .m.bot').last().textContent(); assert(bot.includes('a domicilio') && bot.includes('Arica urbana') && bot.includes('$10.000')); ok('el chatbot explica el servicio a domicilio con los precios de despacho');

// pruebas de la regla pura
const chk = await p.evaluate(() => { const D = DK; const c = D.siteChecks({ ancho: 6, largo: 6, alto: 4, luz: 'si', agua: 'no', suelo: 'pasto', pendiente: 'inclinado', acceso: 70, nivel: 'escaleras' }, { tobogan: 1, piscinaL: 1 }); return c; });
assert(chk.issues.some(t => t.includes('Tobogán') && t.includes('no cabe'))); assert(chk.warns.some(t => t.includes('agua')) && chk.warns.some(t => t.includes('inclinado')) && chk.warns.some(t => t.includes('80 cm')) && chk.warns.some(t => t.includes('planta baja'))); ok('reglas del lugar: no cabe, agua, pendiente, acceso angosto y piso alto');
const chk2 = await p.evaluate(() => DK.siteChecks({ ancho: 5, largo: 5 }, { castillo: 1, piscinaL: 1 })); assert(chk2.issues.some(t => t.includes('no caben todos juntos'))); ok('si la suma de las huellas supera el espacio, no caben juntos');

// sin zonas no hay servicio a domicilio
await a.click('[data-tab=domicilio]'); for (let i = 0; i < 6; i++) { const bt = a.locator('[data-zdel]').first(); if (!(await bt.count())) break; await bt.click(); await a.waitForTimeout(250); }
await p.reload(); await p.waitForTimeout(700); assert(!(await p.isVisible('#modo'))); assert(await p.isVisible('#simulador')); ok('sin zonas configuradas el sitio solo ofrece la parcela');
assert.deepEqual(errs, []); console.log(`\nTodo bien: ${n} comprobaciones, sin errores de página.`);
await b.close(); srv.close && srv.close();
