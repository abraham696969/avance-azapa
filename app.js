(async function(){
'use strict';
const {$,$$,CLP,esc,pad,iso,parseISO,MESES,fmtDate,today,addDays,toast,CATS,SLOTS,CAT,byId,DESIGN,TERR,OBST,API}=DK;
/* ---------- datos desde la base (o modo demo) ---------- */
let data;
try{data=await API.loadPublic()}
catch(e){console.error(e);data={res:[],blocked:[],catalog:{}};setTimeout(()=>toast('No se pudo conectar con la base de datos. Revisa config.js.'),600)}
DK.applyCatalog(data.catalog);
const DB={res:data.res,blocked:data.blocked};

const S={cat:'todos',month:new Date(today.getFullYear(),today.getMonth(),1),date:null,slot:'tarde',parcela:true,placed:[],sel:null,uid:1};

/* ---------- disponibilidad ---------- */
const blockedDay=ds=>DB.blocked.some(b=>b.date===ds);
function used(id,ds,slot){let n=0;DB.res.forEach(r=>{if(r.date===ds&&r.slot===slot&&r.status!=='cancelada'){if(id==='parcela'){if(r.parcela)n++}else n+=r.items[id]||0}});return n}
function avail(id,ds,slot){if(blockedDay(ds))return 0;return Math.max(0,byId(id).stock-used(id,ds,slot))}
function slotFree(ds,slot){return avail('parcela',ds,slot)>0}
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
const countOf=id=>S.placed.filter(p=>p.id===id).length;
function renderCatalog(){
  const g=$('#catalog');g.innerHTML='';
  CAT.filter(i=>S.cat==='todos'||i.cat===S.cat).forEach(it=>{
    const el=document.createElement('article');el.className='card';
    const left=avail(it.id,S.date,S.slot);
    const inDesign=it.id==='parcela'?(S.parcela?1:0):countOf(it.id);
    const stockB=left===0?'<span class="badge bad">Sin disponibilidad</span>':`<span class="badge ${left<=1?'warn':'ok'}">${left} disponible${left>1?'s':''} esa fecha</span>`;
    el.innerHTML=`<div class="plan">${planSVG(it)}<small>${it.w} × ${it.d} m</small></div>
      <div class="body"><h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p>
      <div class="row"><span class="price num">${CLP(it.price)}<small> / evento</small></span>${stockB}</div>
      <div class="row"><span class="note">${inDesign?'En tu diseño: '+inDesign:'No está en tu diseño'}</span>
      <button class="btn sm primary" data-add="${it.id}" ${left===0?'disabled':''}>${it.id==='parcela'?(S.parcela?'Quitar':'Agregar'):'Agregar al terreno'}</button></div></div>`;
    g.appendChild(el);
  });
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
    case 'pool':
      g.add(cyl(w/2,w/2,h,0xeeeeee));const wt=cyl(w/2-.15,w/2-.15,h*.9,c,0,.05,0);g.add(wt);
      const wt2=new THREE.Mesh(new THREE.CircleGeometry(w/2-.15,32),new THREE.MeshLambertMaterial({color:0x7fd0ff}));wt2.rotation.x=-Math.PI/2;wt2.position.y=h+.01;g.add(wt2);break;
  }
  return g;
}
function setEmissive(g,hex){if(!g.traverse)return;g.traverse(o=>{if(o.material&&o.material.emissive)o.material.emissive.setHex(hex)})}
function makeLabel(text){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#12203F';x.beginPath();x.roundRect?x.roundRect(4,8,248,48,12):x.rect(4,8,248,48);x.fill();x.fillStyle='#fff';x.font='700 30px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,33);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));sp.scale.set(4,1,1);return sp;
}
function initScene(){
  const stage=$('#stage'),cv=$('#cv');
  if(!THREE_OK){stage.innerHTML='<p style="padding:24px">No se pudo cargar el motor 3D. Revisa tu conexión y recarga la página.</p>';return}
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;
  scene=new THREE.Scene();scene.background=new THREE.Color(0xcfe8ff);
  camera=new THREE.PerspectiveCamera(45,1,.1,200);
  scene.add(new THREE.HemisphereLight(0xffffff,0x88aa88,.85));
  const sun=new THREE.DirectionalLight(0xffffff,.65);sun.position.set(-12,24,10);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-20,right:20,top:16,bottom:-16,near:1,far:70});sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  // suelo con cuadrícula de 1 m
  const tc=document.createElement('canvas');tc.width=TERR.w*24;tc.height=TERR.d*24;const t=tc.getContext('2d');
  for(let i=0;i<TERR.w;i++)for(let j=0;j<TERR.d;j++){t.fillStyle=(i+j)%2?'#7fcf7d':'#76c874';t.fillRect(i*24,j*24,24,24)}
  t.strokeStyle='rgba(255,255,255,.18)';t.lineWidth=1;for(let i=0;i<=TERR.w;i++){t.beginPath();t.moveTo(i*24,0);t.lineTo(i*24,tc.height);t.stroke()}for(let j=0;j<=TERR.d;j++){t.beginPath();t.moveTo(0,j*24);t.lineTo(tc.width,j*24);t.stroke()}
  ground=new THREE.Mesh(new THREE.PlaneGeometry(TERR.w,TERR.d),new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(tc)}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const out=new THREE.Mesh(new THREE.PlaneGeometry(90,70),new THREE.MeshLambertMaterial({color:0xd8c9a3}));out.rotation.x=-Math.PI/2;out.position.y=-.02;scene.add(out);
  // cerco con entrada al frente
  const fc=0xffffff;
  scene.add(box(TERR.w,.9,.12,fc,0,0,-TERR.d/2));scene.add(box(.12,.9,TERR.d,fc,-TERR.w/2,0,0));scene.add(box(.12,.9,TERR.d,fc,TERR.w/2,0,0));
  scene.add(box(TERR.w/2-2,.9,.12,fc,-(TERR.w/4+1),0,TERR.d/2));scene.add(box(TERR.w/2-2,.9,.12,fc,(TERR.w/4+1),0,TERR.d/2));
  const lb=makeLabel('ENTRADA');lb.position.set(0,1.6,TERR.d/2+.6);scene.add(lb);
  // obstáculos fijos: quincho y árboles
  const q=OBST[0];const qg=new THREE.Group();qg.add(box(q.w,2.4,q.d,0xe8d6b0));qg.add(box(q.w+.6,.4,q.d+.6,0xb5452f,0,2.4,0));qg.position.set(q.x,0,q.z);scene.add(qg);
  const ql=makeLabel('QUINCHO');ql.position.set(q.x,4,q.z);scene.add(ql);
  OBST.slice(1).forEach(o=>{const tg=new THREE.Group();tg.add(cyl(.22,.28,1.6,0x7a5230,0,0,0,10));const cr=new THREE.Mesh(new THREE.SphereGeometry(1.2,14,10),mat(0x2f8f4e));cr.position.y=2.6;cr.castShadow=true;tg.add(cr);tg.position.set(o.x,0,o.z);scene.add(tg)});
  raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  bindStage(cv);
  new ResizeObserver(()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render()}).observe(stage);
}
function corners(x,z,w,d,r){const c=Math.cos(r),s=Math.sin(r),hw=w/2,hd=d/2;return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([a,b])=>[x+a*c+b*s,z-a*s+b*c])}
function sat(A,B){for(const P of [A,B]){for(let i=0;i<4;i++){const p=P[i],q=P[(i+1)%4],ax=-(q[1]-p[1]),az=q[0]-p[0];let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;A.forEach(v=>{const t=v[0]*ax+v[1]*az;a0=Math.min(a0,t);a1=Math.max(a1,t)});B.forEach(v=>{const t=v[0]*ax+v[1]*az;b0=Math.min(b0,t);b1=Math.max(b1,t)});if(a1<=b0+.02||b1<=a0+.02)return false}}return true}
function boundsOK(x,z,w,d,r){const c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));return Math.abs(x)+(c*w+s*d)/2<=TERR.w/2-.15&&Math.abs(z)+(s*w+c*d)/2<=TERR.d/2-.15}
function collides(x,z,it,r,skip){const A=corners(x,z,it.w,it.d,r);
  for(const o of OBST)if(sat(A,corners(o.x,o.z,o.w,o.d,o.r)))return true;
  for(const p of S.placed){if(p.uid===skip)continue;const q=byId(p.id);if(sat(A,corners(p.x,p.z,q.w,q.d,p.rot)))return true}return false}
