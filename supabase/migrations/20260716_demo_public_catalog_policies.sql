-- Permite que la landing pública lea solamente el catálogo activo.
-- Reservas, clientes y administración continuarán protegidos por API/RLS.

create policy "demo_complejos_public_read"
on public.demo_complejos
for select
to anon, authenticated
using (activo = true);

create policy "demo_canchas_public_read"
on public.demo_canchas
for select
to anon, authenticated
using (activa = true);
