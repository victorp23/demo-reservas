-- Llaves de eliminacion directa para 4, 8 o 16 equipos.
--
-- Uso previsto desde el administrador:
--   1) Crear un torneo con formato ELIMINACION_DIRECTA y cupo de 4, 8 o 16.
--   3) Registrar exactamente ese numero de equipos.
--   4) Generar la llave. Los cruces se crean completos, pero las rondas
--      posteriores esperan los ganadores.
--   5) Registrar el marcador de cada partido. La funcion existente
--      demo_admin_registrar_resultado_partido mueve el ganador automaticamente.
--
-- No se crean tablas: se reutilizan demo_torneos, demo_torneo_equipos y
-- demo_partidos_torneo. La creacion y agenda se encuentran en la migracion
-- demo_eliminacion_directa_agenda.

-- Sustituye la primera version para exigir la modalidad solicitada y usar
-- siembras balanceadas: 1 vs ultimo, 4 vs 5, etc.; no 1 vs 2 al inicio.
create or replace function public.demo_admin_generar_llaves_directas(p_torneo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complejo_id uuid;
  v_formato varchar;
  v_cupo smallint;
  v_equipos uuid[];
  v_partidos_previos uuid[];
  v_partidos_ronda uuid[];
  v_semillas smallint[];
  v_total integer;
  v_partidos integer;
  v_indice integer;
  v_id uuid;
  v_padre uuid;
  v_fase varchar;
  v_creados integer := 0;
  v_primera_ronda boolean := true;
begin
  select t.complejo_id, t.formato, t.max_equipos
    into v_complejo_id, v_formato, v_cupo
  from public.demo_torneos t
  where t.id = p_torneo_id
  for update;

  if v_complejo_id is null then
    raise exception 'No existe el torneo.' using errcode = '22023';
  end if;
  if not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para este torneo.' using errcode = '42501';
  end if;
  if v_formato <> 'ELIMINACION_DIRECTA' then
    raise exception 'Este torneo no usa eliminacion directa.' using errcode = '22023';
  end if;
  if v_cupo not in (4, 8, 16) then
    raise exception 'Primero configura un cupo de 4, 8 o 16 equipos.' using errcode = '22023';
  end if;
  if exists (select 1 from public.demo_partidos_torneo p where p.torneo_id = p_torneo_id) then
    raise exception 'Este torneo ya tiene una llave generada.' using errcode = '22023';
  end if;

  -- El orden de alta de los equipos se usa como siembra. Se puede ampliar
  -- despues con un campo de ranking, sin cambiar el modelo de partidos.
  select array_agg(e.id order by e.created_at, e.nombre)
    into v_equipos
  from public.demo_torneo_equipos e
  where e.torneo_id = p_torneo_id;
  v_total := coalesce(array_length(v_equipos, 1), 0);
  if v_total <> v_cupo then
    raise exception 'Debes registrar exactamente % equipos antes de generar la llave; actualmente hay %.', v_cupo, v_total using errcode = '22023';
  end if;

  -- Posiciones de bracket estandar. Ejemplo 8: 1-8, 4-5, 2-7, 3-6.
  v_semillas := case v_total
    when 4 then array[1,4,2,3]::smallint[]
    when 8 then array[1,8,4,5,2,7,3,6]::smallint[]
    when 16 then array[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]::smallint[]
  end;

  v_partidos_previos := array[]::uuid[];
  v_partidos := v_total / 2;
  while v_partidos >= 1 loop
    v_fase := case v_partidos
      when 8 then 'OCTAVOS'
      when 4 then 'CUARTOS'
      when 2 then 'SEMIFINALES'
      else 'FINAL'
    end;
    v_partidos_ronda := array[]::uuid[];

    for v_indice in 1..v_partidos loop
      if v_primera_ronda then
        insert into public.demo_partidos_torneo (
          torneo_id, equipo_local_id, equipo_visitante_id, fase, orden_llave, estado, etiqueta_llave
        ) values (
          p_torneo_id,
          v_equipos[v_semillas[(v_indice * 2) - 1]],
          v_equipos[v_semillas[v_indice * 2]],
          v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice
        ) returning id into v_id;
      else
        insert into public.demo_partidos_torneo (torneo_id, fase, orden_llave, estado, etiqueta_llave)
        values (p_torneo_id, v_fase, v_indice, 'PROGRAMADO', v_fase || ' ' || v_indice)
        returning id into v_id;
      end if;
      v_partidos_ronda := array_append(v_partidos_ronda, v_id);
      v_creados := v_creados + 1;
    end loop;

    if not v_primera_ronda then
      for v_indice in 1..array_length(v_partidos_previos, 1) loop
        v_padre := v_partidos_ronda[ceil(v_indice::numeric / 2)::integer];
        update public.demo_partidos_torneo p
        set siguiente_partido_id = v_padre,
            siguiente_lado = case when mod(v_indice, 2) = 1 then 'LOCAL' else 'VISITANTE' end
        where p.id = v_partidos_previos[v_indice];
      end loop;
    end if;

    if v_partidos = 1 then exit; end if;
    v_partidos_previos := v_partidos_ronda;
    v_primera_ronda := false;
    v_partidos := v_partidos / 2;
  end loop;
  return v_creados;
end;
$$;

-- La agenda de partidos se gestiona con demo_admin_agendar_partido.

revoke all on function public.demo_admin_generar_llaves_directas(uuid) from public;

grant execute on function public.demo_admin_generar_llaves_directas(uuid) to authenticated;

notify pgrst, 'reload schema';
