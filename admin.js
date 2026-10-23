(async function(){
'use strict';
const {$,$$,CLP,esc,iso,parseISO,fmtDate,today,addDays,toast,SLOTS,CAT,CATS,SHAPES,byId,OBST,TERR,API,applyCatalog,numHex}=DK;
let DB={res:[],blocked:[],catalog:{}};
const openDet=new Set();

/* ---------- vistas ---------- */
function show(which){$('#loginView').hidden=which!=='login';$('#panelView').hidden=which!=='panel'}
function setBadge(){const b=$('#modeBadge');b.textContent=API.mode==='supabase'?'Base de datos conectada':'Modo demo';b.className='modebadge'+(API.mode==='supabase'?' live':'')}

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
  render();
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
    tr.innerHTML=`<td><b>${esc(r.id)}</b>${r.example?'<br><span class="note">ejemplo</span>':''}</td><td>${fmtDate(r.date).replace(/ de \d{4}$/,'')}<br><span class="note">${SLOTS[r.slot].n}</span></td><td>${esc(r.client.name)}<br><span class="note">${r.client.guests} invitados</span></td><td class="num">${CLP(r.total)}</td><td class="num">${CLP(r.abono)}</td>
    <td><select data-st="${esc(r.id)}" aria-label="Estado de ${esc(r.id)}">${['por_pagar','pendiente','confirmada','finalizada','cancelada'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></td>
    <td><button class="btn sm" data-det="${esc(r.id)}">${openDet.has(r.id)?'Ocultar':'Ver distribución'}</button></td>`;
    tb.appendChild(tr);
    if(openDet.has(r.id)){const d=document.createElement('tr');d.innerHTML=`<td colspan="7"><div class="detail"><div>${svgPlan(r)}</div><div><b>Servicios</b><ul style="margin:6px 0 0;padding-left:18px">${r.parcela?'<li>Arriendo de la parcela</li>':''}${Object.entries(r.items).map(([k,v])=>`<li>${esc(byId(k)?byId(k).name:k)} × ${v}</li>`).join('')}</ul><p class="note" style="margin-top:8px">${esc(r.client.email)} · ${esc(r.client.phone)}</p><p class="note">Pago: ${esc(r.method||'—')} · ${esc(r.txn||'—')}</p>${r.note?`<p class="note" style="color:var(--bad);font-weight:600">${esc(r.note)}</p>`:''}</div></div></td>`;tb.appendChild(d)}
  });
  $$('[data-st]').forEach(s=>s.onchange=()=>doAct(()=>API.setStatus(s.dataset.st,s.value),'Estado actualizado'));
  $$('[data-det]').forEach(b=>b.onclick=()=>{const k=b.dataset.det;openDet.has(k)?openDet.delete(k):openDet.add(k);render()});
  $('#blockList').innerHTML=DB.blocked.length?DB.blocked.map(b=>`<li><span>${fmtDate(b.date)}<br><span class="note">${esc(b.why)}</span></span><button class="btn sm" data-unb="${b.date}">Quitar</button></li>`).join(''):'<li><span class="muted">No hay fechas bloqueadas</span><span></span></li>';
  $$('[data-unb]').forEach(b=>b.onclick=()=>doAct(()=>API.removeBlock(b.dataset.unb),'Fecha desbloqueada'));
  $('#priceBody').innerHTML=CAT.map(i=>`<tr><td>${i.img?`<img class="thumb" src="${esc(i.img)}" alt="" loading="lazy"> `:''}<b>${esc(i.name)}</b>${i.model?' <span class="badge ok">3D real</span>':''}<br><span class="note">${esc(i.desc||'')}</span></td><td>${esc(CATS[i.cat]||i.cat)}</td><td><input class="p num" type="number" min="0" step="1000" value="${i.price}" data-pr="${i.id}" aria-label="Precio de ${esc(i.name)}"></td><td><input class="p num" style="width:70px" type="number" min="0" step="1" value="${i.stock}" data-sk="${i.id}" aria-label="Stock de ${esc(i.name)}"></td><td class="num">${i.w} × ${i.d} × ${i.h} m</td><td style="white-space:nowrap"><button class="btn sm" data-edit="${i.id}">Editar</button> ${i.id==='parcela'?'':`<button class="btn sm" data-del="${i.id}">Eliminar</button>`}</td></tr>`).join('');
  const quick=id=>{const it=byId(id);const p=Math.max(0,Math.round(+document.querySelector(`[data-pr="${id}"]`).value||0)),k=Math.max(0,Math.round(+document.querySelector(`[data-sk="${id}"]`).value||0));doAct(()=>API.saveService(Object.assign({},it,{price:p,stock:k})),'Servicio actualizado')};
  $$('[data-pr]').forEach(inp=>inp.onchange=()=>quick(inp.dataset.pr));
  $$('[data-sk]').forEach(inp=>inp.onchange=()=>quick(inp.dataset.sk));
  $$('[data-edit]').forEach(b=>b.onclick=()=>fillForm(byId(b.dataset.edit)));
  $$('[data-del]').forEach(b=>b.onclick=()=>{const it=byId(b.dataset.del);if(confirm(`¿Eliminar "${it.name}" del sitio?\nLas reservas anteriores no se alteran.`))doAct(()=>API.deleteService(it.id),'Servicio eliminado')});
}
$('#blockForm').addEventListener('submit',e=>{e.preventDefault();const d=$('#bDate').value;
  if(!d||parseISO(d)<=today){toast('Elige una fecha futura');return}
  if(DB.blocked.some(b=>b.date===d)){toast('Esa fecha ya está bloqueada');return}
  doAct(()=>API.addBlock(d,$('#bWhy').value.trim()||'Sin motivo'),'Fecha bloqueada')});
