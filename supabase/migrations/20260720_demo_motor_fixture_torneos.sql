-- Motor de fixtures: liga, grupos y eliminación directa.
-- El administrador genera rondas; el sistema valida resultados y llena las llaves.

create table if not exists public.demo_torneo_reglas (
  torneo_id uuid primary key references public.demo_torneos(id) on delete cascade,
  clasifican_por_grupo smallint not null default 2 check (clasifican_por_grupo between 1 and 4),
  permitir_empates_grupos boolean not null default true,
  creado_at timestamptz not null default timezone('utc', now()),
  actualizado_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists demo_torneo_reglas_set_updated_at on public.demo_torneo_reglas;
create trigger demo_torneo_reglas_set_updated_at before update on public.demo_torneo_reglas
for each row execute function public.demo_set_updated_at();

alter table public.demo_partidos_torneo
  add column if not exists jornada smallint,
  add column if not exists ganador_equipo_id uuid references public.demo_torneo_equipos(id) on delete set null,
  add column if not exists siguiente_partido_id uuid references public.demo_partidos_torneo(id) on delete set null,
  add column if not exists siguiente_lado varchar(10);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'demo_partidos_torneo_siguiente_lado_ck') then
    alter table public.demo_partidos_torneo add constraint demo_partidos_torneo_siguiente_lado_ck
      check (siguiente_lado is null or siguiente_lado in ('LOCAL', 'VISITANTE'));
  end if;
end $$;

create or replace function public.demo_admin_configurar_reglas_torneo(
  p_torneo_id uuid,
  p_clasifican_por_grupo smallint default 2
)
returns void language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  insert into public.demo_torneo_reglas as r (torneo_id, clasifican_por_grupo)
  values (p_torneo_id, p_clasifican_por_grupo)
  on conflict (torneo_id) do update set clasifican_por_grupo = excluded.clasifican_por_grupo;
end;
$$;