function validAt(x,z,it,r,skip){return boundsOK(x,z,it.w,it.d,r)&&!collides(x,z,it,r,skip)}
function findSpot(it){for(let z=-8;z<=8;z+=1){for(let x=-13;x<=13;x+=1){if(validAt(x,z,it,0,-1))return [x,z]}}return null}
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
    if(mode==='pinch'&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);cam.r=Math.min(60,Math.max(14,cam.r*pinch/d));pinch=d;render();return}
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
  cv.addEventListener('wheel',e=>{e.preventDefault();cam.r=Math.min(60,Math.max(14,cam.r*(1+Math.sign(e.deltaY)*.08)));render()},{passive:false});
}
function warnHud(on){const w=$('#hudWarn');w.hidden=!on;w.textContent='Ahí no cabe: choca o sale del cerco'}
function camPreset(k){const p={aerea:[0,.2,36],tres:[.5,.8,34],entrada:[0,1.05,26]}[k];Object.assign(cam,{theta:p[0],phi:p[1],r:p[2]});render()}
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
  if(S.parcela){const p=byId('parcela');lines.push({id:'parcela',name:p.name,qty:1,unit:p.price,sub:p.price})}
  DESIGN.forEach(it=>{const q=countOf(it.id);if(q)lines.push({id:it.id,name:it.name,qty:q,unit:it.price,sub:it.price*q})});
  const total=lines.reduce((a,l)=>a+l.sub,0);return {lines,total,abono:Math.round(total*.3)}
}
function issues(){
  const out=[];
  if(!slotFree(S.date,S.slot))out.push('La parcela está ocupada en la franja elegida. Cambia de fecha o de franja.');
  DESIGN.forEach(it=>{const q=countOf(it.id),l=avail(it.id,S.date,S.slot);if(q>l)out.push(`${it.name}: tienes ${q} y solo hay ${l} disponible${l===1?'':'s'} para esa fecha.`)});
  if(!quote().lines.length)out.push('Tu cotización está vacía. Agrega servicios desde el catálogo o el simulador.');
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
  $('#hudInfo').textContent=`${S.placed.length} objeto${S.placed.length===1?'':'s'} en el terreno · ${CLP(q.total)}`;
}

