(async function(){
'use strict';
const {$,$$,CLP,esc,iso,parseISO,fmtDate,today,addDays,toast,SLOTS,CAT,CATS,SHAPES,byId,OBST,TERR,API,applyCatalog,numHex,MESES}=DK;
let DB={res:[],blocked:[],catalog:{},clientes:[],ofertas:[],propuestas:[],zonas:[]};
const openDet=new Set();

/* ---------- vistas ---------- */
function show(which){$('#loginView').hidden=which!=='login';$('#panelView').hidden=which!=='panel'}
function setBadge(){const b=$('#modeBadge');b.textContent=API.mode==='servidor'?'Base de datos conectada':'Modo demo';b.className='modebadge'+(API.mode==='servidor'?' live':'')}

/* ---------- login ---------- */
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#lErr'),btn=$('#lBtn');err.hidden=true;
  const mail=$('#lMail').value.trim(),pass=$('#lPass').value;
  if(!mail||!pass){err.textContent='Escribe tu correo y tu contraseña.';err.hidden=false;return}
  btn.disabled=true;btn.textContent='Entrando…';
  try{const s=await API.login(mail,pass);$('#lPass').value='';await enter(s)}
  catch(ex){err.textContent=ex.message||'No se pudo iniciar sesión.';err.hidden=false}
  finally{btn.disabled=false;btn.textContent='Entrar'}
});
$('#logout').onclick=async()=>{try{await API.logout()}catch(e){}openDet.clear();show('login')};

async function enter(s){
  $('#who').textContent=s.email;setBadge();
  await reload();show('panel');
}
async function reload(){
  DB=await API.adminLoad();
  applyCatalog(DB.catalog);
  DK.applyTerrain(DB.terrain||DK.DEFAULT_TERRAIN);
  if(!TE.dirty)teLoad();      // no pisa lo que se está editando en el plano
  render();renderExtra();
}
async function doAct(fn,okMsg){
  try{await fn();await reload();if(okMsg)toast(okMsg)}
  catch(e){console.error(e);toast('No se pudo guardar: '+(e.message||'error'));try{await reload()}catch(_){}}
}

/* ---------- panel ---------- */
const TXC={pasto:'#7fcf7d',pastosint:'#3fae4a',tierra:'#c9a56b',madera:'#9a6a3b',cemento:'#b9bcc4',arena:'#e8d6a4',agua:'#4fb3ff'};
const GR={pasto:'#7fcf7d',tierra:'#c9a56b',cemento:'#b9bcc4',arena:'#e8d6a4'};
const TC={zona:'#9a9a9a',quincho:'#e8d6b0',casa:'#f0e6d2',bano:'#dfe8ef',arbol:'#2f8f4e',piscina:'#4fb3ff',otro:'#9a9a9a'};
const obstSvg=o=>o.t==='arbol'?`<circle cx="${o.x}" cy="${o.z}" r="${Math.max(o.w,o.d)*.75}" fill="${TC.arbol}" opacity=".9"/>`
  :`<rect x="${o.x-o.w/2}" y="${o.z-o.d/2}" width="${o.w}" height="${o.d}" rx="${o.t==='piscina'?.3:0}" fill="${TXC[o.tex]||TC[o.t]||TC.otro}"${o.solid===false?' fill-opacity=".8" stroke-dasharray=".4 .3"':''} stroke="#25265E" stroke-width=".06" transform="rotate(${-o.r*180/Math.PI} ${o.x} ${o.z})"/>`;
