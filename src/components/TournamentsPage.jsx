import { CalendarDays, ChevronRight, CircleDot, Trophy, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDemoTournaments } from '../hooks/useDemoTournaments'

const statusLabel = {
  INSCRIPCIONES: 'Inscripciones abiertas',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado',
}

function dateRange(tournament) {
  if (!tournament.fecha_inicio) return 'Fechas por confirmar'
  const options = { day: 'numeric', month: 'short', year: 'numeric' }
  const start = new Intl.DateTimeFormat('es-EC', options).format(new Date(`${tournament.fecha_inicio}T12:00:00`))
  if (!tournament.fecha_fin || tournament.fecha_fin === tournament.fecha_inicio) return start
  return `${start} — ${new Intl.DateTimeFormat('es-EC', options).format(new Date(`${tournament.fecha_fin}T12:00:00`))}`
}

function matchDate(value) {
  if (!value) return 'Horario por confirmar'
  return new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function groupStandings(rows) {
  return [...rows].sort((a, b) => b.puntos - a.puntos || (b.goles_favor - b.goles_contra) - (a.goles_favor - a.goles_contra) || b.goles_favor - a.goles_favor || a.equipo_nombre.localeCompare(b.equipo_nombre))
}

export function TournamentsPage({ complex }) {
  const data = useDemoTournaments(complex?.id)
  const [selectedId, setSelectedId] = useState(null)
  const selectedTournament = useMemo(() => data.tournaments.find((tournament) => tournament.id === selectedId) || data.tournaments[0], [data.tournaments, selectedId])
  const selectedGroups = data.groups.filter((group) => group.torneo_id === selectedTournament?.id)
  const selectedStandings = data.standings.filter((row) => row.torneo_id === selectedTournament?.id)
  const selectedMatches = data.matches.filter((match) => match.torneo_id === selectedTournament?.id)
  const directMatches = selectedMatches.filter((match) => !match.grupo_id)
  const teamsById = Object.fromEntries(data.teams.map((team) => [team.id, team]))

  return <main className="tournaments-page">
    <section className="tournaments-hero">
      <div><p className="eyebrow"><Trophy size={13} /> COMPETENCIAS DEL COMPLEJO</p><h1>TORNEOS</h1><p>Calendarios, posiciones y resultados de cada campeonato.</p></div>
    </section>

    <section className="tournaments-content">
      {data.isLoading && <p className="tournaments-message">Cargando torneos…</p>}
      {data.error && <p className="tournaments-message is-error">{data.error}</p>}
      {!data.isLoading && !data.error && !data.tournaments.length && <section className="tournaments-empty"><Trophy size={30} /><h2>Próximamente habrá torneos</h2><p>Cuando el complejo publique una competencia, su calendario y resultados aparecerán aquí.</p></section>}

      {!!selectedTournament && <>
        <div className="tournament-picker" aria-label="Seleccionar torneo">
          {data.tournaments.map((tournament) => <button key={tournament.id} onClick={() => setSelectedId(tournament.id)} className={tournament.id === selectedTournament.id ? 'is-selected' : ''}>
            <span>{statusLabel[tournament.estado] || tournament.estado}</span><strong>{tournament.nombre}</strong><ChevronRight size={16} />
          </button>)}
        </div>

        <section className="tournament-overview">
          <div><p className="eyebrow dark">{selectedTournament.formato?.replaceAll('_', ' ')}</p><h2>{selectedTournament.nombre}</h2><p>{selectedTournament.descripcion || 'Información oficial del torneo.'}</p></div>
          <div className="tournament-meta"><span><CalendarDays size={15} />{dateRange(selectedTournament)}</span><span><UsersRound size={15} />{data.teams.filter((team) => team.torneo_id === selectedTournament.id).length} equipos</span><strong className={`tournament-status is-${selectedTournament.estado?.toLowerCase()}`}>{statusLabel[selectedTournament.estado] || selectedTournament.estado}</strong></div>
        </section>

        {selectedGroups.length > 0 && <section className="standings-section"><div className="tournament-section-heading"><p className="eyebrow dark"><UsersRound size={13} /> FASE DE GRUPOS</p><h2>Tabla de posiciones</h2></div><div className="standings-grid">{selectedGroups.map((group) => <article className="standings-card" key={group.id}><h3>{group.nombre}</h3><div className="standings-head"><span>#</span><span>Equipo</span><span>PJ</span><span>DG</span><span>PTS</span></div>{groupStandings(selectedStandings.filter((row) => row.grupo_id === group.id)).map((row, index) => <div className="standing-row" key={row.equipo_id}><span>{index + 1}</span><strong>{row.equipo_nombre}</strong><span>{row.partidos_jugados}</span><span>{row.goles_favor - row.goles_contra}</span><b>{row.puntos}</b></div>)}</article>)}</div></section>}

        {selectedMatches.filter((match) => match.grupo_id).length > 0 && <section className="matches-section"><div className="tournament-section-heading"><p className="eyebrow dark"><CircleDot size={13} /> PARTIDOS DE GRUPOS</p><h2>Calendario y resultados</h2></div><div className="match-grid">{selectedMatches.filter((match) => match.grupo_id).map((match) => <MatchCard key={match.id} match={match} teamsById={teamsById} />)}</div></section>}

        {directMatches.length > 0 && <section className="bracket-section"><div className="tournament-section-heading"><p className="eyebrow dark"><Trophy size={13} /> FASE ELIMINATORIA</p><h2>Llaves del torneo</h2></div><div className="bracket-grid">{directMatches.map((match) => <MatchCard key={match.id} match={match} teamsById={teamsById} bracket />)}</div></section>}
      </>}
    </section>
  </main>
}

function MatchCard({ match, teamsById, bracket = false }) {
  const local = teamsById[match.equipo_local_id]?.nombre || 'Por definir'
  const visitante = teamsById[match.equipo_visitante_id]?.nombre || 'Por definir'
  const isFinal = match.estado === 'FINALIZADO'
  return <article className={`match-card ${bracket ? 'is-bracket' : ''}`}><header><span>{match.etiqueta_llave || match.fase || 'Partido'}</span><time>{matchDate(match.inicio_at)}</time></header><div><strong>{local}</strong><b>{isFinal ? match.goles_local ?? 0 : '—'}</b></div><div><strong>{visitante}</strong><b>{isFinal ? match.goles_visitante ?? 0 : '—'}</b></div><footer>{isFinal ? 'Finalizado' : match.estado === 'EN_JUEGO' ? 'En juego' : 'Programado'}</footer></article>
}