/* ---------- pago y reserva ---------- */
let lastRes=null;
$('#clientForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#formErr');err.hidden=true;
  const n=$('#cName').value.trim(),m=$('#cMail').value.trim(),t=$('#cPhone').value.trim(),g=+$('#cGuests').value;
  if(n.length<3||!/^\S+@\S+\.\S+$/.test(m)||t.replace(/\D/g,'').length<8||!(g>0)){err.textContent='Revisa tus datos: nombre, un correo válido, un teléfono de al menos 8 dígitos y la cantidad de invitados.';err.hidden=false;return}
  if(issues().length){return}
  $('#payAmt').textContent=CLP(quote().abono);$('#payMsg').hidden=true;$('#payGo').disabled=false;$('#payOv').hidden=false;$('#payGo').focus();
});
$('#payCancel').onclick=()=>$('#payOv').hidden=true;
$('#payGo').onclick=async()=>{
  const num=$('#cardN').value.replace(/\D/g,''),msg=$('#payMsg'),go=$('#payGo');msg.hidden=false;msg.style.color='var(--muted)';
  if(num.length!==16){msg.style.color='var(--bad)';msg.textContent='El número de tarjeta debe tener 16 dígitos.';return}
  go.disabled=true;msg.innerHTML='<span class="spin"></span> Procesando pago en el ambiente de pruebas…';
  await new Promise(r=>setTimeout(r,1400));
  if(num==='4000000000000002'){msg.style.color='var(--bad)';msg.textContent='Pago rechazado por el banco emisor. No se hizo ningún cargo. Prueba con otra tarjeta.';go.disabled=false;return}
  if(issues().length){msg.style.color='var(--bad)';msg.textContent='Mientras pagabas cambió la disponibilidad. Revisa tu cotización.';go.disabled=false;return}
  const q=quote(),items={};q.lines.forEach(l=>{if(l.id!=='parcela')items[l.id]=l.qty});
  const client={name:$('#cName').value.trim(),email:$('#cMail').value.trim(),phone:$('#cPhone').value.trim(),guests:+$('#cGuests').value};
  const method=document.querySelector('input[name=pm]:checked').value,txn='TBK-'+Math.floor(Math.random()*9e8+1e8);
  const layout=S.placed.map(p=>({id:p.id,x:p.x,z:p.z,rot:p.rot}));
  try{
    const res=await API.createReservation({date:S.date,slot:S.slot,client,items,parcela:S.parcela,layout,method,txn});
    const r={id:res.folio,date:S.date,slot:S.slot,client,items,parcela:S.parcela,status:res.estado,total:res.total,abono:res.abono,method,txn,layout};
    DB.res.push({date:r.date,slot:r.slot,items,parcela:r.parcela,status:r.status});
    lastRes=r;$('#payOv').hidden=true;showDone(r);refreshAll();
  }catch(e){
    console.error(e);msg.style.color='var(--bad)';msg.textContent=(e&&e.message)||'No se pudo registrar la reserva. Intenta de nuevo.';go.disabled=false;
  }
};
function showDone(r){
  const items=Object.entries(r.items).map(([k,v])=>`• ${byId(k).name} × ${v}`).join('\n');
  $('#bookArea').innerHTML=`<div class="panel" style="grid-column:1/-1;display:grid;gap:16px;max-width:760px">
    <div style="display:flex;gap:16px;align-items:center"><div class="okmark">✓</div><div><h3>Reserva ${r.id} ${r.status==='confirmada'?'confirmada':'recibida'}</h3><p class="muted">Abono de ${CLP(r.abono)} recibido con ${esc(r.method)} (operación ${r.txn}, ambiente de pruebas).</p></div></div>
    ${r.status!=='confirmada'?'<p class="note" style="font-weight:600">Tu reserva queda pendiente hasta que el equipo valide el abono. Te avisaremos por correo.</p>':''}<p class="eyebrow">Vista previa del correo de confirmación (no se envía en esta demo)</p>
    <div class="mail">Para: ${esc(r.client.email)}\nAsunto: Reserva ${r.id} confirmada, ${fmtDate(r.date)}\n\nHola ${esc(r.client.name)},\ntu fiesta quedó reservada para el ${fmtDate(r.date)}, franja ${SLOTS[r.slot].n.toLowerCase()} (${SLOTS[r.slot].h}).\n\n${r.parcela?'• Arriendo de la parcela\n':''}${esc(items)}\n\nTotal: ${CLP(r.total)}\nAbono pagado: ${CLP(r.abono)}\nSaldo para el día del evento: ${CLP(r.total-r.abono)}\n\nTu distribución 3D quedó guardada y el equipo la verá en su panel.</div>
    <div class="cta-row" style="margin:0"><button class="btn primary" id="again">Hacer otra reserva</button></div></div>`;
  $('#again').onclick=()=>location.reload();
  document.getElementById('reservar').scrollIntoView({behavior:'smooth'});
}

