/* Divertí Kids · capa compartida (catálogo, utilidades y acceso a datos)
   Si el sitio lo entrega el servidor de Railway (server/index.mjs), los datos viven en su base PostgreSQL.
   Si no (por ejemplo, abriendo los archivos sueltos), funciona en MODO DEMO guardando todo en el navegador (localStorage). */
(function(){
'use strict';
const $=s=>document.querySelector(s)||document.createElement('div'); // nunca devuelve null
const $$=s=>[...document.querySelectorAll(s)];
const CLP=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseISO=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fmtDate=s=>{const d=parseISO(s);return ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][d.getDay()]+' '+d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear()};
const today=new Date(); today.setHours(0,0,0,0);
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2600)}

/* ---------- datos ---------- */
const CATS={juegos:'Juegos y entretención',comida:'Máquinas de alimentos',piscinas:'Piscinas',local:'Arriendo del local'};
const SLOTS={manana:{n:'Mañana',h:'10:00 a 14:00'},tarde:{n:'Tarde',h:'15:00 a 19:00'}};
const CAT=[
 {id:'castillo',cat:'juegos',name:'Castillo inflable',desc:'Torres y salto libre para los más chicos.',price:45000,stock:2,w:4.5,d:4.5,h:3.5,color:0xff5fa2,shape:'castle'},
 {id:'tobogan',cat:'juegos',name:'Tobogán inflable',desc:'Rampa de subida y bajada con plataforma.',price:70000,stock:1,w:4,d:7,h:4.5,color:0x3d7bff,shape:'slide'},
 {id:'cancha',cat:'juegos',name:'Cancha inflable',desc:'Para fútbol o juegos de equipo.',price:60000,stock:1,w:6,d:4,h:2.2,color:0x2bb673,shape:'field'},
 {id:'tacataca',cat:'juegos',name:'Mesa de taca-taca',desc:'Taca-taca de madera para 2 a 4 jugadores.',price:18000,stock:3,w:1.5,d:0.9,h:0.9,color:0x8a5a2b,shape:'table'},
 {id:'pingpong',cat:'juegos',name:'Mesa de ping pong',desc:'Reglamentaria, con paletas y pelotas.',price:15000,stock:2,w:2.7,d:1.5,h:0.8,color:0x1e6bb8,shape:'pingpong'},
 {id:'papas',cat:'comida',name:'Máquina de papas fritas',desc:'Papas calientes en el momento.',price:40000,stock:2,w:1.2,d:1.2,h:1.6,color:0xffc21a,top:0xe0402f,shape:'machine'},
 {id:'algodon',cat:'comida',name:'Algodón de azúcar',desc:'Con carro y conos.',price:30000,stock:2,w:1.1,d:1.1,h:1.5,color:0xf56fa6,top:0xffffff,shape:'machine'},
 {id:'completos',cat:'comida',name:'Máquina de completos',desc:'Completos armados al instante.',price:35000,stock:2,w:1.4,d:1.1,h:1.6,color:0xe0402f,top:0xffc21a,shape:'machine'},
 {id:'piscinaS',cat:'piscinas',name:'Piscina chica',desc:'Diámetro 3 m, para los más pequeños.',price:20000,stock:3,w:3,d:3,h:0.6,color:0x39a0ff,shape:'pool'},
 {id:'piscinaL',cat:'piscinas',name:'Piscina grande',desc:'Diámetro 5 m, hasta 12 niños.',price:35000,stock:2,w:5,d:5,h:0.8,color:0x1f86e8,shape:'pool'},
 {id:'parcela',cat:'local',name:'Arriendo de la parcela',desc:'Recinto completo de 30 × 20 m con cerco, quincho y árboles.',price:150000,stock:1,w:30,d:20,h:0,color:0x7ccf7a,shape:'land'}
];
CAT.forEach(i=>{i.active=true;if(i.top==null)i.top=0xffffff});
const ALL=[...CAT];            // todos los servicios (incluye los eliminados, para reservas antiguas)
const byId=id=>ALL.find(i=>i.id===id);
const DESIGN=CAT.filter(i=>i.id!=='parcela');
/* ----- Terreno (la parcela): medidas, suelo, cerco, foto aérea, modelo 3D y elementos fijos (quincho, árboles...) ----- */
const TERRAIN_TYPES={quincho:'Quincho',casa:'Casa o bodega',bano:'Baños',arbol:'Árbol',piscina:'Piscina fija',otro:'Otro obstáculo',zona:'Zona de suelo (pasto, madera…)'};
const TEXTURES={pasto:'Pasto',pastosint:'Pasto sintético',tierra:'Tierra',madera:'Madera (deck)',cemento:'Cemento',arena:'Arena',agua:'Agua'};
const GROUNDS={pasto:'Pasto',tierra:'Tierra',cemento:'Cemento o pavimento',arena:'Arena'};
const DEFAULT_TERRAIN={w:30,d:20,ground:'pasto',fence:true,photo:'',model:'',modelRot:0,items:[
  {id:'q1',t:'quincho',name:'Quincho',x:-11.5,z:-7.5,w:6,d:4,rot:0},
  {id:'a1',t:'arbol',name:'Árbol',x:12.5,z:-6.5,w:1.6,d:1.6,rot:0},
  {id:'a2',t:'arbol',name:'Árbol',x:-12.5,z:6,w:1.6,d:1.6,rot:0},
  {id:'a3',t:'arbol',name:'Árbol',x:9,z:8.3,w:1.6,d:1.6,rot:0}]};
