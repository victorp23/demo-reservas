# Base de datos de la demo

La migración usa solamente tablas, funciones, triggers e índices cuyo nombre empieza por `demo_`. Esto permite distinguirla de cualquier sistema existente y eliminarla luego sin confusión.

## Orden de uso

1. `demo_complejos`: datos del Complejo Billares de Bugs Bunny.
2. `demo_canchas`: una o varias canchas del complejo.
3. `demo_horarios_canchas`: apertura semanal de cada cancha.
4. `demo_bloqueos_canchas`: cierres puntuales, mantenimiento y eventos.
5. `demo_clientes` y `demo_reservas`: agenda y solicitudes.
6. `demo_reserva_historial`: seguimiento de cambios de estado.
7. `demo_torneos`, `demo_torneo_equipos` y `demo_partidos_torneo`: módulo de campeonatos.
8. `demo_galeria`: fotografías del complejo.

## Ejecutar en Supabase

1. Abre el proyecto de Supabase que quieras usar para la demo.
2. Ve a **SQL Editor** → **New query**.
3. Copia y ejecuta el contenido de `supabase/migrations/20260716_create_demo_booking_platform.sql`.
4. Confirma que aparezcan las tablas `demo_` en **Table Editor**.

El SQL crea el Complejo Billares de Bugs Bunny y su cancha sintética principal, pero no inventa horarios, precios, teléfono ni dirección. Esos datos se completarán desde el panel administrativo.

## Próximo paso técnico

Las tablas llevan RLS activado y no exponen datos públicos todavía. La siguiente implementación será una API de servidor para:

- consultar disponibilidad;
- detectar choques de reserva;
- guardar solicitudes;
- permitir que el administrador confirme o cancele;
- enviar confirmación por WhatsApp.

## Borrar la demo después

Ejecuta únicamente cuando quieras eliminar la demo por completo:

```sql
drop table if exists public.demo_partidos_torneo cascade;
drop table if exists public.demo_torneo_equipos cascade;
drop table if exists public.demo_torneos cascade;
drop table if exists public.demo_reserva_historial cascade;
drop table if exists public.demo_reservas cascade;
drop table if exists public.demo_clientes cascade;
drop table if exists public.demo_bloqueos_canchas cascade;
drop table if exists public.demo_horarios_canchas cascade;
drop table if exists public.demo_canchas cascade;
drop table if exists public.demo_galeria cascade;
drop table if exists public.demo_complejos cascade;
drop function if exists public.demo_set_updated_at cascade;
```
