-- Complemento del motor existente: un solo grupo también clasifica a una final
-- y las posiciones nunca mezclan resultados de fase eliminatoria.

-- En una sola zona/grupo de tres equipos se generan tres partidos todos contra todos.
-- Los dos mejores se enfrentan directamente en la final. Con 2, 4 u 8 grupos
-- se aplica el cruce estándar entre primeros y segundos de grupos consecutivos.
create or replace function public.demo_admin_generar_llaves(p_torneo_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_complejo_id uuid; v_formato varchar; v_grupos integer; v_grupo record; v_anterior uuid[] := array[]::uuid[];
  v_ranking uuid[]; v_previo uuid[]; v_actual uuid[] := array[]::uuid[]; v_total integer; v_partidos integer;
  v_indice integer; v_id uuid; v_padre uuid; v_fase varchar; v_creados integer := 0; v_primera boolean := true;
begin
  select t.complejo_id, t.formato into v_complejo_id, v_formato from public.demo_torneos t where t.id = p_torneo_id;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if v_formato <> 'GRUPOS_Y_ELIMINACION' then raise exception 'La generación automática de llaves requiere grupos y eliminación.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id and p.fase = 'GRUPOS' and p.estado <> 'FINALIZADO') then raise exception 'Primero finaliza todos los partidos de grupos.' using errcode = '22023'; end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id and p.fase <> 'GRUPOS') then raise exception 'Las llaves ya fueron generadas.' using errcode = '22023'; end if;

  select count(*) into v_grupos from public.demo_torneo_grupos g where g.torneo_id = p_torneo_id;
  if v_grupos not in (1, 2, 4, 8) then raise exception 'Usa 1, 2, 4 u 8 grupos para generar una llave compatible.' using errcode = '22023'; end if;

  for v_grupo in select g.id from public.demo_torneo_grupos g where g.torneo_id = p_torneo_id order by g.orden loop
    select array_agg(s.equipo_id order by s.puntos desc, (s.goles_favor - s.goles_contra) desc, s.goles_favor desc, s.equipo_nombre)
      into v_ranking
    from public.demo_torneo_tabla_posiciones s
    where s.grupo_id = v_grupo.id;
    if coalesce(array_length(v_ranking, 1), 0) < 2 then raise exception 'Cada grupo necesita al menos dos equipos.' using errcode = '22023'; end if;
    if v_grupos = 1 then
      v_anterior := array[v_ranking[1], v_ranking[2]];
    elsif v_previo is null then
      v_previo := v_ranking;
    else
      v_anterior := array_append(v_anterior, v_previo[1]);
      v_anterior := array_append(v_anterior, v_ranking[2]);
      v_anterior := array_append(v_anterior, v_ranking[1]);
      v_anterior := array_append(v_anterior, v_previo[2]);
      v_previo := null;
    end if;
  end loop;

  v_total := coalesce(array_length(v_anterior, 1), 0); v_partidos := v_total / 2;
  if v_partidos not in (1, 2, 4, 8) then raise exception 'Los clasificados deben completar una llave de 2, 4, 8 o 16 equipos.' using errcode = '22023'; end if;
  while v_partidos >= 1 loop
    v_fase := case v_partidos when 8 then 'OCTAVOS' when 4 then 'CUARTOS' when 2 then 'SEMIFINALES' else 'FINAL' end;
    v_actual := array[]::uuid[];
    for v_indice in 1..v_partidos loop
      if v_primera then
        insert into public.demo_partidos_torneo (torneo_id, equipo_local_id, equipo_visitante_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_anterior[(v_indice * 2) - 1], v_anterior[v_indice * 2], v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice) returning id into v_id;
      else
        insert into public.demo_partidos_torneo (torneo_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice) returning id into v_id;
      end if;
      v_actual := array_append(v_actual, v_id); v_creados := v_creados + 1;
    end loop;
    if not v_primera then
      for v_indice in 1..array_length(v_anterior, 1) loop
        v_padre := v_actual[ceil(v_indice::numeric / 2)::integer];
        update public.demo_partidos_torneo p set siguiente_partido_id = v_padre,
          siguiente_lado = case when mod(v_indice, 2) = 1 then 'LOCAL' else 'VISITANTE' end where p.id = v_anterior[v_indice];
      end loop;
    end if;
    exit when v_partidos = 1;
    v_anterior := v_actual; v_primera := false; v_partidos := v_partidos / 2;
  end loop;
  return v_creados;
end;
$$;

-- La tabla de posiciones contempla únicamente los resultados de su propio grupo;
-- los goles de octavos, cuartos, semifinales y final no deben alterar la clasificación.
create or replace view public.demo_torneo_tabla_posiciones with (security_invoker = true) as
select e.torneo_id, e.grupo_id, g.nombre as grupo_nombre, e.id as equipo_id, e.nombre as equipo_nombre,
  count(p.id) filter (where p.estado = 'FINALIZADO')::smallint as partidos_jugados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and ((p.equipo_local_id = e.id and p.goles_local > p.goles_visitante) or (p.equipo_visitante_id = e.id and p.goles_visitante > p.goles_local)))::smallint as partidos_ganados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and p.goles_local = p.goles_visitante)::smallint as partidos_empatados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and ((p.equipo_local_id = e.id and p.goles_local < p.goles_visitante) or (p.equipo_visitante_id = e.id and p.goles_visitante < p.goles_local)))::smallint as partidos_perdidos,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case when p.equipo_local_id = e.id then coalesce(p.goles_local, 0) else coalesce(p.goles_visitante, 0) end end), 0)::smallint as goles_favor,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case when p.equipo_local_id = e.id then coalesce(p.goles_visitante, 0) else coalesce(p.goles_local, 0) end end), 0)::smallint as goles_contra,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case when (p.equipo_local_id = e.id and p.goles_local > p.goles_visitante) or (p.equipo_visitante_id = e.id and p.goles_visitante > p.goles_local) then t.puntos_victoria when p.goles_local = p.goles_visitante then t.puntos_empate else t.puntos_derrota end end), 0)::smallint as puntos