/* Parcela real de Divertí Kids (calcada de la foto satelital; medidas APROXIMADAS: ajústalas en el panel). Entrada = parte de abajo del plano. */
const PRESET_DIVERTI={w:48,d:44,ground:'tierra',fence:true,photo:'',model:'',modelRot:0,items:[
  {id:'c1',t:'otro',name:'Mini canchas',x:-12.9,z:11.7,w:22,d:14,rot:0},
  {id:'v1',t:'otro',name:'Acceso vehículos (sin juegos)',x:3,z:18,w:4,d:8,rot:0},
  {id:'q1',t:'quincho',name:'Quincho',x:15.8,z:1.7,w:16,d:6,rot:0,tex:'madera'},
  {id:'s1',t:'zona',name:'Pasto sintético (juegos y mesas)',x:-9.2,z:-2.5,w:24,d:12,rot:0,tex:'pastosint',solid:false},
  {id:'h1',t:'zona',name:'Pasto (máquinas de helado)',x:9.2,z:-8.8,w:12,d:9,rot:0,tex:'pasto',solid:false},
  {id:'k1',t:'casa',name:'Casa y cocina',x:-12.9,z:-15,w:18,d:8,rot:0},
  {id:'b1',t:'bano',name:'Baños',x:-1.5,z:-16.5,w:3,d:3,rot:0},
  {id:'p1',t:'piscina',name:'Piscina',x:18.3,z:-14.2,w:7,d:11,rot:0}]};
const num=(v,lo,hi,def)=>{v=+v;return isFinite(v)?Math.min(hi,Math.max(lo,v)):def};
function sanitizeTerrain(t){
  t=t||{};const D=DEFAULT_TERRAIN;
  const w=Math.round(num(t.w,8,80,D.w)*10)/10,d=Math.round(num(t.d,6,60,D.d)*10)/10;
  const items=(Array.isArray(t.items)?t.items:D.items).slice(0,60).map((o,i)=>({
    id:String(o.id||('e'+i)).slice(0,20),t:TERRAIN_TYPES[o.t]?o.t:'otro',name:String(o.name||TERRAIN_TYPES[o.t]||'Obstáculo').slice(0,30),
    x:Math.round(num(o.x,-w/2,w/2,0)*10)/10,z:Math.round(num(o.z,-d/2,d/2,0)*10)/10,
    w:Math.round(num(o.w,.3,40,1.6)*10)/10,d:Math.round(num(o.d,.3,40,1.6)*10)/10,rot:Math.round(num(o.rot,-360,360,0)),tex:TEXTURES[o.tex]?o.tex:'',solid:o.solid!==false}));
  return {w,d,ground:GROUNDS[t.ground]?t.ground:D.ground,fence:t.fence!==false,photo:String(t.photo||''),model:String(t.model||''),
    modelRot:[0,90,180,270].includes(+t.modelRot)?+t.modelRot:0,items};
}
const TERR={w:30,d:20,ground:'pasto',fence:true,photo:'',model:'',modelRot:0};
const OBST=[];
/* aplica un terreno guardado a TERR y OBST (se modifican "en sitio" para que todo el código los vea) */
function applyTerrain(raw){
  const t=sanitizeTerrain(raw);
  Object.assign(TERR,{w:t.w,d:t.d,ground:t.ground,fence:t.fence,photo:t.photo,model:t.model,modelRot:t.modelRot});
  OBST.length=0;
  t.items.forEach(o=>OBST.push({id:o.id,t:o.t,name:o.name,x:o.x,z:o.z,w:o.w,d:o.d,r:o.rot*Math.PI/180,tex:o.tex,solid:o.solid}));
  const p=ALL.find(i=>i.id==='parcela');
  if(p){p.w=t.w;p.d=t.d;p.desc=String(p.desc||'').replace(/\d+(?:[.,]\d+)? × \d+(?:[.,]\d+)? m/,t.w+' × '+t.d+' m')}
  return t;
}
const terrainOf=()=>sanitizeTerrain({w:TERR.w,d:TERR.d,ground:TERR.ground,fence:TERR.fence,photo:TERR.photo,model:TERR.model,modelRot:TERR.modelRot,
  items:OBST.map(o=>({id:o.id,t:o.t,name:o.name,x:o.x,z:o.z,w:o.w,d:o.d,rot:Math.round(o.r*180/Math.PI),tex:o.tex,solid:o.solid}))});
const terrainFromRow=x=>!x?null:{w:x.ancho,d:x.largo,ground:x.suelo,fence:x.cerco,photo:x.foto||'',model:x.modelo3d||'',modelRot:x.modelo_rot||0,items:x.elementos};
applyTerrain(DEFAULT_TERRAIN);   // terreno de ejemplo hasta que se cargue el real
const terrainRow=t=>({id:1,ancho:t.w,largo:t.d,suelo:t.ground,cerco:t.fence,foto:t.photo||null,modelo3d:t.model||null,modelo_rot:t.modelRot||0,elementos:t.items});