const svgPlan=r=>{
  const W=TERR.w,D=TERR.d;
  const rects=(r.layout||[]).map(p=>{const it=byId(p.id);if(!it)return '';const col='#'+it.color.toString(16).padStart(6,'0');return it.shape==='pool'?`<circle cx="${p.x}" cy="${p.z}" r="${it.w/2}" fill="${col}"/>`:`<rect x="${p.x-it.w/2}" y="${p.z-it.d/2}" width="${it.w}" height="${it.d}" fill="${col}" transform="rotate(${-p.rot*180/Math.PI} ${p.x} ${p.z})"/>`}).join('');
  const bg=`<rect x="${-W/2}" y="${-D/2}" width="${W}" height="${D}" fill="${GR[TERR.ground]||GR.pasto}"/>`+(TERR.photo?`<image href="${esc(TERR.photo)}" x="${-W/2}" y="${-D/2}" width="${W}" height="${D}" preserveAspectRatio="none"/>`:'');
  return `<svg viewBox="${-W/2} ${-D/2} ${W} ${D}" role="img" aria-label="Distribución en planta">${bg}${OBST.map(obstSvg).join('')}${rects}<rect x="-2" y="${D/2-.4}" width="4" height=".4" fill="#25265E"/></svg>`;
};
const modTag=r=>r.modalidad==='domicilio'?'<span class="badge warn">Domicilio</span> ':'';
const domResumen=r=>{const L=r.lugar||{};const its=Object.entries(r.items||{}).map(([k,q])=>(byId(k)?byId(k).name:k)+(q>1?' ×'+q:'')).join(', ');return `<div class="note" style="margin-top:4px;color:var(--ink)"><b>Pidió:</b> ${esc(its||'—')}<br><b>Dirección:</b> ${esc(L.direccion||'—')}<br><b>Suelo:</b> ${esc(DK.SUELOS[L.suelo]||L.suelo||'—')} · <b>Espacio:</b> ${L.ancho?DK.nf(L.ancho)+' × '+DK.nf(L.largo)+' m':'—'}</div>`};
const lugarHtml=(r,conAlertas=true)=>{const L=r.lugar||{};if(!L.direccion)return '';const z=DB.zonas.find(x=>x.id===r.zona);const chk=DK.siteChecks(L,r.items);return `<p><b>Lugar:</b> ${esc(DK.TIPOS_LUGAR[L.tipo]||L.tipo||'')} · ${esc(L.direccion)}${L.referencia?' ('+esc(L.referencia)+')':''}</p><ul style="margin:4px 0 0;padding-left:18px"><li>Suelo: ${esc(DK.SUELOS[L.suelo]||L.suelo)} · Espacio: ${DK.nf(L.ancho)} × ${DK.nf(L.largo)} m${L.alto?' · Altura libre: '+DK.nf(L.alto)+' m':''}${L.acceso?' · Acceso: '+L.acceso+' cm':''}</li><li>Enchufe 220 V: ${L.luz==='si'?'sí':'no'} · Agua: ${L.agua==='si'?'sí':'no'} · ${L.pendiente==='inclinado'?'Terreno con pendiente':'Terreno plano'} · ${L.nivel==='escaleras'?'Piso alto con escaleras':L.nivel==='ascensor'?'Piso alto con ascensor':'Planta baja o patio'}</li><li>Despacho: ${esc(z?z.nombre:r.zona||'—')} · ${CLP(r.flete||0)}</li>${L.obs?`<li>Detalles: ${esc(L.obs)}</li>`:''}</ul>${conAlertas?chk.issues.concat(chk.warns).map(t=>`<p class="note" style="color:var(--bad);font-weight:600">⚠ ${esc(t)}</p>`).join(''):''}`};
function render(){
  const R=[...DB.res].sort((a,b)=>a.date.localeCompare(b.date)||a.slot.localeCompare(b.slot));
  const act=R.filter(r=>r.status!=='cancelada'&&r.status!=='por_pagar');
  $('#metrics').innerHTML=`<div class="panel"><span class="eyebrow">Reservas activas</span><b>${act.filter(r=>r.status!=='finalizada').length}</b></div>
   <div class="panel"><span class="eyebrow">Abonos cobrados</span><b>${CLP(act.filter(r=>r.status==="confirmada"||r.status==="finalizada").reduce((a,r)=>a+r.abono,0))}</b></div>
   <div class="panel"><span class="eyebrow">Pendientes de confirmar</span><b>${R.filter(r=>r.status==='pendiente').length}</b></div>
   <div class="panel"><span class="eyebrow">Fechas bloqueadas</span><b>${DB.blocked.length}</b></div>`;
  const tb=$('#resBody');tb.innerHTML='';
  if(!R.length)tb.innerHTML='<tr><td colspan="7" class="muted">Aún no hay reservas.</td></tr>';
  R.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${modTag(r)}<b>${esc(r.id)}</b>${r.example?'<br><span class="note">ejemplo</span>':''}</td><td>${fmtDate(r.date).replace(/ de \d{4}$/,'')}<br><span class="note">${SLOTS[r.slot].n}</span></td><td>${esc(r.client.name)}<br><span class="note">${r.client.guests} invitados</span>${r.modalidad==='domicilio'?domResumen(r):''}</td><td class="num">${CLP(r.total)}</td><td class="num">${CLP(r.abono)}</td>
    <td><select data-st="${esc(r.id)}" aria-label="Estado de ${esc(r.id)}">${['por_pagar','pendiente','confirmada','finalizada','cancelada'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></td>
    <td><button class="btn sm" data-det="${esc(r.id)}">${openDet.has(r.id)?'Ocultar':(r.modalidad==='domicilio'?'Ver pedido y lugar':'Ver distribución')}</button></td>`;
    tb.appendChild(tr);
    if(openDet.has(r.id)){const d=document.createElement('tr');d.innerHTML=`<td colspan="7"><div class="detail"><div>${r.modalidad==='domicilio'?'<p class="note">Servicio a domicilio: no usa el simulador de la parcela.</p>':svgPlan(r)}</div><div><b>Servicios</b><ul style="margin:6px 0 0;padding-left:18px">${r.parcela?'<li>Arriendo de la parcela</li>':''}${Object.entries(r.items).map(([k,v])=>`<li>${esc(byId(k)?byId(k).name:k)} × ${v}</li>`).join('')}</ul>${r.modalidad==='domicilio'?lugarHtml(r):''}<p class="note" style="margin-top:8px">${esc(r.client.email)} · ${esc(r.client.phone)}</p><p class="note">Pago: ${esc(r.method||'—')} · ${esc(r.txn||'—')}</p>${r.note?`<p class="note" style="color:var(--bad);font-weight:600">${esc(r.note)}</p>`:''}</div></div></td>`;tb.appendChild(d)}
  });
  $$('[data-st]').forEach(s=>s.onchange=()=>doAct(()=>API.setStatus(s.dataset.st,s.value),'Estado actualizado'));
  $$('[data-det]').forEach(b=>b.onclick=()=>{const k=b.dataset.det;openDet.has(k)?openDet.delete(k):openDet.add(k);render()});
  $('#blockList').innerHTML=DB.blocked.length?DB.blocked.map(b=>`<li><span>${fmtDate(b.date)}<br><span class="note">${esc(b.why)} · ${b.aplica==='parcela'?'solo la parcela':b.aplica==='domicilio'?'solo domicilio':'todo'}</span></span><button class="btn sm" data-unb="${b.date}">Quitar</button></li>`).join(''):'<li><span class="muted">No hay fechas bloqueadas</span><span></span></li>';
  $$('[data-unb]').forEach(b=>b.onclick=()=>doAct(()=>API.removeBlock(b.dataset.unb),'Fecha desbloqueada'));
  $('#priceBody').innerHTML=CAT.map(i=>`<tr><td>${i.img?`<img class="thumb" src="${esc(i.img)}" alt="" loading="lazy"> `:''}<b>${esc(i.name)}</b>${i.model?' <span class="badge ok">3D real</span>':''}${i.domicilio===false&&i.id!=='parcela'?' <span class="badge">Solo parcela</span>':''}<br><span class="note">${esc(i.desc||'')}</span></td><td>${esc(CATS[i.cat]||i.cat)}</td><td><input class="p num" type="number" min="0" step="1000" value="${i.price}" data-pr="${i.id}" aria-label="Precio de ${esc(i.name)}"></td><td><input class="p num" style="width:70px" type="number" min="0" step="1" value="${i.stock}" data-sk="${i.id}" aria-label="Stock de ${esc(i.name)}"></td><td class="num">${i.w} × ${i.d} × ${i.h} m</td><td style="white-space:nowrap"><button class="btn sm" data-edit="${i.id}">Editar</button> ${i.id==='parcela'?'':`<button class="btn sm" data-del="${i.id}">Eliminar</button>`}</td></tr>`).join('');
  const quick=id=>{const it=byId(id);const p=Math.max(0,Math.round(+document.querySelector(`[data-pr="${id}"]`).value||0)),k=Math.max(0,Math.round(+document.querySelector(`[data-sk="${id}"]`).value||0));doAct(()=>API.saveService(Object.assign({},it,{price:p,stock:k})),'Servicio actualizado')};
  $$('[data-pr]').forEach(inp=>inp.onchange=()=>quick(inp.dataset.pr));
  $$('[data-sk]').forEach(inp=>inp.onchange=()=>quick(inp.dataset.sk));
  $$('[data-edit]').forEach(b=>b.onclick=()=>fillForm(byId(b.dataset.edit)));
  $$('[data-del]').forEach(b=>b.onclick=()=>{const it=byId(b.dataset.del);if(confirm(`¿Eliminar "${it.name}" del sitio?\nLas reservas anteriores no se alteran.`))doAct(()=>API.deleteService(it.id),'Servicio eliminado')});
}
$('#blockForm').addEventListener('submit',e=>{e.preventDefault();const d=$('#bDate').value;
  if(!d||parseISO(d)<=today){toast('Elige una fecha futura');return}
  if(DB.blocked.some(b=>b.date===d)){toast('Esa fecha ya está bloqueada');return}
  doAct(()=>API.addBlock(d,$('#bWhy').value.trim()||'Sin motivo',$('#bApl').value),'Fecha bloqueada')});
$('#bDate').min=iso(addDays(today,1));

/* ---------- formulario de servicios ---------- */
$('#sCat').innerHTML=Object.entries(CATS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#sShape').innerHTML=Object.entries(SHAPES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
let pImg=null,pModel=null;   // archivos elegidos y aún no guardados ('quitar' = borrar el actual)
let curImg='',curModel='';
function showImg(src){const p=$('#sImgPrev');if(src){p.src=src;p.hidden=false}else{p.removeAttribute('src');p.hidden=true}$('#sImgDel').hidden=!src}
function showModel(has,name){$('#sModelDel').hidden=!has;$('#sModelNote').textContent=has?('Modelo cargado: '+(name||'actual')+'. Se ajusta al ancho y largo reales.'):'Si no subes uno, el simulador usa una figura simple con las medidas y el color de arriba. El modelo se ajusta solo al ancho y largo reales.'}
if(API.mode==='demo'){$('#sModel').disabled=true;$('#sModelNote').textContent='Los modelos 3D reales se pueden subir cuando el sitio funcione con el servidor y la base de datos (Railway). En modo demo se usa la figura simple.'}
$('#sImg').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;const err=$('#sErr');err.hidden=true;
  if(f.size>15*1024*1024){err.textContent='La foto pesa demasiado (máximo 15 MB).';err.hidden=false;e.target.value='';return}
  try{const r=await DK.resizeImage(f,1000);pImg=r.blob;showImg(r.dataUrl)}catch(ex){err.textContent=ex.message;err.hidden=false;e.target.value=''}
});
$('#sImgDel').onclick=()=>{pImg='quitar';$('#sImg').value='';showImg('')};
$('#sModel').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const err=$('#sErr');err.hidden=true;
  if(!/\.glb$/i.test(f.name)){err.textContent='El modelo debe ser un archivo .glb (no .obj, .fbx ni .gltf suelto).';err.hidden=false;e.target.value='';return}
  if(f.size>30*1024*1024){err.textContent='El modelo pesa más de 30 MB. Redúcelo (por ejemplo con gltf.report o Blender) para que cargue rápido en el celular.';err.hidden=false;e.target.value='';return}
  pModel=f;showModel(true,f.name);
});
$('#sModelDel').onclick=()=>{pModel='quitar';$('#sModel').value='';showModel(false)};
function clearForm(){pImg=null;pModel=null;curImg='';curModel='';$('#sImg').value='';$('#sModel').value='';$('#sModelRot').value='0';showImg('');showModel(false);['sId','sName','sDesc','sPrice','sStock','sW','sD','sH'].forEach(i=>$('#'+i).value='');$('#sColor').value='#3d7bff';$('#sDom').checked=true;$('#sCat').value='juegos';$('#sShape').value='castle';$('#svcFormT').textContent='Agregar servicio';$('#sCancel').hidden=true;$('#sErr').hidden=true}
function fillForm(it){
  $('#sId').value=it.id;$('#sName').value=it.name;$('#sDesc').value=it.desc||'';$('#sCat').value=it.cat;$('#sShape').value=it.shape==='land'?'castle':it.shape;
  $('#sPrice').value=it.price;$('#sStock').value=it.stock;$('#sW').value=it.w;$('#sD').value=it.d;$('#sH').value=it.h;$('#sColor').value=numHex(it.color);$('#sDom').checked=it.domicilio!==false;
  pImg=null;pModel=null;curImg=it.img||'';curModel=it.model||'';$('#sImg').value='';$('#sModel').value='';$('#sModelRot').value=String(it.modelRot||0);showImg(curImg);showModel(!!curModel,'actual');
  $('#svcFormT').textContent='Editar: '+it.name;$('#sCancel').hidden=false;$('#sErr').hidden=true;
  $('#svcForm').scrollIntoView({behavior:'smooth',block:'center'});
}
$('#sCancel').onclick=clearForm;
$('#svcForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#sErr');err.hidden=true;
  const name=$('#sName').value.trim(),price=Math.round(+$('#sPrice').value),stock=Math.round(+$('#sStock').value),w=+$('#sW').value,d=+$('#sD').value,h=+$('#sH').value;
  const bad=!name||name.length<3?'Escribe el nombre del servicio (mínimo 3 letras).':!(price>=0)||$('#sPrice').value===''?'Escribe el precio.':!(stock>=0)||$('#sStock').value===''?'Escribe cuántas unidades hay.':!(w>=.3&&w<=30&&d>=.3&&d<=20)?'Las medidas deben ser reales: ancho hasta 30 m y largo hasta 20 m.':!(h>=.2&&h<=8)?'El alto debe estar entre 0,2 y 8 m.':'';
  if(bad){err.textContent=bad;err.hidden=false;return}
  let id=$('#sId').value;
  if(!id){id='s-'+name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)+'-'+Math.random().toString(36).slice(2,5)}
  const old=byId(id)||{};
  const it=Object.assign({},old,{id,name,desc:$('#sDesc').value.trim(),cat:$('#sCat').value,shape:old.id==='parcela'?'land':$('#sShape').value,price,stock,w,d,h,color:parseInt($('#sColor').value.slice(1),16),top:old.top!=null?old.top:0xffffff,active:true});
  it.modelRot=+$('#sModelRot').value||0;
  it.domicilio=it.id==='parcela'?false:$('#sDom').checked;
  doAct(async()=>{
    const sv=$('#sSave');sv.disabled=true;
    try{
      if(pImg==='quitar')it.img='';else if(pImg)it.img=await API.uploadFile('img',pImg,id);
      if(pModel==='quitar')it.model='';else if(pModel){it.model=await API.uploadFile('model',pModel,id)}
      await API.saveService(it);clearForm();
    }finally{sv.disabled=false}
  },old.id?'Servicio actualizado':'Servicio agregado');
});

/* ---------- editor del terreno ---------- */
const TE={t:null,sel:null,dirty:false,pPhoto:null,pModel:null,photoPrev:''};
const DEF_SIZE={zona:[8,5],quincho:[6,4],casa:[5,4],bano:[3,3],arbol:[1.6,1.6],piscina:[6,3],otro:[2,2]};
const TT=DK.TERRAIN_TYPES;
$('#tGround').innerHTML=Object.entries(DK.GROUNDS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#eTex').innerHTML='<option value="">Sin textura</option>'+Object.entries(DK.TEXTURES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#eType').innerHTML=$('#eT').innerHTML=Object.entries(TT).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
if(API.mode==='demo'){$('#tModel').disabled=true;$('#tModelNote').textContent='Los modelos 3D del terreno se pueden subir cuando el sitio funcione con el servidor y la base de datos (Railway). En modo demo se usa el terreno dibujado.'}
const teItem=id=>TE.t.items.find(o=>o.id===id);
const clampN=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),snap=v=>Math.round(v*10)/10;
function teLoad(){TE.t=DK.terrainOf();TE.sel=null;TE.dirty=false;TE.pPhoto=null;TE.pModel=null;TE.photoPrev=TE.t.photo;teFill();teDraw();teSel()}
function teHasModel(){return TE.pModel==='quitar'?false:(TE.pModel?true:!!TE.t.model)}
function teFill(){const t=TE.t;$('#tW').value=t.w;$('#tD').value=t.d;$('#tGround').value=t.ground;$('#tFence').value=t.fence?'1':'0';$('#tModelRot').value=String(t.modelRot);
  $('#tPhoto').value='';$('#tModel').value='';$('#tPhotoDel').hidden=!TE.photoPrev;$('#tModelDel').hidden=!teHasModel();$('#tErr').hidden=true}
function teDraw(){
  const t=TE.t,W=t.w,D=t.d,pad=1.5,svg=$('#tePlan');
  svg.setAttribute('viewBox',`${-W/2-pad} ${-D/2-pad} ${W+2*pad} ${D+2*pad}`);
  let h=`<rect x="${-W/2}" y="${-D/2}" width="${W}" height="${D}" fill="${GR[t.ground]||GR.pasto}"/>`;
  if(TE.photoPrev)h+=`<image href="${esc(TE.photoPrev)}" x="${-W/2}" y="${-D/2}" width="${W}" height="${D}" preserveAspectRatio="none"/>`;
  let g='';for(let i=0;i<=W;i++)g+=`M${-W/2+i} ${-D/2}V${D/2}`;for(let j=0;j<=D;j++)g+=`M${-W/2} ${-D/2+j}H${W/2}`;
  h+=`<path d="${g}" stroke="rgba(255,255,255,.3)" stroke-width=".03" fill="none"/>`;
  if(t.fence){const gap=Math.min(4,W/2),a=-W/2,b=W/2,y0=-D/2,y1=D/2;
    h+=`<path d="M${a} ${y1}V${y0}H${b}V${y1}H${gap/2}M${-gap/2} ${y1}H${a}" stroke="#fff" stroke-width=".18" fill="none"/>`;
    h+=`<text x="0" y="${y1+1.1}" font-size=".8" text-anchor="middle" fill="#25265E" font-weight="700">ENTRADA</text>`}
  t.items.slice().sort((a,b)=>(a.solid===false?0:1)-(b.solid===false?0:1)).forEach(o=>{
    const body=o.t==='arbol'?`<circle r="${Math.max(o.w,o.d)*.75}" fill="${TC.arbol}" opacity=".9"/><circle r=".25" fill="#7a5230"/>`
      :`<rect x="${-o.w/2}" y="${-o.d/2}" width="${o.w}" height="${o.d}" rx="${o.t==='piscina'?.3:0}" fill="${TXC[o.tex]||TC[o.t]||TC.otro}"${o.solid===false?' fill-opacity=".8" stroke-dasharray=".4 .3"':''} stroke="#25265E" stroke-width=".06"/>`;
    h+=`<g class="it${o.id===TE.sel?' sel':''}" data-id="${esc(o.id)}" transform="translate(${o.x} ${o.z}) rotate(${-o.rot})">${body}<text y=".3" font-size=".85" text-anchor="middle" fill="#25265E" stroke="#fff" stroke-width=".22" paint-order="stroke" style="pointer-events:none" transform="rotate(${o.rot})">${esc(o.name)}</text></g>`});
  svg.innerHTML=h;
}
function teSel(){
  const o=TE.sel&&teItem(TE.sel),f=$('#eForm');f.hidden=!o;if(!o)return;
  $('#eName').value=o.name;$('#eT').value=o.t;$('#eTex').value=o.tex||'';$('#eSolid').value=o.solid===false?'0':'1';$('#eW').value=o.w;$('#eD').value=o.d;$('#eRot').value=o.rot;$('#eX').value=o.x;$('#eZ').value=o.z;
}
const svgPt=e=>{const s=$('#tePlan'),p=s.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=s.getScreenCTM();return m?p.matrixTransform(m.inverse()):{x:0,y:0}};
let drag=null;
$('#tePlan').addEventListener('pointerdown',e=>{
  const g=e.target.closest&&e.target.closest('.it');
  if(!g){TE.sel=null;teDraw();teSel();return}
  const o=teItem(g.dataset.id);if(!o)return;TE.sel=o.id;const p=svgPt(e);drag={id:o.id,dx:o.x-p.x,dz:o.z-p.y};
  try{$('#tePlan').setPointerCapture(e.pointerId)}catch(_){}e.preventDefault();teDraw();teSel();
});
$('#tePlan').addEventListener('pointermove',e=>{
  if(!drag)return;const o=teItem(drag.id);if(!o)return;const p=svgPt(e),t=TE.t;
  o.x=snap(clampN(p.x+drag.dx,-t.w/2,t.w/2));o.z=snap(clampN(p.y+drag.dz,-t.d/2,t.d/2));TE.dirty=true;teDraw();$('#eX').value=o.x;$('#eZ').value=o.z;
});
const endDrag=()=>{drag=null};$('#tePlan').addEventListener('pointerup',endDrag);$('#tePlan').addEventListener('pointercancel',endDrag);
// campos del elemento seleccionado
const bindEl=(id,fn)=>$('#'+id).addEventListener('change',()=>{const o=TE.sel&&teItem(TE.sel);if(!o)return;fn(o,$('#'+id));TE.dirty=true;TE.t=DK.sanitizeTerrain(TE.t);teDraw();teSel()});
bindEl('eTex',(o,i)=>{o.tex=i.value});bindEl('eSolid',(o,i)=>{o.solid=i.value!=='0'});
bindEl('eName',(o,i)=>{o.name=i.value.trim()||TT[o.t]});bindEl('eT',(o,i)=>{o.t=i.value});
bindEl('eW',(o,i)=>{o.w=+i.value});bindEl('eD',(o,i)=>{o.d=+i.value});bindEl('eRot',(o,i)=>{o.rot=+i.value||0});bindEl('eX',(o,i)=>{o.x=+i.value});bindEl('eZ',(o,i)=>{o.z=+i.value});
$('#eAdd').onclick=()=>{
  const k=$('#eType').value,[w,d]=DEF_SIZE[k]||[2,2];if(TE.t.items.length>=60){toast('Ya hay demasiados elementos');return}
  const o={id:'e'+Date.now().toString(36),t:k,name:TT[k],x:0,z:0,w,d,rot:0,tex:k==='zona'?'pasto':'',solid:k!=='zona'};TE.t.items.push(o);TE.sel=o.id;TE.dirty=true;teDraw();teSel();
};
$('#eDel').onclick=()=>{TE.t.items=TE.t.items.filter(o=>o.id!==TE.sel);TE.sel=null;TE.dirty=true;teDraw();teSel()};
// medidas, suelo y cerco
const readTop=()=>{const t=TE.t;t.w=+$('#tW').value;t.d=+$('#tD').value;t.ground=$('#tGround').value;t.fence=$('#tFence').value==='1';t.modelRot=+$('#tModelRot').value;TE.t=DK.sanitizeTerrain(t);TE.dirty=true;$('#tW').value=TE.t.w;$('#tD').value=TE.t.d;teDraw()};
['tW','tD','tGround','tFence','tModelRot'].forEach(id=>$('#'+id).addEventListener('change',readTop));
// foto aérea y modelo del terreno
$('#tPhoto').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;const err=$('#tErr');err.hidden=true;
  if(f.size>20*1024*1024){err.textContent='La foto pesa demasiado (máximo 20 MB).';err.hidden=false;e.target.value='';return}
  try{const r=await DK.resizeImage(f,2000);TE.pPhoto=r.blob;TE.photoPrev=r.dataUrl;TE.dirty=true;$('#tPhotoDel').hidden=false;teDraw()}catch(ex){err.textContent=ex.message;err.hidden=false;e.target.value=''}
});
$('#tPhotoDel').onclick=()=>{TE.pPhoto='quitar';TE.photoPrev='';TE.dirty=true;$('#tPhoto').value='';$('#tPhotoDel').hidden=true;teDraw()};
$('#tModel').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const err=$('#tErr');err.hidden=true;
  if(!/\.glb$/i.test(f.name)){err.textContent='El modelo debe ser un archivo .glb.';err.hidden=false;e.target.value='';return}
  if(f.size>30*1024*1024){err.textContent='El modelo pesa más de 30 MB. Redúcelo para que cargue rápido en el celular.';err.hidden=false;e.target.value='';return}
  TE.pModel=f;TE.dirty=true;$('#tModelDel').hidden=false;$('#tModelNote').textContent='Modelo elegido: '+f.name+'. Se guardará al pulsar "Guardar terreno".';
});
$('#tModelDel').onclick=()=>{TE.pModel='quitar';TE.dirty=true;$('#tModel').value='';$('#tModelDel').hidden=true;$('#tModelNote').textContent='Se quitará el modelo al guardar; se usará el terreno dibujado.'};
$('#tSave').onclick=()=>{
  const err=$('#tErr');err.hidden=true;
  doAct(async()=>{
    const t=DK.sanitizeTerrain(TE.t),sv=$('#tSave');sv.disabled=true;
    try{
      if(TE.pPhoto==='quitar')t.photo='';else if(TE.pPhoto)t.photo=await API.uploadFile('img',TE.pPhoto,'terreno');
      if(TE.pModel==='quitar')t.model='';else if(TE.pModel)t.model=await API.uploadFile('model',TE.pModel,'terreno');
      await API.saveTerrain(t);TE.dirty=false;
    }finally{sv.disabled=false}
  },'Terreno guardado');
};
$('#tReset').onclick=()=>{
  if(!confirm('¿Volver al terreno de ejemplo? Pierdes los cambios hasta que pulses "Guardar terreno".'))return;
  const had=!!TE.t.photo||!!TE.photoPrev,hadM=!!TE.t.model;
  TE.t=DK.sanitizeTerrain(DK.DEFAULT_TERRAIN);TE.sel=null;TE.photoPrev='';TE.pPhoto=had?'quitar':null;TE.pModel=hadM?'quitar':null;TE.dirty=true;teFill();teDraw();teSel();
};

$('#tPreset').onclick=()=>{
  if(!confirm('¿Cargar la parcela de Divertí Kids dibujada desde la foto satelital? Las medidas son aproximadas; ajústalas y pulsa "Guardar terreno".'))return;
  const had=!!TE.t.photo||!!TE.photoPrev,hadM=!!TE.t.model;
  TE.t=DK.sanitizeTerrain(DK.PRESET_DIVERTI);TE.sel=null;TE.photoPrev='';TE.pPhoto=had?'quitar':null;TE.pModel=hadM?'quitar':null;TE.dirty=true;teFill();teDraw();teSel();
};


/* ============ Pestañas, cartera, cumpleaños, balance y ofertas ============ */
function setTab(t){$$('#aTabs [data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab===t));$$('.tabpane').forEach(p=>p.hidden=p.id!=='tab-'+t)}
$$('#aTabs [data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
const fd=s=>s?s.split('-').reverse().join('-'):'—';
const MES=m=>MESES[m][0].toUpperCase()+MESES[m].slice(1);
const ageOf=nac=>{if(!nac)return '';const b=parseISO(nac);let a=today.getFullYear()-b.getFullYear();if(today<new Date(today.getFullYear(),b.getMonth(),b.getDate()))a--;return a};
const fmtDM=d=>d.getDate()+' de '+MESES[d.getMonth()];
const siteUrl=()=>location.href.replace(/admin\.html.*$/,'index.html');
const waBtn=(phone,text,label)=>`<a class="btn sm" href="${esc(DK.waUrl(phone,text))}" target="_blank" rel="noopener">${label||'WhatsApp'}</a>`;
function renderExtra(){renderClientes();renderCumple();renderBalance();renderOfertas();renderDomicilio()}

/* ---------- descarga en Excel (con respaldo CSV si no cargó la librería) ---------- */
function download(name,sheets){
  if(window.XLSX){
    const wb=XLSX.utils.book_new();
    sheets.forEach(sh=>{const ws=XLSX.utils.aoa_to_sheet(sh.rows);ws['!cols']=sh.rows[0].map((_,i)=>({wch:Math.min(46,Math.max(10,...sh.rows.map(r=>String(r[i]==null?'':r[i]).length)+2))}));XLSX.utils.book_append_sheet(wb,ws,sh.name.slice(0,31))});
    XLSX.writeFile(wb,name+'.xlsx');return 'xlsx';
  }
  const csv='﻿'+sheets[0].rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();
  toast('No cargó la librería de Excel: se descargó la primera hoja en CSV (se abre en Excel).');return 'csv';
}

/* ---------- clientes ---------- */
let CLI=[];
function renderClientes(){
  CLI=DK.buildClients(DB.res,DB.clientes);
  const q=DK.normTxt($('#cSearch').value),qd=$('#cSearch').value.replace(/\D/g,'');
  const rows=CLI.filter(c=>!q||DK.normTxt(c.apoderado+' '+c.nino).includes(q)||(qd&&String(c.celular).replace(/\D/g,'').includes(qd)));
  $('#cliBody').innerHTML=rows.length?rows.map(c=>{
    const last=c.eventos[c.eventos.length-1];
    return `<tr><td><b>${esc(c.apoderado)}</b>${c.correo?`<br><span class="note">${esc(c.correo)}</span>`:''}</td><td>${esc(c.nino||'—')}</td><td>${c.nacimiento?fd(c.nacimiento)+`<br><span class="note">${ageOf(c.nacimiento)} años</span>`:'—'}</td><td>${esc(c.celular)}</td><td class="num">${c.eventos.length}${c.ultimo?`<br><span class="note">último ${fd(c.ultimo)}</span>`:''}</td><td>${last?esc(last.arrendo||'—'):'—'}</td><td class="num">${CLP(c.total)}</td>
      <td style="white-space:nowrap">${waBtn(c.celular,'','WhatsApp')}${c.extraId!=null?` <button class="btn sm" data-kedit="${c.extraId}">Editar</button> <button class="btn sm" data-kdel="${c.extraId}">Eliminar</button>`:''}</td></tr>`}).join(''):'<tr><td colspan="8" class="muted">Aún no hay clientes. Se agregan solos con cada reserva, o puedes añadirlos abajo.</td></tr>';
  $$('[data-kedit]').forEach(b=>b.onclick=()=>fillCli(DB.clientes.find(x=>String(x.id)===b.dataset.kedit)));
  $$('[data-kdel]').forEach(b=>b.onclick=()=>{const c=DB.clientes.find(x=>String(x.id)===b.dataset.kdel);if(c&&confirm(`¿Eliminar a ${c.apoderado} (${c.nino}) de la cartera?`))doAct(()=>API.deleteCliente(c.id),'Cliente eliminado')});
}
$('#cSearch').addEventListener('input',renderClientes);
function clearCli(){['kId','kApo','kNino','kNac','kCel','kMail','kArr','kFecha','kMonto','kNotas'].forEach(i=>$('#'+i).value='');$('#cFormT').textContent='Agregar cliente';$('#kCancel').hidden=true;$('#kErr').hidden=true}
function fillCli(c){if(!c)return;$('#kId').value=c.id;$('#kApo').value=c.apoderado;$('#kNino').value=c.nino;$('#kNac').value=c.nacimiento||'';$('#kCel').value=c.celular;$('#kMail').value=c.correo||'';$('#kArr').value=c.arrendo||'';$('#kFecha').value=c.fecha||'';$('#kMonto').value=c.monto===''?'':c.monto;$('#kNotas').value=c.notas||'';$('#cFormT').textContent='Editar cliente';$('#kCancel').hidden=false;$('#cliForm').scrollIntoView({behavior:'smooth',block:'center'})}
$('#kCancel').onclick=clearCli;
$('#cliForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#kErr');err.hidden=true;
  const c={id:$('#kId').value?(isNaN(+$('#kId').value)?$('#kId').value:+$('#kId').value):undefined,apoderado:$('#kApo').value.trim(),nino:$('#kNino').value.trim(),nacimiento:$('#kNac').value,celular:$('#kCel').value.trim(),correo:$('#kMail').value.trim(),arrendo:$('#kArr').value.trim(),fecha:$('#kFecha').value,monto:$('#kMonto').value===''?'':Math.round(+$('#kMonto').value),notas:$('#kNotas').value.trim()};
  const bad=c.apoderado.length<3?'Escribe el nombre del apoderado.':c.nino.length<2?'Escribe el nombre del niño o niña.':c.celular.replace(/\D/g,'').length<8?'Escribe un celular de al menos 8 dígitos.':'';
  if(bad){err.textContent=bad;err.hidden=false;return}
  doAct(async()=>{await API.saveCliente(c);clearCli()},c.id?'Cliente actualizado':'Cliente agregado');
});
$('#xlsClientes').onclick=()=>{
  const evs=[];CLI.forEach(c=>c.eventos.forEach(v=>evs.push([v.fecha?fd(v.fecha):'',v.fecha?MES(parseISO(v.fecha).getMonth()):'',c.apoderado,c.nino,c.celular,v.modalidad==='domicilio'?'Domicilio':'Parcela',v.direccion||'',v.arrendo,v.total,v.estado,v.folio])));
  evs.sort((a,b)=>String(a[0]).split('-').reverse().join('').localeCompare(String(b[0]).split('-').reverse().join('')));
  const bd=CLI.filter(c=>c.nacimiento).map(c=>{const n=DK.nextBirthday(c.nacimiento);return [c.nino,c.apoderado,c.celular,fmtDM(n.date),n.age,n.days]}).sort((a,b)=>a[5]-b[5]);
  download('Divertikids_clientes_'+iso(today),[
   {name:'Clientes',rows:[['Apoderado','Niño/a','Nacimiento','Edad','Celular','Correo','Eventos','Último evento','Lo que arrendó (último)','Total pagado (CLP)'],...CLI.map(c=>{const l=c.eventos[c.eventos.length-1];return [c.apoderado,c.nino,c.nacimiento?fd(c.nacimiento):'',c.nacimiento?ageOf(c.nacimiento):'',c.celular,c.correo,c.eventos.length,c.ultimo?fd(c.ultimo):'',l?l.arrendo:'',c.total]})]},
   {name:'Eventos',rows:[['Fecha','Mes','Apoderado','Niño/a','Celular','Modalidad','Dirección (domicilio)','Lo que arrendó','Total (CLP)','Estado','Folio'],...evs]},
   {name:'Cumpleaños',rows:[['Niño/a','Apoderado','Celular','Próximo cumpleaños','Edad que cumple','Días que faltan'],...bd]}]);
};

/* ---------- cumpleaños ---------- */
const TPL_KEY='dk-msg-tpl';
const TPL_DEF='Hola {apoderado} 👋 Somos Divertí Kids. Se acerca el cumpleaños de {nino} ({edad} años, el {fecha}) y nos encantaría ayudarte a celebrarlo otra vez. {ofertas}Mira precios, elige la fecha y arma la fiesta en 3D aquí: {sitio}';
try{$('#msgTpl').value=localStorage.getItem(TPL_KEY)||TPL_DEF}catch(e){$('#msgTpl').value=TPL_DEF}
$('#msgTpl').addEventListener('input',()=>{try{localStorage.setItem(TPL_KEY,$('#msgTpl').value)}catch(e){}renderCumple()});
const activeOffers=()=>DB.ofertas.filter(DK.offerActive);
function proposalText(c,n){
  const of=activeOffers();const ofTxt=of.length?'Tenemos estas ofertas: '+of.map(o=>o.titulo+' ('+o.texto+')').join('; ')+'. ':'';
  return ($('#msgTpl').value||TPL_DEF).replace(/\{apoderado\}/g,c.apoderado.split(' ')[0]).replace(/\{nino\}/g,c.nino).replace(/\{edad\}/g,n.age).replace(/\{fecha\}/g,fmtDM(n.date)).replace(/\{ofertas\}/g,ofTxt).replace(/\{sitio\}/g,siteUrl());
}
const propKey=(c,n)=>DK.phoneKey(c.celular)+'|'+DK.normTxt(c.nino)+'|'+n.year;
function renderCumple(){
  const withEv=CLI.filter(c=>c.nacimiento&&c.nino&&c.eventos.length);
  // destacados: cumplen en los próximos 30 días o cumplieron hace menos de 15
  const hl=[];
  withEv.forEach(c=>{const n=DK.nextBirthday(c.nacimiento),l=DK.lastBirthday(c.nacimiento);
    if(n.days<=30)hl.push({c,when:n.days,txt:n.days===0?'¡Cumple años hoy!':`Cumple ${n.age} años en ${n.days} día${n.days===1?'':'s'} (${fmtDM(n.date)})`,cls:n.days<=7?'soon':'near'});
    else if(l.days<=14)hl.push({c,when:-l.days,txt:`Estuvo de cumpleaños hace ${l.days} día${l.days===1?'':'s'} (cumplió ${l.age})`,cls:'past'});
  });
  hl.sort((a,b)=>Math.abs(a.when)-Math.abs(b.when));
  $('#cumpleHl').innerHTML=hl.length?hl.map(({c,txt,cls})=>{const l=c.eventos[c.eventos.length-1];return `<article class="hlcard ${cls}"><b>${esc(c.nino)}</b><span>${esc(txt)}</span><span class="note">Arrendó${l&&l.arrendo?': '+esc(l.arrendo):''}${l&&l.fecha?' · '+fd(l.fecha):''}</span><span class="note">Apoderado: ${esc(c.apoderado)}</span></article>`}).join(''):'<p class="muted">No hay cumpleaños cercanos entre los clientes que ya arrendaron.</p>';
  const rows=withEv.map(c=>({c,n:DK.nextBirthday(c.nacimiento)})).filter(x=>x.n.days<=35).sort((a,b)=>a.n.days-b.n.days);
  $('#propBody').innerHTML=rows.length?rows.map(({c,n})=>{const sent=DB.propuestas.includes(propKey(c,n));
    return `<tr><td><b>${esc(c.nino)}</b></td><td>${fmtDM(n.date)}<br><span class="note">cumple ${n.age} · ${n.days===0?'hoy':'en '+n.days+' día'+(n.days===1?'':'s')}</span></td><td>${esc(c.apoderado)}</td><td>${esc(c.celular)}</td>
     <td style="white-space:nowrap">${sent?'<span class="badge ok">Enviada</span>':`${waBtn(c.celular,proposalText(c,n),'Enviar por WhatsApp')} <button class="btn sm" data-sent="${esc(propKey(c,n))}">Marcar enviada</button>`}</td></tr>`}).join(''):'<tr><td colspan="5" class="muted">No hay propuestas por enviar este mes.</td></tr>';
  $$('[data-sent]').forEach(b=>b.onclick=()=>doAct(()=>API.markProposal(b.dataset.sent),'Propuesta marcada como enviada'));
}

/* ---------- balance mensual ---------- */
const BAL={year:today.getFullYear(),month:today.getMonth()};
function balYears(){const ys=new Set([today.getFullYear()]);DB.res.forEach(r=>r.date&&ys.add(+r.date.slice(0,4)));DB.clientes.forEach(c=>c.fecha&&ys.add(+c.fecha.slice(0,4)));return [...ys].sort()}
$('#balYear').onchange=()=>{BAL.year=+$('#balYear').value;renderBalance()};
$('#balMonth').innerHTML=MESES.map((m,i)=>`<option value="${i}">${MES(i)}</option>`).join('');
$('#balMonth').value=String(BAL.month);
$('#balMonth').onchange=()=>{BAL.month=+$('#balMonth').value;renderBalance()};
function eventsOf(year,month){
  const out=[];
  DB.res.filter(r=>r.status!=='cancelada'&&r.status!=='por_pagar'&&r.date).forEach(r=>{const d=parseISO(r.date);if(d.getFullYear()===year&&(month==null||d.getMonth()===month)){const it=Object.entries(r.items||{}).map(([k,q])=>(byId(k)?byId(k).name:k)+(q>1?' ×'+q:''));if(r.parcela)it.unshift('Parcela');else if(r.modalidad==='domicilio')it.unshift('A domicilio');out.push({fecha:r.date,cliente:r.client.name,nino:r.client.kid||'',modalidad:r.modalidad==='domicilio'?'Domicilio':'Parcela',arrendo:it.join(', '),total:r.total,estado:r.status})}});
  DB.clientes.filter(c=>c.fecha).forEach(c=>{const d=parseISO(c.fecha);if(d.getFullYear()===year&&(month==null||d.getMonth()===month))out.push({fecha:c.fecha,cliente:c.apoderado,nino:c.nino,modalidad:'—',arrendo:c.arrendo||'',total:+c.monto||0,estado:'finalizada'})});
  return out.sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function renderBalance(){
  const ys=balYears();if(!ys.includes(BAL.year))BAL.year=ys[ys.length-1];
  $('#balYear').innerHTML=ys.map(y=>`<option ${y===BAL.year?'selected':''}>${y}</option>`).join('');
  const rows=DK.monthlyBalance(DB.res,DB.clientes,BAL.year);
  const T=rows.reduce((a,r)=>{['eventos','contratado','abonos','saldos','porCobrar','cobrado'].forEach(k=>a[k]+=r[k]);return a},{eventos:0,contratado:0,abonos:0,saldos:0,porCobrar:0,cobrado:0});
  $('#balMetrics').innerHTML=`<div class="panel"><span class="eyebrow">Eventos del año</span><b>${T.eventos}</b></div><div class="panel"><span class="eyebrow">Contratado</span><b>${CLP(T.contratado)}</b></div><div class="panel"><span class="eyebrow">Cobrado</span><b>${CLP(T.cobrado)}</b></div><div class="panel"><span class="eyebrow">Por cobrar</span><b>${CLP(T.porCobrar)}</b></div>`;
  $('#balBody').innerHTML=rows.map(r=>`<tr${r.m===today.getMonth()&&BAL.year===today.getFullYear()?' class="cur"':''}><td>${MES(r.m)}</td><td class="num">${r.eventos}</td><td class="num">${CLP(r.contratado)}</td><td class="num">${CLP(r.abonos)}</td><td class="num">${CLP(r.saldos)}</td><td class="num"><b>${CLP(r.cobrado)}</b></td><td class="num">${CLP(r.porCobrar)}</td></tr>`).join('')+`<tr class="tot"><td>Total ${BAL.year}</td><td class="num">${T.eventos}</td><td class="num">${CLP(T.contratado)}</td><td class="num">${CLP(T.abonos)}</td><td class="num">${CLP(T.saldos)}</td><td class="num"><b>${CLP(T.cobrado)}</b></td><td class="num">${CLP(T.porCobrar)}</td></tr>`;
  const mx=Math.max(1,...rows.map(r=>r.contratado));
  $('#balBars').innerHTML=rows.map(r=>`<div class="bcol" title="${MES(r.m)}: ${CLP(r.contratado)}"><div class="bar-c" style="height:${Math.round(r.contratado/mx*100)}%"><i style="height:${r.contratado?Math.round(r.cobrado/r.contratado*100):0}%"></i></div><span>${MES(r.m).slice(0,3)}</span></div>`).join('');
  const ev=eventsOf(BAL.year,BAL.month);
  $('#evBody').innerHTML=ev.length?ev.map(e=>`<tr><td>${fd(e.fecha)}</td><td>${esc(e.cliente)}</td><td>${esc(e.nino||'—')}</td><td>${esc(e.modalidad)}</td><td>${esc(e.arrendo||'—')}</td><td class="num">${CLP(e.total)}</td><td>${esc(e.estado)}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">No hay eventos ese mes.</td></tr>';
}
$('#xlsBalance').onclick=()=>{
  const rows=DK.monthlyBalance(DB.res,DB.clientes,BAL.year);
  const sum=k=>rows.reduce((a,r)=>a+r[k],0);
  download('Divertikids_balance_'+BAL.year,[
   {name:'Balance '+BAL.year,rows:[['Mes','Eventos','Contratado (CLP)','Abonos cobrados','Saldos cobrados','Total cobrado','Por cobrar'],...rows.map(r=>[MES(r.m),r.eventos,r.contratado,r.abonos,r.saldos,r.cobrado,r.porCobrar]),['Total',sum('eventos'),sum('contratado'),sum('abonos'),sum('saldos'),sum('cobrado'),sum('porCobrar')]]},
   {name:'Eventos '+BAL.year,rows:[['Fecha','Mes','Cliente','Niño/a','Modalidad','Lo que arrendó','Total (CLP)','Estado'],...eventsOf(BAL.year).map(e=>[fd(e.fecha),MES(parseISO(e.fecha).getMonth()),e.cliente,e.nino,e.modalidad,e.arrendo,e.total,e.estado])]}]);
};

/* ---------- ofertas ---------- */
function clearOf(){['oId','oTit','oTxt','oHasta'].forEach(i=>$('#'+i).value='');$('#oAct').value='1';$('#oFormT').textContent='Nueva oferta';$('#oCancel').hidden=true;$('#oErr').hidden=true}
$('#oCancel').onclick=clearOf;
function renderOfertas(){
  $('#ofList').innerHTML=DB.ofertas.length?DB.ofertas.map(o=>{const vig=DK.offerActive(o);return `<li style="align-items:flex-start"><span><b>${esc(o.titulo)}</b> ${vig?'<span class="badge ok">Visible</span>':'<span class="badge">Oculta o vencida</span>'}<br><span class="note">${esc(o.texto)}${o.hasta?' · hasta '+fd(o.hasta):''}</span></span><span style="white-space:nowrap"><button class="btn sm" data-oedit="${esc(o.id)}">Editar</button> <button class="btn sm" data-odel="${esc(o.id)}">Quitar</button></span></li>`}).join(''):'<li><span class="muted">Aún no hay ofertas publicadas.</span><span></span></li>';
  $$('[data-oedit]').forEach(b=>b.onclick=()=>{const o=DB.ofertas.find(x=>String(x.id)===b.dataset.oedit);if(!o)return;$('#oId').value=o.id;$('#oTit').value=o.titulo;$('#oTxt').value=o.texto;$('#oHasta').value=o.hasta||'';$('#oAct').value=o.activa===false?'0':'1';$('#oFormT').textContent='Editar oferta';$('#oCancel').hidden=false;$('#ofForm').scrollIntoView({behavior:'smooth',block:'center'})});
  $$('[data-odel]').forEach(b=>b.onclick=()=>{const o=DB.ofertas.find(x=>String(x.id)===b.dataset.odel);if(o&&confirm(`¿Quitar la oferta "${o.titulo}"?`))doAct(()=>API.deleteOferta(o.id),'Oferta eliminada')});
}
$('#ofForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#oErr');err.hidden=true;
  const idv=$('#oId').value,o={id:idv?(isNaN(+idv)?idv:+idv):undefined,titulo:$('#oTit').value.trim(),texto:$('#oTxt').value.trim(),hasta:$('#oHasta').value,activa:$('#oAct').value==='1'};
  if(o.titulo.length<3||o.texto.length<3){err.textContent='Escribe un título y el detalle de la oferta.';err.hidden=false;return}
  doAct(async()=>{await API.saveOferta(o);clearOf()},o.id?'Oferta actualizada':'Oferta publicada');
});


