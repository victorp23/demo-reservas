-- Demo independiente: Complejo Billares de Bugs Bunny
-- Todas las tablas comienzan con demo_ para poder ubicarlas y eliminarlas fácilmente.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Reutilizable para todas las entidades modificables de esta demo.
create or replace function public.demo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 1. Datos del complejo deportivo.
create table if not exists public.demo_complejos (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(150) not null,
  descripcion text,
  direccion text,
  ciudad varchar(100),
  telefono varchar(30),
  whatsapp varchar(30),
  zona_horaria varchar(60) not null default 'America/Guayaquil',
  logo_url text,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2. Una o varias canchas de cada complejo.
create table if not exists public.demo_canchas (
  id uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.demo_complejos(id) on delete cascade,
  nombre varchar(120) not null,
  tipo varchar(50) not null default 'FUTBOL_5',
  descripcion text,
  capacidad_jugadores smallint,
  duracion_reserva_minutos smallint not null default 60 check (duracion_reserva_minutos between 30 and 240),
  precio_referencial numeric(10,2),
  moneda char(3) not null default 'USD',
  imagen_url text,
  orden smallint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_canchas_nombre_por_complejo_uk unique (complejo_id, nombre)
);

-- 3. Horario recurrente de apertura por cancha. dia_semana: 0 domingo, 6 sábado.
create table if not exists public.demo_horarios_canchas (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.demo_canchas(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_horarios_canchas_rango_ck check (hora_fin > hora_inicio),
  constraint demo_horarios_canchas_unico_uk unique (cancha_id, dia_semana, hora_inicio, hora_fin)
);

-- 4. Bloqueos puntuales: mantenimiento, evento privado, torneo, etc.
create table if not exists public.demo_bloqueos_canchas (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.demo_canchas(id) on delete cascade,
  inicio_at timestamptz not null,
  fin_at timestamptz not null,
  motivo varchar(40) not null default 'BLOQUEADO'
    check (motivo in ('BLOQUEADO', 'MANTENIMIENTO', 'EVENTO', 'TORNEO')),
  observacion text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_bloqueos_canchas_rango_ck check (fin_at > inicio_at)
);

-- 5. Contactos que reservan. El teléfono permite identificar a un cliente repetido.
create table if not exists public.demo_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(150) not null,
  telefono varchar(30) not null,
  email varchar(180),
  notas text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_clientes_telefono_uk unique (telefono)
);

-- 6. Solicitud y reserva confirmada. El backend debe validar cruces de horario
-- antes de cambiar una reserva a CONFIRMADA.
create table if not exists public.demo_reservas (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(24) not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  complejo_id uuid not null references public.demo_complejos(id) on delete restrict,
  cancha_id uuid not null references public.demo_canchas(id) on delete restrict,
  cliente_id uuid references public.demo_clientes(id) on delete set null,
  inicio_at timestamptz not null,
  fin_at timestamptz not null,
  estado varchar(30) not null default 'PENDIENTE'
    check (estado in ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'FINALIZADA', 'NO_ASISTIO')),
  origen varchar(20) not null default 'WEB'
    check (origen in ('WEB', 'WHATSAPP', 'ADMIN')),
  nombre_equipo varchar(150),
  total numeric(10,2),
  moneda char(3) not null default 'USD',
  notas_cliente text,
  notas_internas text,
  confirmado_at timestamptz,
  cancelado_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_reservas_codigo_uk unique (codigo),
  constraint demo_reservas_rango_ck check (fin_at > inicio_at)
);

-- 7. Auditoría sencilla para saber quién cambió el estado de una reserva.
create table if not exists public.demo_reserva_historial (
  id bigint generated always as identity primary key,
  reserva_id uuid not null references public.demo_reservas(id) on delete cascade,
  estado_anterior varchar(30),
  estado_nuevo varchar(30) not null,
  comentario text,
  creado_en timestamptz not null default timezone('utc', now())
);

-- Evita dos reservas activas sobre la misma cancha y el mismo intervalo.
-- [) permite que una reserva termine exactamente cuando empieza la siguiente.
alter table public.demo_reservas
  add constraint demo_reservas_sin_cruces_excl
  exclude using gist (
    cancha_id with =,
    tstzrange(inicio_at, fin_at, '[)') with &&
  ) where (estado in ('PENDIENTE', 'CONFIRMADA'));

-- Evita que dos bloqueos administrativos se crucen entre sí.
alter table public.demo_bloqueos_canchas
  add constraint demo_bloqueos_sin_cruces_excl
  exclude using gist (
    cancha_id with =,
    tstzrange(inicio_at, fin_at, '[)') with &&
  );