from public.demo_torneo_equipos e
join public.demo_torneos t on t.id = e.torneo_id
left join public.demo_torneo_grupos g on g.id = e.grupo_id
left join public.demo_partidos_torneo p on p.torneo_id = e.torneo_id and p.fase = 'GRUPOS' and p.grupo_id = e.grupo_id and (p.equipo_local_id = e.id or p.equipo_visitante_id = e.id)
group by e.torneo_id, e.grupo_id, g.nombre, e.id, e.nombre;

grant select on public.demo_torneo_tabla_posiciones to anon, authenticated;

-- Al registrar el último resultado de grupos, el sistema genera la siguiente
-- fase de forma automática. Para un solo grupo serán los dos primeros en la final;
-- para 2/4/8 grupos serán semifinales/cuartos/octavos según corresponda.
create or replace function public.demo_avanzar_llaves_al_finalizar_grupos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fase = 'GRUPOS'
    and new.estado = 'FINALIZADO'
    and old.estado is distinct from 'FINALIZADO'
    and not exists (
      select 1 from public.demo_partidos_torneo p
      where p.torneo_id = new.torneo_id and p.fase = 'GRUPOS' and p.estado <> 'FINALIZADO'
    )
    and not exists (
      select 1 from public.demo_partidos_torneo p
      where p.torneo_id = new.torneo_id and p.fase <> 'GRUPOS'
    ) then
    perform public.demo_admin_generar_llaves(new.torneo_id);
  end if;
  return new;
end;
$$;

drop trigger if exists demo_avanzar_llaves_grupos on public.demo_partidos_torneo;
create trigger demo_avanzar_llaves_grupos
after update of estado on public.demo_partidos_torneo
for each row execute function public.demo_avanzar_llaves_al_finalizar_grupos();

-- La agenda respeta la duración configurada en la cancha y evita que se cruce
-- con reservas, bloqueos o partidos ya programados en el mismo recurso.
create or replace function public.demo_admin_agendar_partido(
  p_partido_id uuid,
  p_cancha_id uuid,
  p_inicio_at timestamptz
)
returns table (id uuid, cancha_id uuid, inicio_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_complejo_id uuid; v_duracion smallint; v_fin_at timestamptz;
begin
  select t.complejo_id into v_complejo_id
  from public.demo_partidos_torneo p join public.demo_torneos t on t.id = p.torneo_id
  where p.id = p_partido_id for update;
  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then raise exception 'No autorizado para este partido.' using errcode = '42501'; end if;
  if p_inicio_at is null then raise exception 'Indica fecha y hora.' using errcode = '22023'; end if;
  select c.duracion_reserva_minutos into v_duracion from public.demo_canchas c
  where c.id = p_cancha_id and c.complejo_id = v_complejo_id and c.activa;
  if v_duracion is null then raise exception 'La cancha no pertenece a este complejo o está inactiva.' using errcode = '22023'; end if;
  v_fin_at := p_inicio_at + make_interval(mins => v_duracion);
  if exists (select 1 from public.demo_reservas r where r.cancha_id = p_cancha_id and r.estado in ('PENDIENTE','CONFIRMADA') and tstzrange(r.inicio_at, r.fin_at, '[)') && tstzrange(p_inicio_at, v_fin_at, '[)')) then
    raise exception 'El horario ya está ocupado por una reserva.' using errcode = '23P01';
  end if;
  if exists (select 1 from public.demo_bloqueos_canchas b where b.cancha_id = p_cancha_id and tstzrange(b.inicio_at, b.fin_at, '[)') && tstzrange(p_inicio_at, v_fin_at, '[)')) then
    raise exception 'El horario está bloqueado para esta cancha.' using errcode = '23P01';
  end if;
  if exists (select 1 from public.demo_partidos_torneo p join public.demo_canchas c on c.id = p.cancha_id where p.cancha_id = p_cancha_id and p.id <> p_partido_id and p.inicio_at is not null and p.estado <> 'CANCELADO' and tstzrange(p.inicio_at, p.inicio_at + make_interval(mins => c.duracion_reserva_minutos), '[)') && tstzrange(p_inicio_at, v_fin_at, '[)')) then
    raise exception 'Ya hay otro partido programado en este horario.' using errcode = '23P01';
  end if;
  return query update public.demo_partidos_torneo p set cancha_id = p_cancha_id, inicio_at = p_inicio_at where p.id = p_partido_id returning p.id, p.cancha_id, p.inicio_at;
end;
$$;

revoke all on function public.demo_admin_agendar_partido(uuid, uuid, timestamptz) from public;
grant execute on function public.demo_admin_agendar_partido(uuid, uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
