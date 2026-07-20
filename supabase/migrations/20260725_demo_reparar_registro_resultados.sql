-- Reparacion puntual: registro de resultados de partidos de torneo.
-- Ejecutar este archivo completo en Supabase SQL Editor.

alter table public.demo_partidos_torneo
  add column if not exists ganador_equipo_id uuid references public.demo_torneo_equipos(id) on delete set null,
  add column if not exists siguiente_partido_id uuid references public.demo_partidos_torneo(id) on delete set null,
  add column if not exists siguiente_lado varchar(10);

create or replace function public.demo_admin_registrar_resultado_partido(
  p_partido_id uuid,
  p_goles_local smallint,
  p_goles_visitante smallint,
  p_ganador_equipo_id uuid default null
)
returns table (id uuid, estado varchar, ganador_equipo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partido public.demo_partidos_torneo%rowtype;
  v_complejo_id uuid;
  v_ganador uuid;
begin
  select p.*
    into v_partido
  from public.demo_partidos_torneo p
  where p.id = p_partido_id
  for update;

  if v_partido.id is null then
    raise exception 'No existe el partido.' using errcode = '22023';
  end if;

  select t.complejo_id
    into v_complejo_id
  from public.demo_torneos t
  where t.id = v_partido.torneo_id;

  if not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  if v_partido.equipo_local_id is null or v_partido.equipo_visitante_id is null then
    raise exception 'Este partido aun espera clasificados de la ronda anterior.' using errcode = '22023';
  end if;

  if p_goles_local < 0 or p_goles_visitante < 0 then
    raise exception 'Los goles no pueden ser negativos.' using errcode = '22023';
  end if;

  if v_partido.fase = 'GRUPOS' then
    v_ganador := null;
  elsif p_goles_local > p_goles_visitante then
    v_ganador := v_partido.equipo_local_id;
  elsif p_goles_visitante > p_goles_local then
    v_ganador := v_partido.equipo_visitante_id;
  elsif p_ganador_equipo_id in (v_partido.equipo_local_id, v_partido.equipo_visitante_id) then
    v_ganador := p_ganador_equipo_id;
  else
    raise exception 'En eliminacion directa debes indicar el ganador si hubo empate.' using errcode = '22023';
  end if;

  update public.demo_partidos_torneo p
  set goles_local = p_goles_local,
      goles_visitante = p_goles_visitante,
      ganador_equipo_id = v_ganador,
      estado = 'FINALIZADO'
  where p.id = p_partido_id;

  if v_partido.siguiente_partido_id is not null then
    update public.demo_partidos_torneo p
    set equipo_local_id = case
          when v_partido.siguiente_lado = 'LOCAL' then v_ganador
          else p.equipo_local_id
        end,
        equipo_visitante_id = case
          when v_partido.siguiente_lado = 'VISITANTE' then v_ganador
          else p.equipo_visitante_id
        end
    where p.id = v_partido.siguiente_partido_id;
  end if;

  return query
  select p.id, p.estado, p.ganador_equipo_id
  from public.demo_partidos_torneo p
  where p.id = p_partido_id;
end;
$$;

revoke all on function public.demo_admin_registrar_resultado_partido(uuid, smallint, smallint, uuid) from public;
grant execute on function public.demo_admin_registrar_resultado_partido(uuid, smallint, smallint, uuid) to authenticated;

notify pgrst, 'reload schema';
