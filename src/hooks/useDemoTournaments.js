import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDemoTournaments(complexId) {
  const [state, setState] = useState({ tournaments: [], groups: [], teams: [], matches: [], standings: [], isLoading: Boolean(complexId && supabase), error: null })

  useEffect(() => {
    if (!complexId || !supabase) return
    let isCurrent = true

    async function loadTournaments() {
      setState((current) => ({ ...current, isLoading: true, error: null }))
      const response = await supabase.rpc('demo_torneos_publicos', { p_complejo_id: complexId })

      if (!isCurrent) return
      if (response.error) {
        setState((current) => ({ ...current, isLoading: false, error: 'No se pudieron cargar los torneos.' }))
        return
      }

      setState({
        tournaments: response.data?.tournaments || [],
        groups: response.data?.groups || [],
        teams: response.data?.teams || [],
        matches: response.data?.matches || [],
        standings: response.data?.standings || [],
        isLoading: false,
        error: null,
      })
    }

    loadTournaments()
    return () => { isCurrent = false }
  }, [complexId])

  return state
}
