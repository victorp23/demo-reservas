-- Lectura pública segura para /torneos.
-- No se da SELECT directo a tablas administrativas: solo salen competencias publicadas.

create or replace function public.demo_torneos_publicos(p_complejo_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with publicados as materialized (
    select t.*
    from public.demo_torneos t
    where t.complejo_id = p_complejo_id
      and t.estado in ('INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO')
  )
  select jsonb_build_object(
    'tournaments', coalesce((select jsonb_agg(to_jsonb(t) order by t.fecha_inicio desc nulls last, t.created_at desc) from publicados t), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(to_jsonb(g) order by g.orden, g.nombre) from public.demo_torneo_grupos g join publicados t on t.id = g.torneo_id), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(e) order by e.nombre) from public.demo_torneo_equipos e join publicados t on t.id = e.torneo_id), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(to_jsonb(p) order by p.inicio_at nulls last) from public.demo_partidos_torneo p join publicados t on t.id = p.torneo_id), '[]'::jsonb),
    'standings', coalesce((select jsonb_agg(to_jsonb(s)) from public.demo_torneo_tabla_posiciones s join publicados t on t.id = s.torneo_id), '[]'::jsonb)
  );
$$;

revoke all on function public.demo_torneos_publicos(uuid) from public;
grant execute on function public.demo_torneos_publicos(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