/* ---------- chatbot ---------- */
const WA='https://wa.me/56900000000';
const waLink=`<a href="${WA}" target="_blank" rel="noopener">escribirnos por WhatsApp</a> (número de ejemplo +56 9 0000 0000)`;
function priceList(cat){return CAT.filter(i=>i.id!=='parcela'&&(!cat||i.cat===cat)).map(i=>`${esc(i.name)}: <b>${CLP(i.price)}</b>`).join('<br>')}
function parseDate(t){
  let m=t.match(/(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);let d,mo;
  if(m){d=+m[1];mo=MESES.indexOf(m[2]==='setiembre'?'septiembre':m[2])}
  else{m=t.match(/(\d{1,2})[\/\-](\d{1,2})/);if(!m)return null;d=+m[1];mo=+m[2]-1}
  if(mo<0||mo>11||d<1||d>31)return null;let y=today.getFullYear();let dt=new Date(y,mo,d);if(dt<=today)dt=new Date(y+1,mo,d);if(dt.getMonth()!==mo)return null;return dt;
}
function availAnswer(dt){
  const ds=iso(dt);if(blockedDay(ds))return `El ${fmtDate(ds)} la parcela está bloqueada. ¿Te sirve otra fecha?`;
  const fr=Object.keys(SLOTS).filter(s=>slotFree(ds,s));
  if(!fr.length)return `El ${fmtDate(ds)} no queda ninguna franja libre. Prueba con otra fecha en la sección <a href="#fecha">Fecha</a>.`;
  const low=DESIGN.filter(i=>avail(i.id,ds,fr[0])===0).map(i=>i.name);
  return `El ${fmtDate(ds)} hay parcela libre en: <b>${fr.map(s=>SLOTS[s].n+' ('+SLOTS[s].h+')').join(' y ')}</b>.`+(low.length?`<br>Sin stock esa fecha: ${low.join(', ')}.`:'')+`<br><a href="#fecha" data-pick="${ds}">Elegir esta fecha</a>`;
}
const FAQ=[
 [/hola|buenas|buen d[ií]a|buenos|hey/,()=>'¡Hola! Soy el asistente de Divertí Kids. Puedo ayudarte con precios, disponibilidad por fecha, ubicación y cómo reservar.'],
 [/disponib|libre|queda|ocupad|fecha/,t=>{const d=parseDate(t);return d?availAnswer(d):'Dime la fecha (por ejemplo "25 de octubre" o "25/10") y te digo qué hay disponible.'}],
 [/inflable|castillo|tobog|cancha/,()=>'Inflables:<br>'+priceList('juegos').split('<br>').slice(0,3).join('<br>')+'<br>Puedes ver cómo caben en la parcela en el <a href="#simulador">simulador 3D</a>.'],
 [/taca|ping|juego/,()=>'Juegos y entretención:<br>'+priceList('juegos')],
 [/papas|algod|completo|comida|m[aá]quina|hot ?dog/,()=>'Máquinas de alimentos:<br>'+priceList('comida')],
 [/piscina|agua|pileta/,()=>'Piscinas:<br>'+priceList('piscinas')],
 [/parcela|local|recinto|lugar|espacio/,()=>`La parcela mide 30 × 20 m (medida referencial), tiene cerco, quincho y árboles. Arriendo: <b>${CLP(byId('parcela').price)}</b> por evento.`],
 [/precio|cu[aá]nto|valor|cuesta|tarifa|cotiz/,()=>'Precios por evento:<br>'+priceList()+`<br>Parcela: <b>${CLP(byId('parcela').price)}</b>. Tu cotización exacta aparece en <a href="#reservar">Reservar</a>.`],
 [/ubicaci|d[oó]nde|direcci|llegar|azapa|arica/,()=>'Estamos en el valle de Azapa, Arica. Te enviamos la dirección exacta y cómo llegar al confirmar la reserva.'],
 [/horario|hora|franja|turno|cu[aá]ndo/,()=>`Hay dos franjas por día: <b>Mañana ${SLOTS.manana.h}</b> y <b>Tarde ${SLOTS.tarde.h}</b>.`],
 [/pag|abono|tarjeta|webpay|flow|mercado/,()=>'Se paga un abono del 30% en línea (Webpay Plus, Flow o Mercado Pago). El saldo se paga el día del evento.'],
 [/reserv|arrend|contrat|c[oó]mo/,()=>'Para reservar: 1) elige la fecha, 2) arma tu distribución en el <a href="#simulador">simulador 3D</a>, 3) revisa la cotización y 4) paga el abono en <a href="#reservar">Reservar</a>.'],
 [/3d|simulador|distribu|mover/,()=>'En el <a href="#simulador">simulador 3D</a> arrastras los juegos por el terreno, los giras y ves si caben. Lo que dejes ahí pasa directo a tu cotización.'],
 [/condici|pol[ií]tica|cancel|devol|reembols|seguro|montaje/,()=>`Las condiciones de arriendo y cancelación las revisa una persona del equipo. Puedes ${waLink}.`],
 [/humano|persona|whatsapp|contacto|tel[eé]fono|ejecutiv|llamar/,()=>`Te derivo con el equipo: puedes ${waLink}.`],
 [/gracias|genial|perfecto|listo|ok\b/,()=>'¡De nada! Si necesitas algo más, aquí estoy.']
];
const chatEl=$('#chat'),msgs=$('#msgs');
function say(html,who){const m=document.createElement('div');m.className='m '+who;if(who==='me')m.textContent=html;else m.innerHTML=html;msgs.appendChild(m);msgs.scrollTop=msgs.scrollHeight;
  m.querySelectorAll('[data-pick]').forEach(a=>a.onclick=()=>{const d=parseISO(a.dataset.pick);S.date=a.dataset.pick;S.month=new Date(d.getFullYear(),d.getMonth(),1);if(!slotFree(S.date,S.slot))S.slot=Object.keys(SLOTS).find(s=>slotFree(S.date,s))||S.slot;refreshAll();chatEl.hidden=true;$('#chatFab').hidden=false});
  m.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{chatEl.hidden=true;$('#chatFab').hidden=false}))}
