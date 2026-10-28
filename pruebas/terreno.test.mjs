// Editor del terreno en el panel admin (modo demo): mover elementos, agregar, cambiar medidas, foto aérea,
// y que el sitio público use el terreno guardado.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push('sitio: ' + e.message));
const a = await ctx.newPage(); a.on('pageerror', e => errs.push('admin: ' + e.message)); a.on('dialog', d => d.accept());

await p.goto(srv.url + '/index.html'); await p.waitForTimeout(800);
let t = await p.evaluate(() => ({ w: DK.TERR.w, d: DK.TERR.d, n: DK.OBST.length, ground: DK.TERR.ground }));
assert.deepEqual(t, { w: 30, d: 20, n: 4, ground: 'pasto' }); ok('sin configuración, el sitio usa el terreno de ejemplo (30 × 20 m, quincho y 3 árboles)');

await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500); await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(600); await a.click('[data-tab=catalogo]');
assert.equal(await a.locator('#tePlan .it').count(), 4); assert.equal(await a.inputValue('#tW'), '30'); ok('el panel muestra el plano con los 4 elementos y las medidas');

// arrastrar el quincho con el mouse
await a.locator('#tePlan').scrollIntoViewIfNeeded();
const q = await a.locator('#tePlan .it[data-id="q1"]').boundingBox(); const cx = q.x + q.width / 2, cy = q.y + q.height / 2;
await a.mouse.move(cx, cy); await a.mouse.down(); await a.mouse.move(cx + 80, cy + 50, { steps: 6 }); await a.mouse.up();
const x1 = +(await a.inputValue('#eX')), z1 = +(await a.inputValue('#eZ'));
assert(x1 > -11.5 + 2 && z1 > -7.5 + 1, `x=${x1} z=${z1}`); assert.equal(await a.inputValue('#eName'), 'Quincho'); ok(`arrastrar el quincho lo mueve (ahora x=${x1}, z=${z1}) y abre su ficha`);

// agregar baños, ponerles nombre y posición exactos
await a.selectOption('#eType', 'bano'); await a.click('#eAdd');
assert.equal(await a.locator('#tePlan .it').count(), 5);
await a.fill('#eName', 'Baños'); await a.locator('#eName').dispatchEvent('change');
await a.fill('#eX', '10'); await a.locator('#eX').dispatchEvent('change'); await a.fill('#eZ', '-6'); await a.locator('#eZ').dispatchEvent('change');
await a.fill('#eW', '4'); await a.locator('#eW').dispatchEvent('change'); await a.fill('#eRot', '90'); await a.locator('#eRot').dispatchEvent('change');
ok('se agrega un elemento nuevo (baños) y se edita su ficha');

// medidas, suelo y límites
await a.fill('#tW', '40'); await a.locator('#tW').dispatchEvent('change'); await a.fill('#tD', '25'); await a.locator('#tD').dispatchEvent('change');
await a.selectOption('#tGround', 'tierra');
await a.fill('#tW', '500'); await a.locator('#tW').dispatchEvent('change'); assert.equal(await a.inputValue('#tW'), '80'); ok('un ancho absurdo (500 m) se limita a 80 m');
await a.fill('#tW', '40'); await a.locator('#tW').dispatchEvent('change');
await a.selectOption('#tFence', '0');

// foto aérea
const png = Buffer.from(await a.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 1800; const x = c.getContext('2d'); x.fillStyle = '#4a7a3a'; x.fillRect(0, 0, 3000, 1800); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
await a.setInputFiles('#tPhoto', { name: 'aerea.png', mimeType: 'image/png', buffer: png }); await a.waitForTimeout(500);
assert.equal(await a.locator('#tePlan image').count(), 1); ok('la foto aérea se ve de fondo en el plano');
assert(await a.isDisabled('#tModel')); ok('en modo demo el modelo 3D del terreno avisa que necesita la base de datos');

// guardar
await a.click('#tSave'); await a.waitForTimeout(800);
assert.equal(await a.locator('#tePlan .it').count(), 5); assert.equal(await a.inputValue('#tW'), '40'); ok('guardar mantiene lo editado');
await p.reload(); await p.waitForTimeout(900);
t = await p.evaluate(() => ({ w: DK.TERR.w, d: DK.TERR.d, ground: DK.TERR.ground, fence: DK.TERR.fence, photo: DK.TERR.photo.slice(0, 22), n: DK.OBST.length,
  bano: DK.OBST.find(o => o.t === 'bano'), q: DK.OBST.find(o => o.id === 'q1'), parcela: DK.byId('parcela') }));
assert(t.w === 40 && t.d === 25 && t.ground === 'tierra' && t.fence === false && t.photo === 'data:image/jpeg;base64' && t.n === 5, JSON.stringify(t));
assert(t.bano.name === 'Baños' && t.bano.x === 10 && t.bano.z === -6 && t.bano.w === 4 && Math.abs(t.bano.r - Math.PI / 2) < 1e-9); ok('el sitio público usa el terreno guardado (40 × 25, tierra, sin cerco, foto aérea, baños)');
assert(t.q.x === x1 && t.q.z === z1); ok('el quincho quedó donde lo arrastraste');
assert(t.parcela.w === 40 && t.parcela.d === 25 && t.parcela.desc.includes('40 × 25 m')); ok('la ficha "Arriendo de la parcela" muestra las medidas nuevas');

// no se puede poner un juego encima de un elemento fijo (sin 3D, el sitio igual calcula el espacio)
await p.click('[data-add="castillo"]'); await p.waitForTimeout(300);
const ph = await p.evaluate(() => { const c = DK.byId('castillo'); return DK.OBST.every(o => Math.abs(o.x) <= 20) && c.w > 0; }); assert(ph); ok('agregar un juego con el terreno nuevo no genera errores');

// plano de una reserva usa el terreno nuevo
await a.reload(); await a.waitForTimeout(900);   // la sesión sigue abierta
await a.locator('#resBody [data-det]').first().click(); await a.waitForTimeout(200);
assert.equal(await a.locator('.detail svg').first().getAttribute('viewBox'), '-20 -12.5 40 25'); ok('el plano de cada reserva usa las medidas del terreno guardado');

// volver al ejemplo
await a.click('[data-tab=catalogo]'); await a.locator('#tePlan').scrollIntoViewIfNeeded(); await a.click('#tReset'); await a.waitForTimeout(200);
assert.equal(await a.locator('#tePlan .it').count(), 4); assert.equal(await a.inputValue('#tW'), '30'); assert.equal(await a.locator('#tePlan image').count(), 0); ok('"Volver al terreno de ejemplo" restaura medidas, elementos y quita la foto');
await a.click('#tSave'); await a.waitForTimeout(700); await p.reload(); await p.waitForTimeout(800);
t = await p.evaluate(() => ({ w: DK.TERR.w, photo: DK.TERR.photo, n: DK.OBST.length })); assert.deepEqual(t, { w: 30, photo: '', n: 4 }); ok('guardado el ejemplo, el sitio vuelve a 30 × 20');

await b.close(); srv.close();
console.log(errs.length ? '\nERRORES DE PÁGINA:\n' + errs.join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length ? 1 : 0);
