-- Cuentas de clientes: se reutiliza demo_clientes, sin crear otra tabla de usuarios.
-- auth_user_id conecta cada cliente con Supabase Auth y permite ver solo sus propias reservas.

alter table public.demo_clientes
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists demo_clientes_auth_user_idx on public.demo_clientes (auth_user_id);

create or replace function public.demo_mi_perfil()
returns table (id uuid, nombre varchar, telefono varchar, email varchar)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  return query
  select c.id, c.nombre, c.telefono, c.email
  from public.demo_clientes c
  where c.auth_user_id = auth.uid();
end;
$$;

create or replace function public.demo_actualizar_mi_perfil(
  p_nombre varchar,
  p_telefono varchar
)
returns table (id uuid, nombre varchar, telefono varchar, email varchar)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_email varchar;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' then
    raise exception 'Nombre y teléfono son obligatorios.' using errcode = '22023';
  end if;

  v_email := auth.jwt() ->> 'email';

  select c.id into v_cliente_id
  from public.demo_clientes c
  where c.auth_user_id = auth.uid()
  for update;

  if v_cliente_id is not null then
    update public.demo_clientes c
    set nombre = trim(p_nombre), telefono = trim(p_telefono), email = v_email
    where c.id = v_cliente_id;
  else
    select c.id into v_cliente_id
    from public.demo_clientes c
    where c.telefono = trim(p_telefono)
      and c.auth_user_id is null
    for update;

    if v_cliente_id is not null then
      update public.demo_clientes c
      set auth_user_id = auth.uid(), nombre = trim(p_nombre), email = v_email
      where c.id = v_cliente_id;
    else
      insert into public.demo_clientes as cliente (auth_user_id, nombre, telefono, email)
      values (auth.uid(), trim(p_nombre), trim(p_telefono), v_email)
      returning cliente.id into v_cliente_id;
    end if;
  end if;

  return query
  select c.id, c.nombre, c.telefono, c.email
  from public.demo_clientes c
  where c.id = v_cliente_id;
end;
$$;

create or replace function public.demo_mis_reservas()
returns table (
  id uuid,
  codigo varchar,
  estado varchar,
  inicio_at timestamptz,
  fin_at timestamptz,
  cancha_nombre varchar,
  nombre_equipo varchar,
  notas_cliente text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  return query
  select r.id, r.codigo, r.estado, r.inicio_at, r.fin_at, c.nombre,
    r.nombre_equipo, r.notas_cliente, r.created_at
  from public.demo_reservas r
  join public.demo_clientes cl on cl.id = r.cliente_id
  join public.demo_canchas c on c.id = r.cancha_id
  where cl.auth_user_id = auth.uid()
  order by r.inicio_at desc;
end;
$$;

-- La versión anterior permitía enviar nombre/teléfono de invitado. Se reemplaza
-- por una que usa exclusivamente el perfil del usuario autenticado.
drop function if exists public.demo_crear_reserva(uuid, uuid, date, time, varchar, varchar, varchar, text);

create or replace function public.demo_crear_reserva(
  p_complejo_id uuid,
  p_cancha_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_nombre_equipo varchar default null,
  p_notas text default null
)
returns table (reserva_id uuid, codigo varchar, estado varchar)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_duracion smallint;
  v_inicio_local timestamp;
  v_fin_local timestamp;
  v_inicio_at timestamptz;
  v_fin_at timestamptz;
  v_codigo varchar(24);
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para solicitar una reserva.' using errcode = '42501';
  end if;

  select cl.id into v_cliente_id
  from public.demo_clientes cl
  where cl.auth_user_id = auth.uid();

  if v_cliente_id is null then
    raise exception 'Completa primero los datos de tu perfil.' using errcode = '22023';
  end if;

  if p_fecha < (now() at time zone 'America/Guayaquil')::date then
    raise exception 'No puedes solicitar horarios de fechas pasadas.' using errcode = '22023';
  end if;

  select c.duracion_reserva_minutos into v_duracion
  from public.demo_canchas c
  where c.id = p_cancha_id and c.complejo_id = p_complejo_id and c.activa = true;

  if v_duracion is null then
    raise exception 'La cancha seleccionada no está disponible.' using errcode = '22023';
  end if;

  v_inicio_local := p_fecha + p_hora_inicio;
  v_fin_local := v_inicio_local + make_interval(mins => v_duracion);

  if not exists (
    select 1 from public.demo_horarios_canchas h
    where h.cancha_id = p_cancha_id and h.activo = true
      and h.dia_semana = extract(dow from p_fecha)::smallint
      and p_hora_inicio >= h.hora_inicio and v_fin_local::time <= h.hora_fin
  ) then
    raise exception 'Ese horario ya no pertenece a la disponibilidad de la cancha.' using errcode = '22023';
  end if;

  v_inicio_at := v_inicio_local at time zone 'America/Guayaquil';
  v_fin_at := v_fin_local at time zone 'America/Guayaquil';
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.demo_reservas (
    codigo, complejo_id, cancha_id, cliente_id, inicio_at, fin_at,
    estado, origen, nombre_equipo, notas_cliente
  ) values (
    v_codigo, p_complejo_id, p_cancha_id, v_cliente_id, v_inicio_at, v_fin_at,
    'PENDIENTE', 'WEB', nullif(trim(p_nombre_equipo), ''), nullif(trim(p_notas), '')
  );

  insert into public.demo_reserva_historial (reserva_id, estado_nuevo, comentario)
  select r.id, 'PENDIENTE', 'Solicitud creada desde la página web.'
  from public.demo_reservas r where r.codigo = v_codigo;

  return query
  select r.id, r.codigo, r.estado
  from public.demo_reservas r where r.codigo = v_codigo;
end;
$$;

revoke all on function public.demo_mi_perfil() from public;
revoke all on function public.demo_actualizar_mi_perfil(varchar, varchar) from public;
revoke all on function public.demo_mis_reservas() from public;
revoke all on function public.demo_crear_reserva(uuid, uuid, date, time, varchar, text) from public;

grant execute on function public.demo_mi_perfil() to authenticated;
grant execute on function public.demo_actualizar_mi_perfil(varchar, varchar) to authenticated;
grant execute on function public.demo_mis_reservas() to authenticated;
grant execute on function public.demo_crear_reserva(uuid, uuid, date, time, varchar, text) to authenticated;

-- Hace que PostgREST/Supabase detecte inmediatamente las funciones nuevas.
notify pgrst, 'reload schema';
