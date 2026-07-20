-- Reparación compatible para instalaciones que ya tenían demo_partidos_torneo
-- antes del módulo profesional de torneos. No borra partidos ni reservas.

alter table public.demo_partidos_torneo
  add column if not exists grupo_id uuid references public.demo_torneo_grupos(id) on delete set null,
  add column if not exists jornada smallint,
  add column if not exists orden_llave smallint,
  add column if not exists etiqueta_llave varchar(80),
  add column if not exists ganador_equipo_id uuid references public.demo_torneo_equipos(id) on delete set null,
  add column if not exists siguiente_partido_id uuid references public.demo_partidos_torneo(id) on delete set null,
  add column if not exists siguiente_lado varchar(10);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'demo_partidos_torneo_siguiente_lado_ck'
  ) then
    alter table public.demo_partidos_torneo
      add constraint demo_partidos_torneo_siguiente_lado_ck
      check (siguiente_lado is null or siguiente_lado in ('LOCAL', 'VISITANTE'));
  end if;
end;
$$;

create index if not exists demo_partidos_torneo_grupo_idx
  on public.demo_partidos_torneo (grupo_id, inicio_at);

create or replace function public.demo_admin_partidos_torneo(p_torneo_id uuid)
returns table (
  id uuid, fase varchar, jornada smallint, orden_llave smallint, etiqueta_llave varchar,
  estado varchar, goles_local smallint, goles_visitante smallint, ganador_equipo_id uuid,
  equipo_local_id uuid, equipo_local_nombre varchar, equipo_visitante_id uuid,
  equipo_visitante_nombre varchar, cancha_id uuid, inicio_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_complejo_id uuid;
begin
  select t.complejo_id into v_complejo_id
  from public.demo_torneos t
  where t.id = p_torneo_id;

  if v_complejo_id is null or not public.demo_es_administrador(v_complejo_id) then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  return query
  select p.id, p.fase, p.jornada, p.orden_llave, p.etiqueta_llave, p.estado,
    p.goles_local, p.goles_visitante, p.ganador_equipo_id,
    p.equipo_local_id, local.nombre, p.equipo_visitante_id, visitante.nombre,
    p.cancha_id, p.inicio_at
  from public.demo_partidos_torneo p
  left join public.demo_torneo_equipos local on local.id = p.equipo_local_id
  left join public.demo_torneo_equipos visitante on visitante.id = p.equipo_visitante_id
  where p.torneo_id = p_torneo_id
  order by case p.fase when 'GRUPOS' then 0 when 'OCTAVOS' then 1 when 'CUARTOS' then 2 when 'SEMIFINALES' then 3 else 4 end,
    p.jornada nulls last, p.orden_llave nulls last;
end;
$$;

revoke all on function public.demo_admin_partidos_torneo(uuid) from public;
grant execute on function public.demo_admin_partidos_torneo(uuid) to authenticated;

notify pgrst, 'reload schema';
