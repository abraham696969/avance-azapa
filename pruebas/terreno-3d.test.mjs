// Comprueba QUÉ se dibuja en el simulador 3D para un terreno configurado (medidas, suelo, cerco, elementos, foto aérea,
// modelo 3D del terreno y de un servicio). Usa una librería 3D simulada que registra las piezas: valida la lógica de
// colocación, no el aspecto visual.
import { createRequire } from 'node:module'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { servir } from './_servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAKE = `(function(){
 const rec={loads:[],texLoads:[],cross:null,renders:0,glb:[]};window.__rec=rec;
 class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}setScalar(s){this.x=this.y=this.z=s;return this}}
 class Obj{constructor(){this.children=[];this.position=new V3();this.rotation=new V3();this.scale=new V3(1,1,1);this.userData={};this.visible=true}
  add(o){this.children.push(o);o.parent=this;return this}remove(o){this.children=this.children.filter(c=>c!==o)}
  traverse(f){f(this);this.children.forEach(c=>c.traverse&&c.traverse(f))}lookAt(){}updateMatrixWorld(){}clone(){const c=new Group();c.userData=this.userData;c.bbox=this.bbox;return c}}
 class Group extends Obj{} class Scene extends Obj{}
 class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true}}
 const G=n=>class{constructor(...a){this.type=n;this.args=a}};
 class Mat{constructor(o){Object.assign(this,o||{});this.emissive={setHex(){}}}clone(){return this}}
 class Sprite extends Obj{constructor(m){super();this.isSprite=true;this.material=m}}
 class Cam extends Obj{constructor(f,a,n,far){super();this.far=far;this.aspect=a}updateProjectionMatrix(){}}
 class Light extends Obj{constructor(){super();this.shadow={camera:{},mapSize:{set(){}}}}}
 class Box3{setFromObject(o){const b=o.bbox||[[0,0,0],[1,1,1]];this.min=new V3(...b[0]);this.max=new V3(...b[1]);return this}}
 class TL{setCrossOrigin(v){rec.cross=v}load(url,ok){rec.texLoads.push(url);ok&&ok({})}}
 class GL{load(url,ok,_p,fail){rec.glb.push({url,ok,fail})}}
 window.THREE={Mesh,Group,Scene,Sprite,Box3,TextureLoader:TL,GLTFLoader:GL,sRGBEncoding:3001,
  MeshLambertMaterial:Mat,SpriteMaterial:Mat,CanvasTexture:class{constructor(c){this.canvas=c}},Color:class{},
  BoxGeometry:G('box'),CylinderGeometry:G('cyl'),SphereGeometry:G('sphere'),PlaneGeometry:G('plane'),CircleGeometry:G('circle'),
  Vector3:V3,Vector2:class{set(){}},Plane:class{},Raycaster:class{setFromCamera(){}},
  PerspectiveCamera:Cam,HemisphereLight:Light,DirectionalLight:Light,
  WebGLRenderer:class{constructor(){this.shadowMap={};this.domElement=document.createElement('canvas')}setPixelRatio(){}setSize(){}render(s,c){rec.renders++;rec.lastCam=c.position.x**2+c.position.y**2+c.position.z**2;rec.scene=s}}};
 window.THREE.Scene=class extends Scene{constructor(){super();window.__scene=this}};
 window.__cam=null;const PC=window.THREE.PerspectiveCamera;window.THREE.PerspectiveCamera=class extends PC{constructor(...a){super(...a);window.__cam=this}};
})();`;

const TERRENO = { w: 40, d: 25, ground: 'tierra', fence: true, photo: 'http://x.test/aerea.jpg', model: '', modelRot: 0, items: [
  { id: 'q1', t: 'quincho', name: 'Quincho', x: -12, z: -8, w: 6, d: 4, rot: 0 }, { id: 'a1', t: 'arbol', name: 'Árbol', x: 10, z: 5, w: 2, d: 2, rot: 0 },
  { id: 'b1', t: 'bano', name: 'Baños', x: 15, z: -9, w: 3, d: 3, rot: 90 }, { id: 'p1', t: 'piscina', name: 'Piscina', x: 0, z: 8, w: 6, d: 3, rot: 0 }] };
const estado = (terreno, catalog) => `localStorage.setItem('diverti-kids-demo-v2', ${JSON.stringify(JSON.stringify({ res: [], blocked: [], catalog: catalog || {}, seq: 1006, terrain: terreno }))});`;

const srv = await servir(root);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
let n = 0; const ok = m => console.log('  ✓', m, `(${++n})`); const errs = [];
async function abrir(terreno, catalog) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/(cdnjs|jsdelivr|googleapis|gstatic)/, r => r.abort());
  await ctx.addInitScript(FAKE); await ctx.addInitScript(estado(terreno, catalog));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(srv.url + '/index.html?todo=1'); await p.waitForTimeout(1200); return p;
}
const resumen = p => p.evaluate(() => {
  const s = window.__scene, proc = s.children.find(c => c.children.some(k => k.geometry && k.geometry.type === 'plane')), geo = o => o.geometry ? o.geometry.type + ':' + o.geometry.args.map(v => Math.round(v * 100) / 100).join(',') : 'grupo';
  return { nScene: s.children.length, procVisible: proc.visible, procKids: proc.children.map(c => ({ g: geo(c), x: c.position.x, y: c.position.y, z: c.position.z, ry: c.rotation.y, kids: c.children.map(geo), sprite: !!c.isSprite })),
    far: window.__cam.far, rec: { cross: window.__rec.cross, tex: window.__rec.texLoads, renders: window.__rec.renders, dist: Math.sqrt(window.__rec.lastCam) } };
});

// 1) terreno configurado
let p = await abrir(TERRENO); let r = await resumen(p);
const planos = r.procKids.filter(k => k.g.startsWith('plane')).map(k => k.g);
assert.deepEqual(planos, ['plane:40,25', 'plane:120,87.5']); ok('el suelo mide 40 × 25 m y el exterior crece con el terreno (120 × 87,5)');
assert.equal(r.rec.cross, 'anonymous'); assert.deepEqual(r.rec.tex, ['http://x.test/aerea.jpg']); ok('la foto aérea se carga como textura del suelo (con permiso de origen cruzado)');
const cajas = r.procKids.filter(k => k.g.startsWith('box')); assert.equal(cajas.length, 5); assert(r.procKids.some(k => k.sprite)); ok('hay cerco de 5 tramos y el letrero ENTRADA');
const quincho = r.procKids.find(k => k.kids.includes('box:6,2.4,4')); assert(quincho && quincho.x === -12 && quincho.z === -8 && quincho.kids.includes('box:6.6,0.4,4.6')); ok('el quincho (6 × 4) está en (-12, -8) con su techo');
const arbol = r.procKids.find(k => k.kids.some(c => c.startsWith('sphere'))); assert(arbol.x === 10 && arbol.z === 5 && arbol.kids.includes('sphere:1.5,14,10')); ok('el árbol de 2 m tiene copa de radio 1,5 m (proporcional)');
const bano = r.procKids.find(k => k.kids.includes('box:3,2.4,3')); assert(bano && bano.x === 15 && Math.abs(bano.ry + Math.PI / 2) < 1e-9); ok('los baños están girados 90° donde los pusiste');
assert(r.procKids.some(k => k.kids.includes('box:6,0.5,3') && k.kids.includes('box:5.6,0.05,2.6'))); ok('la piscina fija se dibuja con su borde y su agua');
const K = Math.max(1, Math.max(40 * 1.1, 25 * 1.7) / 34); assert(Math.abs(r.far - 200 * K) < 1e-6 && Math.abs(r.rec.dist - 34 * K) < 1e-6, JSON.stringify([r.far, r.rec.dist])); ok('la cámara se aleja según el tamaño del terreno (no queda adentro ni recortada)');
assert.equal(r.nScene, 2 + 1 + 5); ok('los 5 juegos iniciales se ubican en el terreno nuevo');
// ninguno de los juegos iniciales cae sobre un elemento fijo ni fuera del terreno
const choque = await p.evaluate(() => { const bad = []; window.__scene.children.filter(c=>c.children.length&&!c.children.some(k=>k.geometry&&k.geometry.type==='plane')).forEach(g => { const x = g.position.x, z = g.position.z; if (Math.abs(x) > 20 || Math.abs(z) > 12.5) bad.push(['fuera', x, z]); DK.OBST.forEach(o => { if (Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2) bad.push(['choca', o.name, x, z]) }) }); return bad });
assert.deepEqual(choque, []); ok('ningún juego inicial queda encima del quincho, los árboles, los baños ni fuera del terreno');
await p.context().close();

// 2) sin cerco ni foto
p = await abrir(Object.assign({}, TERRENO, { fence: false, photo: '' })); r = await resumen(p);
assert.equal(r.procKids.filter(k => k.g.startsWith('box')).length, 0); assert(!r.procKids.some(k => k.sprite && k.y === 1.6)); assert.deepEqual(r.rec.tex, []); ok('sin cerco no se dibujan tramos ni el letrero de entrada, y sin foto no se carga textura');
await p.context().close();

// 3) modelo 3D del terreno: reemplaza al terreno dibujado
p = await abrir(Object.assign({}, TERRENO, { model: 'http://x.test/terreno.glb', modelRot: 0, photo: '' }));
let g = await p.evaluate(() => window.__rec.glb.map(x => x.url)); assert.deepEqual(g, ['http://x.test/terreno.glb']); ok('se pide el archivo .glb del terreno');
await p.evaluate(() => { const sc = new THREE.Group(); sc.bbox = [[5, 1, 5], [15, 3, 10]]; window.__rec.glb[0].ok({ scene: sc }) }); await p.waitForTimeout(100);
r = await p.evaluate(() => { const s = window.__scene, h = s.children[s.children.length - 1]; return { procVisible: s.children.find(c => c.children.some(k => k.geometry && k.geometry.type === 'plane')).visible, scale: h.scale.x, pos: [h.position.x, h.position.y, h.position.z] } });
assert.equal(r.procVisible, false); assert(Math.abs(r.scale - 4) < 1e-9); assert(Math.abs(r.pos[0] - -40) < 1e-9 && Math.abs(r.pos[1] - -4) < 1e-9 && Math.abs(r.pos[2] - -30) < 1e-9, JSON.stringify(r)); ok('al cargar el modelo se oculta el terreno dibujado y el escaneo se escala a 40 × 25 m, centrado y apoyado en el suelo');
await p.context().close();

// 4) si el modelo del terreno falla, queda el terreno dibujado
p = await abrir(Object.assign({}, TERRENO, { model: 'http://x.test/malo.glb', photo: '' }));
await p.evaluate(() => window.__rec.glb[0].fail(new Error('404'))); await p.waitForTimeout(100);
r = await resumen(p); assert.equal(r.procVisible, true); assert.equal(errs.length, 0, errs.join('|')); ok('si el modelo del terreno no carga, se sigue viendo el terreno dibujado y no hay errores');
await p.context().close();

// 5) un servicio con modelo 3D real reemplaza la figura simple una vez cargado
const cat = { castillo: { name: 'Castillo inflable', desc: '', cat: 'juegos', price: 45000, stock: 2, w: 4.5, d: 4.5, h: 3.5, color: 0xff5fa2, shape: 'castle', active: true, model: 'http://x.test/castillo.glb', modelRot: 90 } };
p = await abrir(TERRENO, cat);
g = await p.evaluate(() => window.__rec.glb.map(x => x.url)); assert(g.every(u => u === 'http://x.test/castillo.glb') && g.length >= 1); assert.equal(new Set(g).size, 1); ok('el modelo de un servicio se pide una sola vez aunque haya varias copias');
const antes = await p.evaluate(() => { const gr = window.__scene.children.find(c => c.children.some(k => k.geometry && k.geometry.type === 'cyl')); return gr ? gr.children.length : -1 });
await p.evaluate(() => { const sc = new THREE.Group(); sc.bbox = [[0, 0, 0], [2, 1, 3]]; window.__rec.glb[0].ok({ scene: sc }) }); await p.waitForTimeout(100);
const despues = await p.evaluate(() => { const gr = window.__scene.children.filter(c => c.children.length === 1 && c.children[0].scale && c.children[0].scale.x !== 1); return gr.map(x => ({ rot: x.children[0].rotation.y, s: x.children[0].scale.x })) });
assert(despues.length >= 1 && despues.every(d => Math.abs(d.rot - Math.PI / 2) < 1e-9 && Math.abs(d.s - 1.5) < 1e-9), JSON.stringify(despues)); ok('el castillo real se gira 90° y se ajusta a 4,5 × 4,5 m (escala 1,5 para un modelo de 2 × 3)');
await p.context().close();

await b.close(); srv.close();
console.log(errs.length ? '\nERRORES DE PÁGINA:\n' + errs.join('\n') : `\nTodo bien: ${n} comprobaciones, sin errores de página.`); process.exit(errs.length ? 1 : 0);
