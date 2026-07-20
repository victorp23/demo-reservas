-- Nómina de jugadores por equipo para cada torneo.
-- El equipo ya pertenece a un torneo, por eso no se repite torneo_id aquí.

create table if not exists public.demo_torneo_jugadores (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.demo_torneo_equipos(id) on delete cascade,
  nombre varchar(150) not null,
  numero_documento varchar(50),
  fecha_nacimiento date,
  dorsal smallint,
  posicion varchar(60),
  foto_url text,
  es_capitan boolean not null default false,
  estado varchar(30) not null default 'ACTIVO',
  creado_at timestamptz not null default timezone('utc', now()),
  actualizado_at timestamptz not null default timezone('utc', now()),
  constraint demo_torneo_jugadores_estado_ck
    check (estado in ('ACTIVO', 'INACTIVO', 'SUSPENDIDO')),
  constraint demo_torneo_jugadores_dorsal_ck
    check (dorsal is null or dorsal between 0 and 99),
  constraint demo_torneo_jugadores_dorsal_uk unique (equipo_id, dorsal),
  constraint demo_torneo_jugadores_documento_uk unique (equipo_id, numero_documento)
);

create index if not exists demo_torneo_jugadores_equipo_idx
  on public.demo_torneo_jugadores (equipo_id, estado, nombre);

drop trigger if exists demo_torneo_jugadores_set_updated_at on public.demo_torneo_jugadores;
create trigger demo_torneo_jugadores_set_updated_at
  before update on public.demo_torneo_jugadores
  for each row execute function public.demo_set_updated_at();

-- Un único capitán activo por equipo. La validación se mantiene incluso si se carga
-- la nómina desde el panel administrativo o desde una futura inscripción web.
create unique index if not exists demo_torneo_jugadores_un_capitan_idx
  on public.demo_torneo_jugadores (equipo_id)
  where es_capitan and estado = 'ACTIVO';

notify pgrst, 'reload schema';