const hexNum=h=>{const n=parseInt(String(h||'').replace('#',''),16);return isNaN(n)?0x888888:n};
const numHex=n=>'#'+Number(n).toString(16).padStart(6,'0');
/* Aplica el catálogo guardado (precios, stock y servicios creados/eliminados desde el panel) */
function applyCatalog(cat){
  Object.entries(cat||{}).forEach(([id,c])=>{
    let it=ALL.find(i=>i.id===id);
    if(!it){it={id,cat:'juegos',name:id,desc:'',price:0,stock:0,w:2,d:2,h:1.5,color:0x888888,top:0xffffff,shape:'table',active:true};ALL.push(it)}
    if(c.name!=null)it.name=c.name;
    if(c.desc!=null)it.desc=c.desc;
    if(c.cat&&CATS[c.cat])it.cat=c.cat;
    if(c.price!=null)it.price=c.price;
    if(c.stock!=null)it.stock=c.stock;
    if(c.w!=null)it.w=+c.w; if(c.d!=null)it.d=+c.d; if(c.h!=null)it.h=+c.h;
    if(c.color!=null)it.color=typeof c.color==='number'?c.color:hexNum(c.color);
    if(c.top!=null)it.top=typeof c.top==='number'?c.top:hexNum(c.top);
    if(c.shape)it.shape=c.shape;
    if(c.active!=null)it.active=!!c.active;
    if(c.img!==undefined)it.img=c.img||'';
    if(c.model!==undefined)it.model=c.model||'';
    if(c.modelRot!=null)it.modelRot=+c.modelRot||0;
    if(c.domicilio!==undefined)it.domicilio=c.domicilio!==false;
  });
  CAT.length=0;ALL.filter(i=>i.active!==false||i.id==='parcela').forEach(i=>CAT.push(i));
  DESIGN.length=0;CAT.filter(i=>i.id!=='parcela').forEach(i=>DESIGN.push(i));
}
const SHAPES={castle:'Inflable con torres',slide:'Tobogán inflable',field:'Cancha inflable',table:'Mesa de juego',pingpong:'Mesa de ping pong',machine:'Máquina o carro de comida',pool:'Piscina',box:'Otro objeto (caja)'};
const rowOf=it=>({item_id:it.id,nombre:it.name,descripcion:it.desc||'',categoria:it.cat,precio:it.price,stock:it.stock,ancho:it.w,largo:it.d,alto:it.h,color:numHex(it.color),color_tope:it.shape==='machine'?numHex(it.top):null,forma:it.shape,activo:it.active!==false,imagen:it.img||null,modelo3d:it.model||null,modelo_rot:it.modelRot||0,domicilio:it.domicilio!==false});
const fromRow=x=>({name:x.nombre,desc:x.descripcion,cat:x.categoria,price:x.precio,stock:x.stock,w:x.ancho,d:x.largo,h:x.alto,color:x.color,top:x.color_tope,shape:x.forma,active:x.activo,img:x.imagen||'',model:x.modelo3d||'',modelRot:x.modelo_rot||0,domicilio:x.domicilio!==false});


/* ============ Fotos y modelos 3D ============ */
/* Reduce una foto a máx. 1000 px y la comprime (JPEG). Devuelve {blob,dataUrl}. */
function resizeImage(file,max){
  max=max||1000;
  return new Promise((res,rej)=>{
    if(!/^image\//.test(file.type||''))return rej(new Error('El archivo no es una imagen.'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const k=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
      x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
      c.toBlob(b=>b?res({blob:b,dataUrl:c.toDataURL('image/jpeg',.82)}):rej(new Error('No se pudo procesar la imagen.')),'image/jpeg',.82);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('No se pudo leer la imagen. Prueba con un JPG o PNG.'))};
    img.src=url;
  });
}
/* Cómo colocar un modelo 3D real dentro de la huella ancho x largo del servicio (solo giros de 90 grados).
   min/max = caja del modelo [x,y,z]. Devuelve {scale,pos:[x,y,z]} para un grupo con rotation.y = rotDeg. */
function fitGLB(min,max,rotDeg,w,d){
  const sx=max[0]-min[0],sy=max[1]-min[1],sz=max[2]-min[2];
  if(!(sx>0&&sz>0&&sy>0&&w>0&&d>0)||![sx,sy,sz].every(isFinite))return null;
  const r=(((Math.round(rotDeg/90)%4)+4)%4)*Math.PI/2,c=Math.round(Math.cos(r)),sn=Math.round(Math.sin(r));
  const swap=Math.abs(sn)===1,fx=swap?sz:sx,fz=swap?sx:sz;
  const k=Math.min(w/fx,d/fz);
  const cx=(min[0]+max[0])/2,cz=(min[2]+max[2])/2;
  const rx=cx*c+cz*sn,rz=-cx*sn+cz*c;
  return {scale:k,pos:[-k*rx,-k*min[1],-k*rz],size:[k*fx,k*sy,k*fz]};
}

