-- Flujo de reservas para la demo.
-- Público: crea una solicitud PENDIENTE y consulta únicamente los horarios ocupados.
-- Administración: requiere un usuario de Supabase Auth con el correo autorizado abajo.

create or replace function public.demo_es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Antes de ejecutar esta migración reemplaza el texto por tu correo de administrador.
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('REEMPLAZA_CON_TU_CORREO@EJEMPLO.COM');
$$;

create or replace function public.demo_horarios_bloqueados(
  p_cancha_id uuid,
  p_desde date,
  p_hasta date
)
returns table (fecha date, hora_inicio time, hora_fin time)
language sql
stable
security definer
set search_path = public
as $$
  select
    (r.inicio_at at time zone 'America/Guayaquil')::date as fecha,
    (r.inicio_at at time zone 'America/Guayaquil')::time as hora_inicio,
    (r.fin_at at time zone 'America/Guayaquil')::time as hora_fin
  from public.demo_reservas r
  where r.cancha_id = p_cancha_id
    and r.estado in ('PENDIENTE', 'CONFIRMADA')
    and (r.inicio_at at time zone 'America/Guayaquil')::date between p_desde and p_hasta;
$$;

create or replace function public.demo_crear_reserva(
  p_complejo_id uuid,
  p_cancha_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_nombre varchar,
  p_telefono varchar,
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
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' then
    raise exception 'Nombre y teléfono son obligatorios.' using errcode = '22023';
  end if;

  if p_fecha < (now() at time zone 'America/Guayaquil')::date then
    raise exception 'No puedes solicitar horarios de fechas pasadas.' using errcode = '22023';
  end if;

  select c.duracion_reserva_minutos
    into v_duracion
  from public.demo_canchas c
  where c.id = p_cancha_id
    and c.complejo_id = p_complejo_id
    and c.activa = true;

  if v_duracion is null then
    raise exception 'La cancha seleccionada no está disponible.' using errcode = '22023';
  end if;

  v_inicio_local := p_fecha + p_hora_inicio;
  v_fin_local := v_inicio_local + make_interval(mins => v_duracion);

  if not exists (
    select 1
    from public.demo_horarios_canchas h
    where h.cancha_id = p_cancha_id
      and h.activo = true
      and h.dia_semana = extract(dow from p_fecha)::smallint
      and p_hora_inicio >= h.hora_inicio
      and v_fin_local::time <= h.hora_fin
  ) then
    raise exception 'Ese horario ya no pertenece a la disponibilidad de la cancha.' using errcode = '22023';
  end if;

  v_inicio_at := v_inicio_local at time zone 'America/Guayaquil';
  v_fin_at := v_fin_local at time zone 'America/Guayaquil';

  insert into public.demo_clientes (nombre, telefono)
  values (trim(p_nombre), trim(p_telefono))
  on conflict (telefono) do update
    set nombre = excluded.nombre
  returning id into v_cliente_id;

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
  from public.demo_reservas r
  where r.codigo = v_codigo;

  return query
  select r.id, r.codigo, r.estado
  from public.demo_reservas r
  where r.codigo = v_codigo;
end;
$$;

create or replace function public.demo_admin_reservas()
returns table (
  id uuid,
  codigo varchar,
  estado varchar,
  inicio_at timestamptz,
  fin_at timestamptz,
  cancha_nombre varchar,
  cliente_nombre varchar,
  cliente_telefono varchar,
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
  if not public.demo_es_administrador() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  return query
  select r.id, r.codigo, r.estado, r.inicio_at, r.fin_at, c.nombre,
    cl.nombre, cl.telefono, r.nombre_equipo, r.notas_cliente, r.created_at
  from public.demo_reservas r
  join public.demo_canchas c on c.id = r.cancha_id
  left join public.demo_clientes cl on cl.id = r.cliente_id
  order by case when r.estado = 'PENDIENTE' then 0 else 1 end, r.inicio_at asc;
end;
$$;

create or replace function public.demo_admin_actualizar_reserva(
  p_reserva_id uuid,
  p_estado varchar,
  p_comentario text default null
)
returns table (id uuid, estado varchar)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_anterior varchar;
begin
  if not public.demo_es_administrador() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  if p_estado not in ('CONFIRMADA', 'CANCELADA', 'FINALIZADA', 'NO_ASISTIO') then
    raise exception 'Estado no permitido.' using errcode = '22023';
  end if;

  select r.estado into v_estado_anterior from public.demo_reservas r where r.id = p_reserva_id for update;
  if v_estado_anterior is null then
    raise exception 'No existe la reserva solicitada.' using errcode = '22023';
  end if;

  update public.demo_reservas r
  set estado = p_estado,
      confirmado_at = case when p_estado = 'CONFIRMADA' then timezone('utc', now()) else confirmado_at end,
      cancelado_at = case when p_estado = 'CANCELADA' then timezone('utc', now()) else cancelado_at end
  where r.id = p_reserva_id;

  insert into public.demo_reserva_historial (reserva_id, estado_anterior, estado_nuevo, comentario)
  values (p_reserva_id, v_estado_anterior, p_estado, nullif(trim(p_comentario), ''));

  return query select r.id, r.estado from public.demo_reservas r where r.id = p_reserva_id;
end;
$$;

revoke all on function public.demo_horarios_bloqueados(uuid, date, date) from public;
revoke all on function public.demo_crear_reserva(uuid, uuid, date, time, varchar, varchar, varchar, text) from public;
revoke all on function public.demo_admin_reservas() from public;
revoke all on function public.demo_admin_actualizar_reserva(uuid, varchar, text) from public;

grant execute on function public.demo_horarios_bloqueados(uuid, date, date) to anon, authenticated;
grant execute on function public.demo_crear_reserva(uuid, uuid, date, time, varchar, varchar, varchar, text) to anon, authenticated;
grant execute on function public.demo_admin_reservas() to authenticated;
grant execute on function public.demo_admin_actualizar_reserva(uuid, varchar, text) to authenticated;