-- 8. Módulo de torneos (opcional para la primera salida).
create table if not exists public.demo_torneos (
  id uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.demo_complejos(id) on delete cascade,
  nombre varchar(150) not null,
  descripcion text,
  categoria varchar(80),
  fecha_inicio date,
  fecha_fin date,
  estado varchar(30) not null default 'BORRADOR'
    check (estado in ('BORRADOR', 'INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO', 'CANCELADO')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_torneos_fechas_ck check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create table if not exists public.demo_torneo_equipos (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.demo_torneos(id) on delete cascade,
  nombre varchar(150) not null,
  delegado_nombre varchar(150),
  delegado_telefono varchar(30),
  puntos smallint not null default 0,
  goles_favor smallint not null default 0,
  goles_contra smallint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_torneo_equipos_nombre_uk unique (torneo_id, nombre)
);

create table if not exists public.demo_partidos_torneo (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.demo_torneos(id) on delete cascade,
  cancha_id uuid references public.demo_canchas(id) on delete set null,
  equipo_local_id uuid references public.demo_torneo_equipos(id) on delete set null,
  equipo_visitante_id uuid references public.demo_torneo_equipos(id) on delete set null,
  inicio_at timestamptz,
  goles_local smallint,
  goles_visitante smallint,
  fase varchar(80),
  estado varchar(30) not null default 'PROGRAMADO'
    check (estado in ('PROGRAMADO', 'EN_JUEGO', 'FINALIZADO', 'CANCELADO')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_partidos_torneo_equipos_ck check (equipo_local_id is null or equipo_visitante_id is null or equipo_local_id <> equipo_visitante_id)
);

-- 9. Galería pública del complejo.
create table if not exists public.demo_galeria (
  id uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.demo_complejos(id) on delete cascade,
  titulo varchar(150),
  imagen_url text not null,
  descripcion text,
  orden smallint not null default 0,
  publicada boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Índices pensados para agenda, consultas de disponibilidad y panel admin.
create index if not exists demo_canchas_complejo_idx on public.demo_canchas (complejo_id, activa, orden);
create index if not exists demo_horarios_canchas_consulta_idx on public.demo_horarios_canchas (cancha_id, dia_semana, activo);
create index if not exists demo_bloqueos_canchas_consulta_idx on public.demo_bloqueos_canchas (cancha_id, inicio_at, fin_at);
create index if not exists demo_reservas_agenda_idx on public.demo_reservas (cancha_id, inicio_at, fin_at);
create index if not exists demo_reservas_estado_idx on public.demo_reservas (estado, inicio_at desc);
create index if not exists demo_reservas_cliente_idx on public.demo_reservas (cliente_id, created_at desc);
create index if not exists demo_reserva_historial_reserva_idx on public.demo_reserva_historial (reserva_id, creado_en desc);
create index if not exists demo_torneos_complejo_idx on public.demo_torneos (complejo_id, estado);
create index if not exists demo_partidos_torneo_calendario_idx on public.demo_partidos_torneo (torneo_id, inicio_at);
create index if not exists demo_galeria_publicada_idx on public.demo_galeria (complejo_id, publicada, orden);

-- Mantener updated_at actualizado en toda la demo.
create trigger demo_complejos_set_updated_at before update on public.demo_complejos for each row execute function public.demo_set_updated_at();
create trigger demo_canchas_set_updated_at before update on public.demo_canchas for each row execute function public.demo_set_updated_at();
create trigger demo_horarios_canchas_set_updated_at before update on public.demo_horarios_canchas for each row execute function public.demo_set_updated_at();
create trigger demo_bloqueos_canchas_set_updated_at before update on public.demo_bloqueos_canchas for each row execute function public.demo_set_updated_at();
create trigger demo_clientes_set_updated_at before update on public.demo_clientes for each row execute function public.demo_set_updated_at();
create trigger demo_reservas_set_updated_at before update on public.demo_reservas for each row execute function public.demo_set_updated_at();
create trigger demo_torneos_set_updated_at before update on public.demo_torneos for each row execute function public.demo_set_updated_at();
create trigger demo_torneo_equipos_set_updated_at before update on public.demo_torneo_equipos for each row execute function public.demo_set_updated_at();
create trigger demo_partidos_torneo_set_updated_at before update on public.demo_partidos_torneo for each row execute function public.demo_set_updated_at();
create trigger demo_galeria_set_updated_at before update on public.demo_galeria for each row execute function public.demo_set_updated_at();

-- Datos iniciales reales del complejo. Revisa/actualiza teléfono y dirección luego.
insert into public.demo_complejos (nombre, ciudad, zona_horaria, activo)
select 'Complejo Billares de Bugs Bunny', 'San Antonio de Pichincha', 'America/Guayaquil', true
where not exists (
  select 1 from public.demo_complejos where nombre = 'Complejo Billares de Bugs Bunny'
);

insert into public.demo_canchas (complejo_id, nombre, tipo, duracion_reserva_minutos, activa, orden)
select id, 'Cancha sintética principal', 'FUTBOL', 60, true, 1
from public.demo_complejos
where nombre = 'Complejo Billares de Bugs Bunny'
  and not exists (
    select 1 from public.demo_canchas c
    where c.complejo_id = public.demo_complejos.id
      and c.nombre = 'Cancha sintética principal'
  );

-- Seguridad: la demo no abre las tablas directamente al público.
-- Cuando se conecte el frontend se usarán rutas servidor/API para validar
-- disponibilidad, crear reservas y aplicar políticas RLS específicas.
alter table public.demo_complejos enable row level security;
alter table public.demo_canchas enable row level security;
alter table public.demo_horarios_canchas enable row level security;
alter table public.demo_bloqueos_canchas enable row level security;
alter table public.demo_clientes enable row level security;
alter table public.demo_reservas enable row level security;
alter table public.demo_reserva_historial enable row level security;
alter table public.demo_torneos enable row level security;
alter table public.demo_torneo_equipos enable row level security;
alter table public.demo_partidos_torneo enable row level security;
alter table public.demo_galeria enable row level security;