create or replace function public.demo_admin_generar_fixture_grupos(p_torneo_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_complejo_id uuid;
  v_formato varchar;
  v_grupo record;
  v_equipos uuid[];
  v_total integer;
  v_jornada integer;
  v_indice integer;
  v_local uuid;
  v_visitante uuid;
  v_ultimo uuid;
  v_creados integer := 0;
begin
  select t.complejo_id, t.formato into v_complejo_id, v_formato from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_formato <> 'GRUPOS_Y_ELIMINACION' then raise exception 'Este torneo no usa fase de grupos.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id and p.fase = 'GRUPOS') then
    raise exception 'La fase de grupos ya tiene un fixture generado.' using errcode = '22023';
  end if;

  for v_grupo in select g.id, g.nombre from public.demo_torneo_grupos g where g.torneo_id = p_torneo_id order by g.orden loop
    select array_agg(e.id order by e.nombre) into v_equipos from public.demo_torneo_equipos e where e.grupo_id = v_grupo.id;
    v_total := coalesce(array_length(v_equipos, 1), 0);
    if v_total < 2 then raise exception 'El grupo % necesita al menos dos equipos.', v_grupo.nombre using errcode = '22023'; end if;
    if mod(v_total, 2) = 1 then v_equipos := array_append(v_equipos, null); v_total := v_total + 1; end if;

    -- Método del círculo: genera jornadas reales sin que un equipo juegue dos veces en la misma fecha.
    for v_jornada in 1..(v_total - 1) loop
      for v_indice in 1..(v_total / 2) loop
        v_local := v_equipos[v_indice];
        v_visitante := v_equipos[v_total - v_indice + 1];
        if v_local is not null and v_visitante is not null then
          insert into public.demo_partidos_torneo (torneo_id, grupo_id, equipo_local_id, equipo_visitante_id, fase, jornada, estado, etiqueta_llave)
          values (p_torneo_id, v_grupo.id, v_local, v_visitante, 'GRUPOS', v_jornada, 'PROGRAMADO', v_grupo.nombre || ' · Jornada ' || v_jornada);
          v_creados := v_creados + 1;
        end if;
      end loop;
      v_ultimo := v_equipos[v_total];
      for v_indice in reverse v_total..3 loop v_equipos[v_indice] := v_equipos[v_indice - 1]; end loop;
      v_equipos[2] := v_ultimo;
    end loop;
  end loop;
  return v_creados;
end;
$$;

-- Liga: todos contra todos. El método del círculo evita que un equipo juegue dos veces
-- en una misma jornada y genera n-1 jornadas cuando hay un número par de participantes.
create or replace function public.demo_admin_generar_fixture_liga(p_torneo_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_complejo_id uuid;
  v_formato varchar;
  v_equipos uuid[];
  v_total integer;
  v_jornada integer;
  v_indice integer;
  v_local uuid;
  v_visitante uuid;
  v_ultimo uuid;
  v_creados integer := 0;
begin
  select t.complejo_id, t.formato into v_complejo_id, v_formato from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_formato <> 'LIGA' then raise exception 'Este torneo no usa formato de liga.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id) then raise exception 'Este torneo ya tiene un fixture generado.' using errcode = '22023'; end if;

  select array_agg(e.id order by e.nombre) into v_equipos from public.demo_torneo_equipos e where e.torneo_id = p_torneo_id;
  v_total := coalesce(array_length(v_equipos, 1), 0);
  if v_total < 2 then raise exception 'La liga necesita al menos dos equipos.' using errcode = '22023'; end if;
  if mod(v_total, 2) = 1 then v_equipos := array_append(v_equipos, null); v_total := v_total + 1; end if;

  for v_jornada in 1..(v_total - 1) loop
    for v_indice in 1..(v_total / 2) loop
      v_local := v_equipos[v_indice];
      v_visitante := v_equipos[v_total - v_indice + 1];
      if v_local is not null and v_visitante is not null then
        insert into public.demo_partidos_torneo (torneo_id, equipo_local_id, equipo_visitante_id, fase, jornada, estado, etiqueta_llave)
        values (p_torneo_id, v_local, v_visitante, 'LIGA', v_jornada, 'PROGRAMADO', 'Jornada ' || v_jornada);
        v_creados := v_creados + 1;
      end if;
    end loop;
    v_ultimo := v_equipos[v_total];
    for v_indice in reverse v_total..3 loop v_equipos[v_indice] := v_equipos[v_indice - 1]; end loop;
    v_equipos[2] := v_ultimo;
  end loop;
  return v_creados;
end;
$$;

-- Eliminación directa: requiere 2, 4, 8 o 16 participantes. Si hay otra cantidad,
-- el administrador debe definir una ronda previa o completar la cantidad antes de generar la llave.
create or replace function public.demo_admin_generar_llaves_directas(p_torneo_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_complejo_id uuid;
  v_formato varchar;
  v_anterior uuid[];
  v_actual uuid[] := array[]::uuid[];
  v_total integer;
  v_partidos integer;
  v_indice integer;
  v_id uuid;
  v_padre uuid;
  v_fase varchar;
  v_creados integer := 0;
  v_es_primera_ronda boolean := true;
begin
  select t.complejo_id, t.formato into v_complejo_id, v_formato from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_formato <> 'ELIMINACION_DIRECTA' then raise exception 'Este torneo no usa eliminación directa.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id) then raise exception 'Este torneo ya tiene una llave generada.' using errcode = '22023'; end if;

  select array_agg(e.id order by e.nombre) into v_anterior from public.demo_torneo_equipos e where e.torneo_id = p_torneo_id;
  v_total := coalesce(array_length(v_anterior, 1), 0);
  v_partidos := v_total / 2;
  if v_partidos not in (1, 2, 4, 8) then
    raise exception 'La eliminación directa necesita 2, 4, 8 o 16 equipos. Para otra cantidad usa una ronda previa.' using errcode = '22023';
  end if;

  while v_partidos >= 1 loop
    v_fase := case v_partidos when 8 then 'OCTAVOS' when 4 then 'CUARTOS' when 2 then 'SEMIFINALES' else 'FINAL' end;
    v_actual := array[]::uuid[];
    for v_indice in 1..v_partidos loop
      if v_es_primera_ronda then
        insert into public.demo_partidos_torneo (torneo_id, equipo_local_id, equipo_visitante_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_anterior[(v_indice * 2) - 1], v_anterior[v_indice * 2], v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice)
        returning id into v_id;
      else
        insert into public.demo_partidos_torneo (torneo_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice)
        returning id into v_id;
      end if;
      v_actual := array_append(v_actual, v_id);
      v_creados := v_creados + 1;
    end loop;
    if not v_es_primera_ronda then
      for v_indice in 1..array_length(v_anterior, 1) loop
        v_padre := v_actual[ceil(v_indice::numeric / 2)::integer];
        update public.demo_partidos_torneo p
        set siguiente_partido_id = v_padre,
            siguiente_lado = case when mod(v_indice, 2) = 1 then 'LOCAL' else 'VISITANTE' end
        where p.id = v_anterior[v_indice];
      end loop;
    end if;
    if v_partidos = 1 then exit; end if;
    v_anterior := v_actual;
    v_es_primera_ronda := false;
    v_partidos := v_partidos / 2;
  end loop;
  return v_creados;
end;
$$;

create or replace function public.demo_admin_generar_llaves(p_torneo_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_complejo_id uuid;
  v_formato varchar;
  v_clasifican smallint;
  v_grupo record;
  v_ranking uuid[];
  v_anterior uuid[] := array[]::uuid[];
  v_actual uuid[] := array[]::uuid[];
  v_grupo_previo uuid[];
  v_total integer := 0;
  v_partidos integer;
  v_indice integer;
  v_id uuid;
  v_padre uuid;
  v_fase varchar;
  v_creados integer := 0;
  v_es_primera_ronda boolean := true;
begin
  select t.complejo_id, t.formato into v_complejo_id, v_formato from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_formato <> 'GRUPOS_Y_ELIMINACION' then raise exception 'La generación automática de llaves requiere un torneo de grupos y eliminación.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id and p.fase = 'GRUPOS' and p.estado <> 'FINALIZADO') then
    raise exception 'Primero finaliza todos los partidos de la fase de grupos.' using errcode = '22023';
  end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id and p.fase <> 'GRUPOS') then
    raise exception 'Las llaves ya fueron generadas para este torneo.' using errcode = '22023';
  end if;
  select coalesce(r.clasifican_por_grupo, 2) into v_clasifican from public.demo_torneo_reglas r where r.torneo_id = p_torneo_id;
  v_clasifican := coalesce(v_clasifican, 2);
  if v_clasifican <> 2 then raise exception 'Esta primera versión genera llaves con los dos primeros de cada grupo.' using errcode = '22023'; end if;

  -- Cruce estándar por pares de grupos: A1 vs B2 y B1 vs A2; después C1 vs D2, etc.
  for v_grupo in select g.id from public.demo_torneo_grupos g where g.torneo_id = p_torneo_id order by g.orden loop
    select array_agg(s.equipo_id order by s.puntos desc, (s.goles_favor - s.goles_contra) desc, s.goles_favor desc, s.equipo_nombre)
    into v_ranking from public.demo_torneo_tabla_posiciones s where s.grupo_id = v_grupo.id;
    if coalesce(array_length(v_ranking, 1), 0) < 2 then raise exception 'El grupo no tiene clasificación suficiente.' using errcode = '22023'; end if;
    if v_grupo_previo is null then
      v_grupo_previo := v_ranking;
    else
      v_anterior := array_append(v_anterior, v_grupo_previo[1]);
      v_anterior := array_append(v_anterior, v_ranking[2]);
      v_anterior := array_append(v_anterior, v_ranking[1]);
      v_anterior := array_append(v_anterior, v_grupo_previo[2]);
      v_grupo_previo := null;
    end if;
  end loop;
  if v_grupo_previo is not null then raise exception 'Se requiere un número par de grupos para cruzar a los dos primeros.' using errcode = '22023'; end if;
  v_total := array_length(v_anterior, 1);
  v_partidos := v_total / 2;
  if v_partidos not in (1, 2, 4, 8) then raise exception 'Los clasificados deben completar una llave de 2, 4, 8 o 16 equipos.' using errcode = '22023'; end if;

  while v_partidos >= 1 loop
    v_fase := case v_partidos when 8 then 'OCTAVOS' when 4 then 'CUARTOS' when 2 then 'SEMIFINALES' else 'FINAL' end;
    v_actual := array[]::uuid[];
    for v_indice in 1..v_partidos loop
      if v_partidos = (v_total / 2) then
        insert into public.demo_partidos_torneo (torneo_id, equipo_local_id, equipo_visitante_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_anterior[(v_indice * 2) - 1], v_anterior[v_indice * 2], v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice)
        returning id into v_id;
      else
        insert into public.demo_partidos_torneo (torneo_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice)
        returning id into v_id;
      end if;
      v_actual := array_append(v_actual, v_id);
      v_creados := v_creados + 1;
    end loop;
    if not v_es_primera_ronda then
      for v_indice in 1..array_length(v_anterior, 1) loop
        v_padre := v_actual[ceil(v_indice::numeric / 2)::integer];
        update public.demo_partidos_torneo p
        set siguiente_partido_id = v_padre,
            siguiente_lado = case when mod(v_indice, 2) = 1 then 'LOCAL' else 'VISITANTE' end
        where p.id = v_anterior[v_indice];
      end loop;
    end if;
    if v_partidos = 1 then exit; end if;
    v_anterior := v_actual;
    v_es_primera_ronda := false;
    v_partidos := v_partidos / 2;
  end loop;
  return v_creados;
end;
$$;

create or replace function public.demo_admin_registrar_resultado_partido(
  p_partido_id uuid,
  p_goles_local smallint,
  p_goles_visitante smallint,
  p_ganador_equipo_id uuid default null
)
returns table (id uuid, estado varchar, ganador_equipo_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_partido public.demo_partidos_torneo%rowtype;
  v_complejo_id uuid;
  v_ganador uuid;
begin
  select p.* into v_partido from public.demo_partidos_torneo p where p.id = p_partido_id for update;
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = v_partido.torneo_id;
  if v_partido.id is null then raise exception 'No existe el partido.' using errcode = '22023'; end if;
  if not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_partido.equipo_local_id is null or v_partido.equipo_visitante_id is null then raise exception 'Este partido aún espera clasificados de la ronda anterior.' using errcode = '22023'; end if;
  if p_goles_local < 0 or p_goles_visitante < 0 then raise exception 'Los goles no pueden ser negativos.' using errcode = '22023'; end if;

  if v_partido.fase = 'GRUPOS' then
    v_ganador := null;
  elsif p_goles_local > p_goles_visitante then
    v_ganador := v_partido.equipo_local_id;
  elsif p_goles_visitante > p_goles_local then
    v_ganador := v_partido.equipo_visitante_id;
  elsif p_ganador_equipo_id in (v_partido.equipo_local_id, v_partido.equipo_visitante_id) then
    v_ganador := p_ganador_equipo_id;
  else
    raise exception 'En eliminación directa debe indicar el ganador si hubo empate.' using errcode = '22023';
  end if;

  update public.demo_partidos_torneo p set goles_local = p_goles_local, goles_visitante = p_goles_visitante,
    ganador_equipo_id = v_ganador, estado = 'FINALIZADO' where p.id = p_partido_id;

  if v_partido.siguiente_partido_id is not null then
    update public.demo_partidos_torneo p set
      equipo_local_id = case when v_partido.siguiente_lado = 'LOCAL' then v_ganador else p.equipo_local_id end,
      equipo_visitante_id = case when v_partido.siguiente_lado = 'VISITANTE' then v_ganador else p.equipo_visitante_id end
    where p.id = v_partido.siguiente_partido_id;
  end if;
  return query select p.id, p.estado, p.ganador_equipo_id from public.demo_partidos_torneo p where p.id = p_partido_id;
end;
$$;

create or replace function public.demo_admin_partidos_torneo(p_torneo_id uuid)
returns table (
  id uuid, fase varchar, jornada smallint, orden_llave smallint, etiqueta_llave varchar,
  estado varchar, goles_local smallint, goles_visitante smallint, ganador_equipo_id uuid,
  equipo_local_id uuid, equipo_local_nombre varchar, equipo_visitante_id uuid, equipo_visitante_nombre varchar
)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  return query
  select p.id, p.fase, p.jornada, p.orden_llave, p.etiqueta_llave, p.estado, p.goles_local, p.goles_visitante, p.ganador_equipo_id,
    p.equipo_local_id, el.nombre, p.equipo_visitante_id, ev.nombre
  from public.demo_partidos_torneo p
  left join public.demo_torneo_equipos el on el.id = p.equipo_local_id
  left join public.demo_torneo_equipos ev on ev.id = p.equipo_visitante_id
  where p.torneo_id = p_torneo_id
  order by case p.fase when 'GRUPOS' then 0 when 'OCTAVOS' then 1 when 'CUARTOS' then 2 when 'SEMIFINALES' then 3 else 4 end,
    p.jornada nulls last, p.orden_llave nulls last;
end;
$$;

revoke all on function public.demo_admin_configurar_reglas_torneo(uuid, smallint) from public;
revoke all on function public.demo_admin_generar_fixture_grupos(uuid) from public;
revoke all on function public.demo_admin_generar_llaves(uuid) from public;
revoke all on function public.demo_admin_registrar_resultado_partido(uuid, smallint, smallint, uuid) from public;
revoke all on function public.demo_admin_partidos_torneo(uuid) from public;
grant execute on function public.demo_admin_configurar_reglas_torneo(uuid, smallint) to authenticated;
grant execute on function public.demo_admin_generar_fixture_grupos(uuid) to authenticated;
grant execute on function public.demo_admin_generar_llaves(uuid) to authenticated;
grant execute on function public.demo_admin_registrar_resultado_partido(uuid, smallint, smallint, uuid) to authenticated;
grant execute on function public.demo_admin_partidos_torneo(uuid) to authenticated;
notify pgrst, 'reload schema';
