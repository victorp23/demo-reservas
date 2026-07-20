-- Extiende las tablas demo_torneos existentes para soportar ligas, grupos y llaves.
-- No crea una segunda tabla de torneos ni modifica las reservas.

alter table public.demo_torneos
  add column if not exists formato varchar(30) not null default 'GRUPOS_Y_ELIMINACION',
  add column if not exists max_equipos smallint,
  add column if not exists puntos_victoria smallint not null default 3,
  add column if not exists puntos_empate smallint not null default 1,
  add column if not exists puntos_derrota smallint not null default 0,
  add column if not exists imagen_url text,
  add column if not exists publicado_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demo_torneos_formato_ck') then
    alter table public.demo_torneos add constraint demo_torneos_formato_ck
      check (formato in ('LIGA', 'GRUPOS_Y_ELIMINACION', 'ELIMINACION_DIRECTA'));
  end if;
end;
$$;

create table if not exists public.demo_torneo_grupos (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.demo_torneos(id) on delete cascade,
  nombre varchar(80) not null,
  orden smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_torneo_grupos_nombre_uk unique (torneo_id, nombre)
);

create index if not exists demo_torneo_grupos_torneo_idx
  on public.demo_torneo_grupos (torneo_id, orden);

drop trigger if exists demo_torneo_grupos_set_updated_at on public.demo_torneo_grupos;
create trigger demo_torneo_grupos_set_updated_at
  before update on public.demo_torneo_grupos
  for each row execute function public.demo_set_updated_at();

alter table public.demo_torneo_equipos
  add column if not exists grupo_id uuid references public.demo_torneo_grupos(id) on delete set null,
  add column if not exists escudo_url text,
  add column if not exists partidos_jugados smallint not null default 0,
  add column if not exists partidos_ganados smallint not null default 0,
  add column if not exists partidos_empatados smallint not null default 0,
  add column if not exists partidos_perdidos smallint not null default 0;

create index if not exists demo_torneo_equipos_grupo_idx
  on public.demo_torneo_equipos (grupo_id, puntos desc, goles_favor desc);

alter table public.demo_partidos_torneo
  add column if not exists grupo_id uuid references public.demo_torneo_grupos(id) on delete set null,
  add column if not exists orden_llave smallint,
  add column if not exists etiqueta_llave varchar(80);

create index if not exists demo_partidos_torneo_grupo_idx
  on public.demo_partidos_torneo (grupo_id, inicio_at);

-- Posiciones derivadas de resultados finales. No actualices puntos a mano:
-- al registrar el marcador de un partido FINALIZADO, esta vista se recalcula sola.
create or replace view public.demo_torneo_tabla_posiciones as
select
  e.torneo_id,
  e.grupo_id,
  g.nombre as grupo_nombre,
  e.id as equipo_id,
  e.nombre as equipo_nombre,
  count(p.id) filter (where p.estado = 'FINALIZADO')::smallint as partidos_jugados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and (
    (p.equipo_local_id = e.id and p.goles_local > p.goles_visitante) or
    (p.equipo_visitante_id = e.id and p.goles_visitante > p.goles_local)
  ))::smallint as partidos_ganados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and p.goles_local = p.goles_visitante)::smallint as partidos_empatados,
  count(p.id) filter (where p.estado = 'FINALIZADO' and (
    (p.equipo_local_id = e.id and p.goles_local < p.goles_visitante) or
    (p.equipo_visitante_id = e.id and p.goles_visitante < p.goles_local)
  ))::smallint as partidos_perdidos,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case
    when p.equipo_local_id = e.id then coalesce(p.goles_local, 0)
    else coalesce(p.goles_visitante, 0)
  end end), 0)::smallint as goles_favor,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case
    when p.equipo_local_id = e.id then coalesce(p.goles_visitante, 0)
    else coalesce(p.goles_local, 0)
  end end), 0)::smallint as goles_contra,
  coalesce(sum(case when p.estado = 'FINALIZADO' then case
    when (p.equipo_local_id = e.id and p.goles_local > p.goles_visitante)
      or (p.equipo_visitante_id = e.id and p.goles_visitante > p.goles_local) then t.puntos_victoria
    when p.goles_local = p.goles_visitante then t.puntos_empate
    else t.puntos_derrota
  end end), 0)::smallint as puntos
from public.demo_torneo_equipos e
join public.demo_torneos t on t.id = e.torneo_id
left join public.demo_torneo_grupos g on g.id = e.grupo_id
left join public.demo_partidos_torneo p on p.torneo_id = e.torneo_id
  and (p.equipo_local_id = e.id or p.equipo_visitante_id = e.id)
group by e.torneo_id, e.grupo_id, g.nombre, e.id, e.nombre;

-- Las vistas creadas por postgres son SECURITY DEFINER por defecto. Esta opción
-- garantiza que la vista respete las políticas RLS del usuario que la consulta.
alter view public.demo_torneo_tabla_posiciones set (security_invoker = true);

grant select on public.demo_torneo_tabla_posiciones to anon, authenticated;

notify pgrst, 'reload schema';
