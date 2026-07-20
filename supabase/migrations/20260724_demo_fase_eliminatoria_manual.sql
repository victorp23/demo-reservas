-- La fase eliminatoria queda bajo control del administrador:
-- se habilita después de finalizar todos los grupos y solo se crea al pulsar Continuar.
drop trigger if exists demo_avanzar_llaves_grupos on public.demo_partidos_torneo;

notify pgrst, 'reload schema';