function ask(t){
  say(t,'me');const q=t.toLowerCase();const t0=performance.now();
  setTimeout(()=>{
    let ans=null;
    if(parseDate(q)&&/(\d)/.test(q)&&!/precio|cu[aá]nto/.test(q))ans=availAnswer(parseDate(q));
    if(!ans)for(const [re,fn] of FAQ){if(re.test(q)){ans=fn(q);break}}
    say(ans||`No estoy seguro de haber entendido. Prueba con precios, disponibilidad, ubicación o cómo reservar, o puedes ${waLink}.`,'bot');
  },350);
}
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#chatIn').value.trim();if(!v)return;$('#chatIn').value='';ask(v)});
['Precios','¿Qué hay libre el sábado 31 de octubre?','Ubicación','Cómo reservar','Hablar con una persona'].forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.length>24?'Consultar una fecha':t;b.onclick=()=>ask(t);$('#chips').appendChild(b)});
$('#chatFab').onclick=()=>{chatEl.hidden=false;$('#chatFab').hidden=true;if(!msgs.children.length)say('¡Hola! Soy el asistente de Divertí Kids. Pregúntame por precios, disponibilidad de una fecha, ubicación o cómo reservar.','bot');$('#chatIn').focus()};
$('#chatX').onclick=()=>{chatEl.hidden=true;$('#chatFab').hidden=false};

