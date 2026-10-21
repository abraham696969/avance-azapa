-- =====================================================================
-- Divertí Kids · esquema de base de datos para Supabase (PostgreSQL)
-- Pégalo completo en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.catalogo (
  item_id text primary key,
  nombre  text not null,
  precio  integer not null check (precio >= 0),
  stock   integer not null check (stock >= 0)
);

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
  estado      text not null default 'pendiente'
              check (estado in ('pendiente','confirmada','finalizada','cancelada')),
  creada      timestamptz not null default now()
);
create index if not exists reservas_fecha_idx on public.reservas (fecha, franja);

-- Quiénes son administradores (usuarios de Supabase Auth)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Catálogo inicial ----------
insert into public.catalogo (item_id, nombre, precio, stock) values
  ('castillo','Castillo inflable',45000,2),
  ('tobogan','Tobogán inflable',70000,1),
  ('cancha','Cancha inflable',60000,1),
  ('tacataca','Mesa de taca-taca',18000,3),
  ('pingpong','Mesa de ping pong',15000,2),
  ('papas','Máquina de papas fritas',40000,2),
  ('algodon','Algodón de azúcar',30000,2),
  ('completos','Máquina de completos',35000,2),
  ('piscinaS','Piscina chica',20000,3),
  ('piscinaL','Piscina grande',35000,2),
  ('parcela','Arriendo de la parcela',150000,1)
on conflict (item_id) do nothing;

-- ---------- Funciones auxiliares ----------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Disponibilidad pública: solo fecha, franja y qué se arrendó. SIN datos de clientes.
create or replace function public.disponibilidad()
returns table (fecha date, franja text, items jsonb, parcela boolean)
language sql stable security definer set search_path = public as $$
  select r.fecha, r.franja, r.items, r.parcela
  from public.reservas r
  where r.estado <> 'cancelada' and r.fecha >= current_date;
$$;

-- Crear reserva: el servidor recalcula precios y valida disponibilidad (no confía en el navegador).
create or replace function public.crear_reserva(
  p_fecha date, p_franja text, p_nombre text, p_email text, p_telefono text,
  p_invitados integer, p_items jsonb, p_parcela boolean, p_layout jsonb,
  p_metodo text, p_transaccion text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0; v_abono integer; v_folio text;
  v_key text; v_qty integer; v_cat public.catalogo%rowtype; v_usado integer;
begin
  if p_franja not in ('manana','tarde') then raise exception 'Franja horaria no válida.'; end if;
  if p_fecha is null or p_fecha <= current_date then raise exception 'Elige una fecha futura.'; end if;
  if length(trim(coalesce(p_nombre,''))) < 3 then raise exception 'Escribe tu nombre.'; end if;
  if coalesce(p_email,'') !~ '^\S+@\S+\.\S+$' then raise exception 'Correo no válido.'; end if;
  if length(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g')) < 8 then raise exception 'Teléfono no válido.'; end if;
  if p_invitados is null or p_invitados < 1 or p_invitados > 200 then raise exception 'Cantidad de invitados no válida.'; end if;
  if jsonb_typeof(coalesce(p_items,'{}'::jsonb)) <> 'object' then raise exception 'Servicios no válidos.'; end if;

  -- Evita dos reservas simultáneas para la misma fecha y franja
  perform pg_advisory_xact_lock(hashtext(p_fecha::text || p_franja));

  if exists (select 1 from public.fechas_bloqueadas where fecha = p_fecha) then
    raise exception 'Esa fecha está bloqueada. Elige otra.';
  end if;
  if exists (select 1 from public.reservas where fecha = p_fecha and franja = p_franja
             and parcela and estado <> 'cancelada') then
    raise exception 'La parcela ya fue reservada en esa franja. Elige otra fecha o franja.';
  end if;

  for v_key, v_qty in
    select key, (value)::text::integer from jsonb_each(coalesce(p_items,'{}'::jsonb))
  loop
    if v_qty is null or v_qty < 1 or v_key = 'parcela' then raise exception 'Servicios no válidos.'; end if;
    select * into v_cat from public.catalogo where item_id = v_key;
    if not found then raise exception 'Servicio desconocido: %', v_key; end if;
    select coalesce(sum((r.items ->> v_key)::integer), 0) into v_usado
      from public.reservas r
      where r.fecha = p_fecha and r.franja = p_franja and r.estado <> 'cancelada';
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

  v_abono := round(v_total * 0.30);
  v_folio := 'R-' || nextval('public.folio_seq');

  -- Queda "pendiente" hasta que el equipo valide el abono (ver INSTRUCCIONES.md sobre pagos reales)
  insert into public.reservas (folio, fecha, franja, nombre, email, telefono, invitados, items, parcela, layout,
                               total, abono, metodo_pago, transaccion, estado)
  values (v_folio, p_fecha, p_franja, trim(p_nombre), trim(p_email), trim(p_telefono), p_invitados,
          coalesce(p_items,'{}'::jsonb), coalesce(p_parcela,true), coalesce(p_layout,'[]'::jsonb),
          v_total, v_abono, p_metodo, p_transaccion, 'pendiente');

  return jsonb_build_object('folio', v_folio, 'total', v_total, 'abono', v_abono, 'estado', 'pendiente');
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
create policy "todos ven el catalogo" on public.catalogo for select to anon, authenticated using (true);
drop policy if exists "admin edita el catalogo" on public.catalogo;
create policy "admin edita el catalogo" on public.catalogo
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "todos ven fechas bloqueadas" on public.fechas_bloqueadas;
create policy "todos ven fechas bloqueadas" on public.fechas_bloqueadas for select to anon, authenticated using (true);
drop policy if exists "admin gestiona bloqueos" on public.fechas_bloqueadas;
create policy "admin gestiona bloqueos" on public.fechas_bloqueadas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Permisos de ejecución de las funciones
revoke all on function public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text) from public;
grant execute on function public.crear_reserva(date,text,text,text,text,integer,jsonb,boolean,jsonb,text,text) to anon, authenticated;
revoke all on function public.disponibilidad() from public;
grant execute on function public.disponibilidad() to anon, authenticated;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;
