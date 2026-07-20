import { ArrowLeft, CalendarCog, CalendarPlus, Play, Plus, ShieldAlert, Trophy, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function asGuayaquilDateTimeInput(value) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function AdminTournamentManager({ tournament, onBack, onChanged }) {
  const [groups, setGroups] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [courts, setCourts] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedRosterGroupId, setSelectedRosterGroupId] = useState('')
  const [selectedFixtureSection, setSelectedFixtureSection] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupName, setGroupName] = useState('')
  const [teamForm, setTeamForm] = useState({ nombre: '', delegado: '', telefono: '', grupoId: '' })
  const [playerForm, setPlayerForm] = useState({ nombre: '', dorsal: '', posicion: '', documento: '', capitan: false })
  const direct = tournament.formato === 'ELIMINACION_DIRECTA'

  async function loadConfiguration(showLoading = true) {
    if (!supabase) return
    if (showLoading) setIsLoading(true)
    const [groupsResponse, teamsResponse, matchesResponse] = await Promise.all([
      supabase.rpc('demo_admin_grupos', { p_torneo_id: tournament.id }),
      supabase.rpc('demo_admin_equipos', { p_torneo_id: tournament.id }),
      supabase.rpc('demo_admin_partidos_torneo', { p_torneo_id: tournament.id }),
    ])
    if (groupsResponse.error || teamsResponse.error || matchesResponse.error) setError('No se pudo cargar la configuración del torneo.')
    else {
      const nextTeams = teamsResponse.data || []
      setGroups(groupsResponse.data || []); setTeams(nextTeams); setMatches(matchesResponse.data || [])
      const nextGroups = groupsResponse.data || []
      const activeGroupId = nextGroups.some((group) => group.id === selectedRosterGroupId) ? selectedRosterGroupId : nextGroups[0]?.id || ''
      const firstTeamForGroup = activeGroupId ? nextTeams.find((team) => team.grupo_id === activeGroupId) : nextTeams[0]
      setSelectedRosterGroupId(activeGroupId)
      setSelectedTeamId((current) => nextTeams.some((team) => team.id === current) && (!activeGroupId || nextTeams.some((team) => team.id === current && team.grupo_id === activeGroupId)) ? current : firstTeamForGroup?.id || null)
      setError('')
    }
    if (showLoading) setIsLoading(false)
  }

  useEffect(() => { loadConfiguration() }, [tournament.id])
  useEffect(() => { if (supabase) supabase.from('demo_canchas').select('id, nombre').eq('activa', true).order('orden').then(({ data, error: responseError }) => responseError ? setError('No se pudieron cargar las canchas para la agenda.') : setCourts(data || [])) }, [])
  useEffect(() => { if (!supabase || !selectedTeamId) { setPlayers([]); return }; supabase.rpc('demo_admin_jugadores', { p_equipo_id: selectedTeamId }).then(({ data, error: responseError }) => responseError ? setError('No se pudo cargar la nómina.') : setPlayers(data || [])) }, [selectedTeamId])

  async function rpc(name, args, fallback) { const response = await supabase.rpc(name, args); if (response.error) { setError(response.error.message || fallback); return false }; setError(''); await loadConfiguration(false); onChanged?.(false); return true }
  async function createGroup(event) { event.preventDefault(); if (groupName.trim() && await rpc('demo_admin_crear_grupo', { p_torneo_id: tournament.id, p_nombre: groupName, p_orden: groups.length + 1 }, 'No se pudo crear el grupo.')) setGroupName('') }
  async function createTeam(event) { event.preventDefault(); if (await rpc('demo_admin_crear_equipo', { p_torneo_id: tournament.id, p_nombre: teamForm.nombre, p_delegado_nombre: teamForm.delegado || null, p_delegado_telefono: teamForm.telefono || null, p_grupo_id: teamForm.grupoId || null }, 'No se pudo crear el equipo.')) setTeamForm({ nombre: '', delegado: '', telefono: '', grupoId: '' }) }
  async function createPlayer(event) { event.preventDefault(); if (!selectedTeamId) return; const saved = await rpc('demo_admin_crear_jugador', { p_equipo_id: selectedTeamId, p_nombre: playerForm.nombre, p_dorsal: playerForm.dorsal ? Number(playerForm.dorsal) : null, p_posicion: playerForm.posicion || null, p_numero_documento: playerForm.documento || null, p_es_capitan: playerForm.capitan }, 'No se pudo agregar el jugador.'); if (saved) setPlayerForm({ nombre: '', dorsal: '', posicion: '', documento: '', capitan: false }) }
  const generateFixture = () => rpc(direct ? 'demo_admin_generar_llaves_directas' : 'demo_admin_generar_fixture_grupos', { p_torneo_id: tournament.id }, 'No se pudo generar el fixture.')
  const generateBracket = () => rpc('demo_admin_generar_llaves', { p_torneo_id: tournament.id }, 'No se pudieron generar las llaves.')
  const schedule = (id, canchaId, inicioAt) => rpc('demo_admin_agendar_partido', { p_partido_id: id, p_cancha_id: canchaId, p_inicio_at: `${inicioAt}:00-05:00` }, 'No se pudo guardar la agenda.')
  const saveResult = (match, local, visitor, winner) => rpc('demo_admin_registrar_resultado_partido', { p_partido_id: match.id, p_goles_local: Number(local), p_goles_visitante: Number(visitor), p_ganador_equipo_id: winner || null }, 'No se pudo guardar el resultado.')

  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const rosterGroups = groups.length ? groups : [...new Map(teams.filter((team) => team.grupo_id).map((team) => [team.grupo_id, { id: team.grupo_id, nombre: team.grupo_nombre }])).values()]
  const rosterTeams = direct || !selectedRosterGroupId
    ? teams
    : teams.filter((team) => team.grupo_id === selectedRosterGroupId)
  const groupMatches = matches.filter((match) => match.fase === 'GRUPOS')
  const eliminationMatches = matches.filter((match) => match.fase !== 'GRUPOS')
  const matchesByGroup = groupMatches.reduce((result, match) => {
    const name = match.etiqueta_llave?.split(' · Jornada')[0] || 'Fase de grupos'
    result[name] = [...(result[name] || []), match]
    return result
  }, {})
  const groupsFinished = groupMatches.length > 0 && groupMatches.every((match) => match.estado === 'FINALIZADO')
  const canContinue = !direct && groupsFinished && eliminationMatches.length === 0
  const fixtureSections = [
    ...Object.entries(matchesByGroup).map(([id, items]) => ({ id: `GROUP:${id}`, label: id, eyebrow: 'FASE DE GRUPOS', items })),
    ...['OCTAVOS', 'CUARTOS', 'SEMIFINALES', 'FINAL'].map((phase) => ({ id: `PHASE:${phase}`, label: phase, eyebrow: 'FASE ELIMINATORIA', items: eliminationMatches.filter((match) => match.fase === phase) })).filter((section) => section.items.length),
  ]
  const visibleFixtureSections = selectedFixtureSection === 'ALL'
    ? fixtureSections
    : fixtureSections.filter((section) => section.id === selectedFixtureSection)

  return <section className="admin-tournament-manager">
    <header className="admin-manager-heading"><button onClick={onBack}><ArrowLeft size={16} /> Volver a torneos</button><div><p className="eyebrow dark">CONFIGURACIÓN DEL TORNEO</p><h2>{tournament.nombre}</h2><p>{direct ? 'Eliminación directa: registra equipos, genera las llaves y agenda cada partido.' : tournament.formato?.replaceAll('_', ' ')}</p></div></header>
    {error && <p className="admin-error"><ShieldAlert size={15} /> {error}</p>}
    {isLoading ? <p className="admin-empty">Cargando configuración…</p> : <>
      <section className="admin-manager-grid">
        <article className="admin-manager-card"><header><p className="eyebrow dark">{direct ? 'FORMATO' : '1. FASE DE GRUPOS'}</p><h3>{direct ? 'Llave automática' : 'Grupos'}</h3></header>{direct ? <div className="admin-group-list"><p>El sistema requiere exactamente 4, 8 o 16 equipos. La primera ronda será semifinales, cuartos u octavos según corresponda.</p></div> : <><div className="admin-group-list">{groups.map((group) => <span key={group.id}>{group.nombre}<b>{group.equipos} equipos</b></span>)}{!groups.length && <p>Aún no hay grupos.</p>}</div><form onSubmit={createGroup} className="admin-inline-form"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Ej. Grupo A" /><button aria-label="Crear grupo"><Plus size={16} /></button></form></>}</article>
        <article className="admin-manager-card"><header><p className="eyebrow dark">{direct ? '1. PARTICIPANTES' : '2. PARTICIPANTES'}</p><h3>Registrar equipo</h3></header><form onSubmit={createTeam} className="admin-stacked-form"><input required value={teamForm.nombre} onChange={(event) => setTeamForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre del equipo" /><input value={teamForm.delegado} onChange={(event) => setTeamForm((current) => ({ ...current, delegado: event.target.value }))} placeholder="Nombre del delegado" /><input value={teamForm.telefono} onChange={(event) => setTeamForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Teléfono del delegado" />{!direct && <select value={teamForm.grupoId} onChange={(event) => setTeamForm((current) => ({ ...current, grupoId: event.target.value }))}><option value="">Sin grupo por ahora</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}</select>}<button className="admin-primary-button"><Plus size={15} /> Agregar equipo</button></form></article>
      </section>
      <section className="admin-roster-section"><div className="admin-roster-teams"><p className="eyebrow dark">{direct ? '2. NÓMINAS' : '3. NÓMINAS'}</p><h3>Equipos registrados</h3>{!direct && rosterGroups.length > 0 && <label className="admin-roster-filter"><span>Mostrar grupo</span><select value={selectedRosterGroupId} onChange={(event) => { const nextGroupId = event.target.value; setSelectedRosterGroupId(nextGroupId); const firstTeam = teams.find((team) => team.grupo_id === nextGroupId); setSelectedTeamId(firstTeam?.id || null) }}>{rosterGroups.map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}</select></label>}{rosterTeams.map((team) => <button key={team.id} className={team.id === selectedTeamId ? 'is-selected' : ''} onClick={() => setSelectedTeamId(team.id)}><strong>{team.nombre}</strong><span>{team.grupo_nombre || 'Sin grupo'} · {team.jugadores} jugadores</span></button>)}{!teams.length && <p>Agrega un equipo para cargar su nómina.</p>}{teams.length > 0 && !rosterTeams.length && <p>No hay equipos en este grupo.</p>}</div><div className="admin-roster-players"><header><div><p className="eyebrow dark">JUGADORES</p><h3>{selectedTeam?.nombre || 'Selecciona un equipo'}</h3></div>{selectedTeam && <span><UsersRound size={15} /> {players.length} registrados</span>}</header>{selectedTeam && <><form className="admin-player-form" onSubmit={createPlayer}><input required value={playerForm.nombre} onChange={(event) => setPlayerForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre del jugador" /><input type="number" min="0" max="99" value={playerForm.dorsal} onChange={(event) => setPlayerForm((current) => ({ ...current, dorsal: event.target.value }))} placeholder="#" /><input value={playerForm.posicion} onChange={(event) => setPlayerForm((current) => ({ ...current, posicion: event.target.value }))} placeholder="Posición" /><input value={playerForm.documento} onChange={(event) => setPlayerForm((current) => ({ ...current, documento: event.target.value }))} placeholder="Documento" /><label><input type="checkbox" checked={playerForm.capitan} onChange={(event) => setPlayerForm((current) => ({ ...current, capitan: event.target.checked }))} /> Capitán</label><button className="admin-primary-button"><Plus size={15} /> Agregar jugador</button></form><div className="admin-player-list">{players.map((player) => <article key={player.id}><b>#{player.dorsal ?? '—'}</b><div><strong>{player.nombre}</strong><span>{player.posicion || 'Posición por definir'}{player.es_capitan ? ' · Capitán' : ''}</span></div></article>)}</div></>}</div></section>
      <section className="admin-fixture-section">
        <header><div><p className="eyebrow dark">{direct ? '3. LLAVES, AGENDA Y RESULTADOS' : '4. FIXTURE, AGENDA Y RESULTADOS'}</p><h3>Partidos del torneo</h3></div><div className="admin-fixture-actions">{!matches.length && <button className="admin-primary-button" onClick={generateFixture}><Trophy size={15} /> {direct ? 'Generar llave directa' : 'Generar fixture de grupos'}</button>}{canContinue && <button className="admin-primary-button" onClick={generateBracket}><CalendarCog size={15} /> Continuar a fase eliminatoria</button>}</div></header>
        <p className="admin-fixture-help">Programa cancha, fecha y hora. La fase eliminatoria se habilita después de terminar todos los partidos de grupos.</p>
        {!matches.length && <p className="admin-empty">Registra los equipos y genera el fixture automático.</p>}
        {fixtureSections.length > 1 && <label className="admin-fixture-filter"><span>Ver fase o grupo</span><select value={selectedFixtureSection} onChange={(event) => setSelectedFixtureSection(event.target.value)}><option value="ALL">Todos los partidos</option>{fixtureSections.map((section) => <option key={section.id} value={section.id}>{section.eyebrow === 'FASE DE GRUPOS' ? section.label : `Eliminatoria · ${section.label}`}</option>)}</select></label>}
        {!!visibleFixtureSections.length && <div className="admin-grouped-matches">{visibleFixtureSections.map((section) => <FixtureSection key={section.id} eyebrow={section.eyebrow} title={section.label} matches={section.items} courts={courts} onSchedule={schedule} onSave={saveResult} />)}</div>}
        {canContinue && <section className="admin-next-phase"><div><p className="eyebrow dark">CLASIFICACIÓN COMPLETA</p><h4>La fase de grupos terminó</h4><p>Revisa los resultados y genera la siguiente llave cuando estés listo.</p></div><button className="admin-primary-button" onClick={generateBracket}><Trophy size={16} /> Continuar a fase eliminatoria</button></section>}
      </section>
    </>}
  </section>
}

function FixtureSection({ eyebrow, title, matches, courts, onSchedule, onSave }) {
  const completed = matches.filter((match) => match.estado === 'FINALIZADO').length
  return <section className="admin-match-phase"><header><div><p className="eyebrow dark">{eyebrow}</p><h4>{title}</h4></div><span>{completed}/{matches.length} finalizados</span></header><div className="admin-match-list">{matches.map((match) => <AdminMatchResult key={match.id} match={match} courts={courts} onSchedule={onSchedule} onSave={onSave} />)}</div></section>
}

function AdminMatchResult({ match, courts, onSchedule, onSave }) {
  const [local, setLocal] = useState(match.goles_local ?? '')
  const [visitor, setVisitor] = useState(match.goles_visitante ?? '')
  const [winner, setWinner] = useState(match.ganador_equipo_id || '')
  const [court, setCourt] = useState(match.cancha_id || '')
  const [startAt, setStartAt] = useState(asGuayaquilDateTimeInput(match.inicio_at))
  const ready = match.equipo_local_id && match.equipo_visitante_id
  const final = match.estado === 'FINALIZADO'
  const tie = match.fase !== 'GRUPOS' && local !== '' && visitor !== '' && Number(local) === Number(visitor)
  return <article className="admin-match"><header><span>{match.etiqueta_llave || (match.jornada ? `Jornada ${match.jornada}` : match.fase)}</span><b>{final ? 'Finalizado' : 'Programado'}</b></header><div className="admin-match-teams"><strong>{match.equipo_local_nombre || 'Por definir'}</strong><input disabled={!ready || final} type="number" min="0" value={local} onChange={(event) => setLocal(event.target.value)} /><strong>{match.equipo_visitante_nombre || 'Por definir'}</strong><input disabled={!ready || final} type="number" min="0" value={visitor} onChange={(event) => setVisitor(event.target.value)} /></div><div className="admin-match-agenda"><select value={court} onChange={(event) => setCourt(event.target.value)}><option value="">Cancha</option>{courts.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /><button className="admin-secondary-button" disabled={!court || !startAt} onClick={() => onSchedule(match.id, court, startAt)}><CalendarPlus size={14} /> Agendar</button></div>{tie && !final && <select value={winner} onChange={(event) => setWinner(event.target.value)}><option value="">Ganador por penales</option><option value={match.equipo_local_id}>{match.equipo_local_nombre}</option><option value={match.equipo_visitante_id}>{match.equipo_visitante_nombre}</option></select>}{!final && <button disabled={!ready || local === '' || visitor === '' || (tie && !winner)} onClick={() => onSave(match, local, visitor, winner)}><Play size={14} /> Guardar resultado</button>}</article>
}
