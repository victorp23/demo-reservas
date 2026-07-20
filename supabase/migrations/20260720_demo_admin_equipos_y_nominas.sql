-- Gestión privada de grupos, equipos y nóminas desde el administrador del complejo.

create or replace function public.demo_admin_grupos(p_torneo_id uuid)
returns table (id uuid, nombre varchar, orden smallint, equipos bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para este torneo.' using errcode = '42501';
  end if;
  return query
  select g.id, g.nombre, g.orden, (select count(*) from public.demo_torneo_equipos e where e.grupo_id = g.id)
  from public.demo_torneo_grupos g where g.torneo_id = p_torneo_id order by g.orden, g.nombre;
end;
$$;

create or replace function public.demo_admin_crear_grupo(p_torneo_id uuid, p_nombre varchar, p_orden smallint default 1)
returns table (id uuid, nombre varchar, orden smallint)
language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para este torneo.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El nombre del grupo es obligatorio.' using errcode = '22023'; end if;
  return query insert into public.demo_torneo_grupos as g (torneo_id, nombre, orden)
  values (p_torneo_id, trim(p_nombre), coalesce(p_orden, 1)) returning g.id, g.nombre, g.orden;
end;
$$;

create or replace function public.demo_admin_equipos(p_torneo_id uuid)
returns table (id uuid, nombre varchar, delegado_nombre varchar, delegado_telefono varchar, grupo_id uuid, grupo_nombre varchar, jugadores bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado para este torneo.' using errcode = '42501'; end if;
  return query
  select e.id, e.nombre, e.delegado_nombre, e.delegado_telefono, e.grupo_id, g.nombre,
    (select count(*) from public.demo_torneo_jugadores j where j.equipo_id = e.id and j.estado = 'ACTIVO')
  from public.demo_torneo_equipos e left join public.demo_torneo_grupos g on g.id = e.grupo_id
  where e.torneo_id = p_torneo_id order by g.orden nulls last, e.nombre;
end;
$$;

create or replace function public.demo_admin_crear_equipo(
  p_torneo_id uuid, p_nombre varchar, p_delegado_nombre varchar default null,
  p_delegado_telefono varchar default null, p_grupo_id uuid default null
)
returns table (id uuid, nombre varchar)
language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado para este torneo.' using errcode = '42501'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El nombre del equipo es obligatorio.' using errcode = '22023'; end if;
  if p_grupo_id is not null and not exists (select 1 from public.demo_torneo_grupos g where g.id = p_grupo_id and g.torneo_id = p_torneo_id) then
    raise exception 'El grupo no pertenece a este torneo.' using errcode = '22023';
  end if;
  return query insert into public.demo_torneo_equipos as e (torneo_id, nombre, delegado_nombre, delegado_telefono, grupo_id)
  values (p_torneo_id, trim(p_nombre), nullif(trim(p_delegado_nombre), ''), nullif(trim(p_delegado_telefono), ''), p_grupo_id)
  returning e.id, e.nombre;
end;
$$;

create or replace function public.demo_admin_jugadores(p_equipo_id uuid)
returns table (id uuid, nombre varchar, dorsal smallint, posicion varchar, numero_documento varchar, es_capitan boolean, estado varchar)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneo_equipos e join public.demo_torneos t on t.id = e.torneo_id where e.id = p_equipo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado para este equipo.' using errcode = '42501'; end if;
  return query select j.id, j.nombre, j.dorsal, j.posicion, j.numero_documento, j.es_capitan, j.estado
  from public.demo_torneo_jugadores j where j.equipo_id = p_equipo_id order by j.es_capitan desc, j.dorsal nulls last, j.nombre;
end;
$$;

create or replace function public.demo_admin_crear_jugador(
  p_equipo_id uuid, p_nombre varchar, p_dorsal smallint default null, p_posicion varchar default null,
  p_numero_documento varchar default null, p_es_capitan boolean default false
)
returns table (id uuid, nombre varchar)
language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneo_equipos e join public.demo_torneos t on t.id = e.torneo_id where e.id = p_equipo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado para este equipo.' using errcode = '42501'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El nombre del jugador es obligatorio.' using errcode = '22023'; end if;
  return query insert into public.demo_torneo_jugadores as j (equipo_id, nombre, dorsal, posicion, numero_documento, es_capitan)
  values (p_equipo_id, trim(p_nombre), p_dorsal, nullif(trim(p_posicion), ''), nullif(trim(p_numero_documento), ''), coalesce(p_es_capitan, false))
  returning j.id, j.nombre;
end;
$$;

revoke all on function public.demo_admin_grupos(uuid) from public;
revoke all on function public.demo_admin_crear_grupo(uuid, varchar, smallint) from public;
revoke all on function public.demo_admin_equipos(uuid) from public;
revoke all on function public.demo_admin_crear_equipo(uuid, varchar, varchar, varchar, uuid) from public;
revoke all on function public.demo_admin_jugadores(uuid) from public;
revoke all on function public.demo_admin_crear_jugador(uuid, varchar, smallint, varchar, varchar, boolean) from public;

grant execute on function public.demo_admin_grupos(uuid) to authenticated;
grant execute on function public.demo_admin_crear_grupo(uuid, varchar, smallint) to authenticated;
grant execute on function public.demo_admin_equipos(uuid) to authenticated;
grant execute on function public.demo_admin_crear_equipo(uuid, varchar, varchar, varchar, uuid) to authenticated;
grant execute on function public.demo_admin_jugadores(uuid) to authenticated;
grant execute on function public.demo_admin_crear_jugador(uuid, varchar, smallint, varchar, varchar, boolean) to authenticated;

notify pgrst, 'reload schema';
