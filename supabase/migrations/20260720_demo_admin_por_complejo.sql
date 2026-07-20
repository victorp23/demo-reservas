-- Un único administrador autenticado por complejo.
-- El usuario se configura en demo_complejos.admin_auth_user_id; no se usa el
-- correo ni user_metadata para autorizar, porque esos datos pueden cambiar.

alter table public.demo_complejos
  add column if not exists admin_auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists demo_complejos_un_admin_por_usuario_idx
  on public.demo_complejos (admin_auth_user_id)
  where admin_auth_user_id is not null;

-- Reemplaza la autorización provisional por correo incluida en la primera demo.
drop function if exists public.demo_admin_reservas();
drop function if exists public.demo_admin_actualizar_reserva(uuid, varchar, text);
drop function if exists public.demo_es_administrador();

create or replace function public.demo_es_administrador(p_complejo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.demo_complejos c
    where c.id = p_complejo_id
      and c.admin_auth_user_id = auth.uid()
  );
$$;

create or replace function public.demo_admin_reservas(p_complejo_id uuid)
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
  if not public.demo_es_administrador(p_complejo_id) then
    raise exception 'No autorizado para este complejo.' using errcode = '42501';
  end if;

  return query
  select r.id, r.codigo, r.estado, r.inicio_at, r.fin_at, c.nombre,
    cl.nombre, cl.telefono, r.nombre_equipo, r.notas_cliente, r.created_at
  from public.demo_reservas r
  join public.demo_canchas c on c.id = r.cancha_id
  left join public.demo_clientes cl on cl.id = r.cliente_id
  where r.complejo_id = p_complejo_id
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
  v_complejo_id uuid;
begin
  select r.estado, r.complejo_id
    into v_estado_anterior, v_complejo_id
  from public.demo_reservas r
  where r.id = p_reserva_id
  for update;

  if v_complejo_id is null then
    raise exception 'No existe la reserva solicitada.' using errcode = '22023';
  end if;

  if not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para esta reserva.' using errcode = '42501';
  end if;

  if p_estado not in ('CONFIRMADA', 'CANCELADA', 'FINALIZADA', 'NO_ASISTIO') then
    raise exception 'Estado no permitido.' using errcode = '22023';
  end if;

  update public.demo_reservas r
  set estado = p_estado,
      confirmado_at = case when p_estado = 'CONFIRMADA' then timezone('utc', now()) else r.confirmado_at end,
      cancelado_at = case when p_estado = 'CANCELADA' then timezone('utc', now()) else r.cancelado_at end
  where r.id = p_reserva_id;

  insert into public.demo_reserva_historial (reserva_id, estado_anterior, estado_nuevo, comentario)
  values (p_reserva_id, v_estado_anterior, p_estado, nullif(trim(p_comentario), ''));

  return query
  select r.id, r.estado from public.demo_reservas r where r.id = p_reserva_id;
end;
$$;

create or replace function public.demo_admin_torneos(p_complejo_id uuid)
returns table (
  id uuid,
  nombre varchar,
  descripcion text,
  categoria varchar,
  fecha_inicio date,
  fecha_fin date,
  estado varchar,
  formato varchar,
  equipos bigint,
  partidos bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.demo_es_administrador(p_complejo_id) then
    raise exception 'No autorizado para este complejo.' using errcode = '42501';
  end if;

  return query
  select t.id, t.nombre, t.descripcion, t.categoria, t.fecha_inicio, t.fecha_fin,
    t.estado, t.formato,
    (select count(*) from public.demo_torneo_equipos e where e.torneo_id = t.id),
    (select count(*) from public.demo_partidos_torneo p where p.torneo_id = t.id)
  from public.demo_torneos t
  where t.complejo_id = p_complejo_id
  order by t.created_at desc;
end;
$$;

create or replace function public.demo_admin_crear_torneo(
  p_complejo_id uuid,
  p_nombre varchar,
  p_descripcion text default null,
  p_categoria varchar default null,
  p_fecha_inicio date default null,
  p_fecha_fin date default null,
  p_formato varchar default 'GRUPOS_Y_ELIMINACION'
)
returns table (id uuid, nombre varchar, estado varchar)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.demo_es_administrador(p_complejo_id) then
    raise exception 'No autorizado para este complejo.' using errcode = '42501';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre del torneo es obligatorio.' using errcode = '22023';
  end if;

  if p_formato not in ('LIGA', 'GRUPOS_Y_ELIMINACION', 'ELIMINACION_DIRECTA') then
    raise exception 'Formato de torneo no permitido.' using errcode = '22023';
  end if;

  return query
  insert into public.demo_torneos as t (
    complejo_id, nombre, descripcion, categoria, fecha_inicio, fecha_fin, formato, estado
  ) values (
    p_complejo_id, trim(p_nombre), nullif(trim(p_descripcion), ''), nullif(trim(p_categoria), ''),
    p_fecha_inicio, p_fecha_fin, p_formato, 'BORRADOR'
  )
  returning t.id, t.nombre, t.estado;
end;
$$;

create or replace function public.demo_admin_actualizar_estado_torneo(
  p_torneo_id uuid,
  p_estado varchar
)
returns table (id uuid, estado varchar)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id
  from public.demo_torneos t
  where t.id = p_torneo_id
  for update;

  if v_complejo_id is null then
    raise exception 'No existe el torneo solicitado.' using errcode = '22023';
  end if;

  if not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para este torneo.' using errcode = '42501';
  end if;

  if p_estado not in ('BORRADOR', 'INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO', 'CANCELADO') then
    raise exception 'Estado no permitido.' using errcode = '22023';
  end if;

  return query
  update public.demo_torneos t
  set estado = p_estado,
      publicado_at = case when p_estado in ('INSCRIPCIONES', 'EN_CURSO') then coalesce(t.publicado_at, timezone('utc', now())) else t.publicado_at end
  where t.id = p_torneo_id
  returning t.id, t.estado;
end;
$$;

revoke all on function public.demo_es_administrador(uuid) from public;
revoke all on function public.demo_admin_reservas(uuid) from public;
revoke all on function public.demo_admin_actualizar_reserva(uuid, varchar, text) from public;
revoke all on function public.demo_admin_torneos(uuid) from public;
revoke all on function public.demo_admin_crear_torneo(uuid, varchar, text, varchar, date, date, varchar) from public;
revoke all on function public.demo_admin_actualizar_estado_torneo(uuid, varchar) from public;

grant execute on function public.demo_es_administrador(uuid) to authenticated;
grant execute on function public.demo_admin_reservas(uuid) to authenticated;
grant execute on function public.demo_admin_actualizar_reserva(uuid, varchar, text) to authenticated;
grant execute on function public.demo_admin_torneos(uuid) to authenticated;
grant execute on function public.demo_admin_crear_torneo(uuid, varchar, text, varchar, date, date, varchar) to authenticated;
grant execute on function public.demo_admin_actualizar_estado_torneo(uuid, varchar) to authenticated;

notify pgrst, 'reload schema';
