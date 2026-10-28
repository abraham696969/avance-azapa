-- =====================================================================
-- Divertí Kids · esquema de base de datos para Supabase (PostgreSQL)
-- Pégalo completo en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar más de una vez (también sobre una versión anterior) sin perder datos.
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.catalogo (
  item_id text primary key,
  nombre  text not null,
  precio  integer not null check (precio >= 0),
  stock   integer not null check (stock >= 0)
);
-- columnas del catálogo editable desde el panel (si ya existían, no se tocan)
alter table public.catalogo add column if not exists descripcion text;
alter table public.catalogo add column if not exists categoria  text    not null default 'juegos'
  check (categoria in ('juegos','comida','piscinas','local'));
alter table public.catalogo add column if not exists ancho      numeric(5,2) not null default 2 check (ancho between 0.3 and 30);
alter table public.catalogo add column if not exists largo      numeric(5,2) not null default 2 check (largo between 0.3 and 30);
alter table public.catalogo add column if not exists alto       numeric(5,2) not null default 1.5 check (alto between 0 and 8);
alter table public.catalogo add column if not exists color      text    not null default '#3d7bff' check (color ~ '^#[0-9a-fA-F]{6}$');
alter table public.catalogo add column if not exists color_tope text    check (color_tope is null or color_tope ~ '^#[0-9a-fA-F]{6}$');
alter table public.catalogo add column if not exists forma      text    not null default 'box'
  check (forma in ('castle','slide','field','table','pingpong','machine','pool','box','land'));
alter table public.catalogo add column if not exists activo     boolean not null default true;
alter table public.catalogo add column if not exists orden      integer not null default 100;

create table if not exists public.fechas_bloqueadas (
  fecha  date primary key,
  motivo text
);

create sequence if not exists public.folio_seq start 1001;

create table if not exists public.reservas (
  id          bigint generated always as identity primary key,
  folio       text unique not null,
  fecha       date not null,
  franja      text not null check (franja in ('manana','tarde')),
  nombre      text not null,
  email       text not null,
  telefono    text not null,
  invitados   integer not null check (invitados between 1 and 200),
  items       jsonb not null default '{}'::jsonb,   -- {"castillo":1,"papas":2}
  parcela     boolean not null default true,
  layout      jsonb not null default '[]'::jsonb,   -- distribución 3D: [{"id","x","z","rot"}]
  total       integer not null,
  abono       integer not null,
  metodo_pago text,
  transaccion text,
  estado      text not null default 'pendiente',
  creada      timestamptz not null default now()
);
-- campos del pago en línea (Flow)
alter table public.reservas add column if not exists codigo     text not null default substr(replace(gen_random_uuid()::text,'-',''),1,16);
alter table public.reservas add column if not exists expira     timestamptz;     -- hasta cuándo se guarda el cupo mientras se paga
alter table public.reservas add column if not exists flow_token text;
alter table public.reservas add column if not exists flow_orden bigint;
alter table public.reservas add column if not exists pagada_en  timestamptz;
alter table public.reservas add column if not exists nota       text;
-- datos del niño o niña cumpleañero/a (para la cartera de clientes y el aviso de cumpleaños)
alter table public.reservas add column if not exists nombre_nino      text;
alter table public.reservas add column if not exists nacimiento_nino  date;
alter table public.reservas add column if not exists acepta_datos     boolean not null default false;

-- estados: por_pagar (esperando el pago en Flow), pendiente (el equipo debe validar), confirmada, finalizada, cancelada
alter table public.reservas drop constraint if exists reservas_estado_check;
alter table public.reservas add  constraint reservas_estado_check
  check (estado in ('por_pagar','pendiente','confirmada','finalizada','cancelada'));
create index if not exists reservas_fecha_idx on public.reservas (fecha, franja);

