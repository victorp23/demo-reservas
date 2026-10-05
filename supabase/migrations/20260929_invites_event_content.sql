-- Contenido multimedia y bloques de cada invitación.
-- Los archivos pequeños se almacenan como base64 para que el evento sea autocontenido.

create type public.invites_content_type as enum ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBED');

create table public.invites_event_content (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.invites_events(id) on delete cascade,
  content_key varchar(80) not null,
  content_type public.invites_content_type not null,
  title varchar(180),
  text_value text,
  media_base64 text,
  mime_type varchar(120),
  external_url text,
  poster_base64 text,
  content jsonb not null default '{}'::jsonb,
  animation jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, content_key),
  constraint invites_content_payload_present check (
    text_value is not null
    or media_base64 is not null
    or external_url is not null
    or content <> '{}'::jsonb
  ),
  constraint invites_content_media_limit check (
    media_base64 is null or char_length(media_base64) <= 15728640
  ),
  constraint invites_content_poster_limit check (
    poster_base64 is null or char_length(poster_base64) <= 5242880
  )
);

create index invites_event_content_event_idx
  on public.invites_event_content(event_id, sort_order);

create trigger invites_event_content_updated_at
before update on public.invites_event_content
for each row execute function public.invites_set_updated_at();

alter table public.invites_event_content enable row level security;

create policy invites_event_content_owner_all on public.invites_event_content
  for all to authenticated
  using (exists (
    select 1 from public.invites_events e
    where e.id = event_id and e.owner_auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.invites_events e
    where e.id = event_id and e.owner_auth_user_id = auth.uid()
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
    'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from invites_media m where m.event_id = e.id and m.is_active), '[]'::jsonb),
    'content', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from invites_event_content c where c.event_id = e.id and c.is_visible), '[]'::jsonb)
  ) into result
  from invites_events e
  where e.slug = lower(trim(p_slug)) and e.status = 'PUBLISHED';

  return result;
end;
$$;

grant execute on function public.invites_public_event(varchar) to anon, authenticated;
