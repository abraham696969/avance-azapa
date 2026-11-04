// Texturas y "sólido / intangible" de los elementos del terreno.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root); const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500); await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(600); await a.click('[data-tab=catalogo]');
await a.fill('#tW', '30'); await a.fill('#tD', '20'); await a.dispatchEvent('#tD', 'change');
await a.selectOption('#eType', 'zona'); await a.click('#eAdd');
assert.equal(await a.inputValue('#eTex'), 'pasto'); assert.equal(await a.inputValue('#eSolid'), '0'); ok('una "zona de suelo" nueva nace con pasto y como intangible');
assert((await a.locator('#eTex option').allTextContents()).includes('Madera (deck)')); ok('las texturas se pueden elegir (pasto, pasto sintético, tierra, madera, cemento, arena, agua)');
await a.fill('#eW', '30'); await a.dispatchEvent('#eW', 'change'); await a.fill('#eD', '20'); await a.dispatchEvent('#eD', 'change');
await a.selectOption('#eTex', 'madera'); await a.waitForTimeout(100);
assert((await a.locator('#tePlan .it rect[stroke-dasharray]').first().getAttribute('stroke-dasharray'))); ok('en el plano lo intangible se ve con borde punteado');
await a.click('#tSave'); await a.waitForTimeout(500);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(srv.url + '/index.html?todo=1'); await p.waitForTimeout(900);
let r = await p.evaluate(() => ({ o: DK.OBST.map(o => [o.t, o.tex, o.solid]), placed: document.querySelectorAll('[data-add="castillo"]').length }));
assert(r.o.some(x => x[0] === 'zona' && x[1] === 'madera' && x[2] === false)); ok('el sitio recibe la textura y que es intangible');
await p.click('[data-add="castillo"]'); await p.waitForTimeout(300);
{ const m = await p.evaluate(() => (document.querySelector('.toast,#toast') || {}).textContent || ''); assert(!/No hay espacio/.test(m), m); } ok('con una zona intangible que cubre todo el terreno, igual se puede colocar un juego');
const pos = await p.evaluate(() => { const c = DK.byId('castillo'); return { w: c.w }; }); assert(pos.w > 0);
// ahora sólido: no cabe ningún juego
{ const bb = await a.locator('#tePlan .it').first().boundingBox(); await a.mouse.click(bb.x + 4, bb.y + 4); await a.waitForTimeout(150); }
assert.equal(await a.inputValue('#eTex'), 'madera');
await a.selectOption('#eSolid', '1'); await a.click('#tSave'); await a.waitForTimeout(400);
const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message)); await p2.goto(srv.url + '/index.html?todo=1'); await p2.waitForTimeout(900);
const ocupados = await p2.evaluate(() => document.querySelector('#toast') ? 0 : 0); await p2.click('[data-add="castillo"]'); await p2.waitForTimeout(300);
const msg = await p2.evaluate(() => (document.querySelector('.toast,#toast')||{}).textContent || ''); assert(/No hay espacio/.test(msg), msg); ok('si el mismo suelo se marca como sólido, ya no se puede poner un juego encima');
await b.close(); srv.close(); console.log(errs.length ? errs.join('\n') : `\nTodo bien: ${n} comprobaciones.`); process.exit(errs.length ? 1 : 0);
