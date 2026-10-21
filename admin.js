(async function(){
'use strict';
const {$,$$,CLP,esc,iso,parseISO,fmtDate,today,addDays,toast,SLOTS,CAT,byId,OBST,API,applyCatalog}=DK;
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
  const act=R.filter(r=>r.status!=='cancelada');
  $('#metrics').innerHTML=`<div class="panel"><span class="eyebrow">Reservas activas</span><b>${act.filter(r=>r.status!=='finalizada').length}</b></div>
   <div class="panel"><span class="eyebrow">Abonos registrados</span><b>${CLP(act.reduce((a,r)=>a+r.abono,0))}</b></div>
   <div class="panel"><span class="eyebrow">Pendientes de confirmar</span><b>${R.filter(r=>r.status==='pendiente').length}</b></div>
   <div class="panel"><span class="eyebrow">Fechas bloqueadas</span><b>${DB.blocked.length}</b></div>`;
  const tb=$('#resBody');tb.innerHTML='';
  if(!R.length)tb.innerHTML='<tr><td colspan="7" class="muted">Aún no hay reservas.</td></tr>';
  R.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><b>${esc(r.id)}</b>${r.example?'<br><span class="note">ejemplo</span>':''}</td><td>${fmtDate(r.date).replace(/ de \d{4}$/,'')}<br><span class="note">${SLOTS[r.slot].n}</span></td><td>${esc(r.client.name)}<br><span class="note">${r.client.guests} invitados</span></td><td class="num">${CLP(r.total)}</td><td class="num">${CLP(r.abono)}</td>
    <td><select data-st="${esc(r.id)}" aria-label="Estado de ${esc(r.id)}">${['pendiente','confirmada','finalizada','cancelada'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></td>
    <td><button class="btn sm" data-det="${esc(r.id)}">${openDet.has(r.id)?'Ocultar':'Ver distribución'}</button></td>`;
    tb.appendChild(tr);
    if(openDet.has(r.id)){const d=document.createElement('tr');d.innerHTML=`<td colspan="7"><div class="detail"><div>${svgPlan(r)}</div><div><b>Servicios</b><ul style="margin:6px 0 0;padding-left:18px">${r.parcela?'<li>Arriendo de la parcela</li>':''}${Object.entries(r.items).map(([k,v])=>`<li>${esc(byId(k)?byId(k).name:k)} × ${v}</li>`).join('')}</ul><p class="note" style="margin-top:8px">${esc(r.client.email)} · ${esc(r.client.phone)}</p><p class="note">Pago: ${esc(r.method||'—')} · ${esc(r.txn||'—')}</p></div></div></td>`;tb.appendChild(d)}
  });
  $$('[data-st]').forEach(s=>s.onchange=()=>doAct(()=>API.setStatus(s.dataset.st,s.value),'Estado actualizado'));
  $$('[data-det]').forEach(b=>b.onclick=()=>{const k=b.dataset.det;openDet.has(k)?openDet.delete(k):openDet.add(k);render()});
  $('#blockList').innerHTML=DB.blocked.length?DB.blocked.map(b=>`<li><span>${fmtDate(b.date)}<br><span class="note">${esc(b.why)}</span></span><button class="btn sm" data-unb="${b.date}">Quitar</button></li>`).join(''):'<li><span class="muted">No hay fechas bloqueadas</span><span></span></li>';
  $$('[data-unb]').forEach(b=>b.onclick=()=>doAct(()=>API.removeBlock(b.dataset.unb),'Fecha desbloqueada'));
  $('#priceBody').innerHTML=CAT.map(i=>`<tr><td>${esc(i.name)}</td><td><input class="p num" type="number" min="0" step="1000" value="${i.price}" data-pr="${i.id}" aria-label="Precio de ${esc(i.name)}"></td><td><input class="p num" style="width:70px" type="number" min="0" step="1" value="${i.stock}" data-sk="${i.id}" aria-label="Stock de ${esc(i.name)}"></td></tr>`).join('');
  const saveCat=id=>{const p=Math.max(0,Math.round(+document.querySelector(`[data-pr="${id}"]`).value||0)),s=Math.max(0,Math.round(+document.querySelector(`[data-sk="${id}"]`).value||0));doAct(()=>API.setCatalog(id,p,s),'Catálogo actualizado')};
  $$('[data-pr]').forEach(inp=>inp.onchange=()=>saveCat(inp.dataset.pr));
  $$('[data-sk]').forEach(inp=>inp.onchange=()=>saveCat(inp.dataset.sk));
}
$('#blockForm').addEventListener('submit',e=>{e.preventDefault();const d=$('#bDate').value;
  if(!d||parseISO(d)<=today){toast('Elige una fecha futura');return}
  if(DB.blocked.some(b=>b.date===d)){toast('Esa fecha ya está bloqueada');return}
  doAct(()=>API.addBlock(d,$('#bWhy').value.trim()||'Sin motivo'),'Fecha bloqueada')});
$('#bDate').min=iso(addDays(today,1));

/* ---------- arranque ---------- */
if(API.mode==='demo'){$('#demoHint').hidden=false;$('#dUser').textContent=API.demoUser;$('#dPass').textContent=API.demoPass;$('#lMail').value=API.demoUser}
try{const s=await API.session();if(s)await enter(s);else show('login')}
catch(e){console.error(e);show('login');const er=$('#lErr');er.textContent='No se pudo conectar con la base de datos: '+(e.message||'revisa config.js');er.hidden=false}
})();