-- Quiénes son administradores (usuarios de Supabase Auth)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Catálogo inicial ----------
insert into public.catalogo (item_id,nombre,descripcion,categoria,precio,stock,ancho,largo,alto,color,color_tope,forma,activo,orden) values
  ('castillo','Castillo inflable','Torres y salto libre para los más chicos.','juegos',45000,2,4.5,4.5,3.5,'#ff5fa2',null,'castle',true,10),
  ('tobogan','Tobogán inflable','Rampa de subida y bajada con plataforma.','juegos',70000,1,4,7,4.5,'#3d7bff',null,'slide',true,20),
  ('cancha','Cancha inflable','Para fútbol o juegos de equipo.','juegos',60000,1,6,4,2.2,'#2bb673',null,'field',true,30),
  ('tacataca','Mesa de taca-taca','Taca-taca de madera para 2 a 4 jugadores.','juegos',18000,3,1.5,0.9,0.9,'#8a5a2b',null,'table',true,40),
  ('pingpong','Mesa de ping pong','Reglamentaria, con paletas y pelotas.','juegos',15000,2,2.7,1.5,0.8,'#1e6bb8',null,'pingpong',true,50),
  ('papas','Máquina de papas fritas','Papas calientes en el momento.','comida',40000,2,1.2,1.2,1.6,'#ffc21a','#e0402f','machine',true,60),
  ('algodon','Algodón de azúcar','Con carro y conos.','comida',30000,2,1.1,1.1,1.5,'#f56fa6','#ffffff','machine',true,70),
  ('completos','Máquina de completos','Completos armados al instante.','comida',35000,2,1.4,1.1,1.6,'#e0402f','#ffc21a','machine',true,80),
  ('piscinaS','Piscina chica','Diámetro 3 m, para los más pequeños.','piscinas',20000,3,3,3,0.6,'#39a0ff',null,'pool',true,90),
  ('piscinaL','Piscina grande','Diámetro 5 m, hasta 12 niños.','piscinas',35000,2,5,5,0.8,'#1f86e8',null,'pool',true,100),
  ('parcela','Arriendo de la parcela','Recinto completo de 30 × 20 m con cerco, quincho y árboles.','local',150000,1,30,20,0,'#7ccf7a',null,'land',true,110)
on conflict (item_id) do update set
  descripcion = excluded.descripcion, categoria = excluded.categoria, ancho = excluded.ancho, largo = excluded.largo,
  alto = excluded.alto, color = excluded.color, color_tope = excluded.color_tope, forma = excluded.forma, orden = excluded.orden
  where public.catalogo.descripcion is null;   -- solo completa filas de una versión anterior; no pisa lo que editaste

-- ---------- Funciones auxiliares ----------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ¿la reserva ocupa cupo? (las "por_pagar" lo ocupan solo hasta que vence su plazo)
create or replace function public.reserva_vigente(p_estado text, p_expira timestamptz)
returns boolean language sql stable as $$
  select p_estado in ('pendiente','confirmada','finalizada')
      or (p_estado = 'por_pagar' and p_expira is not null and p_expira > now());
$$;

-- Disponibilidad pública: solo fecha, franja y qué se arrendó. SIN datos de clientes.
create or replace function public.disponibilidad()
returns table (fecha date, franja text, items jsonb, parcela boolean)
language sql stable security definer set search_path = public as $$
  select r.fecha, r.franja, r.items, r.parcela
  from public.reservas r
  where public.reserva_vigente(r.estado, r.expira) and r.fecha >= current_date;
$$;

