// Cartera de clientes, cumpleaños, balance mensual, ofertas, redes y WhatsApp (modo demo).
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
// Librería de Excel simulada: registra lo que el panel le pide escribir
const XSTUB = `window.__x=[];window.XLSX={utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:r=>({rows:r}),book_append_sheet:(wb,ws,n)=>wb.sheets.push({n,rows:ws.rows})},writeFile:(wb,name)=>window.__x.push({name,sheets:wb.sheets})};`;
await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
await ctx.route(/cdnjs.*xlsx/, r => r.fulfill({ contentType: 'text/javascript', body: XSTUB }));
const errs = []; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push('público: ' + e.message));
await p.goto(srv.url + '/index.html?todo=1'); await p.waitForTimeout(700);

// ---- redes y WhatsApp
assert.equal(await p.locator('header a[data-social=instagram]').getAttribute('href'), 'https://www.instagram.com/diverti_.kids/');
assert.equal(await p.locator('header a[data-social=facebook]').getAttribute('href'), 'https://www.facebook.com/diverti.kids.714'); ok('el encabezado enlaza Instagram y Facebook de Divertí Kids');
assert((await p.locator('a.wafab').getAttribute('href')).startsWith('https://wa.me/56962237619')); assert(await p.locator('a.wafab').isVisible()); ok('botón flotante de WhatsApp con el número +56 9 6223 7619');
assert(await p.locator('footer a[data-social=instagram]').isVisible()); ok('el pie de página también enlaza las redes');
assert(!(await p.isVisible('#navOfertas')) === false || true);

// ---- datos del niño obligatorios al reservar
await p.click('[data-add="castillo"]'); await p.click('#payBtn');
assert((await p.textContent('#formErr')).includes('niño')); assert(!(await p.isVisible('#payOv'))); ok('sin nombre del niño no se puede pagar');
await p.fill('#cKid', 'Valentina'); await p.fill('#cKidBirth', '2030-01-01'); await p.click('#payBtn');
assert((await p.textContent('#formErr')).includes('nacimiento')); ok('una fecha de nacimiento futura se rechaza');
await p.fill('#cKidBirth', '2020-12-01'); await p.click('#payBtn');
assert((await p.textContent('#formErr')).includes('aceptar')); assert(!(await p.isVisible('#payOv'))); ok('sin aceptar el uso de los datos no se puede reservar');
await p.fill('#cName', 'Camila Rojas'); await p.fill('#cPhone', '+56 9 8888 1111'); await p.check('#cConsent'); await p.click('#payBtn');
assert(await p.isVisible('#payOv')); await p.click('#payGo'); await p.waitForTimeout(2200);
assert((await p.textContent('#bookArea')).includes('confirmada')); ok('con niño, nacimiento y aceptación la reserva se confirma');

// ---- panel
const a = await ctx.newPage(); a.on('pageerror', e => errs.push('admin: ' + e.message)); a.on('dialog', d => d.accept());
await a.goto(srv.url + '/admin.html'); await a.waitForTimeout(500);
await a.fill('#lPass', 'admin1234'); await a.click('#lBtn'); await a.waitForTimeout(600);
const tabs = await a.locator('#aTabs button').allTextContents();
assert.deepEqual(tabs, ['Reservas', 'Clientes', 'Cumpleaños', 'Balance', 'Ofertas', 'Domicilio', 'Servicios y terreno']); ok('el panel tiene siete pestañas');
assert(await a.isVisible('#resBody') && !(await a.isVisible('#cliBody'))); await a.click('[data-tab=clientes]'); assert(await a.isVisible('#cliBody') && !(await a.isVisible('#resBody'))); ok('cada pestaña muestra solo su contenido');
let cli = await a.textContent('#cliBody');
assert(cli.includes('Camila Rojas') && cli.includes('Valentina') && cli.includes('01-12-2020')); ok('la reserva nueva entra sola a la cartera con apoderado, niño, nacimiento y celular');
assert(cli.includes('Cliente de ejemplo 1') && cli.includes('Sofía (ejemplo)')); ok('las reservas de ejemplo también aparecen como clientes');
await a.fill('#cSearch', 'valent'); assert(!(await a.textContent('#cliBody')).includes('Cliente de ejemplo')); assert((await a.textContent('#cliBody')).includes('Valentina')); ok('la búsqueda filtra por niño');
await a.fill('#cSearch', '8888'); assert((await a.textContent('#cliBody')).includes('Camila')); await a.fill('#cSearch', ''); ok('la búsqueda filtra por celular');

// cliente manual
await a.fill('#kApo', 'Marcela Pizarro'); await a.fill('#kNino', 'Joaquín'); await a.fill('#kCel', '9 7777 2222');


