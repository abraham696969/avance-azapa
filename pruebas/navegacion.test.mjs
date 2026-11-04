// Navegación por páginas del sitio público: menú, pasos de la reserva, accesos de la portada y simulador al cambiar de página.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const visibles = p => p.$$eval('.page', ps => ps.filter(x => !x.hidden).map(x => x.dataset.page));

// ---------- escritorio ----------
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.goto(srv.url + '/index.html'); await p.waitForTimeout(900);
assert.deepEqual(await visibles(p), ['inicio']); ok('al entrar se ve solo la portada');
assert.equal(await p.getAttribute('[data-nav="inicio"]', 'aria-current'), 'page'); ok('el menú marca Inicio');
assert(!(await p.isVisible('#pasos'))); ok('en la portada no se muestran los pasos de la reserva');

await p.click('nav.main [data-nav="servicios"]'); await p.waitForTimeout(400);
assert.deepEqual(await visibles(p), ['servicios']); ok('el menú lleva a Juegos y servicios');
assert(await p.isVisible('#pasos')); assert.match(await p.getAttribute('[data-paso="servicios"]', 'class'), /actual/); ok('se ven los pasos con el 1 marcado');
assert.match(await p.title(), /Juegos y servicios/); ok('cambia el título de la pestaña');

await p.click('.siguiente a[href="#fiesta"]'); await p.waitForTimeout(700);
assert.deepEqual(await visibles(p), ['fiesta']); ok('el botón siguiente lleva a Arma tu fiesta');
assert.match(await p.getAttribute('[data-paso="servicios"]', 'class'), /hecho/); ok('el paso 1 queda como hecho');
const tam = await p.$eval('#stage canvas', c => ({ w: c.clientWidth, h: c.clientHeight })).catch(() => null);
assert(tam && tam.w > 200 && tam.h > 150, 'el simulador debe tener tamaño: ' + JSON.stringify(tam)); ok('el simulador 3D se dibuja con tamaño al abrir su página');

await p.goBack(); await p.waitForTimeout(400);
assert.deepEqual(await visibles(p), ['servicios']); ok('el botón Atrás del navegador vuelve a la página anterior');

await p.click('nav.main [data-nav="contacto"]'); await p.waitForTimeout(400);
assert.deepEqual(await visibles(p), ['contacto']); assert(await p.isVisible('#cWa')); ok('Contacto muestra WhatsApp y redes');

await p.goto(srv.url + '/index.html#cal'); await p.waitForTimeout(500);
assert.deepEqual(await visibles(p), ['fiesta']); ok('un enlace a una sección interna abre la página que la contiene');

await p.click('[data-nav="inicio"]'); await p.waitForTimeout(400);
await p.click('[data-ir-cat="comida"]'); await p.waitForTimeout(500);
assert.deepEqual(await visibles(p), ['servicios']);
const cat = await p.$eval('#tabs .tab[aria-pressed="true"]', t => t.textContent);
assert.match(cat, /alimentos/i); ok('la tarjeta "Máquinas de comida" de la portada abre el catálogo en esa categoría');

await p.goto(srv.url + '/index.html#inicio'); await p.waitForTimeout(400);
await p.click('[data-add]').catch(() => {});
await p.goto(srv.url + '/index.html#servicios'); await p.waitForTimeout(400);
const antes = await p.textContent('#cartpill');
await p.click('#servicios [data-add]'); await p.waitForTimeout(200);
assert.notEqual(await p.textContent('#cartpill'), antes); ok('agregar un servicio actualiza el carrito (con animación)');

// ---------- celular ----------
const m = await (await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
m.on('pageerror', e => errs.push('celular: ' + e.message));
for (const pg of ['inicio', 'servicios', 'fiesta', 'reservar', 'contacto']) {
  await m.goto(srv.url + '/index.html#' + pg); await m.waitForTimeout(500);
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  assert(ancho <= 376, `${pg}: la página no debe moverse hacia el lado (${ancho}px)`);
}
ok('en celular ninguna página se sale del ancho de la pantalla');

// ---------- modo todo (lo usan las demás pruebas) ----------
const t = await (await b.newContext()).newPage();
await t.goto(srv.url + '/index.html?todo=1'); await t.waitForTimeout(500);
assert.equal((await visibles(t)).length, 5); ok('con ?todo=1 se ven todas las páginas juntas');

assert.deepEqual(errs, []); ok('sin errores de JavaScript');
await b.close(); srv.close();
console.log(`\nnavegación: ${n} comprobaciones OK`);
process.exit(0);