-- Crear reserva: el servidor recalcula precios y valida disponibilidad (no confía en el navegador).
-- p_online = true  -> queda "por_pagar" (30 min de plazo) y se paga en Flow
-- p_online = false -> queda "pendiente" y el equipo valida el abono a mano
drop function if exists public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text);
drop function if exists public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text,boolean);
create or replace function public.crear_reserva(
  p_fecha date, p_franja text, p_nombre text, p_email text, p_telefono text,
  p_invitados integer, p_items jsonb, p_parcela boolean, p_layout jsonb,
  p_metodo text, p_transaccion text, p_online boolean default false,
  p_nino text default null, p_nacimiento date default null, p_acepta boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0; v_abono integer; v_folio text; v_codigo text; v_estado text;
  v_key text; v_qty integer; v_cat public.catalogo%rowtype; v_usado integer;
begin
  if p_franja not in ('manana','tarde') then raise exception 'Franja horaria no válida.'; end if;
  if p_fecha is null or p_fecha <= current_date then raise exception 'Elige una fecha futura.'; end if;
  if length(trim(coalesce(p_nombre,''))) < 3 then raise exception 'Escribe tu nombre.'; end if;
  if coalesce(p_email,'') !~ '^\S+@\S+\.\S+$' then raise exception 'Correo no válido.'; end if;
  if length(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g')) < 8 then raise exception 'Teléfono no válido.'; end if;
  if p_invitados is null or p_invitados < 1 or p_invitados > 200 then raise exception 'Cantidad de invitados no válida.'; end if;
  if jsonb_typeof(coalesce(p_items,'{}'::jsonb)) <> 'object' then raise exception 'Servicios no válidos.'; end if;
  if length(trim(coalesce(p_nino,''))) < 2 then raise exception 'Escribe el nombre del niño o niña cumpleañero/a.'; end if;
  if p_nacimiento is null or p_nacimiento > current_date or p_nacimiento < current_date - interval '25 years' then
    raise exception 'La fecha de nacimiento del niño o niña no es válida.'; end if;
  if not coalesce(p_acepta,false) then raise exception 'Debes aceptar el uso de los datos para continuar.'; end if;

  -- Evita dos reservas simultáneas para la misma fecha y franja
  perform pg_advisory_xact_lock(hashtext(p_fecha::text || p_franja));

  if exists (select 1 from public.fechas_bloqueadas where fecha = p_fecha) then
    raise exception 'Esa fecha está bloqueada. Elige otra.';
  end if;
  if exists (select 1 from public.reservas r where r.fecha = p_fecha and r.franja = p_franja
             and r.parcela and public.reserva_vigente(r.estado, r.expira)) then
    raise exception 'La parcela ya fue reservada en esa franja. Elige otra fecha o franja.';
  end if;

  for v_key, v_qty in
    select key, (value)::text::integer from jsonb_each(coalesce(p_items,'{}'::jsonb))
  loop
    if v_qty is null or v_qty < 1 or v_key = 'parcela' then raise exception 'Servicios no válidos.'; end if;
    select * into v_cat from public.catalogo where item_id = v_key and activo;
    if not found then raise exception 'El servicio "%" ya no está disponible.', v_key; end if;
    select coalesce(sum((r.items ->> v_key)::integer), 0) into v_usado
      from public.reservas r
      where r.fecha = p_fecha and r.franja = p_franja and public.reserva_vigente(r.estado, r.expira);
    if v_usado + v_qty > v_cat.stock then
      raise exception 'Ya no quedan suficientes "%" para esa fecha y franja.', v_cat.nombre;
    end if;
    v_total := v_total + v_cat.precio * v_qty;
  end loop;

  if coalesce(p_parcela, true) then
    select * into v_cat from public.catalogo where item_id = 'parcela';
    v_total := v_total + v_cat.precio;
  end if;
  if v_total <= 0 then raise exception 'Tu cotización está vacía.'; end if;

  v_abono  := round(v_total * 0.30);
  v_folio  := 'R-' || nextval('public.folio_seq');
  v_estado := case when coalesce(p_online,false) then 'por_pagar' else 'pendiente' end;

  insert into public.reservas (folio, fecha, franja, nombre, email, telefono, invitados, items, parcela, layout,
                               total, abono, metodo_pago, transaccion, estado, expira, nombre_nino, nacimiento_nino, acepta_datos)
  values (v_folio, p_fecha, p_franja, trim(p_nombre), trim(p_email), trim(p_telefono), p_invitados,
          coalesce(p_items,'{}'::jsonb), coalesce(p_parcela,true), coalesce(p_layout,'[]'::jsonb),
          v_total, v_abono, p_metodo, p_transaccion, v_estado,
          case when v_estado = 'por_pagar' then now() + interval '30 minutes' end,
          trim(p_nino), p_nacimiento, true)
  returning codigo into v_codigo;

  return jsonb_build_object('folio', v_folio, 'codigo', v_codigo, 'total', v_total, 'abono', v_abono, 'estado', v_estado);
end;
$$;

-- Estado de una reserva para la pantalla de retorno del pago (exige folio + código secreto)
create or replace function public.estado_reserva(p_folio text, p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'folio', r.folio, 'fecha', r.fecha, 'franja', r.franja, 'total', r.total, 'abono', r.abono,
      'estado', case when r.estado = 'por_pagar' and (r.expira is null or r.expira <= now()) then 'expirada' else r.estado end)
    from public.reservas r where r.folio = p_folio and r.codigo = p_codigo), 'null'::jsonb);
$$;

