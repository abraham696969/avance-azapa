// El botón "Cargar mi parcela" deja el plano de Divertí Kids (según la foto satelital) y el sitio lo usa.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root); const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500); await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(600);
await a.click('#tPreset'); await a.waitForTimeout(200);
assert.equal(await a.inputValue('#tW'), '48'); assert.equal(await a.inputValue('#tD'), '44'); assert.equal(await a.inputValue('#tGround'), 'tierra'); assert.equal(await a.locator('#tePlan .it').count(), 7); ok('el botón carga 48 × 44 m, suelo de tierra y los 7 elementos de la foto');
await a.click('#tSave'); await a.waitForTimeout(500);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(srv.url + '/index.html'); await p.waitForTimeout(900);
const r = await p.evaluate(() => { const T = DK.TERR, bad = DK.OBST.filter(o => Math.abs(o.x) + o.w / 2 > T.w / 2 + .01 || Math.abs(o.z) + o.d / 2 > T.d / 2 + .01).map(o => o.name);
  const c = DK.OBST.filter((o, i) => DK.OBST.some((q, j) => j > i && Math.abs(o.x - q.x) < (o.w + q.w) / 2 - .5 && Math.abs(o.z - q.z) < (o.d + q.d) / 2 - .5)).map(o => o.name); return { w: T.w, n: DK.OBST.length, bad, c } });
assert.deepEqual(r, { w: 48, n: 7, bad: [], c: [] }); ok('el sitio usa la parcela y ningún elemento sale del terreno ni se pisa con otro');
await p.click('[data-add="castillo"]'); await p.waitForTimeout(300); ok('se puede agregar un juego en la parcela nueva');
await b.close(); srv.close(); console.log(errs.length ? errs.join('\n') : `\nTodo bien: ${n} comprobaciones.`); process.exit(errs.length ? 1 : 0);
