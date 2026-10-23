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
await p.click('[data-add="castillo"]'); await p.click('#payBtn'); await p.waitForTimeout(200);
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
// eliminar
await a.locator('#priceBody tr', { hasText: 'Trampolín gigante' }).locator('[data-del]').click(); await a.waitForTimeout(500);
assert(!(await a.textContent('#priceBody')).includes('Trampolín gigante')); ok('eliminar lo saca del panel');
await p.reload(); await p.waitForTimeout(800); assert(!(await p.textContent('#catalog')).includes('Trampolín gigante')); ok('y del catálogo público');
await a.click('#logout'); await a.waitForTimeout(200); assert(await a.isVisible('#loginView')); ok('cerrar sesión vuelve al login');
await b.close(); srv.close();
console.log(errs.length ? '\nERRORES DE PÁGINA:\n' + errs.join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length ? 1 : 0);
