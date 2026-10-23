(async function(){
'use strict';
const {$,$$,CLP,esc,iso,parseISO,fmtDate,today,addDays,toast,SLOTS,CAT,CATS,SHAPES,byId,OBST,API,applyCatalog,numHex}=DK;
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
  render();
}
async function doAct(fn,okMsg){
  try{await fn();await reload();if(okMsg)toast(okMsg)}
  catch(e){console.error(e);toast('No se pudo guardar: '+(e.message||'error'));try{await reload()}catch(_){}}
}

/* ---------- panel ---------- */
const svgPlan=r=>{
  const rects=(r.layout||[]).map(p=>{const it=byId(p.id);if(!it)return '';const col='#'+it.color.toString(16).padStart(6,'0');return it.shape==='pool'?`<circle cx="${p.x}" cy="${p.z}" r="${it.w/2}" fill="${col}"/>`:`<rect x="${p.x-it.w/2}" y="${p.z-it.d/2}" width="${it.w}" height="${it.d}" fill="${col}" transform="rotate(${-p.rot*180/Math.PI} ${p.x} ${p.z})"/>`}).join('');
  const q=OBST[0];
  return `<svg viewBox="-15 -10 30 20" role="img" aria-label="Distribución en planta"><rect x="-15" y="-10" width="30" height="20" fill="#7fcf7d"/><rect x="${q.x-q.w/2}" y="${q.z-q.d/2}" width="${q.w}" height="${q.d}" fill="#e8d6b0"/>${OBST.slice(1).map(o=>`<circle cx="${o.x}" cy="${o.z}" r=".9" fill="#2f8f4e"/>`).join('')}${rects}<rect x="-2" y="9.6" width="4" height=".4" fill="#12203F"/></svg>`;
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

/* ---------- arranque ---------- */
if(API.mode==='demo'){$('#demoHint').hidden=false;$('#dUser').textContent=API.demoUser;$('#dPass').textContent=API.demoPass;$('#lMail').value=API.demoUser}
try{const s=await API.session();if(s)await enter(s);else show('login')}
catch(e){console.error(e);show('login');const er=$('#lErr');er.textContent='No se pudo conectar con la base de datos: '+(e.message||'revisa config.js');er.hidden=false}
})();