-- Lo llaman SOLO las funciones de servidor (Edge Functions) cuando Flow informa el resultado de un pago.
-- p_status de Flow: 1 = pendiente de pago, 2 = pagada, 3 = rechazada, 4 = anulada
create or replace function public.marcar_pago(p_folio text, p_status integer, p_flow_orden bigint, p_monto integer)
returns text language plpgsql security definer set search_path = public as $$
declare r public.reservas%rowtype;
begin
  select * into r from public.reservas where folio = p_folio for update;
  if not found then return 'no_existe'; end if;
  if r.estado in ('confirmada','finalizada') then return 'ya_confirmada'; end if;

  if p_status = 2 then
    if p_monto is distinct from r.abono then
      update public.reservas set estado = 'pendiente', flow_orden = p_flow_orden,
        nota = 'Flow informó un pago de ' || p_monto || ' y el abono era ' || r.abono || '. Revisar.' where id = r.id;
      return 'monto_distinto';
    end if;
    -- ¿el cupo se perdió mientras tanto? (pago tardío, reserva ya vencida o cancelada)
    if r.estado = 'cancelada' or (r.estado = 'por_pagar' and r.expira <= now() and exists (
         select 1 from public.reservas o where o.id <> r.id and o.fecha = r.fecha and o.franja = r.franja
           and o.parcela and r.parcela and public.reserva_vigente(o.estado, o.expira))) then
      update public.reservas set estado = 'pendiente', flow_orden = p_flow_orden, pagada_en = now(),
        nota = 'Pago recibido pero el cupo ya no estaba disponible: contactar al cliente o reembolsar.' where id = r.id;
      return 'cupo_perdido';
    end if;
    update public.reservas set estado = 'confirmada', flow_orden = p_flow_orden, pagada_en = now(),
      metodo_pago = 'Flow', transaccion = 'FLOW-' || p_flow_orden where id = r.id;
    return 'confirmada';
  elsif p_status = 4 then
    update public.reservas set estado = 'cancelada', nota = 'Pago anulado en Flow.' where id = r.id and estado = 'por_pagar';
    return 'anulada';
  end if;
  return 'sin_cambio';
end;
$$;

-- ---------- Seguridad (Row Level Security) ----------
alter table public.reservas          enable row level security;
alter table public.catalogo          enable row level security;
alter table public.fechas_bloqueadas enable row level security;
alter table public.admins            enable row level security;   -- sin políticas: nadie la lee por la API

drop policy if exists "admin gestiona reservas" on public.reservas;
create policy "admin gestiona reservas" on public.reservas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "todos ven el catalogo" on public.catalogo;
drop policy if exists "admin edita el catalogo" on public.catalogo;
drop policy if exists "publico ve servicios activos" on public.catalogo;
create policy "publico ve servicios activos" on public.catalogo for select to anon, authenticated using (activo);
drop policy if exists "admin gestiona el catalogo" on public.catalogo;
create policy "admin gestiona el catalogo" on public.catalogo
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "todos ven fechas bloqueadas" on public.fechas_bloqueadas;
create policy "todos ven fechas bloqueadas" on public.fechas_bloqueadas for select to anon, authenticated using (true);
drop policy if exists "admin gestiona bloqueos" on public.fechas_bloqueadas;
create policy "admin gestiona bloqueos" on public.fechas_bloqueadas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Permisos de ejecución de las funciones
revoke all on function public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text,boolean,text,date,boolean) from public;
grant execute on function public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text,boolean,text,date,boolean) to anon, authenticated;
revoke all on function public.disponibilidad() from public;
grant execute on function public.disponibilidad() to anon, authenticated;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;
revoke all on function public.estado_reserva(text,text) from public;
grant execute on function public.estado_reserva(text,text) to anon, authenticated;
revoke all on function public.reserva_vigente(text,timestamptz) from public;
grant execute on function public.reserva_vigente(text,timestamptz) to anon, authenticated;
revoke all on function public.marcar_pago(text,integer,bigint,integer) from public, anon, authenticated;
grant execute on function public.marcar_pago(text,integer,bigint,integer) to service_role;

-- ---------- Fotos y modelos 3D de los servicios ----------
alter table public.catalogo add column if not exists imagen text;                -- dirección pública de la foto
alter table public.catalogo add column if not exists modelo3d text;              -- dirección pública del modelo .glb
alter table public.catalogo add column if not exists modelo_rot integer not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'catalogo_modelo_rot_chk') then
    alter table public.catalogo add constraint catalogo_modelo_rot_chk check (modelo_rot in (0,90,180,270));
  end if;
end $$;

