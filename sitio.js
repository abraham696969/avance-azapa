/* Divertí Kids · navegación por páginas y detalles interactivos del sitio público.
   La lógica de reservas, simulador, pago y chatbot sigue en app.js; este archivo solo:
   - muestra una página a la vez (Inicio, Juegos y servicios, Arma tu fiesta, Reservar, Contacto),
   - marca el menú y los pasos de la reserva,
   - agrega animaciones (entrada de página, aparición al hacer scroll, "vuelo" al carrito).
   Con ?todo=1 en la dirección se ven todas las páginas juntas (lo usan las pruebas automáticas). */
(function(){
'use strict';
const PAGINAS={inicio:'Divertí Kids · Juegos y eventos infantiles en Arica',servicios:'Juegos y servicios · Divertí Kids',fiesta:'Arma tu fiesta · Divertí Kids',reservar:'Reserva y paga · Divertí Kids',contacto:'Contacto · Divertí Kids'};
const RECORRIDO=['servicios','fiesta','reservar'];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const qs=new URLSearchParams(location.search);
let TODO=false;
try{if(qs.has('todo'))sessionStorage.setItem('dk-todo','1');TODO=sessionStorage.getItem('dk-todo')==='1'}catch(e){TODO=qs.has('todo')}
const QUIETO=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('todo',TODO);

/* ---------- páginas ---------- */
const paginaDe=id=>{if(PAGINAS[id])return id;const el=id&&document.getElementById(id);const p=el&&el.closest('.page');return p?p.dataset.page:null};
let actual=null;
function irA(destino,suave){
  const el=destino&&document.getElementById(destino);
  if(!el)return;
  requestAnimationFrame(()=>el.scrollIntoView({behavior:suave&&!QUIETO?'smooth':'auto',block:'start'}));
}
function mostrar(nombre,destino){
  if(TODO){if(destino)irA(destino,true);return}
  const cambia=nombre!==actual;
  $$('.page').forEach(p=>{
    const on=p.dataset.page===nombre;
    p.hidden=!on;p.classList.toggle('activa',on);
    if(on&&cambia&&!QUIETO){p.classList.remove('entrando');void p.offsetWidth;p.classList.add('entrando');clearTimeout(p._t);p._t=setTimeout(()=>p.classList.remove('entrando'),900)}
  });
  actual=nombre;
  document.title=PAGINAS[nombre];
  $$('[data-nav]').forEach(a=>{if(a.dataset.nav===nombre)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  // pasos de la reserva
  const i=RECORRIDO.indexOf(nombre),pasos=$('#pasos');
  pasos.classList.toggle('visible',i>=0);
  $$('[data-paso]').forEach((a,k)=>{a.classList.toggle('actual',k===i);a.classList.toggle('hecho',i>k)});
  if(destino&&destino!==nombre)irA(destino,!cambia);
  else if(cambia)window.scrollTo({top:0,behavior:'auto'});
}
function ruta(){
  const h=decodeURIComponent(location.hash.slice(1));
  const p=paginaDe(h)||'inicio';
  mostrar(p,h&&h!==p?h:null);
}
// un enlace a la misma dirección no dispara hashchange: igual se lleva al destino
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');
  if(a&&a.getAttribute('href')===location.hash){e.preventDefault();ruta()}
});
window.addEventListener('hashchange',ruta);
if(qs.get('folio')&&qs.get('c'))mostrar('reservar');   // vuelta desde el pago en Flow
else ruta();

/* ---------- accesos de la portada ---------- */
document.addEventListener('click',e=>{
  const m=e.target.closest('[data-ir-modo]');
  if(m){const b=document.querySelector(`[data-modo="${m.dataset.irModo}"]`);b&&b.click();location.hash='servicios';return}
  const c=e.target.closest('[data-ir-cat]');
  if(c){const nombre=(window.DK&&DK.CATS||{})[c.dataset.irCat];
    setTimeout(()=>{const t=$$('#tabs .tab').find(x=>x.textContent===nombre);t&&t.click()},0);return}
  if(e.target.closest('[data-abrir-chat]')){const f=$('#chatFab');f&&!f.hidden&&f.click()}
});
// si el servicio a domicilio no está habilitado, la portada no lo ofrece; en domicilio la página 2 es solo la fecha
const sync=()=>{
  const modo=$('#modo'),ird=$('#irDomicilio');if(modo&&ird)ird.hidden=modo.hidden;
  const sim=$('#simulador'),dom=sim&&sim.hidden;
  const p2=$('[data-paso="fiesta"] span');if(p2)p2.textContent=dom?'Elige la fecha':'Fecha y diseño';
  const ban=$('[data-page="fiesta"] .pbanner p');if(ban)ban.textContent=dom?'Elige el día y la franja. Los datos de tu casa o local los completas al reservar.':'Elige el día y la franja, y distribuye los juegos en la parcela para ver cómo queda.';
};
['#modo','#simulador'].forEach(s=>{const el=$(s);el&&new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['hidden']})});
sync();

