import { ArrowLeft, CalendarCog, CalendarPlus, Play, Plus, ShieldAlert, Trophy, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function asGuayaquilDateTimeInput(value) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function AdminTournamentManager({ tournament, onBack, onChanged }) {
  const [groups, setGroups] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [courts, setCourts] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupName, setGroupName] = useState('')
  const [teamForm, setTeamForm] = useState({ nombre: '', delegado: '', telefono: '', grupoId: '' })
  const [playerForm, setPlayerForm] = useState({ nombre: '', dorsal: '', posicion: '', documento: '', capitan: false })
  const direct = tournament.formato === 'ELIMINACION_DIRECTA'

  async function loadConfiguration() {
    if (!supabase) return
    setIsLoading(true)
    const [groupsResponse, teamsResponse, matchesResponse] = await Promise.all([
      supabase.rpc('demo_admin_grupos', { p_torneo_id: tournament.id }),
      supabase.rpc('demo_admin_equipos', { p_torneo_id: tournament.id }),
      supabase.rpc('demo_admin_partidos_torneo', { p_torneo_id: tournament.id }),
    ])
    if (groupsResponse.error || teamsResponse.error || matchesResponse.error) setError('No se pudo cargar la configuración del torneo.')
    else {
      const nextTeams = teamsResponse.data || []
      setGroups(groupsResponse.data || []); setTeams(nextTeams); setMatches(matchesResponse.data || [])
      setSelectedTeamId((current) => nextTeams.some((team) => team.id === current) ? current : nextTeams[0]?.id || null)
      setError('')
    }
    setIsLoading(false)
  }

  useEffect(() => { loadConfiguration() }, [tournament.id])
  useEffect(() => { if (supabase) supabase.from('demo_canchas').select('id, nombre').eq('activa', true).order('orden').then(({ data, error: e }) => e ? setError('No se pudieron cargar las canchas para la agenda.') : setCourts(data || [])) }, [])
  useEffect(() => { if (!supabase || !selectedTeamId) { setPlayers([]); return }; supabase.rpc('demo_admin_jugadores', { p_equipo_id: selectedTeamId }).then(({ data, error: e }) => e ? setError('No se pudo cargar la nómina.') : setPlayers(data || [])) }, [selectedTeamId])

  async function rpc(name, args, fallback) { const response = await supabase.rpc(name, args); if (response.error) { setError(response.error.message || fallback); return false }; setError(''); await loadConfiguration(); onChanged?.(); return true }
  async function createGroup(event) { event.preventDefault(); if (groupName.trim() && await rpc('demo_admin_crear_grupo', { p_torneo_id: tournament.id, p_nombre: groupName, p_orden: groups.length + 1 }, 'No se pudo crear el grupo.')) setGroupName('') }
  async function createTeam(event) { event.preventDefault(); if (await rpc('demo_admin_crear_equipo', { p_torneo_id: tournament.id, p_nombre: teamForm.nombre, p_delegado_nombre: teamForm.delegado || null, p_delegado_telefono: teamForm.telefono || null, p_grupo_id: teamForm.grupoId || null }, 'No se pudo crear el equipo.')) setTeamForm({ nombre: '', delegado: '', telefono: '', grupoId: '' }) }
  async function createPlayer(event) { event.preventDefault(); if (!selectedTeamId) return; const ok = await rpc('demo_admin_crear_jugador', { p_equipo_id: selectedTeamId, p_nombre: playerForm.nombre, p_dorsal: playerForm.dorsal ? Number(playerForm.dorsal) : null, p_posicion: playerForm.posicion || null, p_numero_documento: playerForm.documento || null, p_es_capitan: playerForm.capitan }, 'No se pudo agregar el jugador.'); if (ok) setPlayerForm({ nombre: '', dorsal: '', posicion: '', documento: '', capitan: false }) }
  const generate = () => rpc(direct ? 'demo_admin_generar_llaves_directas' : 'demo_admin_generar_fixture_grupos', { p_torneo_id: tournament.id }, 'No se pudo generar el fixture.')
  const generateBracket = () => rpc('demo_admin_generar_llaves', { p_torneo_id: tournament.id }, 'No se pudieron generar las llaves.')
  // datetime-local does not include a zone. The complex operates in Ecuador,
  // so preserve the time selected by the administrator as America/Guayaquil.
  const schedule = (id, canchaId, inicioAt) => rpc('demo_admin_agendar_partido', { p_partido_id: id, p_cancha_id: canchaId, p_inicio_at: `${inicioAt}:00-05:00` }, 'No se pudo guardar la agenda.')
  const result = (match, local, visitor, winner) => rpc('demo_admin_registrar_resultado_partido', { p_partido_id: match.id, p_goles_local: Number(local), p_goles_visitante: Number(visitor), p_ganador_equipo_id: winner || null }, 'No se pudo guardar el resultado.')
  const selectedTeam = teams.find((team) => team.id === selectedTeamId)

  return <section className="admin-tournament-manager">
    <header className="admin-manager-heading"><button onClick={onBack}><ArrowLeft size={16} /> Volver a torneos</button><div><p className="eyebrow dark">CONFIGURACIÓN DEL TORNEO</p><h2>{tournament.nombre}</h2><p>{direct ? 'Eliminación directa: registra equipos, genera las llaves y agenda cada partido.' : tournament.formato?.replaceAll('_', ' ')}</p></div></header>
    {error && <p className="admin-error"><ShieldAlert size={15} /> {error}</p>}
    {isLoading ? <p className="admin-empty">Cargando configuración…</p> : <>
      <section className="admin-manager-grid">
        <article className="admin-manager-card"><header><p className="eyebrow dark">{direct ? 'FORMATO' : '1. FASE DE GRUPOS'}</p><h3>{direct ? 'Llave automática' : 'Grupos'}</h3></header>{direct ? <div className="admin-group-list"><p>El sistema requiere exactamente 4, 8 o 16 equipos. La primera ronda será semifinales, cuartos u octavos según corresponda.</p></div> : <><div className="admin-group-list">{groups.map((group) => <span key={group.id}>{group.nombre}<b>{group.equipos} equipos</b></span>)}{!groups.length && <p>Aún no hay grupos.</p>}</div><form onSubmit={createGroup} className="admin-inline-form"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej. Grupo A" /><button aria-label="Crear grupo"><Plus size={16} /></button></form></>}</article>
        <article className="admin-manager-card"><header><p className="eyebrow dark">{direct ? '1. PARTICIPANTES' : '2. PARTICIPANTES'}</p><h3>Registrar equipo</h3></header><form onSubmit={createTeam} className="admin-stacked-form"><input required value={teamForm.nombre} onChange={(e) => setTeamForm((v) => ({ ...v, nombre: e.target.value }))} placeholder="Nombre del equipo" /><input value={teamForm.delegado} onChange={(e) => setTeamForm((v) => ({ ...v, delegado: e.target.value }))} placeholder="Nombre del delegado" /><input value={teamForm.telefono} onChange={(e) => setTeamForm((v) => ({ ...v, telefono: e.target.value }))} placeholder="Teléfono del delegado" />{!direct && <select value={teamForm.grupoId} onChange={(e) => setTeamForm((v) => ({ ...v, grupoId: e.target.value }))}><option value="">Sin grupo por ahora</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}</select>}<button className="admin-primary-button"><Plus size={15} /> Agregar equipo</button></form></article>
      </section>
      <section className="admin-roster-section"><div className="admin-roster-teams"><p className="eyebrow dark">{direct ? '2. NÓMINAS' : '3. NÓMINAS'}</p><h3>Equipos registrados</h3>{teams.map((team) => <button key={team.id} className={team.id === selectedTeamId ? 'is-selected' : ''} onClick={() => setSelectedTeamId(team.id)}><strong>{team.nombre}</strong><span>{team.grupo_nombre || 'Sin grupo'} · {team.jugadores} jugadores</span></button>)}{!teams.length && <p>Agrega un equipo para cargar su nómina.</p>}</div><div className="admin-roster-players"><header><div><p className="eyebrow dark">JUGADORES</p><h3>{selectedTeam?.nombre || 'Selecciona un equipo'}</h3></div>{selectedTeam && <span><UsersRound size={15} /> {players.length} registrados</span>}</header>{selectedTeam && <><form className="admin-player-form" onSubmit={createPlayer}><input required value={playerForm.nombre} onChange={(e) => setPlayerForm((v) => ({ ...v, nombre: e.target.value }))} placeholder="Nombre del jugador" /><input type="number" min="0" max="99" value={playerForm.dorsal} onChange={(e) => setPlayerForm((v) => ({ ...v, dorsal: e.target.value }))} placeholder="#" /><input value={playerForm.posicion} onChange={(e) => setPlayerForm((v) => ({ ...v, posicion: e.target.value }))} placeholder="Posición" /><input value={playerForm.documento} onChange={(e) => setPlayerForm((v) => ({ ...v, documento: e.target.value }))} placeholder="Documento" /><label><input type="checkbox" checked={playerForm.capitan} onChange={(e) => setPlayerForm((v) => ({ ...v, capitan: e.target.checked }))} /> Capitán</label><button className="admin-primary-button"><Plus size={15} /> Agregar jugador</button></form><div className="admin-player-list">{players.map((player) => <article key={player.id}><b>#{player.dorsal ?? '—'}</b><div><strong>{player.nombre}</strong><span>{player.posicion || 'Posición por definir'}{player.es_capitan ? ' · Capitán' : ''}</span></div></article>)}</div></>}</div></section>
      <section className="admin-fixture-section"><header><div><p className="eyebrow dark">{direct ? '3. LLAVES, AGENDA Y RESULTADOS' : '4. FIXTURE, AGENDA Y RESULTADOS'}</p><h3>Partidos del torneo</h3></div><div className="admin-fixture-actions"><button className="admin-primary-button" onClick={generate}><Trophy size={15} /> {direct ? 'Generar llave directa' : 'Generar fixture de grupos'}</button>{!direct && <button className="admin-secondary-button" onClick={generateBracket}><CalendarCog size={15} /> Generar llaves</button>}</div></header><p className="admin-fixture-help">Al generar los cruces, el administrador solo debe asignar cancha, fecha y hora. El ganador de cada llave pasa automáticamente a la siguiente ronda.</p><div className="admin-match-list">{matches.map((match) => <AdminMatchResult key={match.id} match={match} courts={courts} onSchedule={schedule} onSave={result} />)}{!matches.length && <p className="admin-empty">Registra los equipos y genera el fixture automático.</p>}</div></section>
    </>}
  </section>
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
  return <article className="admin-match"><header><span>{match.etiqueta_llave || match.fase}{match.jornada ? ` · Jornada ${match.jornada}` : ''}</span><b>{final ? 'Finalizado' : 'Programado'}</b></header><div className="admin-match-teams"><strong>{match.equipo_local_nombre || 'Por definir'}</strong><input disabled={!ready || final} type="number" min="0" value={local} onChange={(e) => setLocal(e.target.value)} /><strong>{match.equipo_visitante_nombre || 'Por definir'}</strong><input disabled={!ready || final} type="number" min="0" value={visitor} onChange={(e) => setVisitor(e.target.value)} /></div><div className="admin-match-agenda"><select value={court} onChange={(e) => setCourt(e.target.value)}><option value="">Cancha</option>{courts.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /><button className="admin-secondary-button" disabled={!court || !startAt} onClick={() => onSchedule(match.id, court, startAt)}><CalendarPlus size={14} /> Agendar</button></div>{tie && !final && <select value={winner} onChange={(e) => setWinner(e.target.value)}><option value="">Ganador por penales</option><option value={match.equipo_local_id}>{match.equipo_local_nombre}</option><option value={match.equipo_visitante_id}>{match.equipo_visitante_nombre}</option></select>}{!final && <button disabled={!ready || local === '' || visitor === '' || (tie && !winner)} onClick={() => onSave(match, local, visitor, winner)}><Play size={14} /> Guardar resultado</button>}</article>
}