$('#bDate').min=iso(addDays(today,1));

/* ---------- formulario de servicios ---------- */
$('#sCat').innerHTML=Object.entries(CATS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
$('#sShape').innerHTML=Object.entries(SHAPES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
let pImg=null,pModel=null;   // archivos elegidos y aún no guardados ('quitar' = borrar el actual)
let curImg='',curModel='';
function showImg(src){const p=$('#sImgPrev');if(src){p.src=src;p.hidden=false}else{p.removeAttribute('src');p.hidden=true}$('#sImgDel').hidden=!src}
function showModel(has,name){$('#sModelDel').hidden=!has;$('#sModelNote').textContent=has?('Modelo cargado: '+(name||'actual')+'. Se ajusta al ancho y largo reales.'):'Si no subes uno, el simulador usa una figura simple con las medidas y el color de arriba. El modelo se ajusta solo al ancho y largo reales.'}
if(API.mode==='demo'){$('#sModel').disabled=true;$('#sModelNote').textContent='Los modelos 3D reales se pueden subir cuando conectes la base de datos (Supabase). En modo demo se usa la figura simple.'}
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
function clearForm(){pImg=null;pModel=null;curImg='';curModel='';$('#sImg').value='';$('#sModel').value='';$('#sModelRot').value='0';showImg('');showModel(false);['sId','sName','sDesc','sPrice','sStock','sW','sD','sH'].forEach(i=>$('#'+i).value='');$('#sColor').value='#3d7bff';$('#sCat').value='juegos';$('#sShape').value='castle';$('#svcFormT').textContent='Agregar servicio';$('#sCancel').hidden=true;$('#sErr').hidden=true}
function fillForm(it){
  $('#sId').value=it.id;$('#sName').value=it.name;$('#sDesc').value=it.desc||'';$('#sCat').value=it.cat;$('#sShape').value=it.shape==='land'?'castle':it.shape;
  $('#sPrice').value=it.price;$('#sStock').value=it.stock;$('#sW').value=it.w;$('#sD').value=it.d;$('#sH').value=it.h;$('#sColor').value=numHex(it.color);
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
if(API.mode==='demo'){$('#tModel').disabled=true;$('#tModelNote').textContent='Los modelos 3D del terreno se pueden subir cuando conectes la base de datos (Supabase). En modo demo se usa el terreno dibujado.'}
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

/* ---------- arranque ---------- */
if(API.mode==='demo'){$('#demoHint').hidden=false;$('#dUser').textContent=API.demoUser;$('#dPass').textContent=API.demoPass;$('#lMail').value=API.demoUser}
try{const s=await API.session();if(s)await enter(s);else show('login')}
catch(e){console.error(e);show('login');const er=$('#lErr');er.textContent='No se pudo conectar con la base de datos: '+(e.message||'revisa config.js');er.hidden=false}
})();