/* ---------- domicilio: zonas de despacho y pedidos ---------- */
function clearZona(){['zId','zNom','zPrecio'].forEach(i=>$('#'+i).value='');$('#zAct').value='1';$('#zFormT').textContent='Nueva zona de despacho';$('#zCancel').hidden=true;$('#zErr').hidden=true}
$('#zCancel').onclick=clearZona;
function renderDomicilio(){
  $('#zonaList').innerHTML=DB.zonas.length?DB.zonas.map(z=>`<li style="align-items:flex-start"><span><b>${esc(z.nombre)}</b> ${z.activa!==false?'<span class="badge ok">Activa</span>':'<span class="badge">Oculta</span>'}<br><span class="note">${CLP(z.precio)}</span></span><span style="white-space:nowrap"><button class="btn sm" data-zedit="${esc(z.id)}">Editar</button> <button class="btn sm" data-zdel="${esc(z.id)}">Quitar</button></span></li>`).join(''):'<li><span class="muted">No hay zonas: sin zonas el sitio no ofrece servicio a domicilio.</span><span></span></li>';
  $$('[data-zedit]').forEach(b=>b.onclick=()=>{const z=DB.zonas.find(x=>x.id===b.dataset.zedit);if(!z)return;$('#zId').value=z.id;$('#zNom').value=z.nombre;$('#zPrecio').value=z.precio;$('#zAct').value=z.activa===false?'0':'1';$('#zFormT').textContent='Editar zona';$('#zCancel').hidden=false;$('#zonaForm').scrollIntoView({behavior:'smooth',block:'center'})});
  $$('[data-zdel]').forEach(b=>b.onclick=()=>{const z=DB.zonas.find(x=>x.id===b.dataset.zdel);if(z&&confirm(`¿Quitar la zona "${z.nombre}"? Los pedidos anteriores no se alteran.`))doAct(()=>API.deleteZona(z.id),'Zona eliminada')});
  const up=DB.res.filter(r=>r.modalidad==='domicilio'&&r.status!=='cancelada'&&r.status!=='por_pagar'&&r.date>=iso(today)).sort((a,b)=>a.date.localeCompare(b.date));
  $('#domBody').innerHTML=up.length?up.map(r=>{const L=r.lugar||{},chk=DK.siteChecks(L,r.items),n=chk.issues.length+chk.warns.length;return `<tr><td>${fd(r.date)}<br><span class="note">${SLOTS[r.slot].n}</span></td><td>${esc(r.client.name)}<br><span class="note">${esc(r.client.phone)}</span></td><td style="min-width:260px">${lugarHtml(r,false)||esc(L.direccion||'—')}</td><td>${Object.entries(r.items).map(([k,q])=>esc(byId(k)?byId(k).name:k)+(q>1?' ×'+q:'')).join(', ')}</td><td>${n?`<span class="badge warn">${n} alerta${n>1?'s':''}</span><br><span class="note">${chk.issues.concat(chk.warns).map(esc).join('<br>')}</span>`:'<span class="badge ok">Sin alertas</span>'}</td></tr>`}).join(''):'<tr><td colspan="5" class="muted">No hay pedidos a domicilio próximos.</td></tr>';
}
$('#zonaForm').addEventListener('submit',e=>{
  e.preventDefault();const err=$('#zErr');err.hidden=true;
  const nombre=$('#zNom').value.trim(),precio=Math.round(+$('#zPrecio').value);let id=$('#zId').value;
  if(nombre.length<3){err.textContent='Escribe el nombre de la zona.';err.hidden=false;return}
  if(!($('#zPrecio').value!==''&&precio>=0)){err.textContent='Escribe el precio del despacho.';err.hidden=false;return}
  if(!id)id=nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,26)+'-'+Math.random().toString(36).slice(2,4);
  const old=DB.zonas.find(z=>z.id===id);
  doAct(async()=>{await API.saveZona({id,nombre,precio,activa:$('#zAct').value==='1',orden:old&&old.orden||100+DB.zonas.length*10});clearZona()},old?'Zona actualizada':'Zona agregada');
});

/* ---------- arranque ---------- */
if(API.mode==='demo'){$('#demoHint').hidden=false;$('#dUser').textContent=API.demoUser;$('#dPass').textContent=API.demoPass;$('#lMail').value=API.demoUser}
try{const s=await API.session();if(s)await enter(s);else show('login')}
catch(e){console.error(e);show('login');const er=$('#lErr');er.textContent='No se pudo conectar con la base de datos: '+(e.message||'revisa config.js');er.hidden=false}
})();
