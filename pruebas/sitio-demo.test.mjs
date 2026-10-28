// Recorrido completo en MODO DEMO: reservar y pagar, entrar al admin, crear/editar/eliminar un servicio.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push('público: ' + e.message));
await p.goto(srv.url + '/index.html'); await p.waitForTimeout(800);
await p.click('[data-add="castillo"]'); await p.fill('#cKid','Sofía'); await p.fill('#cKidBirth','2020-03-05'); await p.check('#cConsent'); await p.click('#payBtn'); await p.waitForTimeout(200);
assert(await p.isVisible('#payOv')); ok('se abre la ventana de pago');
assert(await p.isVisible('#cardBlock')); ok('en modo demo se ven los campos de tarjeta de prueba');
await p.click('#payGo'); await p.waitForTimeout(2200);
assert(!(await p.isVisible('#payOv'))); assert((await p.textContent('#bookArea')).includes('confirmada')); ok('pago simulado y reserva confirmada');

const a = await ctx.newPage(); a.on('pageerror', e => errs.push('admin: ' + e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500);
assert(await a.isVisible('#loginView')); ok('el admin pide login');
await a.fill('#lPass', 'mala'); await a.click('#lBtn'); await a.waitForTimeout(200);
assert((await a.textContent('#lErr')).includes('incorrectos')); ok('clave incorrecta se rechaza');
await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(500);
assert(await a.isVisible('#panelView')); assert((await a.textContent('#resBody')).includes('R-1006')); ok('entra y ve la reserva nueva');
await a.click('[data-tab=catalogo]');

// crear servicio
await a.fill('#sName', 'Trampolín gigante'); await a.selectOption('#sCat', 'juegos'); await a.selectOption('#sShape', 'box');
await a.fill('#sDesc', 'Salta salta para 6 niños'); await a.fill('#sPrice', '28000'); await a.fill('#sStock', '2');
await a.fill('#sW', '3'); await a.fill('#sD', '3'); await a.fill('#sH', '1.2'); await a.click('#sSave'); await a.waitForTimeout(500);
assert((await a.textContent('#priceBody')).includes('Trampolín gigante')); ok('servicio creado aparece en el panel');
await p.reload(); await p.waitForTimeout(800);
assert((await p.textContent('#catalog')).includes('Trampolín gigante')); assert((await p.textContent('#catalog')).includes('28.000')); ok('el servicio nuevo aparece en el catálogo público con su precio');
// editar
await a.click('[data-edit]:near(:text("Trampolín gigante"))').catch(async () => { await a.locator('#priceBody tr', { hasText: 'Trampolín gigante' }).locator('[data-edit]').click(); });
await a.fill('#sPrice', '31000'); await a.click('#sSave'); await a.waitForTimeout(500);
await p.reload(); await p.waitForTimeout(800); assert((await p.textContent('#catalog')).includes('31.000')); ok('editar el precio se refleja en el sitio');
// reservar el servicio nuevo (comprueba que entra a la cotización y al simulador)
const id = await p.getAttribute('#catalog article:has-text("Trampolín") [data-add]', 'data-add');
await p.click(`[data-add="${id}"]`); await p.waitForTimeout(300);
assert((await p.textContent('#qlines')).includes('Trampolín')); ok('el servicio nuevo entra a la cotización');
// foto del servicio
const png = Buffer.from(await a.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const x = c.getContext('2d'); x.fillStyle = '#e8397f'; x.fillRect(0, 0, 1600, 900); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
assert(await a.locator('#sModel').isDisabled()); ok('en modo demo el modelo 3D real avisa que necesita la base de datos');
await a.locator('#priceBody tr', { hasText: 'Trampolín gigante' }).locator('[data-edit]').click();
await a.setInputFiles('#sImg', { name: 'foto.png', mimeType: 'image/png', buffer: png }); await a.waitForTimeout(400);
assert(await a.isVisible('#sImgPrev')); ok('al elegir una foto se ve la vista previa');
await a.click('#sSave'); await a.waitForTimeout(600);
assert(await a.locator('#priceBody img.thumb').count() === 1); ok('la foto queda como miniatura en la lista del panel');
await p.reload(); await p.waitForTimeout(900);
const im = p.locator('#catalog article:has-text("Trampolín") .plan img');
assert(await im.count() === 1); await im.scrollIntoViewIfNeeded(); await p.waitForFunction(() => { const i = document.querySelector('#catalog article:has(img) .plan img'); return i && i.complete && i.naturalWidth > 0; });
const dim = await im.evaluate(i => [i.naturalWidth, i.naturalHeight, i.src.slice(0, 22)]);
assert(dim[2] === 'data:image/jpeg;base64' && dim[0] === 1000 && dim[1] === 563, JSON.stringify(dim)); ok('la foto sale en el catálogo público, reducida a 1000 px de ancho');
await a.locator('#priceBody tr', { hasText: 'Trampolín gigante' }).locator('[data-edit]').click(); await a.click('#sImgDel'); await a.click('#sSave'); await a.waitForTimeout(600);
await p.reload(); await p.waitForTimeout(900); assert(await p.locator('#catalog article:has-text("Trampolín") .plan img').count() === 0); ok('quitar la foto la saca del catálogo');
await a.setInputFiles('#sImg', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }).catch(() => {});
// eliminar
await a.locator('#priceBody tr', { hasText: 'Trampolín gigante' }).locator('[data-del]').click(); await a.waitForTimeout(500);
assert(!(await a.textContent('#priceBody')).includes('Trampolín gigante')); ok('eliminar lo saca del panel');
await p.reload(); await p.waitForTimeout(800); assert(!(await p.textContent('#catalog')).includes('Trampolín gigante')); ok('y del catálogo público');
await a.click('#logout'); await a.waitForTimeout(200); assert(await a.isVisible('#loginView')); ok('cerrar sesión vuelve al login');
await b.close(); srv.close();
console.log(errs.length ? '\nERRORES DE PÁGINA:\n' + errs.join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length ? 1 : 0);