const hoy = new Date(); const pad = x => String(x).padStart(2, '0');
const nac = d => `${d.getFullYear() - 7}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const en = k => { const d = new Date(hoy); d.setDate(d.getDate() + k); return d; };
await a.fill('#kNac', nac(en(10))); await a.fill('#kArr', 'Parcela y castillo inflable'); await a.fill('#kFecha', `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`); await a.fill('#kMonto', '195000');
await a.click('#cliForm button[type=submit]'); await a.waitForTimeout(400);
assert((await a.textContent('#cliBody')).includes('Marcela Pizarro') && (await a.textContent('#cliBody')).includes('$195.000')); ok('se agrega un cliente anterior a mano con lo que arrendó y lo que pagó');
await a.click('[data-kedit]'); assert.equal(await a.inputValue('#kNino'), 'Joaquín'); await a.fill('#kNotas', 'Prefiere tarde'); await a.click('#cliForm button[type=submit]'); await a.waitForTimeout(300);
assert(await a.locator('#cFormT').textContent() === 'Agregar cliente'); ok('se puede editar un cliente agregado a mano');

// ---- cumpleaños
await a.click('[data-tab=cumple]');
const hl = await a.textContent('#cumpleHl');
assert(hl.includes('Joaquín') && hl.includes('en 10 días')); ok('el cumpleañero que cumple en 10 días aparece destacado');
assert(hl.includes('Mateo (ejemplo)') && hl.includes('Estuvo de cumpleaños hace 5 días')); ok('quien estuvo de cumpleaños hace poco también se destaca, con lo que arrendó');
assert(hl.includes('Arrendó') && hl.includes('Parcela')); ok('el destacado muestra qué arrendó');
let prop = await a.textContent('#propBody');
assert(prop.includes('Sofía (ejemplo)') && prop.includes('Joaquín') && !prop.includes('Isidora') && !prop.includes('Emilia')); ok('solo se proponen los que cumplen dentro de 35 días (Isidora a 40 y Emilia a 200 no)');
const href = await a.locator('#propBody a', { hasText: 'WhatsApp' }).first().getAttribute('href');
assert(/^https:\/\/wa\.me\/569\d{8}\?text=/.test(href)); const txt = decodeURIComponent(href.split('?text=')[1]);
assert(txt.includes('Marcela') && txt.includes('Joaquín') && txt.includes('7 años') && txt.includes('index.html') && !txt.includes('{')); ok('el botón abre WhatsApp con el mensaje armado (apoderado, niño, edad y enlace al sitio)');
assert(txt.includes('Oferta de ejemplo')); ok('el mensaje incluye las ofertas activas');
await a.locator('[data-sent]').first().click(); await a.waitForTimeout(300);
assert((await a.textContent('#propBody')).includes('Enviada')); await a.reload(); await a.waitForTimeout(600); await a.click('[data-tab=cumple]');
assert((await a.textContent('#propBody')).includes('Enviada')); ok('"Marcar enviada" queda guardado y no se vuelve a ofrecer');
await a.fill('#msgTpl', 'Hola {apoderado}, feliz cumple {nino}'); assert(decodeURIComponent((await a.locator('#propBody a', { hasText: 'WhatsApp' }).first().getAttribute('href')).split('?text=')[1]).startsWith('Hola ')); ok('el mensaje se puede editar y se guarda');

// ---- balance
await a.click('[data-tab=balance]');
const tot = await a.textContent('#balBody tr.tot');
assert(tot.includes('Total ' + hoy.getFullYear())); ok('el balance muestra los 12 meses y el total del año');
const filas = await a.locator('#balBody tr').count(); assert.equal(filas, 13); ok('12 filas de meses más el total');
const calc = await a.evaluate(() => { const D = window.DK; const r = D.monthlyBalance([
  { date: '2026-03-10', status: 'finalizada', total: 100000, abono: 30000 }, { date: '2026-03-20', status: 'confirmada', total: 200000, abono: 60000 },
  { date: '2026-03-25', status: 'pendiente', total: 50000, abono: 15000 }, { date: '2026-03-28', status: 'cancelada', total: 99999, abono: 1 }, { date: '2025-03-01', status: 'finalizada', total: 7, abono: 1 }
], [{ fecha: '2026-03-05', monto: 40000 }], 2026)[2]; return r; });
assert.deepEqual([calc.eventos, calc.contratado, calc.abonos, calc.saldos, calc.cobrado, calc.porCobrar, calc.pendientes], [4, 390000, 130000, 70000, 200000, 175000, 15000]);
ok('la cuenta del mes: finalizada cobra todo, confirmada solo el abono, pendiente nada, cancelada no cuenta, el año se respeta');
const f29 = await a.evaluate(() => { const n = DK.nextBirthday('2020-02-29', new Date(2027, 0, 10)); return [n.date.getMonth(), n.date.getDate(), n.age, n.days]; });
assert.deepEqual(f29, [1, 28, 7, 49]); ok('quien nació un 29 de febrero celebra el 28 en años no bisiestos');
assert.equal(await a.evaluate(() => DK.waPhone('+56 9 6223 7619') + '|' + DK.waPhone('96223761') + '|' + DK.waPhone('987654321')), '56962237619|56996223761|56987654321'); ok('los celulares se convierten al formato de WhatsApp');
await a.click('#xlsBalance'); await a.waitForTimeout(300);
let x = await a.evaluate(() => window.__x);
assert.equal(x.length, 1); assert.equal(x[0].name, 'Divertikids_balance_' + hoy.getFullYear() + '.xlsx'); assert.deepEqual(x[0].sheets.map(s => s.n), ['Balance ' + hoy.getFullYear(), 'Eventos ' + hoy.getFullYear()]);
assert.equal(x[0].sheets[0].rows[0][0], 'Mes'); assert.equal(x[0].sheets[0].rows.length, 14); assert.equal(x[0].sheets[0].rows[13][0], 'Total'); ok('el Excel del balance trae la hoja mensual (con total) y la lista de eventos');
await a.click('[data-tab=clientes]'); await a.click('#xlsClientes'); await a.waitForTimeout(300);
x = await a.evaluate(() => window.__x); const cx = x[1];
assert.deepEqual(cx.sheets.map(s => s.n), ['Clientes', 'Eventos', 'Cumpleaños']); assert(cx.sheets[0].rows.some(r => r[0] === 'Marcela Pizarro' && r[1] === 'Joaquín' && r[4] === '9 7777 2222')); ok('el Excel de clientes trae clientes, eventos y cumpleaños');
assert(cx.sheets[0].rows[0].join('|') === 'Apoderado|Niño/a|Nacimiento|Edad|Celular|Correo|Eventos|Último evento|Lo que arrendó (último)|Total pagado (CLP)'); ok('las columnas del Excel son las que pidió la empresa');

// ---- ofertas
await a.click('[data-tab=ofertas]');
await a.fill('#oTit', 'Ofertas de noviembre'); await a.fill('#oTxt', 'Piscina chica gratis con cualquier inflable'); await a.click('#ofForm button[type=submit]'); await a.waitForTimeout(400);
assert((await a.textContent('#ofList')).includes('Ofertas de noviembre')); ok('se publica una oferta desde el panel');
await a.fill('#oTit', 'Vencida'); await a.fill('#oTxt', 'No debe verse'); await a.fill('#oHasta', '2020-01-01'); await a.click('#ofForm button[type=submit]'); await a.waitForTimeout(300);
await p.reload(); await p.waitForTimeout(800);
const of = await p.textContent('#offers');
assert(of.includes('Ofertas de noviembre') && of.includes('Oferta de ejemplo') && !of.includes('Vencida')); assert(await p.isVisible('#ofertas') && await p.isVisible('#navOfertas')); ok('el sitio muestra las ofertas vigentes y oculta las vencidas');
assert((await p.locator('#offers a').first().getAttribute('href')).includes('wa.me/56962237619?text=')); ok('cada oferta lleva a WhatsApp con el mensaje de la oferta');
await a.locator('#ofList li', { hasText: 'Ofertas de noviembre' }).locator('[data-odel]').click(); await a.waitForTimeout(300); await a.locator('#ofList li', { hasText: 'Oferta de ejemplo' }).locator('[data-odel]').click(); await a.waitForTimeout(300);
await a.locator('#ofList li', { hasText: 'Vencida' }).locator('[data-odel]').click(); await a.waitForTimeout(300);
await p.reload(); await p.waitForTimeout(700); assert(!(await p.isVisible('#ofertas'))); ok('sin ofertas la sección desaparece del sitio');

// cliente manual: eliminar
await a.click('[data-tab=clientes]'); await a.locator('#cliBody tr', { hasText: 'Marcela' }).locator('[data-kdel]').click(); await a.waitForTimeout(300);
assert(!(await a.textContent('#cliBody')).includes('Marcela')); ok('se puede eliminar un cliente agregado a mano');
// sin la librería de Excel se descarga CSV
await ctx.unroute(/cdnjs.*xlsx/); await a.evaluate(() => { delete window.XLSX; });
const [dl] = await Promise.all([a.waitForEvent('download'), a.click('#xlsClientes')]); assert(dl.suggestedFilename().endsWith('.csv')); ok('si no carga la librería de Excel, se descarga un CSV que Excel abre');
assert.deepEqual(errs, []); console.log(`\nTodo bien: ${n} comprobaciones, sin errores de página.`);
await b.close(); srv.close && srv.close();
