import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDemoTournaments(complexId) {
  const [state, setState] = useState({ tournaments: [], groups: [], teams: [], matches: [], standings: [], isLoading: Boolean(complexId && supabase), error: null })

  useEffect(() => {
    if (!complexId || !supabase) return
    let isCurrent = true

    async function loadTournaments() {
      setState((current) => ({ ...current, isLoading: true, error: null }))
      const tournamentsResponse = await supabase
        .from('demo_torneos')
        .select('*')
        .eq('complejo_id', complexId)
        .in('estado', ['INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO'])
        .order('fecha_inicio', { ascending: false })

      if (!isCurrent) return
      if (tournamentsResponse.error) {
        setState((current) => ({ ...current, isLoading: false, error: 'No se pudieron cargar los torneos.' }))
        return
      }

      const tournaments = tournamentsResponse.data || []
      if (!tournaments.length) {
        setState({ tournaments: [], groups: [], teams: [], matches: [], standings: [], isLoading: false, error: null })
        return
      }

      const tournamentIds = tournaments.map((tournament) => tournament.id)
      const [groupsResponse, teamsResponse, matchesResponse, standingsResponse] = await Promise.all([
        supabase.from('demo_torneo_grupos').select('*').in('torneo_id', tournamentIds).order('orden'),
        supabase.from('demo_torneo_equipos').select('*').in('torneo_id', tournamentIds).order('nombre'),
        supabase.from('demo_partidos_torneo').select('*').in('torneo_id', tournamentIds).order('inicio_at'),
        supabase.from('demo_torneo_tabla_posiciones').select('*').in('torneo_id', tournamentIds),
      ])

      if (!isCurrent) return
      if (groupsResponse.error || teamsResponse.error || matchesResponse.error || standingsResponse.error) {
        setState((current) => ({ ...current, isLoading: false, error: 'No se pudieron cargar los detalles del torneo.' }))
        return
      }

      setState({
        tournaments,
        groups: groupsResponse.data || [],
        teams: teamsResponse.data || [],
        matches: matchesResponse.data || [],
        standings: standingsResponse.data || [],
        isLoading: false,
        error: null,
      })
    }

    loadTournaments()
    return () => { isCurrent = false }
  }, [complexId])

  return state
}
