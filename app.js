(async function(){
'use strict';
const {$,$$,CLP,esc,pad,iso,parseISO,MESES,fmtDate,today,addDays,toast,CATS,SLOTS,CAT,byId,DESIGN,TERR,OBST,API}=DK;
/* ---------- datos desde la base (o modo demo) ---------- */
let data;
try{data=await API.loadPublic()}
catch(e){console.error(e);data={res:[],blocked:[],catalog:{},ofertas:[]};setTimeout(()=>toast('No se pudo conectar con la base de datos. Revisa config.js.'),600)}
DK.applyCatalog(data.catalog);
DK.applyTerrain(data.terrain||DK.DEFAULT_TERRAIN);
const DB={res:data.res,blocked:data.blocked};

const S={modo:'parcela',qty:{},zona:'',cat:'todos',month:new Date(today.getFullYear(),today.getMonth(),1),date:null,slot:'tarde',parcela:true,placed:[],sel:null,uid:1};

/* ---------- disponibilidad ---------- */
const blockedDay=ds=>DB.blocked.some(b=>b.date===ds&&(!b.aplica||b.aplica==='todo'||b.aplica===S.modo));
const ZONAS=(data.zonas&&data.zonas.length?data.zonas:[]);
const domOK=it=>it.id!=='parcela'&&it.domicilio!==false;
const dsgn=()=>S.modo==='domicilio'?DESIGN.filter(domOK):DESIGN;   // servicios que se pueden pedir en la modalidad actual
function used(id,ds,slot){let n=0;DB.res.forEach(r=>{if(r.date===ds&&r.slot===slot&&r.status!=='cancelada'){if(id==='parcela'){if(r.parcela)n++}else n+=r.items[id]||0}});return n}
function avail(id,ds,slot){if(blockedDay(ds))return 0;return Math.max(0,byId(id).stock-used(id,ds,slot))}
function slotFree(ds,slot){if(S.modo==='domicilio')return !blockedDay(ds)&&DESIGN.some(it=>domOK(it)&&avail(it.id,ds,slot)>0);return avail('parcela',ds,slot)>0}
function dayState(ds){if(blockedDay(ds))return 'blocked';const f=Object.keys(SLOTS).filter(s=>slotFree(ds,s)).length;return f===0?'full':(f===2?'free':'partial')}
(function pickDefault(){for(let i=7;i<60;i++){const d=addDays(today,i);if(d.getDay()===6&&dayState(iso(d))==='free'){S.date=iso(d);S.month=new Date(d.getFullYear(),d.getMonth(),1);return}}S.date=iso(addDays(today,8))})();

/* ---------- catálogo ---------- */
function planSVG(it){
  const k=22, max=Math.max(it.w,it.d), sc=it.id==='parcela'?3.2:Math.min(k*2.1/ (max>5?max:5)*1.0,16);
  const w=it.w*sc,d=it.d*sc,col='#'+it.color.toString(16).padStart(6,'0');
  const body=it.shape==='pool'?`<circle cx="60" cy="48" r="${w/2}" fill="${col}"/>`:`<rect x="${60-w/2}" y="${48-d/2}" width="${w}" height="${d}" rx="4" fill="${col}"/>`;
  return `<svg viewBox="0 0 120 96" width="120" height="96" role="img" aria-label="Vista en planta, ${it.w} por ${it.d} metros">${body}</svg>`;
}
function renderTabs(){
  const t=$('#tabs');t.innerHTML='';
  [['todos','Todo'],...Object.entries(CATS)].forEach(([k,n])=>{const b=document.createElement('button');b.className='tab';b.textContent=n;b.setAttribute('aria-pressed',S.cat===k);b.onclick=()=>{S.cat=k;renderTabs();renderCatalog()};t.appendChild(b)});
}
const countOf=id=>S.modo==='domicilio'?(S.qty[id]||0):S.placed.filter(p=>p.id===id).length;
function renderCatalog(){
  const g=$('#catalog');g.innerHTML='';
  CAT.filter(i=>(S.cat==='todos'||i.cat===S.cat)&&(S.modo!=='domicilio'||domOK(i))).forEach(it=>{
    const el=document.createElement('article');el.className='card';
    const left=avail(it.id,S.date,S.slot);
    const inDesign=it.id==='parcela'?(S.parcela?1:0):countOf(it.id);
    const stockB=left===0?'<span class="badge bad">Sin disponibilidad</span>':`<span class="badge ${left<=1?'warn':'ok'}">${left} disponible${left>1?'s':''} esa fecha</span>`;
    el.innerHTML=`<div class="plan${it.img?' has-img':''}">${planSVG(it)}${it.img?`<img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy" decoding="async" onerror="this.remove()">`:''}<small>${it.w} × ${it.d} m</small></div>
      <div class="body"><h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p>
      <div class="row"><span class="price num">${CLP(it.price)}<small> / evento</small></span>${stockB}</div>
      <div class="row"><span class="note">${S.modo==='domicilio'?(inDesign?'En tu pedido: '+inDesign:'No está en tu pedido'):(inDesign?'En tu diseño: '+inDesign:'No está en tu diseño')}</span>
      ${S.modo==='domicilio'?`<span class="qty"><button class="qtybtn" data-dm="${it.id}" aria-label="Quitar ${esc(it.name)}" ${inDesign?'':'disabled'}>−</button><b class="num">${inDesign}</b><button class="qtybtn" data-dp="${it.id}" aria-label="Agregar ${esc(it.name)}" ${inDesign>=left?'disabled':''}>+</button></span>`:`<button class="btn sm primary" data-add="${it.id}" ${left===0?'disabled':''}>${it.id==='parcela'?(S.parcela?'Quitar':'Agregar'):'Agregar al terreno'}</button>`}</div></div>`;
    g.appendChild(el);
  });
  $$('[data-dp]').forEach(b=>b.onclick=()=>addDom(b.dataset.dp));
  $$('[data-dm]').forEach(b=>b.onclick=()=>{const id=b.dataset.dm;if(S.qty[id]>0){S.qty[id]--;if(!S.qty[id])delete S.qty[id];refreshAll()}});
  $$('[data-add]').forEach(b=>b.onclick=()=>{const id=b.dataset.add;if(id==='parcela'){S.parcela=!S.parcela;refreshAll()}else{if(addItem(id)){toast('Agregado al terreno')}}});
}

/* ---------- agenda ---------- */
function renderCal(){
  const m=S.month;$('#monthT').textContent=MESES[m.getMonth()]+' '+m.getFullYear();
  const c=$('#cal');c.innerHTML='';
  ['Lu','Ma','Mi','Ju','Vi','Sá','Do'].forEach(x=>{const e=document.createElement('div');e.className='dow';e.textContent=x;c.appendChild(e)});
  const first=(new Date(m.getFullYear(),m.getMonth(),1).getDay()+6)%7;
  for(let i=0;i<first;i++)c.appendChild(document.createElement('div'));
  const n=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
  for(let d=1;d<=n;d++){
    const dt=new Date(m.getFullYear(),m.getMonth(),d),ds=iso(dt),st=dayState(ds),past=dt<=today;
    const b=document.createElement('button');b.className='day num '+(past?'':st)+(ds===S.date?' sel':'');
    b.disabled=past||st==='blocked'||st==='full';
    b.setAttribute('aria-label',fmtDate(ds)+(st==='full'?', ocupado':st==='blocked'?', bloqueado':''));
    if(st==='blocked'&&!past)b.className+=' blocked';
    const dots=Object.keys(SLOTS).map(s=>`<i class="${slotFree(ds,s)&&st!=='blocked'?'':'x'}"></i>`).join('');
    b.innerHTML=`${d}<span class="dots">${past?'':dots}</span>`;
    b.onclick=()=>{S.date=ds;if(!slotFree(ds,S.slot)){S.slot=Object.keys(SLOTS).find(s=>slotFree(ds,s))||S.slot}refreshAll()};
    c.appendChild(b);
  }
  $('#prevM').disabled=(m.getFullYear()===today.getFullYear()&&m.getMonth()<=today.getMonth());
}
function renderSlots(){
  $('#dateT').textContent=fmtDate(S.date);
  const s=$('#slots');s.innerHTML='';
  Object.entries(SLOTS).forEach(([k,v])=>{
    const free=slotFree(S.date,k);
    const b=document.createElement('button');b.className='slot';b.disabled=!free;b.setAttribute('aria-pressed',S.slot===k);
    b.innerHTML=`<b>${v.n}</b><span class="note num">${v.h}</span><span class="badge ${free?'ok':'bad'}" style="align-self:flex-start;margin-top:4px">${free?'Disponible':'Ocupada'}</span>`;
    b.onclick=()=>{S.slot=k;refreshAll()};s.appendChild(b);
  });
  const a=$('#avail');a.innerHTML='';
  CAT.filter(i=>i.id!=='parcela').forEach(it=>{const l=avail(it.id,S.date,S.slot);const d=document.createElement('div');d.innerHTML=`<span>${esc(it.name)}</span><b class="${l===0?'':''}">${l} de ${it.stock}</b>`;if(l===0)d.style.opacity='.5';a.appendChild(d)});
}

/* ---------- simulador 3D ---------- */
let THREE_OK=typeof THREE!=='undefined';
let scene,camera,renderer,ground,raycaster,mouse,groundPlane;
const cam={theta:0.4,phi:0.75,r:34};
let CAM_K=1,CAM_MIN=14,CAM_MAX=60;   // se ajustan al tamaño del terreno
const zoomTo=r=>{cam.r=Math.min(CAM_MAX,Math.max(CAM_MIN,r))};
let need=false;
function render(){need=true;if(render.p)return;render.p=true;requestAnimationFrame(()=>{render.p=false;if(!renderer)return;updCam();renderer.render(scene,camera)})}
function updCam(){camera.position.set(cam.r*Math.sin(cam.phi)*Math.sin(cam.theta),cam.r*Math.cos(cam.phi),cam.r*Math.sin(cam.phi)*Math.cos(cam.theta));camera.lookAt(0,0,0)}
const mat=c=>new THREE.MeshLambertMaterial({color:c});
function box(w,h,d,c,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x||0,(y||0)+h/2,z||0);m.castShadow=true;m.receiveShadow=true;return m}
function cyl(rt,rb,h,c,x,y,z,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||24),mat(c));m.position.set(x||0,(y||0)+h/2,z||0);m.castShadow=true;return m}
function build(it){
  const g=new THREE.Group(),w=it.w,d=it.d,h=it.h,c=it.color;
  switch(it.shape){
    case 'castle':
      g.add(box(w,h*.55,d,c));
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>{g.add(cyl(.65,.65,h*.85,0xffffff,a*(w/2-.65),0,b*(d/2-.65)));g.add(cyl(0,.8,h*.25,0xffc21a,a*(w/2-.65),h*.85,b*(d/2-.65)))});break;
    case 'slide':{
      g.add(box(w,h*.8,d*.3,c,0,0,-d*.35));
      const L=Math.hypot(d*.7,h*.8),ang=Math.atan2(h*.8,d*.7*1.0);
      const r=new THREE.Mesh(new THREE.BoxGeometry(w*.9,.4,L),mat(0xffc21a));r.position.set(0,h*.4,d*.15);r.rotation.x=ang;r.castShadow=true;g.add(r);
      g.add(box(.4,h*.35,d*.3,0xffffff,-w/2+.2,h*.8,-d*.35));g.add(box(.4,h*.35,d*.3,0xffffff,w/2-.2,h*.8,-d*.35));break}
    case 'field':
      g.add(box(w,.25,d,0x3fbf6a));
      [[0,-d/2+.3,w,.6],[0,d/2-.3,w,.6]].forEach(([x,z,ww,dd])=>g.add(box(ww,h,dd,c,x,0,z)));
      [[-w/2+.3,0],[w/2-.3,0]].forEach(([x,z])=>g.add(box(.6,h,d-1.2,c,x,0,z)));break;
    case 'table':
      g.add(box(w,.18,d,c,0,h-.18,0));
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>g.add(box(.1,h-.18,.1,0x444444,a*(w/2-.1),0,b*(d/2-.1))));
      g.add(box(w-.2,.04,d*.5,0x2bb673,0,h,0));break;
    case 'pingpong':
      g.add(box(w,.06,d,c,0,h-.06,0));g.add(box(w-.1,.01,.03,0xffffff,0,h,0));g.add(box(.03,.15,d,0xffffff,0,h,0));
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>g.add(box(.08,h-.06,.08,0x444444,a*(w/2-.15),0,b*(d/2-.15))));break;
    case 'machine':
      g.add(box(w,h*.7,d,c));g.add(box(w*.8,h*.3,d*.8,it.top,0,h*.7,0));
      if(it.id==='algodon'){const s=new THREE.Mesh(new THREE.SphereGeometry(.42,16,12),mat(0xffd6e6));s.position.set(0,h+.1,0);g.add(s)}break;
    case 'box':
      g.add(box(w,h,d,c));break;
    case 'pool':
      g.add(cyl(w/2,w/2,h,0xeeeeee));const wt=cyl(w/2-.15,w/2-.15,h*.9,c,0,.05,0);g.add(wt);
      const wt2=new THREE.Mesh(new THREE.CircleGeometry(w/2-.15,32),new THREE.MeshLambertMaterial({color:0x7fd0ff}));wt2.rotation.x=-Math.PI/2;wt2.position.y=h+.01;g.add(wt2);break;
  }
  // si el servicio tiene un modelo 3D real (.glb), se carga y reemplaza la figura simple
  if(it.model&&THREE_OK&&THREE.GLTFLoader){
    loadModel(it.model).then(src=>{const r=realModel(src,it);if(!r)return;while(g.children.length)g.remove(g.children[0]);g.add(r);render()})
      .catch(e=>{console.warn('No se pudo cargar el modelo 3D de',it.name,e);MODEL_CACHE.delete(it.model)});
  }
  return g;
}
/* ----- modelos 3D reales (.glb) con respaldo: si falla la carga se queda la figura simple ----- */
const MODEL_CACHE=new Map();
function loadModel(url){
  if(!MODEL_CACHE.has(url))MODEL_CACHE.set(url,new Promise((ok,fail)=>{
    if(!THREE.GLTFLoader)return fail(new Error('GLTFLoader no disponible'));
    new THREE.GLTFLoader().load(url,gl=>ok(gl.scene),undefined,fail)}));
  return MODEL_CACHE.get(url);
}
function realModel(src,it){
  const m=src.clone(true);
  m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material=Array.isArray(o.material)?o.material.map(x=>x.clone()):o.material.clone()}});
  m.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(m);
  const f=DK.fitGLB([b.min.x,b.min.y,b.min.z],[b.max.x,b.max.y,b.max.z],it.modelRot||0,it.w,it.d);
  if(!f)return null;
  const holder=new THREE.Group();holder.add(m);
  holder.rotation.y=(it.modelRot||0)*Math.PI/180;holder.scale.setScalar(f.scale);holder.position.set(f.pos[0],f.pos[1],f.pos[2]);
  return holder;
}
function setEmissive(g,hex){if(!g.traverse)return;g.traverse(o=>{if(o.material&&o.material.emissive)o.material.emissive.setHex(hex)})}
function makeLabel(text){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#12203F';x.beginPath();x.roundRect?x.roundRect(4,8,248,48,12):x.rect(4,8,248,48);x.fill();x.fillStyle='#fff';x.font='700 30px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,33);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));sp.scale.set(4,1,1);return sp;
}
/* ---------- terreno: suelo, cerco, elementos fijos, foto aérea y modelo 3D ---------- */
const GROUND_COLORS={pasto:['#7fcf7d','#76c874'],tierra:['#c9a56b','#c19c62'],cemento:['#b9bcc4','#b1b4bd'],arena:['#e8d6a4','#e2cf9b']};
function groundCanvas(){
  const K=24,tc=document.createElement('canvas');tc.width=Math.round(TERR.w*K);tc.height=Math.round(TERR.d*K);const t=tc.getContext('2d');
  const [c1,c2]=GROUND_COLORS[TERR.ground]||GROUND_COLORS.pasto;
  for(let i=0;i<Math.ceil(TERR.w);i++)for(let j=0;j<Math.ceil(TERR.d);j++){t.fillStyle=(i+j)%2?c1:c2;t.fillRect(i*K,j*K,K,K)}
  t.strokeStyle='rgba(255,255,255,.18)';t.lineWidth=1;
  for(let i=0;i<=TERR.w;i++){t.beginPath();t.moveTo(i*K,0);t.lineTo(i*K,tc.height);t.stroke()}
  for(let j=0;j<=TERR.d;j++){t.beginPath();t.moveTo(0,j*K);t.lineTo(tc.width,j*K);t.stroke()}
  return tc;
}
const ELEM={ // tipo -> [alto de las paredes, color paredes, color techo]
  quincho:[2.4,0xe8d6b0,0xb5452f],casa:[2.8,0xf0e6d2,0x8a4b3a],bano:[2.4,0xdfe8ef,0x5b7080]};
const TEXPAL={pasto:['#7fcf7d','#6fbf6d','#8fdb8c'],pastosint:['#3fae4a','#37a043','#49b955'],tierra:['#c9a56b','#bb975c','#d6b47c'],madera:['#9a6a3b','#8a5c31','#a97a49'],cemento:['#b9bcc4','#aeb1b9','#c6c9d0'],arena:['#e8d6a4','#dfcb94','#f0e0b6'],agua:['#4fb3ff','#44a6f2','#66c2ff']};
function texCanvas(key,w,d){
  const K=16,c=document.createElement('canvas');c.width=Math.max(8,Math.round(w*K));c.height=Math.max(8,Math.round(d*K));const t=c.getContext('2d'),P=TEXPAL[key]||TEXPAL.cemento;
  t.fillStyle=P[0];t.fillRect(0,0,c.width,c.height);let s=7+key.length*13;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  if(key==='madera'){const pw=Math.round(.18*K*2);for(let x=0;x<c.width;x+=pw){t.fillStyle=P[(x/pw)%2?1:2];t.fillRect(x,0,pw-1,c.height)}}
  else if(key==='pastosint'){const sw=Math.round(1.2*K);for(let y=0;y<c.height;y+=sw){t.fillStyle=P[(y/sw)%2?1:2];t.fillRect(0,y,c.width,sw)}}
  else if(key==='agua'){t.strokeStyle='rgba(255,255,255,.35)';t.lineWidth=1;for(let y=6;y<c.height;y+=12){t.beginPath();t.moveTo(0,y);for(let x=0;x<=c.width;x+=8)t.lineTo(x,y+Math.sin(x/8)*2);t.stroke()}}
  else{for(let i=0;i<c.width*c.height/30;i++){t.fillStyle=P[1+(rnd()>.5?1:0)];t.fillRect(rnd()*c.width,rnd()*c.height,2,2)}}
  return c;
}
const texMat=(key,w,d)=>new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(texCanvas(key,w,d))});
function slab(w,d,key,h,y,fallback){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),key?texMat(key,w,d):mat(fallback||0x9a9a9a));m.position.set(0,y+h/2,0);m.receiveShadow=true;return m}
function elementMesh(o){
  const g=new THREE.Group(),w=o.w,d=o.d;let top=1.2;
  const flat=o.t==='zona'||(o.t==='otro'&&o.solid===false);
  if(flat){g.add(slab(w,d,o.tex,.06,0));top=.1}
  else if(o.t==='arbol'){const k=Math.max(w,d)/1.6;g.add(cyl(.22*k,.28*k,1.6*k,0x7a5230,0,0,0,10));const cr=new THREE.Mesh(new THREE.SphereGeometry(1.2*k,14,10),mat(0x2f8f4e));cr.position.y=2.6*k;cr.castShadow=true;g.add(cr);top=3.8*k}
  else if(ELEM[o.t]){const [h,wc,rc]=ELEM[o.t];g.add(box(w,h,d,wc));g.add(box(w+.6,.4,d+.6,rc,0,h,0));top=h+.4}
  else if(o.t==='piscina'){g.add(box(w,.5,d,0xeeeeee));g.add(box(Math.max(.1,w-.4),.05,Math.max(.1,d-.4),0x4fb3ff,0,.48,0));top=.6}
  else{g.add(o.tex?slab(w,d,o.tex,1.2,0):box(w,1.2,d,0x9a9a9a))}
  if(o.tex&&!flat&&o.t!=='arbol'&&o.t!=='otro')g.add(slab(w+.4,d+.4,o.tex,.04,0));
  g.position.set(o.x,0,o.z);g.rotation.y=-o.r;
  if(o.t!=='arbol'&&o.name){const l=makeLabel(o.name);l.position.set(o.x,top+1.4,o.z);g.userData.label=l}
  return g;
}
function buildTerrain(){
  const proc=new THREE.Group();   // todo lo "dibujado por código"; se oculta si hay un modelo 3D real del terreno
  const gm=new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(groundCanvas())});
  ground=new THREE.Mesh(new THREE.PlaneGeometry(TERR.w,TERR.d),gm);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;proc.add(ground);
  const out=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(90,TERR.w*3),Math.max(70,TERR.d*3.5)),new THREE.MeshLambertMaterial({color:0xd8c9a3}));out.rotation.x=-Math.PI/2;out.position.y=-.02;proc.add(out);
  if(TERR.photo){   // foto aérea: la parte de arriba de la foto es el fondo del terreno y la de abajo es la entrada
    const ld=new THREE.TextureLoader();if(ld.setCrossOrigin)ld.setCrossOrigin('anonymous');
    ld.load(TERR.photo,tex=>{if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;gm.map=tex;gm.needsUpdate=true;render()},undefined,()=>console.warn('No se pudo cargar la foto aérea del terreno'));
  }
  if(TERR.fence){   // cerco con entrada al frente (4 m de portón)
    const fc=0xffffff,W=TERR.w,D=TERR.d,half=Math.max(.5,W/2-2);
    proc.add(box(W,.9,.12,fc,0,0,-D/2));proc.add(box(.12,.9,D,fc,-W/2,0,0));proc.add(box(.12,.9,D,fc,W/2,0,0));
    proc.add(box(half,.9,.12,fc,-(W/2-half/2),0,D/2));proc.add(box(half,.9,.12,fc,(W/2-half/2),0,D/2));
    const lb=makeLabel('ENTRADA');lb.position.set(0,1.6,D/2+.6);proc.add(lb);
  }
  OBST.forEach(o=>{const m=elementMesh(o);proc.add(m);if(m.userData.label)proc.add(m.userData.label)});
  scene.add(proc);
  if(TERR.model){   // modelo 3D real del terreno (escaneo): reemplaza al terreno dibujado por código
    loadModel(TERR.model).then(src=>{
      const m=src.clone(true);m.traverse(o=>{if(o.isMesh){o.receiveShadow=true}});m.updateMatrixWorld(true);
      const b=new THREE.Box3().setFromObject(m),f=DK.fitGLB([b.min.x,b.min.y,b.min.z],[b.max.x,b.max.y,b.max.z],TERR.modelRot||0,TERR.w,TERR.d);
      if(!f)return;const holder=new THREE.Group();holder.add(m);holder.rotation.y=(TERR.modelRot||0)*Math.PI/180;holder.scale.setScalar(f.scale);holder.position.set(f.pos[0],f.pos[1],f.pos[2]);
      scene.add(holder);proc.visible=false;render();
    }).catch(e=>console.warn('No se pudo cargar el modelo 3D del terreno',e));
  }
}
function initScene(){
  const stage=$('#stage'),cv=$('#cv');
  if(!THREE_OK){stage.innerHTML='<p style="padding:24px">No se pudo cargar el motor 3D. Revisa tu conexión y recarga la página.</p>';return}
  // la cámara y los límites de zoom se ajustan al tamaño del terreno
  CAM_K=Math.max(.5,Math.max(TERR.w*1.1,TERR.d*1.7)/34);CAM_MIN=14*CAM_K;CAM_MAX=60*CAM_K;
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;
  scene=new THREE.Scene();scene.background=new THREE.Color(0xcfe8ff);
  camera=new THREE.PerspectiveCamera(45,1,.1,200*CAM_K);
  scene.add(new THREE.HemisphereLight(0xffffff,0x88aa88,.85));
  const sun=new THREE.DirectionalLight(0xffffff,.65);sun.position.set(-12*CAM_K,24*CAM_K,10*CAM_K);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-TERR.w/2-5,right:TERR.w/2+5,top:TERR.d/2+6,bottom:-TERR.d/2-6,near:1,far:70*CAM_K});sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  buildTerrain();
  raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  bindStage(cv);
  new ResizeObserver(()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render()}).observe(stage);
}
function corners(x,z,w,d,r){const c=Math.cos(r),s=Math.sin(r),hw=w/2,hd=d/2;return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([a,b])=>[x+a*c+b*s,z-a*s+b*c])}
function sat(A,B){for(const P of [A,B]){for(let i=0;i<4;i++){const p=P[i],q=P[(i+1)%4],ax=-(q[1]-p[1]),az=q[0]-p[0];let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;A.forEach(v=>{const t=v[0]*ax+v[1]*az;a0=Math.min(a0,t);a1=Math.max(a1,t)});B.forEach(v=>{const t=v[0]*ax+v[1]*az;b0=Math.min(b0,t);b1=Math.max(b1,t)});if(a1<=b0+.02||b1<=a0+.02)return false}}return true}
function boundsOK(x,z,w,d,r){const c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));return Math.abs(x)+(c*w+s*d)/2<=TERR.w/2-.15&&Math.abs(z)+(s*w+c*d)/2<=TERR.d/2-.15}
function collides(x,z,it,r,skip){const A=corners(x,z,it.w,it.d,r);
  for(const o of OBST)if(o.solid!==false&&sat(A,corners(o.x,o.z,o.w,o.d,o.r)))return true;
  for(const p of S.placed){if(p.uid===skip)continue;const q=byId(p.id);if(sat(A,corners(p.x,p.z,q.w,q.d,p.rot)))return true}return false}
function validAt(x,z,it,r,skip){return boundsOK(x,z,it.w,it.d,r)&&!collides(x,z,it,r,skip)}
function findSpot(it){const zm=Math.max(0,TERR.d/2-2),xm=Math.max(0,TERR.w/2-2);for(let z=-zm;z<=zm;z+=1){for(let x=-xm;x<=xm;x+=1){if(validAt(x,z,it,0,-1))return [x,z]}}return null}
function spawn(id,x,z,rot){
  const it=byId(id),g=THREE_OK?build(it):{position:{set(){}},rotation:{},userData:{}};g.position.set(x,0,z);g.rotation.y=-rot;
  const uid=S.uid++;g.userData.uid=uid;scene&&scene.add(g);
  S.placed.push({uid,id,x,z,rot,mesh:g});return uid;
}
function addItem(id){
  const it=byId(id);
  if(countOf(id)>=avail(id,S.date,S.slot)){toast('No quedan más "'+it.name+'" para esa fecha y franja');return false}
  const sp=findSpot(it);if(!sp){toast('No hay espacio libre en el terreno');return false}
  const uid=spawn(id,sp[0],sp[1],0);select(uid);refreshAll();return true;
}
function addDom(id){const it=byId(id);if((S.qty[id]||0)>=avail(id,S.date,S.slot)){toast('No quedan más "'+it.name+'" para esa fecha y franja');return false}S.qty[id]=(S.qty[id]||0)+1;refreshAll();return true}
function removeUid(uid){const i=S.placed.findIndex(p=>p.uid===uid);if(i<0)return;scene&&scene.remove(S.placed[i].mesh);S.placed.splice(i,1);if(S.sel===uid)S.sel=null;refreshAll()}
function select(uid){if(S.sel){const o=S.placed.find(p=>p.uid===S.sel);o&&setEmissive(o.mesh,0)}S.sel=uid;if(uid){const o=S.placed.find(p=>p.uid===uid);setEmissive(o.mesh,0x444422)}
  const o=S.placed.find(p=>p.uid===S.sel);$('#selName').textContent=o?byId(o.id).name:'Ninguno';['#rotL','#rotR','#delSel'].forEach(s=>$(s).disabled=!o);render()}
function rotateSel(dir){const o=S.placed.find(p=>p.uid===S.sel);if(!o)return;const it=byId(o.id);let r=o.rot+dir*Math.PI/4;
  if(validAt(o.x,o.z,it,r,o.uid)){o.rot=r;o.mesh.rotation.y=-r;render()}else toast('No hay espacio para girar aquí')}
function bindStage(cv){
  const ptrs=new Map();let mode=null,drag=null,last=null,pinch=0;
  const ndc=e=>{const r=cv.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1)};
  const groundPt=e=>{ndc(e);raycaster.setFromCamera(mouse,camera);const v=new THREE.Vector3();return raycaster.ray.intersectPlane(groundPlane,v)?v:null};
  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===2){mode='pinch';const [a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);return}
    ndc(e);raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(S.placed.map(p=>p.mesh),true);
    if(hits.length){let o=hits[0].object;while(o&&o.userData.uid==null)o=o.parent;const p=S.placed.find(q=>q.uid===o.userData.uid);select(p.uid);const gp=groundPt(e);drag={p,ox:gp?p.x-gp.x:0,oz:gp?p.z-gp.z:0};mode='drag';cv.classList.add('dragging')}
    else{select(null);mode='orbit';last={x:e.clientX,y:e.clientY}}
  });
  cv.addEventListener('pointermove',e=>{
    if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(mode==='pinch'&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);zoomTo(cam.r*pinch/d);pinch=d;render();return}
    if(mode==='orbit'){cam.theta-=(e.clientX-last.x)*.006;cam.phi=Math.min(1.35,Math.max(.12,cam.phi-(e.clientY-last.y)*.006));last={x:e.clientX,y:e.clientY};render()}
    else if(mode==='drag'&&drag){const gp=groundPt(e);if(!gp)return;const it=byId(drag.p.id);let nx=gp.x+drag.ox,nz=gp.z+drag.oz;
      if(validAt(nx,nz,it,drag.p.rot,drag.p.uid)){drag.p.x=nx;drag.p.z=nz;drag.p.mesh.position.set(nx,0,nz);setEmissive(drag.p.mesh,0x444422);warnHud(false)}
      else if(validAt(nx,drag.p.z,it,drag.p.rot,drag.p.uid)){drag.p.x=nx;drag.p.mesh.position.x=nx}
      else if(validAt(drag.p.x,nz,it,drag.p.rot,drag.p.uid)){drag.p.z=nz;drag.p.mesh.position.z=nz}
      else{setEmissive(drag.p.mesh,0x8a0000);warnHud(true)}
      render()}
  });
  const end=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2&&mode==='pinch')mode=null;if(mode==='drag'||mode==='orbit'){if(drag){setEmissive(drag.p.mesh,S.sel===drag.p.uid?0x444422:0)}mode=null;drag=null;warnHud(false);cv.classList.remove('dragging');refreshCart()}render()};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  // Solo hace zoom con el pellizco del mousepad o Ctrl + rueda (ambos llegan con ctrlKey). La rueda normal desplaza la página.
  cv.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoomTo(cam.r*(1+Math.max(-.2,Math.min(.2,e.deltaY*.01))));render()},{passive:false});
}
function warnHud(on){const w=$('#hudWarn');w.hidden=!on;w.textContent='Ahí no cabe: choca o sale del cerco'}
function camPreset(k){const p={aerea:[0,.2,36],tres:[.5,.8,34],entrada:[0,1.05,26]}[k];Object.assign(cam,{theta:p[0],phi:p[1],r:p[2]*CAM_K});render()}
function renderPalette(){
  const p=$('#pal');p.innerHTML='';
  DESIGN.forEach(it=>{
    const n=countOf(it.id),l=avail(it.id,S.date,S.slot);
    const r=document.createElement('div');r.className='it num';
    r.innerHTML=`<span class="sw" style="background:#${it.color.toString(16).padStart(6,'0')}"></span><span>${esc(it.name)}<br><span class="note">${CLP(it.price)} · ${l} disp.</span></span><button class="qtybtn" data-m="${it.id}" aria-label="Quitar ${esc(it.name)}" ${n?'':'disabled'}>−</button><span><b>${n}</b> <button class="qtybtn" data-p="${it.id}" aria-label="Agregar ${esc(it.name)}" ${n>=l?'disabled':''}>+</button></span>`;
    p.appendChild(r);
  });
  $$('[data-p]').forEach(b=>b.onclick=()=>addItem(b.dataset.p));
  $$('[data-m]').forEach(b=>b.onclick=()=>{const l=[...S.placed].reverse().find(q=>q.id===b.dataset.m);l&&removeUid(l.uid)});
}

/* ---------- cotización ---------- */
function quote(){
  const lines=[];
  if(S.modo==='parcela'&&S.parcela){const p=byId('parcela');lines.push({id:'parcela',name:p.name,qty:1,unit:p.price,sub:p.price})}
  dsgn().forEach(it=>{const q=countOf(it.id);if(q)lines.push({id:it.id,name:it.name,qty:q,unit:it.price,sub:it.price*q})});
  if(S.modo==='domicilio'){const z=ZONAS.find(z=>z.id===S.zona);if(z&&lines.length)lines.push({id:'flete',name:'Despacho, montaje y retiro · '+z.nombre,qty:1,unit:z.precio,sub:z.precio})}
  const total=lines.reduce((a,l)=>a+l.sub,0);return {lines,total,abono:Math.round(total*.3)}
}
function issues(){
  const out=[];
  if(!slotFree(S.date,S.slot))out.push(S.modo==='domicilio'?'Esa franja no tiene servicios disponibles. Cambia de fecha o de franja.':'La parcela está ocupada en la franja elegida. Cambia de fecha o de franja.');
  dsgn().forEach(it=>{const q=countOf(it.id),l=avail(it.id,S.date,S.slot);if(q>l)out.push(`${it.name}: tienes ${q} y solo hay ${l} disponible${l===1?'':'s'} para esa fecha.`)});
  if(!quote().lines.length)out.push(S.modo==='domicilio'?'Tu cotización está vacía. Agrega servicios desde el catálogo.':'Tu cotización está vacía. Agrega servicios desde el catálogo o el simulador.');
  if(S.modo==='domicilio'){
    if(!S.zona)out.push('Elige la zona de despacho para calcular el costo.');
    const L=readLugar();if(+L.ancho>0&&+L.largo>0)DK.siteChecks(L,S.qty).issues.forEach(t=>out.push(t));
  }
  return out;
}
function refreshCart(){
  const q=quote(),n=q.lines.reduce((a,l)=>a+l.qty,0);
  $('#cartpill').textContent=`${n} ítem${n===1?'':'s'} · ${CLP(q.total)}`;
  if($('#qmeta')){
  $('#qmeta').textContent=`${fmtDate(S.date)} · ${SLOTS[S.slot].n} (${SLOTS[S.slot].h})`;
  $('#qlines').innerHTML=q.lines.length?q.lines.map(l=>`<li><span>${esc(l.name)}${l.qty>1?` <span class="muted">× ${l.qty}</span>`:''}</span><span>${CLP(l.sub)}</span></li>`).join(''):'<li><span class="muted">Sin servicios todavía</span><span></span></li>';
  $('#qtotal').textContent=CLP(q.total);$('#qabono').textContent=CLP(q.abono);
  const is=issues();$('#issues').innerHTML=is.map(t=>`<p>${esc(t)}</p>`).join('');
  $('#payBtn').disabled=is.length>0;}
  if($('#siteWarns')){const L=readLugar(),w=S.modo==='domicilio'?DK.siteChecks(L,S.qty).warns:[];$('#siteWarns').innerHTML=w.map(t=>`<p>${esc(t)}</p>`).join('');$('#siteWarns').hidden=!w.length}
  $('#hudInfo').textContent=`${S.placed.length} objeto${S.placed.length===1?'':'s'} en el terreno · ${CLP(q.total)}`;
}

/* ---------- pago y reserva ---------- */
let lastRes=null;
$('#clientForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#formErr');err.hidden=true;
  const n=$('#cName').value.trim(),m=$('#cMail').value.trim(),t=$('#cPhone').value.trim(),g=+$('#cGuests').value;
  if(n.length<3||!/^\S+@\S+\.\S+$/.test(m)||t.replace(/\D/g,'').length<8||!(g>0)){err.textContent='Revisa tus datos: nombre, un correo válido, un teléfono de al menos 8 dígitos y la cantidad de invitados.';err.hidden=false;return}
  const kid=$('#cKid').value.trim(),kb=$('#cKidBirth').value;
  if(kid.length<2){err.textContent='Escribe el nombre del niño o niña cumpleañero/a.';err.hidden=false;return}
  if(!kb||parseISO(kb)>today||parseISO(kb)<new Date(today.getFullYear()-25,today.getMonth(),today.getDate())){err.textContent='Indica la fecha de nacimiento del niño o niña (la usamos para saludarlo en su cumpleaños).';err.hidden=false;return}
  if(!$('#cConsent').checked){err.textContent='Para reservar debes aceptar que guardemos los datos.';err.hidden=false;return}
  if(S.modo==='domicilio'){const L=readLugar(),bad=!S.zona?'Elige la zona de despacho.':String(L.direccion).trim().length<5?'Escribe la dirección completa donde se montarán los juegos.':!L.suelo?'Indica el tipo de suelo del lugar.':!(+L.ancho>=1&&+L.largo>=1)?'Indica el ancho y el largo del espacio disponible, en metros.':!L.luz?'Indica si hay un enchufe de 220 V cerca.':!L.agua?'Indica si hay agua cerca.':'';
    if(bad){err.textContent=bad;err.hidden=false;return}}
  if(issues().length){return}
  $('#payAmt').textContent=CLP(quote().abono);$('#payMsg').hidden=true;$('#payGo').disabled=false;$('#payOv').hidden=false;$('#payGo').focus();
});
$('#payCancel').onclick=()=>$('#payOv').hidden=true;
$('#payGo').onclick=async()=>{
  const msg=$('#payMsg'),go=$('#payGo');msg.hidden=false;msg.style.color='var(--muted)';
  const online=API.online;
  const num=$('#cardN').value.replace(/\D/g,'');
  if(!online&&num.length!==16){msg.style.color='var(--bad)';msg.textContent='El número de tarjeta debe tener 16 dígitos.';return}
  go.disabled=true;
  if(online)msg.innerHTML='<span class="spin"></span> Reservando tu cupo y preparando el pago…';
  else{msg.innerHTML='<span class="spin"></span> Procesando pago en el ambiente de pruebas…';await new Promise(r=>setTimeout(r,1400));
    if(num==='4000000000000002'){msg.style.color='var(--bad)';msg.textContent='Pago rechazado por el banco emisor. No se hizo ningún cargo. Prueba con otra tarjeta.';go.disabled=false;return}}
  if(issues().length){msg.style.color='var(--bad)';msg.textContent='Mientras pagabas cambió la disponibilidad. Revisa tu cotización.';go.disabled=false;return}
  const q=quote(),items={};q.lines.forEach(l=>{if(l.id!=='parcela'&&l.id!=='flete')items[l.id]=l.qty});
  const client={name:$('#cName').value.trim(),email:$('#cMail').value.trim(),phone:$('#cPhone').value.trim(),guests:+$('#cGuests').value,kid:$('#cKid').value.trim(),kidBirth:$('#cKidBirth').value,consent:$('#cConsent').checked};
  const method=online?'Flow':document.querySelector('input[name=pm]:checked').value,txn=online?'':'TBK-'+Math.floor(Math.random()*9e8+1e8);
  const dom=S.modo==='domicilio',lugar=dom?readLugar():null;
  const layout=dom?[]:S.placed.map(p=>({id:p.id,x:p.x,z:p.z,rot:p.rot}));
  try{
    const res=await API.createReservation({date:S.date,slot:S.slot,client,items,parcela:dom?false:S.parcela,layout,method,txn,online,modalidad:S.modo,lugar,zona:dom?S.zona:''});
    if(online){
      // el cupo ya quedó guardado; ahora se lleva al cliente a pagar a Flow
      const url=await API.startPayment(res.folio,res.codigo);
      msg.innerHTML='<span class="spin"></span> Redirigiendo a Flow…';
      location.href=url;return;
    }
    const r={id:res.folio,date:S.date,slot:S.slot,client,items,parcela:dom?false:S.parcela,modalidad:S.modo,lugar,status:res.estado,total:res.total,abono:res.abono,method,txn,layout};
    DB.res.push({date:r.date,slot:r.slot,items,parcela:r.parcela,status:r.status});
    lastRes=r;$('#payOv').hidden=true;showDone(r);refreshAll();
  }catch(e){
    console.error(e);msg.style.color='var(--bad)';msg.textContent=(e&&e.message)||'No se pudo registrar la reserva. Intenta de nuevo.';go.disabled=false;
  }
};
/* Al volver desde Flow la dirección trae ?folio=...&c=... : se muestra el resultado del pago */
async function showReturn(folio,codigo){
  const area=$('#bookArea');
  const panel=h=>{area.innerHTML=`<div class="panel" style="grid-column:1/-1;display:grid;gap:14px;max-width:760px">${h}</div>`};
  const again='<div class="cta-row" style="margin:0"><a class="btn primary" href="index.html#fecha">Hacer otra reserva</a></div>';
  panel('<div style="display:flex;gap:14px;align-items:center"><span class="spin"></span><b>Confirmando tu pago…</b></div>');
  document.getElementById('reservar').scrollIntoView();
  let st=null;
  for(let i=0;i<8;i++){
    try{st=await API.reservationStatus(folio,codigo)}catch(e){console.error(e);break}
    if(!st||st.estado!=='por_pagar')break;
    await new Promise(r=>setTimeout(r,2500));   // la confirmación de Flow puede tardar unos segundos
  }
  if(!st)return panel('<h3>No encontramos esa reserva</h3><p class="muted">Revisa el enlace o escríbenos y la buscamos con tu folio.</p>'+again);
  const cuando=`${fmtDate(st.fecha)}, franja ${SLOTS[st.franja]?SLOTS[st.franja].n.toLowerCase():st.franja}`;
  if(st.estado==='confirmada'||st.estado==='finalizada')
    return panel(`<div style="display:flex;gap:16px;align-items:center"><div class="okmark">✓</div><div><h3>¡Pago recibido! Reserva ${esc(st.folio)} confirmada</h3><p class="muted">Abono de ${CLP(st.abono)} pagado con Flow. Tu fiesta quedó reservada para el ${cuando}. El saldo de ${CLP(st.total-st.abono)} se paga el día del evento.</p></div></div>`+again);
  if(st.estado==='pendiente')
    return panel(`<h3>Recibimos tu pago, reserva ${esc(st.folio)}</h3><p class="muted">El equipo debe revisar un detalle de tu reserva antes de confirmarla. Te contactaremos pronto.</p>`+again);
  if(st.estado==='por_pagar')
    return panel(`<h3>Aún no vemos tu pago, reserva ${esc(st.folio)}</h3><p class="muted">Si ya pagaste, la confirmación puede tardar unos minutos: recarga esta página en un rato. Tu cupo se guarda hasta que venza el plazo de pago.</p>`);
  panel(`<h3>El pago no se completó</h3><p class="muted">Tu reserva ${esc(st.folio)} no quedó confirmada y el cupo se liberó. No se cobró nada si cancelaste el pago. Puedes intentarlo de nuevo.</p>`+again);
}
function showDone(r){
  const items=Object.entries(r.items).map(([k,v])=>`• ${byId(k).name} × ${v}`).join('\n');
  $('#bookArea').innerHTML=`<div class="panel" style="grid-column:1/-1;display:grid;gap:16px;max-width:760px">
    <div style="display:flex;gap:16px;align-items:center"><div class="okmark">✓</div><div><h3>Reserva ${r.id} ${r.status==='confirmada'?'confirmada':'recibida'}</h3><p class="muted">Abono de ${CLP(r.abono)} recibido con ${esc(r.method)} (operación ${r.txn}, ambiente de pruebas).</p></div></div>
    ${r.status!=='confirmada'?'<p class="note" style="font-weight:600">Tu reserva queda pendiente hasta que el equipo valide el abono. Te avisaremos por correo.</p>':''}<p class="eyebrow">Vista previa del correo de confirmación (no se envía en esta demo)</p>
    <div class="mail">Para: ${esc(r.client.email)}\nAsunto: Reserva ${r.id} confirmada, ${fmtDate(r.date)}\n\nHola ${esc(r.client.name)},\ntu fiesta quedó reservada para el ${fmtDate(r.date)}, franja ${SLOTS[r.slot].n.toLowerCase()} (${SLOTS[r.slot].h}).\n\n${r.parcela?'• Arriendo de la parcela\n':''}${r.modalidad==='domicilio'&&r.lugar?'• Servicio a domicilio en '+esc(r.lugar.direccion)+' (despacho, montaje y retiro incluidos)\n':''}${esc(items)}\n\nTotal: ${CLP(r.total)}\nAbono pagado: ${CLP(r.abono)}\nSaldo para el día del evento: ${CLP(r.total-r.abono)}\n\n${r.modalidad==='domicilio'?'Los datos de tu lugar quedaron guardados: el equipo los revisará y te contactará si necesita confirmar algo.':'Tu distribución 3D quedó guardada y el equipo la verá en su panel.'}</div>
    <div class="cta-row" style="margin:0"><button class="btn primary" id="again">Hacer otra reserva</button></div></div>`;
  $('#again').onclick=()=>location.reload();
  document.getElementById('reservar').scrollIntoView({behavior:'smooth'});
}

/* ---------- chatbot ---------- */
const NEG=window.DK_NEGOCIO||{};
const waNum=String(NEG.whatsapp||'').replace(/\D/g,'')||'56900000000';
const waLink=`<a href="https://wa.me/${waNum}" target="_blank" rel="noopener">escribirnos por WhatsApp</a>${NEG.whatsappVisible?' ('+esc(NEG.whatsappVisible)+')':''}`;
const norm=t=>String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
// respuesta configurable: si el dueño la escribió en config.js se usa; si no, se deriva a una persona
const cfgAns=(k,intro)=>NEG[k]?`${intro?intro+' ':''}${esc(NEG[k])}`:`${intro?intro+' ':''}Eso lo confirma una persona del equipo: puedes ${waLink}.`;
function priceList(cat){return CAT.filter(i=>i.id!=='parcela'&&(!cat||i.cat===cat)).map(i=>`${esc(i.name)}: <b>${CLP(i.price)}</b>`).join('<br>')}
function parseDate(t){
  t=norm(t);
  let m=t.match(/(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);let d,mo;
  if(m){d=+m[1];mo=MESES.indexOf(m[2]==='setiembre'?'septiembre':m[2])}
  else{m=t.match(/(\d{1,2})\/(\d{1,2})/);if(!m)return null;d=+m[1];mo=+m[2]-1}
  if(mo<0||mo>11||d<1||d>31)return null;let y=today.getFullYear();let dt=new Date(y,mo,d);if(dt<=today)dt=new Date(y+1,mo,d);if(dt.getMonth()!==mo)return null;return dt;
}
function availAnswer(dt){
  const ds=iso(dt);if(blockedDay(ds))return `El ${fmtDate(ds)} la parcela está bloqueada. ¿Te sirve otra fecha?`;
  const fr=Object.keys(SLOTS).filter(s=>slotFree(ds,s));
  if(!fr.length)return `El ${fmtDate(ds)} no queda ninguna franja libre. Prueba con otra fecha en la sección <a href="#fecha">Fecha</a>.`;
  const low=DESIGN.filter(i=>avail(i.id,ds,fr[0])===0).map(i=>i.name);
  return `El ${fmtDate(ds)} hay parcela libre en: <b>${fr.map(s=>SLOTS[s].n+' ('+SLOTS[s].h+')').join(' y ')}</b>.`+(low.length?`<br>Sin stock esa fecha: ${low.join(', ')}.`:'')+`<br><a href="#fecha" data-pick="${ds}">Elegir esta fecha</a>`;
}
// servicios nombrados en la pregunta (por palabras del nombre: "castillo", "tobogan", "piscina"...)
function itemsIn(q){return DESIGN.filter(i=>norm(i.name).split(/\s+/).some(w=>w.length>3&&!['maquina','mesa','chica','grande','azucar'].includes(w)&&q.includes(w.replace(/s$/,''))))}
// Cada intención: [id, expresión sobre el texto sin tildes, respuesta]. El orden importa: lo más específico va primero.
const FAQ=[
 ['domicilio',/(domicilio|a mi casa|en mi casa|fuera de la parcela|despacho|flete|delivery|llevan (los )?juegos|llevar (los )?juegos)/,()=>`Sí, también arrendamos juegos y servicios <b>a domicilio</b>: los llevamos, montamos y retiramos en tu casa o local.${ZONAS.length?'<br>Despacho por zona: '+ZONAS.map(z=>`${esc(z.nombre)} <b>${CLP(z.precio)}</b>`).join(' · ')+'.':''}<br>Elige <a href="#modo">"En tu casa o local"</a>, cuéntanos el suelo y las medidas del espacio, y revisamos si caben.`],
 ['cancelacion',/(cancel|devol|reembols|cambiar (la )?fecha|cambio de fecha|modificar|reprogram|anular|arrepent)/,()=>cfgAns('cancelacion','Sobre cambios, cancelaciones y devoluciones:')],
 ['stock',/(cuantos|cuantas|que cantidad|unidades|hay mas|tienen mas|quedan)/,q=>{const it=itemsIn(q);if(!it.length)return null;return 'Unidades en total:<br>'+it.map(i=>`${esc(i.name)}: <b>${i.stock}</b>`).join('<br>')+'<br>Cuántas quedan libres depende de la fecha: dime el día (por ejemplo "25 de octubre") y lo reviso.'}],
 ['estado_reserva',/(mi reserva|estado de (mi|la) reserva|folio|ya pague|confirmaron|me llego|comprobante)/,()=>`Con tu folio (por ejemplo R-1006) una persona del equipo revisa el estado de tu reserva: puedes ${waLink}. Si pagaste en línea, al volver desde Flow ves la confirmación en la página.`],
 ['montaje',/(montaj|instal|armar|retir[ao]|cuando llegan|a que hora (llegan|montan)|desmont)/,()=>cfgAns('montaje','Montaje y retiro:')],
 ['electricidad',/(electric|enchuf|corriente|luz|generador|agua para|manguera|conexion)/,()=>cfgAns('electricidad','Requisitos de electricidad y agua:')],
 ['boleta',/(boleta|factura|rut|comprobante de pago|documento tributario)/,()=>cfgAns('boleta','Boleta o factura:')],
 ['edades',/(\bedad|\banos\b|seguridad|supervis|\bbebes?\b|adolescente|riesgo|seguro de)/,()=>cfgAns('edades','Edades y seguridad:')],
 ['comida_propia',/(torta|comida propia|llevar (comida|torta|bebida)|traer (comida|torta)|musica|parlante|decoraci|alcohol|mascota)/,()=>cfgAns('comidaPropia','Sobre llevar torta, comida, música o decoración:')],
 ['descuentos',/(descuento|promo|oferta|rebaja|paquete|combo|mas barato|convenio)/,()=>cfgAns('descuentos','Descuentos y promociones:')],
 ['capacidad',/(cuantos ninos|capacidad|maximo de (personas|invitados|ninos)|cuantas personas|cuantos invitados|caben|numero de invitados|aforo)/,()=>`La parcela mide 30 × 20 m con cerco y quincho. En la reserva puedes indicar hasta <b>200 invitados</b>; en el <a href="#simulador">simulador 3D</a> ves cuánto espacio queda libre según los juegos que elijas. Para eventos grandes, conviene conversar con el equipo: puedes ${waLink}.`],
 ['saldo',/(saldo|resto del (pago|dinero)|lo que falta|el dia del evento|pagar despues|70 ?%)/,()=>'El abono es el <b>30%</b> del total y se paga en línea para confirmar. El <b>70% restante</b> (el saldo) se paga el día del evento.'],
 ['pago',/(pag[ao]r?|abono|tarjeta|credito|debito|transferencia|webpay|flow|mercado ?pago|medios? de pago|formas? de pago|efectivo)/,()=>'Se paga un abono del <b>30%</b> en línea'+(API.online?' a través de <b>Flow</b>, que acepta tarjetas y otros medios habilitados.':' (Webpay Plus, Flow o Mercado Pago).')+' El saldo se paga el día del evento.'],
 ['ubicacion',/(ubicaci|donde (estan|queda|es)|direcci|llegar|como llego|mapa|azapa|arica|sector)/,()=>NEG.direccion?`Estamos en ${esc(NEG.direccion)}. También puedes ${waLink}.`:'Estamos en el valle de Azapa, Arica. Te enviamos la dirección exacta y cómo llegar al confirmar la reserva.'],
 ['precios',/(precio|cuanto (cuesta|sale|vale|cobran)|valor|cuesta|tarifa|cotiz|presupuesto|costo)/,q=>{const it=itemsIn(q);if(it.length)return it.map(i=>`${esc(i.name)}: <b>${CLP(i.price)}</b> por evento`).join('<br>')+'<br>Tu cotización exacta aparece en <a href="#reservar">Reservar</a>.';return 'Precios por evento:<br>'+priceList()+`<br>Parcela: <b>${CLP((byId('parcela')||{price:0}).price)}</b>. Tu cotización exacta aparece en <a href="#reservar">Reservar</a>.`}],
 ['incluye_parcela',/(parcela|recinto|local|espacio|quincho|cerco|incluye|arbol|estacionamiento|ba(n|ñ)os?)/,()=>`La parcela mide 30 × 20 m (medida referencial) y tiene cerco, quincho y árboles. Arriendo: <b>${CLP((byId('parcela')||{price:0}).price)}</b> por evento. Los juegos y máquinas se arriendan aparte.`],
 ['inflables',/(inflable|castillo|tobog|cancha|salto)/,()=>'Inflables:<br>'+priceList('juegos').split('<br>').filter(l=>/inflable|castillo|tobog|cancha/i.test(l)).join('<br>')+'<br>Puedes ver cómo caben en la parcela en el <a href="#simulador">simulador 3D</a>.'],
 ['juegos',/(taca|ping|pong|juego|entreten|mesa)/,()=>'Juegos y entretención:<br>'+priceList('juegos')],
 ['comida',/(papas|algod|completo|comida|maquina|hot ?dog|dulce|snack)/,()=>'Máquinas de alimentos:<br>'+priceList('comida')],
 ['piscinas',/(piscina|agua|pileta|chapotear)/,()=>'Piscinas:<br>'+priceList('piscinas')],
 ['horario_atencion',/(horario de atencion|atienden|abierto|cuando (puedo )?(llamar|escribir)|dias de atencion|atencion)/,()=>NEG.atencion?`Atendemos: ${esc(NEG.atencion)}. También puedes ${waLink}.`:`Para saber cuándo atiende el equipo, puedes ${waLink}.`],
 ['horario_franjas',/(franja|turno|a que hora|hora del evento|cuanto dura|duracion|manana o tarde|horarios?)/,()=>`Hay dos franjas por día: <b>Mañana ${SLOTS.manana.h}</b> y <b>Tarde ${SLOTS.tarde.h}</b>.`],
 ['simulador',/(3d|simulador|distribu|mover|arrastr|disenar|diseno)/,()=>'En el <a href="#simulador">simulador 3D</a> arrastras los juegos por el terreno, los giras y ves si caben. Lo que dejes ahí pasa directo a tu cotización.'],
 ['reservar',/(reserv|arrend|contrat|como (hago|funciona|se hace)|pasos|quiero (hacer|organizar)|agendar)/,()=>'Para reservar: 1) elige la fecha, 2) arma tu distribución en el <a href="#simulador">simulador 3D</a>, 3) revisa la cotización y 4) paga el abono en <a href="#reservar">Reservar</a>.'],
 ['contacto',/(humano|persona|whatsapp|contacto|telefono|ejecutiv|llamar|correo|email|mail|hablar con)/,()=>`Te derivo con el equipo: puedes ${waLink}${NEG.correo?` o escribir a ${esc(NEG.correo)}`:''}.`],
 ['disponibilidad_sin_fecha',/(disponib|libre|queda|ocupad|fecha|dia)/,()=>'Dime la fecha (por ejemplo "25 de octubre" o "25/10") y te digo qué hay disponible.'],
 ['gracias',/(gracias|genial|perfecto|listo|excelente|buenisimo|ok\b)/,()=>'¡De nada! Si necesitas algo más, aquí estoy.'],
 ['despedida',/(chao|adios|hasta luego|nos vemos|bye)/,()=>'¡Hasta pronto! Cuando quieras armar tu fiesta, aquí estaré.'],
 ['saludo',/(hola|buenas|buen dia|buenos dias|hey|holi|saludos)/,()=>'¡Hola! Soy el asistente de Divertí Kids. Puedo ayudarte con precios, disponibilidad por fecha, ubicación y cómo reservar.']
];
const chatEl=$('#chat'),msgs=$('#msgs');
function say(html,who,intent){const m=document.createElement('div');m.className='m '+who;if(intent)m.dataset.intent=intent;if(who==='me')m.textContent=html;else m.innerHTML=html;msgs.appendChild(m);msgs.scrollTop=msgs.scrollHeight;
  m.querySelectorAll('[data-pick]').forEach(a=>a.onclick=()=>{const d=parseISO(a.dataset.pick);S.date=a.dataset.pick;S.month=new Date(d.getFullYear(),d.getMonth(),1);if(!slotFree(S.date,S.slot))S.slot=Object.keys(SLOTS).find(s=>slotFree(S.date,s))||S.slot;refreshAll();chatEl.hidden=true;$('#chatFab').hidden=false});
  m.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{chatEl.hidden=true;$('#chatFab').hidden=false}))}
function ask(t){
  say(t,'me');const q=norm(t);
  setTimeout(()=>{
    let ans=null,intent='no_entendido';
    const dt=parseDate(q);
    if(dt&&!/precio|cuanto (cuesta|sale|vale)|valor/.test(q)){ans=availAnswer(dt);intent='disponibilidad'}
    if(!ans)for(const [id,re,fn] of FAQ){if(re.test(q)){const a=fn(q);if(a){ans=a;intent=id;break}}}
    say(ans||`No estoy seguro de haber entendido. Prueba con precios, disponibilidad, ubicación o cómo reservar, o puedes ${waLink}.`,'bot',intent);
  },350);
}
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#chatIn').value.trim();if(!v)return;$('#chatIn').value='';ask(v)});
['Precios','¿Qué hay libre el sábado 31 de octubre?','Ubicación','Cómo reservar','Hablar con una persona'].forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.length>24?'Consultar una fecha':t;b.onclick=()=>ask(t);$('#chips').appendChild(b)});
$('#chatFab').onclick=()=>{chatEl.hidden=false;$('#chatFab').hidden=true;if(!msgs.children.length)say('¡Hola! Soy el asistente de Divertí Kids. Pregúntame por precios, disponibilidad de una fecha, ubicación o cómo reservar.','bot');$('#chatIn').focus()};
$('#chatX').onclick=()=>{chatEl.hidden=true;$('#chatFab').hidden=false};

/* ---------- modalidad: parcela o domicilio ---------- */
const LUGAR_IDS={tipo:'lTipo',direccion:'lDir',referencia:'lRef',suelo:'lSuelo',ancho:'lAncho',largo:'lLargo',alto:'lAlto',acceso:'lAcceso',nivel:'lNivel',luz:'lLuz',agua:'lAgua',pendiente:'lPend',obs:'lObs'};
function readLugar(){const o={};Object.entries(LUGAR_IDS).forEach(([k,id])=>{const e=document.getElementById(id);o[k]=e?e.value:''});['ancho','largo','alto','acceso'].forEach(k=>{if(o[k]!=='')o[k]=+o[k]});return o}
$('#lTipo').innerHTML=Object.entries(DK.TIPOS_LUGAR).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#lSuelo').innerHTML='<option value="">Elige…</option>'+Object.entries(DK.SUELOS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#lZona').innerHTML='<option value="">Elige tu zona…</option>'+ZONAS.map(z=>`<option value="${esc(z.id)}">${esc(z.nombre)} · ${CLP(z.precio)}</option>`).join('');
$('#lZona').onchange=()=>{S.zona=$('#lZona').value;refreshCart()};
Object.values(LUGAR_IDS).forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('input',refreshCart)});
function setModo(m){
  if(m==='domicilio'&&!ZONAS.length){toast('El servicio a domicilio aún no está habilitado. Escríbenos por WhatsApp.');return}
  S.modo=m;const dom=m==='domicilio';
  $$('[data-modo]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.modo===m));
  $('#simulador').hidden=dom;$('#navSim').hidden=dom;$('#lugarFs').hidden=!dom;
  $('#bookNote').textContent=dom?'La cotización sale de los servicios que elegiste más el despacho. El abono del 30% confirma la fecha.':'La cotización sale de lo que ubicaste en el terreno. El abono del 30% confirma la fecha.';
  if(!slotFree(S.date,S.slot))S.slot=Object.keys(SLOTS).find(s=>slotFree(S.date,s))||S.slot;
  refreshAll();
}
$$('[data-modo]').forEach(b=>b.onclick=()=>setModo(b.dataset.modo));
$('#modo').hidden=!ZONAS.length;
/* ---------- arranque ---------- */
function refreshAll(){
  // si la fecha/franja cambió, se descuenta lo que ya no está disponible
  renderCal();renderSlots();renderCatalog();renderPalette();refreshCart();
  const bad=dsgn().filter(i=>countOf(i.id)>avail(i.id,S.date,S.slot));
  $('#hudWarn').hidden=true;
  if(bad.length&&!lastRes)toast('Con esta fecha faltan: '+bad.map(i=>i.name).join(', ')+'. Revisa tu cotización.');
}
$('#prevM').onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()-1,1);renderCal()};
$('#nextM').onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()+1,1);renderCal()};
$$('[data-cam]').forEach(b=>b.onclick=()=>camPreset(b.dataset.cam));
$('#zin').onclick=()=>{zoomTo(cam.r*.85);render()};$('#zout').onclick=()=>{zoomTo(cam.r*1.18);render()};
$('#rotL').onclick=()=>rotateSel(1);$('#rotR').onclick=()=>rotateSel(-1);
$('#delSel').onclick=()=>S.sel&&removeUid(S.sel);
$('#clearAll').onclick=()=>{[...S.placed].forEach(p=>scene&&scene.remove(p.mesh));S.placed=[];select(null);refreshAll()};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='r'||e.key==='R')rotateSel(1);if((e.key==='Delete'||e.key==='Backspace')&&S.sel){e.preventDefault();removeUid(S.sel)}});

initScene();
if(API.online){ // pago real en Flow: se ocultan los campos de tarjeta de prueba
  ['#cardBlock','.sandbox:not(#onlineNote)'].forEach(q=>{const e=document.querySelector(q);if(e)e.hidden=true});
  $('#onlineNote').hidden=false;if((window.DK_CONFIG||{}).PAGO_PRUEBAS===false)$('#payNote').textContent='Pagos seguros con Flow.';$('#payGo').textContent='Ir a pagar a Flow';$('#payT').textContent='Pagar abono en línea';
}
if(THREE_OK){
  ['castillo','tacataca','papas','piscinaS','algodon'].forEach(id=>{const it=byId(id);if(!it)return;const sp=findSpot(it);if(sp)spawn(id,sp[0],sp[1],0)});
  // vista inicial del terreno
  Object.assign(cam,{theta:0.5,phi:0.85,r:34*CAM_K});
}
renderTabs();refreshAll();render();

/* ---------- redes, WhatsApp y ofertas ---------- */
{
  const N=window.DK_NEGOCIO||{};
  $$('[data-social]').forEach(l=>{const u=N[l.dataset.social];if(u)l.href=u;else l.hidden=true});
  const wa=DK.waUrl(N.whatsapp||'','Hola Divertí Kids, quiero consultar por una fiesta.');
  $$('[data-wa]').forEach(l=>{if(N.whatsapp)l.href=wa;else l.hidden=true});
  const offers=(data.ofertas||[]).filter(DK.offerActive);
  if(offers.length){
    $('#ofertas').hidden=false;$('#navOfertas').hidden=false;
    $('#offers').innerHTML=offers.map(o=>`<article class="offer"><h3>${esc(o.titulo)}</h3><p>${esc(o.texto)}</p>${o.hasta?`<p class="note">Válida hasta el ${fmtDate(o.hasta)}</p>`:''}<a class="btn sm primary" data-wa href="${DK.waUrl(N.whatsapp||'','Hola, me interesa la oferta: '+o.titulo)}" target="_blank" rel="noopener">Consultar por WhatsApp</a></article>`).join('');
  }
}

{const q=new URLSearchParams(location.search),f=q.get('folio'),c=q.get('c');
 if(f&&c){history.replaceState(null,'',location.pathname);showReturn(f,c)}}
})();
