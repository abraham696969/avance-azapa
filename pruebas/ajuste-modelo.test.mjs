// Comprueba la fórmula que coloca un modelo 3D real dentro del ancho x largo del servicio (no necesita navegador).
import vm from 'node:vm'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = {}; const doc = { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}) };
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared.js'), 'utf8'), { window: win, document: doc, localStorage: {}, sessionStorage: {}, Intl, Date, Math, console, setTimeout, clearTimeout, URL, Image: function () {}, FileReader: function () {} });
const { fitGLB } = win.DK; let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`); const near = (a, b, m) => assert(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);
// modelo de 2 x 1 x 3 (ancho x alto x largo) con un origen cualquiera, para un servicio de 4 x 6 m
let f = fitGLB([10, 5, -3], [12, 6, 0], 0, 4, 6);
near(f.scale, 2, 'escala'); near(f.size[0], 4, 'ancho final'); near(f.size[2], 6, 'largo final'); near(f.size[1], 2, 'alto proporcional');
near(f.pos[0], -2 * 11, 'centrado en x'); near(f.pos[1], -2 * 5, 'apoyado en el suelo'); near(f.pos[2], -2 * -1.5, 'centrado en z'); ok('sin giro: escala 2, centrado y apoyado en el suelo');
f = fitGLB([0, 0, 0], [2, 1, 3], 0, 10, 3); near(f.scale, 1, 'escala'); near(f.size[2], 3, 'largo'); assert(f.size[0] <= 10); ok('si el modelo es más angosto, se ajusta al lado más limitante sin deformarse');
// giro de 90 grados: el ancho y el largo del modelo se intercambian
f = fitGLB([0, 0, 0], [2, 1, 3], 90, 3, 2); near(f.scale, 1, 'escala girado'); near(f.size[0], 3, 'ancho girado'); near(f.size[2], 2, 'largo girado'); ok('con giro de 90° intercambia ancho y largo');
// el centro del modelo, tras girar y mover, queda en (0,0) para cualquier giro
for (const rot of [0, 90, 180, 270]) {
  const min = [3, 1, -7], max = [8, 4, -2], g = fitGLB(min, max, rot, 6, 6), r = rot * Math.PI / 180, c = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2];
  const x = g.scale * (c[0] * Math.cos(r) + c[1] * Math.sin(r)) + g.pos[0], z = g.scale * (-c[0] * Math.sin(r) + c[1] * Math.cos(r)) + g.pos[2];
  near(x, 0, 'x ' + rot); near(z, 0, 'z ' + rot);
}
ok('el modelo queda centrado en el terreno con los 4 giros');
assert(fitGLB([0, 0, 0], [0, 1, 1], 0, 2, 2) === null && fitGLB([0, 0, 0], [NaN, 1, 1], 0, 2, 2) === null); ok('un modelo vacío o dañado no rompe nada (devuelve null)');
assert(fitGLB([0, 0, 0], [1, 1, 1], 450, 2, 2).scale === 2 && fitGLB([0, 0, 0], [1, 1, 1], -90, 2, 2).scale === 2); ok('giros fuera de rango o negativos se normalizan');
console.log(`\nTodo bien: ${n} comprobaciones.`);
