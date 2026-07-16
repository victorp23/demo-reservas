-- Auspiciantes del Complejo Billares de Bugs Bunny.
-- logo_url debe contener la URL pública de Supabase Storage u otra URL HTTPS pública.

create table if not exists public.demo_auspiciantes (
  id uuid primary key default gen_random_uuid(),
  complejo_id uuid not null references public.demo_complejos(id) on delete cascade,
  nombre varchar(150) not null,
  categoria varchar(120),
  logo_url text not null,
  enlace_url text,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint demo_auspiciantes_nombre_por_complejo_uk unique (complejo_id, nombre)
);

create index if not exists demo_auspiciantes_catalogo_idx
  on public.demo_auspiciantes (complejo_id, activo, orden);

create trigger demo_auspiciantes_set_updated_at
before update on public.demo_auspiciantes
for each row execute function public.demo_set_updated_at();

alter table public.demo_auspiciantes enable row level security;

create policy "demo_auspiciantes_public_read"
on public.demo_auspiciantes
for select
to anon, authenticated
using (activo = true);