-- Carpetas de archivos (Storage): fotos hasta 5 MB y modelos hasta 30 MB. Se leen en público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('servicios', 'servicios', true, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('modelos',   'modelos',   true, 31457280, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dk ver archivos" on storage.objects;
create policy "dk ver archivos" on storage.objects for select to anon, authenticated
  using (bucket_id in ('servicios','modelos'));
drop policy if exists "dk admin sube archivos" on storage.objects;
create policy "dk admin sube archivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('servicios','modelos') and public.es_admin());
drop policy if exists "dk admin cambia archivos" on storage.objects;
create policy "dk admin cambia archivos" on storage.objects for update to authenticated
  using (bucket_id in ('servicios','modelos') and public.es_admin())
  with check (bucket_id in ('servicios','modelos') and public.es_admin());
drop policy if exists "dk admin borra archivos" on storage.objects;
create policy "dk admin borra archivos" on storage.objects for delete to authenticated
  using (bucket_id in ('servicios','modelos') and public.es_admin());

-- ---------- Terreno (la parcela del simulador 3D) ----------
create table if not exists public.terreno (
  id         integer primary key default 1 check (id = 1),          -- una sola fila
  ancho      numeric not null default 30 check (ancho between 8 and 80),
  largo      numeric not null default 20 check (largo between 6 and 60),
  suelo      text    not null default 'pasto' check (suelo in ('pasto','tierra','cemento','arena')),
  cerco      boolean not null default true,
  foto       text,                                                    -- foto aérea (dirección pública)
  modelo3d   text,                                                    -- modelo .glb del terreno (escaneo)
  modelo_rot integer not null default 0 check (modelo_rot in (0,90,180,270)),
  elementos  jsonb   not null default '[]'::jsonb
             check (jsonb_typeof(elementos) = 'array' and jsonb_array_length(elementos) <= 60),
  actualizado timestamptz not null default now()
);
insert into public.terreno (id, elementos) values (1, '[
  {"id":"q1","t":"quincho","name":"Quincho","x":-11.5,"z":-7.5,"w":6,"d":4,"rot":0},
  {"id":"a1","t":"arbol","name":"Árbol","x":12.5,"z":-6.5,"w":1.6,"d":1.6,"rot":0},
  {"id":"a2","t":"arbol","name":"Árbol","x":-12.5,"z":6,"w":1.6,"d":1.6,"rot":0},
  {"id":"a3","t":"arbol","name":"Árbol","x":9,"z":8.3,"w":1.6,"d":1.6,"rot":0}]'::jsonb)
on conflict (id) do nothing;

alter table public.terreno enable row level security;
drop policy if exists "todos ven el terreno" on public.terreno;
create policy "todos ven el terreno" on public.terreno for select to anon, authenticated using (true);
drop policy if exists "admin gestiona el terreno" on public.terreno;
create policy "admin gestiona el terreno" on public.terreno
  for all to authenticated using (public.es_admin()) with check (public.es_admin());


-- ---------- Cartera de clientes, ofertas y propuestas de cumpleaños ----------
-- Clientes que no vinieron por el sitio (anteriores o por WhatsApp). Los de las reservas se leen de "reservas".
create table if not exists public.clientes_extra (
  id          bigint generated always as identity primary key,
  apoderado   text not null,
  nino        text not null,
  nacimiento  date,
  celular     text not null,
  correo      text,
  arrendo     text,            -- qué arrendó
  fecha_evento date,
  monto       integer check (monto is null or monto >= 0),
  notas       text,
  creado      timestamptz not null default now()
);
alter table public.clientes_extra enable row level security;
drop policy if exists "admin gestiona clientes" on public.clientes_extra;
create policy "admin gestiona clientes" on public.clientes_extra
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Tablón de ofertas (se muestran en el sitio mientras estén activas y no hayan vencido)
create table if not exists public.ofertas (
  id      bigint generated always as identity primary key,
  titulo  text not null check (length(titulo) between 3 and 80),
  texto   text not null check (length(texto) between 3 and 400),
  hasta   date,
  activa  boolean not null default true,
  creada  timestamptz not null default now()
);
alter table public.ofertas enable row level security;
drop policy if exists "publico ve ofertas vigentes" on public.ofertas;
create policy "publico ve ofertas vigentes" on public.ofertas for select to anon, authenticated
  using (activa and (hasta is null or hasta >= current_date));
drop policy if exists "admin gestiona ofertas" on public.ofertas;
create policy "admin gestiona ofertas" on public.ofertas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Registro de propuestas de cumpleaños ya enviadas (una por niño y año)
create table if not exists public.propuestas (
  clave   text primary key,       -- "celular|niño|año"
  enviada timestamptz not null default now()
);
alter table public.propuestas enable row level security;
drop policy if exists "admin gestiona propuestas" on public.propuestas;
create policy "admin gestiona propuestas" on public.propuestas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
