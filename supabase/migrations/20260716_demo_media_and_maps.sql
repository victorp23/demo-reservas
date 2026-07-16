-- Media de canchas y ubicación pública del complejo.
-- imagen_url ya existe en demo_canchas; allí se guardará la URL pública de Supabase Storage.

alter table public.demo_complejos
  add column if not exists google_maps_url text,
  add column if not exists google_maps_embed_url text;

comment on column public.demo_complejos.google_maps_url is
  'Enlace público normal de Google Maps, para abrir la ubicación en una nueva pestaña.';

comment on column public.demo_complejos.google_maps_embed_url is
  'Solo la URL src obtenida al usar Compartir > Insertar un mapa en Google Maps.';