/* ---------- arranque ---------- */
function refreshAll(){
  // si la fecha/franja cambió, se descuenta lo que ya no está disponible
  renderCal();renderSlots();renderCatalog();renderPalette();refreshCart();
  const bad=DESIGN.filter(i=>countOf(i.id)>avail(i.id,S.date,S.slot));
  $('#hudWarn').hidden=true;
  if(bad.length&&!lastRes)toast('Con esta fecha faltan: '+bad.map(i=>i.name).join(', ')+'. Revisa tu cotización.');
}
$('#prevM').onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()-1,1);renderCal()};
$('#nextM').onclick=()=>{S.month=new Date(S.month.getFullYear(),S.month.getMonth()+1,1);renderCal()};
$$('[data-cam]').forEach(b=>b.onclick=()=>camPreset(b.dataset.cam));
$('#zin').onclick=()=>{cam.r=Math.max(14,cam.r*.85);render()};$('#zout').onclick=()=>{cam.r=Math.min(60,cam.r*1.18);render()};
$('#rotL').onclick=()=>rotateSel(1);$('#rotR').onclick=()=>rotateSel(-1);
$('#delSel').onclick=()=>S.sel&&removeUid(S.sel);
$('#clearAll').onclick=()=>{[...S.placed].forEach(p=>scene&&scene.remove(p.mesh));S.placed=[];select(null);refreshAll()};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='r'||e.key==='R')rotateSel(1);if((e.key==='Delete'||e.key==='Backspace')&&S.sel){e.preventDefault();removeUid(S.sel)}});

initScene();
if(THREE_OK){
  spawn('castillo',-4,1,0);spawn('tacataca',5,5,0);spawn('papas',9,-3,0);spawn('piscinaS',-5,-5,0);spawn('algodon',11,2,0);
  // vista inicial del terreno
  Object.assign(cam,{theta:0.5,phi:0.85,r:34});
}
renderTabs();refreshAll();render();
})();
