// Prueba del chatbot: 30 consultas con la intención esperada. Mide el % de respuestas correctas.
// Requiere Playwright. Ejecutar desde la carpeta del sitio:  node pruebas/chatbot.test.mjs
import { createRequire } from 'node:module';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// [consulta, intenciones que se aceptan como correctas, texto que debe aparecer en la respuesta (opcional)]
const CASOS = [
  ['Hola', ['saludo']],
  ['¿Cuánto cuesta el castillo inflable?', ['precios'], /45\.000/],
  ['¿Qué precio tiene la piscina grande?', ['precios'], /35\.000/],
  ['¿Tienen disponibilidad para el 14 de noviembre?', ['disponibilidad'], /noviembre/],
  ['¿Está libre el 20/12?', ['disponibilidad'], /diciembre/],
  ['¿Dónde están ubicados?', ['ubicacion'], /Azapa/],
  ['¿Cómo llego a la parcela?', ['ubicacion']],
  ['¿Cuánto es el abono?', ['pago'], /30%/],
  ['¿Puedo pagar con transferencia?', ['pago']],
  ['¿Cuánto me falta por pagar el día del evento?', ['saldo'], /70%/],
  ['¿Cómo hago una reserva?', ['reservar']],
  ['Quiero arrendar para el cumpleaños de mi hija', ['reservar']],
  ['¿A qué hora parte la fiesta?', ['horario_franjas'], /10:00/],
  ['¿Qué horarios tienen?', ['horario_franjas']],
  ['¿Cuántos castillos tienen?', ['stock'], /Castillo/],
  ['¿Tienen mesa de ping pong?', ['juegos']],
  ['¿Qué máquinas de comida arriendan?', ['comida'], /papas/i],
  ['¿Hay piscinas para niños chicos?', ['piscinas']],
  ['¿Cómo funciona el simulador 3D?', ['simulador']],
  ['Necesito hablar con una persona', ['contacto'], /WhatsApp/],
  ['¿Me pasan su WhatsApp?', ['contacto']],
  ['¿Puedo cancelar mi reserva si me arrepiento?', ['cancelacion']],
  ['¿Se puede cambiar la fecha?', ['cancelacion']],
  ['¿Entregan boleta?', ['boleta']],
  ['¿Tienen algún descuento?', ['descuentos']],
  ['¿Puedo llevar mi propia torta?', ['comida_propia']],
  ['¿Necesitan electricidad los juegos?', ['electricidad']],
  ['¿Cómo es el montaje de los juegos?', ['montaje']],
  ['¿Cuál es el horario de atención?', ['horario_atencion']],
  ['¿Cuántos niños caben en la parcela?', ['capacidad'], /200/],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForTimeout(800);
await page.click('#chatFab');
const filas = []; let bien = 0;
for (const [q, ok, has] of CASOS) {
  const antes = await page.locator('#msgs .m.bot').count();
  await page.fill('#chatIn', q); await page.press('#chatIn', 'Enter');
  await page.waitForFunction(n => document.querySelectorAll('#msgs .m.bot').length > n, antes, { timeout: 3000 });
  const last = page.locator('#msgs .m.bot').last();
  const intent = await last.getAttribute('data-intent'); const texto = (await last.innerText()).replace(/\s+/g, ' ');
  const bueno = ok.includes(intent) && (!has || has.test(texto));
  if (bueno) bien++;
  filas.push({ q, esperado: ok.join(' o '), intent, bueno, texto: texto.slice(0, 110) });
}
await browser.close();
const pct = Math.round(bien / CASOS.length * 1000) / 10;
let md = `# Resultado de la prueba del chatbot\n\n${bien} de ${CASOS.length} respuestas correctas = **${pct}%** (meta: 85% o más)\n\n| # | Consulta | Esperado | Obtenido | OK |\n|---|---|---|---|---|\n`;
filas.forEach((f, i) => { md += `| ${i + 1} | ${f.q} | ${f.esperado} | ${f.intent} | ${f.bueno ? '✓' : '✗'} |\n`; });
fs.writeFileSync(path.join(root, 'pruebas/resultados-chatbot.md'), md);
filas.filter(f => !f.bueno).forEach(f => console.log('FALLA:', f.q, '→', f.intent, '| esperado', f.esperado, '|', f.texto));
console.log(`\n${bien}/${CASOS.length} = ${pct}%`, errs.length ? 'ERRORES DE PÁGINA: ' + errs.join(' | ') : '(sin errores de página)');
process.exit(pct >= 85 ? 0 : 1);