/* ============ Acceso a datos ============ */
const cfg=window.DK_CONFIG||{};
const LIVE=!!cfg.SERVIDOR;   // lo activa el servidor de Railway al entregar config.js; sin servidor = modo demo
const DEMO_USER='admin@divertikids.cl', DEMO_PASS='admin1234';
/* Llamada al servidor (misma dirección del sitio). La cabecera x-dk protege los cambios del panel. */
async function api(method,url,body){
  const o={method,credentials:'same-origin',headers:{'x-dk':'1'}};
  if(body!==undefined){
    if(body instanceof Blob){o.body=body;o.headers['Content-Type']=body.type||'application/octet-stream'}
    else{o.body=JSON.stringify(body);o.headers['Content-Type']='application/json'}
  }
  let r;try{r=await fetch(url,o)}catch(e){throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.')}
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw new Error((j&&j.error)||'El servidor respondió con un error ('+r.status+').');
  return j;
}
/* Cambio en una tabla desde el panel: accion = insert, update, upsert o delete */
const adm=(tabla,accion,fila,clave)=>api('POST','/api/admin/'+tabla,{accion,fila,clave});

/* ----- modo demo (localStorage) ----- */
const DKEY='diverti-kids-demo-v2';
function demoSeed(){
  const d=n=>iso(addDays(today,n));
  const KIDS=[['Sofía',6,25],['Mateo',8,-5],['Isidora',5,40],['Benjamín',7,12],['Emilia',9,200]]; // [niño, edad que cumple, días hasta su próximo cumpleaños]
  const born=(age,days)=>{const t=addDays(today,days);return iso(new Date(t.getFullYear()-age,t.getMonth(),t.getDate()))};
  let ki=0;
  const mk=(id,n,slot,name,items,st,layout)=>{const k=KIDS[ki++%KIDS.length];return {id,date:d(n),slot,client:{name,email:'cliente@ejemplo.cl',phone:'+56 9 0000 000'+ki,guests:20,kid:k[0]+' (ejemplo)',kidBirth:born(k[1],k[2])},items,parcela:true,status:st,example:true,layout,method:'Webpay Plus',txn:'TBK-DEMO'}};
  const price=it=>Object.entries(it).reduce((a,[k,q])=>a+byId(k).price*q,byId('parcela').price);
  const R=[
   mk('R-1001',4,'tarde','Cliente de ejemplo 1',{castillo:1,papas:1},'confirmada',[{id:'castillo',x:-3,z:2,rot:0},{id:'papas',x:6,z:-3,rot:0}]),
   mk('R-1002',6,'manana','Cliente de ejemplo 2',{tobogan:1,piscinaL:1,algodon:1},'confirmada',[{id:'tobogan',x:2,z:-2,rot:Math.PI/2},{id:'piscinaL',x:-5,z:4,rot:0},{id:'algodon',x:8,z:5,rot:0}]),
   mk('R-1003',6,'tarde','Cliente de ejemplo 3',{castillo:1,tacataca:2},'pendiente',[{id:'castillo',x:0,z:0,rot:0},{id:'tacataca',x:6,z:4,rot:0},{id:'tacataca',x:6,z:6,rot:0}]),
   mk('R-1004',13,'tarde','Cliente de ejemplo 4',{cancha:1,completos:1},'confirmada',[{id:'cancha',x:0,z:0,rot:0},{id:'completos',x:9,z:5,rot:0}]),
   mk('R-1005',20,'manana','Cliente de ejemplo 5',{castillo:2,pingpong:1},'pendiente',[{id:'castillo',x:-4,z:0,rot:0},{id:'castillo',x:4,z:0,rot:0},{id:'pingpong',x:0,z:6,rot:0}])
  ];
  R.forEach(r=>{r.total=price(r.items);r.abono=Math.round(r.total*.3)});
  return {res:R,blocked:[{date:d(11),why:'Mantención de la parcela'}],catalog:{},seq:1006,clientes:[],ofertas:[{id:1,titulo:'Oferta de ejemplo: piscina de regalo',texto:'Arrienda un castillo inflable y la piscina chica va con 50 % de descuento. Edítala o bórrala desde el panel.',hasta:'',activa:true}],propuestas:[]};
}
function demoLoad(){try{const s=localStorage.getItem(DKEY);if(s){const o=JSON.parse(s);if(o&&o.res)return o}}catch(e){}return demoSeed()}
function demoSave(s){try{localStorage.setItem(DKEY,JSON.stringify(s))}catch(e){}}


/* ============ Cartera de clientes, cumpleaños y balance (funciones puras) ============ */
const offerFromRow=x=>({id:x.id,titulo:x.titulo,texto:x.texto,hasta:x.hasta||'',activa:x.activa!==false});
const offerActive=o=>o.activa!==false&&(!o.hasta||o.hasta>=iso(today));
const clienteFromRow=x=>({id:x.id,apoderado:x.apoderado,nino:x.nino,nacimiento:x.nacimiento||'',celular:x.celular,correo:x.correo||'',arrendo:x.arrendo||'',fecha:x.fecha_evento||'',monto:x.monto==null?'':x.monto,notas:x.notas||''});
const clienteRow=c=>({apoderado:c.apoderado,nino:c.nino,nacimiento:c.nacimiento||null,celular:c.celular,correo:c.correo||null,arrendo:c.arrendo||null,fecha_evento:c.fecha||null,monto:c.monto===''||c.monto==null?null:Math.round(+c.monto),notas:c.notas||null});
const normTxt=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s*\(ejemplo\)\s*/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const phoneKey=p=>String(p||'').replace(/\D/g,'').slice(-9);
/* Número para wa.me: deja 569XXXXXXXX (Chile) cuando se puede */
function waPhone(p){
  const d=String(p||'').replace(/\D/g,'');
  if(d.startsWith('56')&&d.length>=11)return d;
  if(d.length===9&&d.startsWith('9'))return '56'+d;
  if(d.length===8)return '569'+d;
  return d;
}
const waUrl=(phone,text)=>'https://wa.me/'+waPhone(phone)+(text?'?text='+encodeURIComponent(text):'');
/* Une las reservas del sitio y los clientes agregados a mano en una sola cartera.
   Un cliente = mismo celular y mismo niño. Las reservas canceladas o sin pagar no cuentan. */
function buildClients(res,extras){
  const map=new Map();
  const upsert=(key,base)=>{let c=map.get(key);if(!c){c=Object.assign({key,eventos:[],total:0},base);map.set(key,c)}return c};
  (res||[]).filter(r=>r.status!=='cancelada'&&r.status!=='por_pagar').forEach(r=>{
    const cl=r.client||{},kid=cl.kid||'';
    const c=upsert(phoneKey(cl.phone)+'|'+normTxt(kid),{apoderado:cl.name||'',nino:kid,nacimiento:cl.kidBirth||'',celular:cl.phone||'',correo:cl.email||'',origen:'sitio'});
    if(!c.nacimiento&&cl.kidBirth)c.nacimiento=cl.kidBirth;
    const names=Object.entries(r.items||{}).map(([k,q])=>(byId(k)?byId(k).name:k)+(q>1?' ×'+q:''));
    if(r.parcela)names.unshift('Parcela');
    else if(r.modalidad==='domicilio')names.unshift('A domicilio');
    c.eventos.push({fecha:r.date,arrendo:names.join(', '),total:r.total||0,estado:r.status,folio:r.id,modalidad:r.modalidad||'parcela',direccion:r.lugar&&r.lugar.direccion||''});
    c.total+=(r.status==='confirmada'||r.status==='finalizada'?r.abono||0:0)+(r.status==='finalizada'?(r.total||0)-(r.abono||0):0);
  });
  (extras||[]).forEach(x=>{
    const c=upsert(phoneKey(x.celular)+'|'+normTxt(x.nino),{apoderado:x.apoderado,nino:x.nino,nacimiento:x.nacimiento||'',celular:x.celular,correo:x.correo||'',origen:'manual',extraId:x.id,notas:x.notas||''});
    if(!c.nacimiento&&x.nacimiento)c.nacimiento=x.nacimiento;
    c.extraId=x.id;
    if(x.fecha||x.arrendo||x.monto!=='')c.eventos.push({fecha:x.fecha||'',arrendo:x.arrendo||'',total:+x.monto||0,estado:'finalizada',folio:'manual'});
    c.total+=+x.monto||0;c.notas=x.notas||c.notas||'';
  });
  const list=[...map.values()];
  list.forEach(c=>{c.eventos.sort((a,b)=>a.fecha.localeCompare(b.fecha));c.ultimo=c.eventos.length?c.eventos[c.eventos.length-1].fecha:''});
  return list.sort((a,b)=>a.apoderado.localeCompare(b.apoderado,'es'));
}
/* Próximo cumpleaños desde una fecha (por defecto hoy): fecha, días que faltan y edad que cumple */
function nextBirthday(nac,from){
  if(!nac)return null;from=from||today;
  const b=parseISO(nac);if(isNaN(b))return null;
  const mk=y=>{const m=b.getMonth(),d=b.getDate();const x=new Date(y,m,d);if(x.getMonth()!==m)return new Date(y,m,d-1);return x}; // 29 de febrero
  let y=from.getFullYear(),n=mk(y);
  if(n<from){y++;n=mk(y)}
  return {date:n,days:Math.round((n-from)/864e5),age:y-b.getFullYear(),year:y};
}
/* Último cumpleaños ya pasado (para "estuvo de cumpleaños") */
function lastBirthday(nac,from){
  if(!nac)return null;from=from||today;const b=parseISO(nac);if(isNaN(b))return null;
  const mk=y=>{const x=new Date(y,b.getMonth(),b.getDate());return x.getMonth()!==b.getMonth()?new Date(y,b.getMonth(),b.getDate()-1):x};
  let y=from.getFullYear(),n=mk(y);if(n>from){y--;n=mk(y)}
  return {date:n,days:Math.round((from-n)/864e5),age:y-b.getFullYear()};
}
/* Balance por mes (según la fecha del evento).
   confirmada = abono cobrado · finalizada = evento hecho y saldo cobrado · pendiente = aún sin validar */
function monthlyBalance(res,extras,year){
  const rows=Array.from({length:12},(_,m)=>({m,eventos:0,contratado:0,abonos:0,saldos:0,porCobrar:0,pendientes:0}));
  (res||[]).forEach(r=>{
    if(r.status==='cancelada'||r.status==='por_pagar'||!r.date)return;
    const d=parseISO(r.date);if(d.getFullYear()!==year)return;const row=rows[d.getMonth()];
    row.eventos++;row.contratado+=r.total||0;
    if(r.status==='pendiente'){row.pendientes+=r.abono||0;row.porCobrar+=(r.total||0)-(r.abono||0);return}
    row.abonos+=r.abono||0;
    if(r.status==='finalizada')row.saldos+=(r.total||0)-(r.abono||0);else row.porCobrar+=(r.total||0)-(r.abono||0);
  });
  (extras||[]).forEach(x=>{
    if(!x.fecha||x.monto===''||x.monto==null)return;const d=parseISO(x.fecha);if(d.getFullYear()!==year)return;
    const row=rows[d.getMonth()];row.eventos++;row.contratado+=+x.monto||0;row.abonos+=+x.monto||0;
  });
  rows.forEach(r=>{r.cobrado=r.abonos+r.saldos});
  return rows;
}


/* ============ Arriendo a domicilio ============ */
const SUELOS={pasto:'Pasto',tierra:'Tierra',cemento:'Cemento',baldosa:'Baldosa o piso interior',arena:'Arena',adoquin:'Adoquín o ladrillo',otro:'Otro'};
const TIPOS_LUGAR={casa:'Casa (patio o jardín)',depto:'Departamento o condominio',salon:'Salón o local de eventos',colegio:'Colegio o jardín infantil',otro:'Otro'};
const ZONAS_DEMO=[{id:'arica',nombre:'Arica urbana',precio:10000,activa:true},{id:'azapa',nombre:'Valle de Azapa y alrededores',precio:15000,activa:true},{id:'lluta',nombre:'Valle de Lluta y Poconchile',precio:25000,activa:true}];
const zonaFromRow=x=>({id:x.id,nombre:x.nombre,precio:x.precio,activa:x.activa!==false});
const nf=x=>String(Math.round(+x*100)/100).replace('.',',');
const needsPower=it=>['castle','slide','field','machine'].includes(it.shape);
const isInflable=it=>['castle','slide','field'].includes(it.shape);
/* Revisa si los servicios caben y se pueden montar en el lugar que describe el cliente.
   issues = impide reservar (no cabe físicamente) · warns = el equipo lo revisa con el cliente */
function siteChecks(lugar,items){
  const out={issues:[],warns:[]};lugar=lugar||{};
  const ancho=+lugar.ancho||0,largo=+lugar.largo||0,alto=lugar.alto===''||lugar.alto==null?0:+lugar.alto;
  const list=Object.entries(items||{}).map(([id,q])=>({it:byId(id),q:+q})).filter(x=>x.it&&x.q>0&&x.it.id!=='parcela');
  let area=0;
  list.forEach(({it,q})=>{
    area+=it.w*it.d*q;
    if(ancho>0&&largo>0&&!((it.w<=ancho&&it.d<=largo)||(it.w<=largo&&it.d<=ancho)))out.issues.push(`${it.name} mide ${nf(it.w)} × ${nf(it.d)} m y tu espacio es de ${nf(ancho)} × ${nf(largo)} m: no cabe.`);
    if(alto>0&&it.h>alto)out.issues.push(`${it.name} mide ${nf(it.h)} m de alto y el espacio libre es de ${nf(alto)} m.`);
  });
  const sp=ancho*largo;
  if(sp>0&&area>sp)out.issues.push(`Los servicios elegidos ocupan ${nf(area)} m² y tu espacio tiene ${nf(sp)} m²: no caben todos juntos. Quita alguno o indica un espacio mayor.`);
  else if(sp>0&&area>sp*.7)out.warns.push(`Los servicios ocupan ${nf(area)} m² de ${nf(sp)} m²: puede quedar muy justo. El equipo lo revisará contigo.`);
  if(list.some(x=>needsPower(x.it))&&lugar.luz==='no')out.warns.push('Los inflables y las máquinas necesitan un enchufe de 220 V cerca. Si no hay, consúltanos antes de pagar.');
  if(list.some(x=>x.it.shape==='pool')&&lugar.agua==='no')out.warns.push('Las piscinas necesitan agua cerca para llenarlas.');
  if(['cemento','baldosa','adoquin'].includes(lugar.suelo)&&list.some(x=>isInflable(x.it)))out.warns.push('En piso duro los inflables se fijan con pesas en lugar de estacas.');
  if(lugar.pendiente==='inclinado'&&list.some(x=>isInflable(x.it)||x.it.shape==='pool'))out.warns.push('Un terreno inclinado puede impedir montar piscinas e inflables; el equipo lo evaluará.');
  if(+lugar.acceso>0&&+lugar.acceso<80)out.warns.push('Un acceso de menos de 80 cm puede impedir ingresar algunos juegos.');
  if(lugar.nivel&&lugar.nivel!=='planta')out.warns.push('Montaje fuera de la planta baja: el equipo confirmará si es posible subir los juegos.');
  return out;
}

const SLOT_OK=Object.keys(SLOTS);
const API={
  mode:LIVE?'servidor':'demo',
  online:LIVE&&!!cfg.PAGO_ONLINE,   // true = el pago se hace en Flow (ver INSTRUCCIONES.md)
  demoUser:DEMO_USER, demoPass:DEMO_PASS,

  /* ---------- público ---------- */
  async loadPublic(){
    if(LIVE){
      const d=await api('GET','/api/publico');
      return {
        terrain:terrainFromRow(d.terreno),
        ofertas:(d.ofertas||[]).map(offerFromRow),
        zonas:(d.zonas||[]).map(zonaFromRow),
        res:(d.disponibilidad||[]).map(x=>({date:x.fecha,slot:x.franja,items:x.items||{},parcela:!!x.parcela,status:'activa'})),
        blocked:(d.bloqueos||[]).map(x=>({date:x.fecha,why:x.motivo||'',aplica:x.aplica||'todo'})),
        catalog:Object.fromEntries((d.catalogo||[]).map(x=>[x.item_id,fromRow(x)]))
      };
    }
    const s=demoLoad();
    return {terrain:s.terrain||null,zonas:(s.zonas||ZONAS_DEMO).filter(z=>z.activa!==false),ofertas:(s.ofertas||[]).filter(offerActive),res:s.res.map(r=>({date:r.date,slot:r.slot,items:r.items,parcela:r.parcela,status:r.status})),blocked:s.blocked,catalog:s.catalog||{}};
  },
  async createReservation(p){
    if(LIVE){
      return await api('POST','/api/reservas',{
        p_fecha:p.date,p_franja:p.slot,p_nombre:p.client.name,p_email:p.client.email,p_telefono:p.client.phone,
        p_invitados:p.client.guests,p_items:p.items,p_parcela:p.parcela,p_layout:p.layout,p_metodo:p.method,p_transaccion:p.txn,p_online:!!p.online,
        p_nino:p.client.kid,p_nacimiento:p.client.kidBirth,p_acepta:!!p.client.consent,
        p_modalidad:p.modalidad||'parcela',p_lugar:p.lugar||null,p_zona:p.zona||null});
    }
    const s=demoLoad();
    const dom=p.modalidad==='domicilio';
    const zona=dom?(s.zonas||ZONAS_DEMO).find(z=>z.id===p.zona&&z.activa!==false):null;
    if(dom&&!zona)throw new Error('Elige la zona de despacho.');
    const flete=zona?zona.precio:0;
    const total=Object.entries(p.items).reduce((a,[k,q])=>a+byId(k).price*q,0)+(!dom&&p.parcela?byId('parcela').price:0)+flete;
    const abono=Math.round(total*.3),folio='R-'+(s.seq++);
    s.res.push({id:folio,date:p.date,slot:p.slot,client:p.client,items:p.items,parcela:dom?false:p.parcela,modalidad:dom?'domicilio':'parcela',lugar:dom?p.lugar:null,flete,zona:dom?p.zona:'',status:'confirmada',total,abono,method:p.method,txn:p.txn,layout:dom?[]:p.layout});
    demoSave(s);
    return {folio,total,abono,estado:'confirmada'};
  },

  /* Pide al servidor la dirección de pago de Flow (el monto lo pone el servidor) y devuelve la URL */
  async startPayment(folio,codigo){
    const d=await api('POST','/api/pago',{folio,codigo});
    if(!d||!d.url)throw new Error('No se pudo iniciar el pago.');
    return d.url;
  },
  /* Estado de la reserva al volver de Flow (folio + código secreto que viajan en la dirección) */
  async reservationStatus(folio,codigo){
    if(!LIVE)return null;
    return await api('GET','/api/reservas/estado?folio='+encodeURIComponent(folio)+'&c='+encodeURIComponent(codigo));
  },

  /* ---------- administración ---------- */
  async session(){
    if(LIVE){const d=await api('GET','/api/sesion');return d&&d.email?{email:d.email}:null}
    try{return sessionStorage.getItem('dk-admin')?{email:DEMO_USER}:null}catch(e){return null}
  },
  async login(email,pass){
    if(LIVE){const d=await api('POST','/api/login',{email,clave:pass});return {email:d.email}}
    if(email.trim().toLowerCase()!==DEMO_USER||pass!==DEMO_PASS)throw new Error('Correo o contraseña incorrectos.');
    try{sessionStorage.setItem('dk-admin','1')}catch(e){}
    return {email:DEMO_USER};
  },
  async logout(){
    if(LIVE){await api('POST','/api/logout');return}
    try{sessionStorage.removeItem('dk-admin')}catch(e){}
  },
  async adminLoad(){
    if(LIVE){
      const d=await api('GET','/api/admin/datos');
      return {
        terrain:terrainFromRow(d.terreno),
        clientes:(d.clientes||[]).map(clienteFromRow),
        ofertas:(d.ofertas||[]).map(offerFromRow),
        propuestas:d.propuestas||[],
        zonas:(d.zonas||[]).map(zonaFromRow),
        res:(d.reservas||[]).map(x=>({id:x.folio,date:x.fecha,slot:x.franja,client:{name:x.nombre,email:x.email,phone:x.telefono,guests:x.invitados,kid:x.nombre_nino||'',kidBirth:x.nacimiento_nino||''},items:x.items||{},parcela:!!x.parcela,status:x.estado,total:x.total,abono:x.abono,method:x.metodo_pago,txn:x.transaccion,layout:x.layout||[],note:x.nota||'',modalidad:x.modalidad||'parcela',lugar:x.lugar||null,flete:x.flete||0,zona:x.zona||''})),
        blocked:(d.bloqueos||[]).map(x=>({date:x.fecha,why:x.motivo||'',aplica:x.aplica||'todo'})),
        catalog:Object.fromEntries((d.catalogo||[]).map(x=>[x.item_id,fromRow(x)]))
      };
    }
    const s=demoLoad();return {terrain:s.terrain||null,res:s.res,blocked:s.blocked,catalog:s.catalog||{},clientes:s.clientes||[],ofertas:s.ofertas||[],propuestas:s.propuestas||[],zonas:s.zonas||ZONAS_DEMO};
  },
  async setStatus(folio,status){
    if(LIVE){await adm('reservas','update',{estado:status},folio);return}
    const s=demoLoad();const r=s.res.find(x=>x.id===folio);if(r)r.status=status;demoSave(s);
  },
  async addBlock(date,why,aplica){
    aplica=aplica||'todo';
    if(LIVE){await adm('fechas_bloqueadas','insert',{fecha:date,motivo:why,aplica});return}
    const s=demoLoad();s.blocked.push({date,why,aplica});demoSave(s);
  },
  async removeBlock(date){
    if(LIVE){await adm('fechas_bloqueadas','delete',null,date);return}
    const s=demoLoad();s.blocked=s.blocked.filter(b=>b.date!==date);demoSave(s);
  },
  /* crea o edita un servicio completo (it = objeto con id, name, desc, cat, price, stock, w, d, h, color, top, shape) */
  async saveService(it){
    if(LIVE){await adm('catalogo','upsert',rowOf(it));return}
    const s=demoLoad();s.catalog=s.catalog||{};
    s.catalog[it.id]={name:it.name,desc:it.desc,cat:it.cat,price:it.price,stock:it.stock,w:it.w,d:it.d,h:it.h,color:numHex(it.color),top:numHex(it.top),shape:it.shape,active:it.active!==false,img:it.img||'',model:'',modelRot:0,domicilio:it.domicilio!==false};
    demoSave(s);
  },
  /* guarda el terreno completo (medidas, suelo, cerco, foto, modelo y elementos) */
  async saveTerrain(t){
    t=sanitizeTerrain(t);
    if(LIVE){await adm('terreno','upsert',terrainRow(t));return}
    const s=demoLoad();s.terrain=t;demoSave(s);
  },
  /* Sube una foto (kind='img') o un modelo .glb (kind='model') y devuelve la dirección pública.
     En modo demo la foto se guarda dentro del navegador; los modelos 3D necesitan la base real. */
  async uploadFile(kind,fileOrBlob,hint){
    const safe=String(hint||'servicio').toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,30);
    if(!LIVE){
      if(kind==='model')throw new Error('Subir modelos 3D requiere el servidor con base de datos (Railway). En modo demo se usa la figura simple.');
      return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('No se pudo leer la imagen.'));fr.readAsDataURL(fileOrBlob)});
    }
    const d=await api('POST','/api/admin/archivos?tipo='+(kind==='model'?'model':'img')+'&nombre='+encodeURIComponent(safe),fileOrBlob);
    return d.url;
  },
  /* ---------- zonas de despacho (arriendo a domicilio) ---------- */
  async saveZona(z){
    if(LIVE){const row={id:z.id,nombre:z.nombre,precio:Math.round(z.precio),activa:z.activa!==false,orden:z.orden||100};await adm('zonas_despacho','upsert',row);return}
    const s=demoLoad();s.zonas=s.zonas||ZONAS_DEMO.map(z=>Object.assign({},z));const i=s.zonas.findIndex(x=>x.id===z.id);
    if(i>=0)s.zonas[i]=Object.assign({},z);else s.zonas.push(Object.assign({},z));demoSave(s);
  },
  async deleteZona(id){
    if(LIVE){await adm('zonas_despacho','delete',null,id);return}
    const s=demoLoad();s.zonas=(s.zonas||ZONAS_DEMO).filter(x=>x.id!==id);demoSave(s);
  },
  /* ---------- cartera, ofertas y propuestas ---------- */
  async saveCliente(c){
    if(LIVE){const row=clienteRow(c);if(c.id)await adm('clientes_extra','update',row,c.id);else await adm('clientes_extra','insert',row);return}
    const s=demoLoad();s.clientes=s.clientes||[];
    if(c.id){const i=s.clientes.findIndex(x=>x.id===c.id);if(i>=0)s.clientes[i]=Object.assign({},c)}
    else s.clientes.push(Object.assign({},c,{id:Date.now()}));
    demoSave(s);
  },
  async deleteCliente(id){
    if(LIVE){await adm('clientes_extra','delete',null,id);return}
    const s=demoLoad();s.clientes=(s.clientes||[]).filter(x=>x.id!==id);demoSave(s);
  },
  async saveOferta(o){
    if(LIVE){const row={titulo:o.titulo,texto:o.texto,hasta:o.hasta||null,activa:o.activa!==false};if(o.id)await adm('ofertas','update',row,o.id);else await adm('ofertas','insert',row);return}
    const s=demoLoad();s.ofertas=s.ofertas||[];
    if(o.id){const i=s.ofertas.findIndex(x=>x.id===o.id);if(i>=0)s.ofertas[i]=Object.assign({},o)}
    else s.ofertas.push(Object.assign({},o,{id:Date.now()}));
    demoSave(s);
  },
  async deleteOferta(id){
    if(LIVE){await adm('ofertas','delete',null,id);return}
    const s=demoLoad();s.ofertas=(s.ofertas||[]).filter(x=>x.id!==id);demoSave(s);
  },
  async markProposal(clave){
    if(LIVE){await adm('propuestas','upsert',{clave});return}
    const s=demoLoad();s.propuestas=s.propuestas||[];if(!s.propuestas.includes(clave))s.propuestas.push(clave);demoSave(s);
  },
  /* "eliminar" = ocultar del sitio; las reservas antiguas siguen mostrando su servicio */
  async deleteService(id){
    if(LIVE){await adm('catalogo','update',{activo:false},id);return}
    const s=demoLoad();s.catalog=s.catalog||{};const it=byId(id);
    s.catalog[id]=Object.assign({},s.catalog[id]||{name:it.name,desc:it.desc,cat:it.cat,price:it.price,stock:it.stock,w:it.w,d:it.d,h:it.h,color:numHex(it.color),top:numHex(it.top),shape:it.shape},{active:false});
    demoSave(s);
  }
};

window.DK={$,$$,CLP,esc,pad,iso,parseISO,MESES,fmtDate,today,addDays,toast,CATS,SLOTS,CAT,ALL,byId,DESIGN,TERR,OBST,API,applyCatalog,SHAPES,numHex,hexNum,resizeImage,fitGLB,applyTerrain,sanitizeTerrain,terrainOf,TERRAIN_TYPES,TEXTURES,GROUNDS,DEFAULT_TERRAIN,PRESET_DIVERTI,buildClients,SUELOS,TIPOS_LUGAR,siteChecks,needsPower,isInflable,nf,nextBirthday,lastBirthday,monthlyBalance,waPhone,waUrl,phoneKey,normTxt,offerActive};
})();
