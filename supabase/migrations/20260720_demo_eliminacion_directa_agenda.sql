-- Configuración de eliminación directa (4, 8 o 16 equipos) y agenda editable.
-- Ejecutar después de las migraciones de administración y motor de fixture.

create or replace function public.demo_admin_crear_torneo(
  p_complejo_id uuid,
  p_nombre varchar,
  p_descripcion text default null,
  p_categoria varchar default null,
  p_fecha_inicio date default null,
  p_fecha_fin date default null,
  p_formato varchar default 'GRUPOS_Y_ELIMINACION',
  p_max_equipos smallint default null
)
returns table (id uuid, nombre varchar, estado varchar)
language plpgsql security definer set search_path = public as $$
begin
  if not public.demo_es_administrador(p_complejo_id) then raise exception 'No autorizado para este complejo.' using errcode = '42501'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El nombre del torneo es obligatorio.' using errcode = '22023'; end if;
  if p_formato not in ('LIGA', 'GRUPOS_Y_ELIMINACION', 'ELIMINACION_DIRECTA') then raise exception 'Formato de torneo no permitido.' using errcode = '22023'; end if;
  if p_formato = 'ELIMINACION_DIRECTA' and coalesce(p_max_equipos, 0) not in (4, 8, 16) then
    raise exception 'La eliminación directa debe configurarse para 4, 8 o 16 equipos.' using errcode = '22023';
  end if;
  return query insert into public.demo_torneos as t
    (complejo_id, nombre, descripcion, categoria, fecha_inicio, fecha_fin, formato, max_equipos, estado)
  values
    (p_complejo_id, trim(p_nombre), nullif(trim(p_descripcion), ''), nullif(trim(p_categoria), ''),
     p_fecha_inicio, p_fecha_fin, p_formato, p_max_equipos, 'BORRADOR')
  returning t.id, t.nombre, t.estado;
end;
$$;

create or replace function public.demo_admin_partidos_torneo(p_torneo_id uuid)
returns table (
  id uuid, fase varchar, jornada smallint, orden_llave smallint, etiqueta_llave varchar,
  estado varchar, goles_local smallint, goles_visitante smallint, ganador_equipo_id uuid,
  equipo_local_id uuid, equipo_local_nombre varchar, equipo_visitante_id uuid, equipo_visitante_nombre varchar,
  cancha_id uuid, inicio_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  return query
  select p.id, p.fase, p.jornada, p.orden_llave, p.etiqueta_llave, p.estado, p.goles_local, p.goles_visitante, p.ganador_equipo_id,
    p.equipo_local_id, el.nombre, p.equipo_visitante_id, ev.nombre, p.cancha_id, p.inicio_at
  from public.demo_partidos_torneo p
  left join public.demo_torneo_equipos el on el.id = p.equipo_local_id
  left join public.demo_torneo_equipos ev on ev.id = p.equipo_visitante_id
  where p.torneo_id = p_torneo_id
  order by case p.fase when 'GRUPOS' then 0 when 'OCTAVOS' then 1 when 'CUARTOS' then 2 when 'SEMIFINALES' then 3 else 4 end,
    p.jornada nulls last, p.orden_llave nulls last;
end;
$$;

create or replace function public.demo_admin_agendar_partido(
  p_partido_id uuid,
  p_cancha_id uuid,
  p_inicio_at timestamptz
)
returns table (id uuid, cancha_id uuid, inicio_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid; v_duracion smallint;
begin
  select t.complejo_id into v_complejo_id
  from public.demo_partidos_torneo p join public.demo_torneos t on t.id = p.torneo_id
  where p.id = p_partido_id for update;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select coalesce(c.duracion_reserva_minutos, 60) into v_duracion
  from public.demo_canchas c where c.id = p_cancha_id and c.complejo_id = v_complejo_id and c.activa;
  if v_duracion is null then raise exception 'La cancha no pertenece a este complejo.' using errcode = '22023'; end if;
  if p_inicio_at is null then raise exception 'Indica fecha y hora.' using errcode = '22023'; end if;
  return query update public.demo_partidos_torneo p
  set cancha_id = p_cancha_id, inicio_at = p_inicio_at
  where p.id = p_partido_id returning p.id, p.cancha_id, p.inicio_at;
end;
$$;

revoke all on function public.demo_admin_crear_torneo(uuid, varchar, text, varchar, date, date, varchar, smallint) from public;
revoke all on function public.demo_admin_agendar_partido(uuid, uuid, timestamptz) from public;
grant execute on function public.demo_admin_crear_torneo(uuid, varchar, text, varchar, date, date, varchar, smallint) to authenticated;
grant execute on function public.demo_admin_agendar_partido(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.demo_admin_partidos_torneo(uuid) to authenticated;
notify pgrst, 'reload schema';
