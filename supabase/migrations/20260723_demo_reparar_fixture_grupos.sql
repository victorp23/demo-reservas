-- Reparación puntual: crea solo el generador de fase de grupos.
-- No sustituye demo_admin_partidos_torneo ni modifica sus tipos de retorno.

create or replace function public.demo_admin_generar_fixture_grupos(p_torneo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
  select t.complejo_id, t.formato
    into v_complejo_id, v_formato
  from public.demo_torneos t
  where t.id = p_torneo_id;

  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado para este torneo.' using errcode = '42501';
  end if;

  if v_formato <> 'GRUPOS_Y_ELIMINACION' then
    raise exception 'Este torneo no utiliza fase de grupos.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.demo_partidos_torneo p
    where p.torneo_id = p_torneo_id and p.fase = 'GRUPOS'
  ) then
    raise exception 'El fixture de grupos ya fue generado.' using errcode = '22023';
  end if;

  for v_grupo in
    select g.id, g.nombre
    from public.demo_torneo_grupos g
    where g.torneo_id = p_torneo_id
    order by g.orden
  loop
    select array_agg(e.id order by e.nombre)
      into v_equipos
    from public.demo_torneo_equipos e
    where e.grupo_id = v_grupo.id;

    v_total := coalesce(array_length(v_equipos, 1), 0);
    if v_total < 2 then
      raise exception 'El grupo % necesita al menos dos equipos.', v_grupo.nombre using errcode = '22023';
    end if;

    -- Para cantidades impares agrega un descanso y genera todos contra todos.
    if mod(v_total, 2) = 1 then
      v_equipos := array_append(v_equipos, null);
      v_total := v_total + 1;
    end if;

    for v_jornada in 1..(v_total - 1) loop
      for v_indice in 1..(v_total / 2) loop
        v_local := v_equipos[v_indice];
        v_visitante := v_equipos[v_total - v_indice + 1];

        if v_local is not null and v_visitante is not null then
          insert into public.demo_partidos_torneo (
            torneo_id, grupo_id, equipo_local_id, equipo_visitante_id,
            fase, jornada, estado, etiqueta_llave
          ) values (
            p_torneo_id, v_grupo.id, v_local, v_visitante,
            'GRUPOS', v_jornada, 'PROGRAMADO', v_grupo.nombre || ' · Jornada ' || v_jornada
          );
          v_creados := v_creados + 1;
        end if;
      end loop;

      -- Método del círculo: cada equipo juega una vez por jornada.
      v_ultimo := v_equipos[v_total];
      for v_indice in reverse v_total..3 loop
        v_equipos[v_indice] := v_equipos[v_indice - 1];
      end loop;
      v_equipos[2] := v_ultimo;
    end loop;
  end loop;

  return v_creados;
end;
$$;

revoke all on function public.demo_admin_generar_fixture_grupos(uuid) from public;
grant execute on function public.demo_admin_generar_fixture_grupos(uuid) to authenticated;

notify pgrst, 'reload schema';