/* ---------- datos del negocio en Contacto ---------- */
{const N=window.DK_NEGOCIO||{};
 if(N.direccion)$('#nDir').textContent=N.direccion;
 if(N.atencion){$('#nHor').textContent=N.atencion;$('#nHorBox').hidden=false}
 if(N.correo){$('#nMail').textContent=N.correo;$('#nMailBox').hidden=false}
 if(N.whatsappVisible)$('#cWa').textContent=N.whatsappVisible}

/* ---------- "vuelo" al carrito al agregar un servicio ---------- */
const cantidad=()=>parseInt(($('#cartpill')||{}).textContent,10)||0;
let antes=null;
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-add],[data-dp],[data-p]'))antes=cantidad()},true);
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-add],[data-dp],[data-p]');if(!b||QUIETO)return;
  const r=b.getBoundingClientRect(),prev=antes==null?cantidad():antes;antes=null;
  setTimeout(()=>{if(cantidad()>prev)volar(r)},40);
});
function volar(r){
  const pill=$('#cartpill');if(!pill)return;const d=pill.getBoundingClientRect();
  const v=document.createElement('span');v.className='vuela';v.style.left=(r.left+r.width/2-14)+'px';v.style.top=(r.top+r.height/2-14)+'px';
  document.body.appendChild(v);
  const dx=d.left+d.width/2-(r.left+r.width/2),dy=d.top+d.height/2-(r.top+r.height/2);
  const a=v.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5-80}px) scale(1.15)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(.35)`,opacity:.7}],{duration:700,easing:'cubic-bezier(.45,0,.55,1)'});
  a.onfinish=()=>v.remove();
}
{const pill=$('#cartpill');let ult=pill&&pill.textContent;
 pill&&new MutationObserver(()=>{if(pill.textContent!==ult){ult=pill.textContent;pill.classList.remove('bump');void pill.offsetWidth;pill.classList.add('bump')}}).observe(pill,{childList:true,characterData:true,subtree:true})}

/* ---------- aparición al hacer scroll ---------- */
if(!TODO&&!QUIETO&&'IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add('visto');io.unobserve(en.target)}}),{threshold:.12});
  $$('.cats .cat,.como li,.modos2 .modo2,.contactos .contacto,.cta-band,.sec-head,.datos-neg').forEach((el,i)=>{el.classList.add('rev');el.style.setProperty('--d',(i%4)*80+'ms');io.observe(el)});
}

/* ---------- la ilustración de la portada sigue un poco al mouse ---------- */
{const h=$('.hero-ilus');
 if(h&&!QUIETO&&matchMedia('(pointer:fine)').matches){
   document.querySelector('.hero2').addEventListener('pointermove',e=>{const r=h.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;h.style.setProperty('--px',(x*14).toFixed(1)+'px');h.style.setProperty('--py',(y*10).toFixed(1)+'px')});
 }}

window.DKNav={mostrar:n=>mostrar(paginaDe(n)||'inicio',n),actual:()=>actual,todo:TODO};
})();
