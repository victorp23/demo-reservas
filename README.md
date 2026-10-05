# Invitaciones digitales

Plataforma para crear y compartir invitaciones digitales animadas, con fotografías, video, audio, ubicación y confirmación de asistencia.

## Backend actual

- La migración `supabase/migrations/20260929_invites_backend.sql` elimina únicamente los objetos anteriores `demo_*`.
- Las nuevas tablas usan el prefijo `invites_`.
- Se soportan eventos, secciones de contenido, imágenes, video, audio, invitados y confirmaciones.
- La migración `20260929_invites_event_content.sql` agrega `invites_event_content` para guardar bloques de texto y medios pequeños dentro de la base de datos como base64, con un límite de 15 MB por contenido.
- El bucket público `invites-media` permite almacenar los medios de cada invitación con carpetas privadas por usuario para subir, modificar y eliminar archivos.

La invitación pública se consulta mediante `invites_public_event(slug)` y la confirmación mediante `invites_submit_rsvp(...)`.

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Desplegar en Vercel

Importa este repositorio como un proyecto distinto y usa el comando de build `npm run build`.
