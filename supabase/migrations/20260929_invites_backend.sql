-- Backend base para invitaciones digitales.
-- Esta migración elimina únicamente los objetos de la demo anterior (demo_*).

do $$
declare
  item record;
begin
  for item in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'demo_%'
  loop
    execute format('drop function if exists %s cascade', item.signature);
  end loop;

  for item in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and c.relname like 'demo_%'
  loop
    execute format('drop table if exists public.%I cascade', item.relname);
  end loop;
end $$;

create extension if not exists pgcrypto;

create type public.invites_event_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.invites_media_kind as enum ('IMAGE', 'VIDEO', 'AUDIO');
create type public.invites_rsvp_status as enum ('PENDING', 'ATTENDING', 'DECLINED');

create table public.invites_events (
  id uuid primary key default gen_random_uuid(),
  owner_auth_user_id uuid not null references auth.users(id) on delete cascade,
  slug varchar(120) not null unique,
  event_type varchar(80) not null default 'OTHER',
  title varchar(180) not null,
  subtitle varchar(240),
  host_names varchar(240),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone varchar(80) not null default 'America/Guayaquil',
  venue_name varchar(180),
  venue_address text,
  maps_url text,
  cover_media_id uuid,
  status public.invites_event_status not null default 'DRAFT',
  rsvp_deadline timestamptz,
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_events_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint invites_events_dates_valid check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.invites_sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.invites_events(id) on delete cascade,
  section_type varchar(40) not null,
  title varchar(180),
  content jsonb not null default '{}'::jsonb,
  animation jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, sort_order)
);

create table public.invites_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.invites_events(id) on delete cascade,
  kind public.invites_media_kind not null,
  storage_path text,
  public_url text,
  poster_url text,
  mime_type varchar(120),
  title varchar(180),
  alt_text varchar(240),
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint invites_media_source check (storage_path is not null or public_url is not null)
);

alter table public.invites_events
  add constraint invites_events_cover_media_fk
  foreign key (cover_media_id) references public.invites_media(id) on delete set null;

create table public.invites_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.invites_events(id) on delete cascade,
  invitation_token uuid not null default gen_random_uuid() unique,
  full_name varchar(180) not null,
  email varchar(255),
  phone varchar(40),
  max_companions smallint not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_guests_companions_valid check (max_companions between 0 and 20)
);

create table public.invites_rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.invites_guests(id) on delete cascade,
  status public.invites_rsvp_status not null default 'PENDING',
  companions_count smallint not null default 0,
  dietary_notes text,
  guest_message text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_rsvps_companions_valid check (companions_count >= 0)
);

create index invites_events_owner_idx on public.invites_events(owner_auth_user_id, updated_at desc);
create index invites_sections_event_idx on public.invites_sections(event_id, sort_order);
create index invites_media_event_idx on public.invites_media(event_id, sort_order);
create index invites_guests_event_idx on public.invites_guests(event_id, full_name);

create or replace function public.invites_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger invites_events_updated_at
before update on public.invites_events
for each row execute function public.invites_set_updated_at();

create trigger invites_sections_updated_at
before update on public.invites_sections
for each row execute function public.invites_set_updated_at();

create trigger invites_guests_updated_at
before update on public.invites_guests
for each row execute function public.invites_set_updated_at();

create trigger invites_rsvps_updated_at
before update on public.invites_rsvps
for each row execute function public.invites_set_updated_at();

alter table public.invites_events enable row level security;
alter table public.invites_sections enable row level security;
alter table public.invites_media enable row level security;
alter table public.invites_guests enable row level security;
alter table public.invites_rsvps enable row level security;

create policy invites_events_owner_all on public.invites_events
  for all to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

create policy invites_sections_owner_all on public.invites_sections
  for all to authenticated
  using (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()))
  with check (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()));

create policy invites_media_owner_all on public.invites_media
  for all to authenticated
  using (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()))
  with check (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()));

create policy invites_guests_owner_all on public.invites_guests
  for all to authenticated
  using (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()))
  with check (exists (select 1 from public.invites_events e where e.id = event_id and e.owner_auth_user_id = auth.uid()));

create policy invites_rsvps_owner_read on public.invites_rsvps
  for select to authenticated
  using (exists (
    select 1 from public.invites_guests g
    join public.invites_events e on e.id = g.event_id
    where g.id = guest_id and e.owner_auth_user_id = auth.uid()
  ));

create or replace function public.invites_public_event(p_slug varchar)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'event', to_jsonb(e) - 'owner_auth_user_id',
    'sections', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from invites_sections s where s.event_id = e.id and s.is_visible), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from invites_media m where m.event_id = e.id and m.is_active), '[]'::jsonb)
  ) into result
  from invites_events e
  where e.slug = lower(trim(p_slug)) and e.status = 'PUBLISHED';

  return result;
end;
$$;

create or replace function public.invites_submit_rsvp(
  p_invitation_token uuid,
  p_status public.invites_rsvp_status,
  p_companions_count smallint default 0,
  p_dietary_notes text default null,
  p_guest_message text default null
)
returns public.invites_rsvps
language plpgsql
security definer
set search_path = public
as $$
declare
  guest public.invites_guests;
  response public.invites_rsvps;
begin
  select g.* into guest from invites_guests g
  join invites_events e on e.id = g.event_id
  where g.invitation_token = p_invitation_token and e.status = 'PUBLISHED';

  if guest.id is null then raise exception 'Invitación no encontrada.' using errcode = '22023'; end if;
  if p_companions_count < 0 or p_companions_count > guest.max_companions then
    raise exception 'La cantidad de acompañantes no es válida.' using errcode = '22023';
  end if;

  insert into invites_rsvps (guest_id, status, companions_count, dietary_notes, guest_message, responded_at)
  values (guest.id, p_status, case when p_status = 'ATTENDING' then p_companions_count else 0 end, p_dietary_notes, p_guest_message, now())
  on conflict (guest_id) do update set
    status = excluded.status,
    companions_count = excluded.companions_count,
    dietary_notes = excluded.dietary_notes,
    guest_message = excluded.guest_message,
    responded_at = excluded.responded_at
  returning * into response;

  return response;
end;
$$;

grant execute on function public.invites_public_event(varchar) to anon, authenticated;
grant execute on function public.invites_submit_rsvp(uuid, public.invites_rsvp_status, smallint, text, text) to anon, authenticated;

-- Bucket para fotografías, videos y audio de las invitaciones.
insert into storage.buckets (id, name, public)
values ('invites-media', 'invites-media', true)
on conflict (id) do update set public = excluded.public;

create policy invites_media_storage_read on storage.objects
  for select to public
  using (bucket_id = 'invites-media');

create policy invites_media_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invites-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy invites_media_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'invites-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'invites-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy invites_media_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'invites-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
