-- Horarios públicos de la demo. Ejecuta este archivo una vez en el SQL Editor de Supabase.
-- Reemplaza únicamente el horario de la cancha activa de la demo; no toca reservas ni clientes.

drop policy if exists "Lectura publica de horarios demo" on public.demo_horarios_canchas;
create policy "Lectura publica de horarios demo" on public.demo_horarios_canchas for select to anon, authenticated using (activo = true);

delete from public.demo_horarios_canchas where cancha_id = '4c7a745e-b011-444c-ba2e-04aa6af84a94';

insert into public.demo_horarios_canchas (cancha_id, dia_semana, hora_inicio, hora_fin, activo) values
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 0, '10:00', '21:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 1, '15:00', '23:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 2, '15:00', '23:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 3, '15:00', '23:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 4, '15:00', '23:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 5, '15:00', '23:00', true),
  ('4c7a745e-b011-444c-ba2e-04aa6af84a94', 6, '10:00', '23:00', true);
