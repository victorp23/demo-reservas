import { CalendarCheck2, Check, CircleX, ClipboardList, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AdminTournamentManager } from './AdminTournamentManager'

const reservationStateLabel = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Reservada', CANCELADA: 'Cancelada', FINALIZADA: 'Finalizada', NO_ASISTIO: 'No asistió' }
const tournamentStateLabel = { BORRADOR: 'Borrador', INSCRIPCIONES: 'Inscripciones', EN_CURSO: 'En curso', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado' }

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AdminReservationsPage({ complex }) {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(null)
  const [activeTab, setActiveTab] = useState('reservas')
  const [reservations, setReservations] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [isTournamentFormOpen, setIsTournamentFormOpen] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [tournamentForm, setTournamentForm] = useState({ nombre: '', descripcion: '', categoria: '', fechaInicio: '', fechaFin: '', formato: 'GRUPOS_Y_ELIMINACION', maxEquipos: '8' })

  const loadAdminData = useCallback(async (showLoading = true) => {
    if (!supabase || !complex?.id) return
    if (showLoading) setIsLoading(true)
    setAuthError('')
    const [reservationsResponse, tournamentsResponse] = await Promise.all([
      supabase.rpc('demo_admin_reservas', { p_complejo_id: complex.id }),
      supabase.rpc('demo_admin_torneos', { p_complejo_id: complex.id }),
    ])
    if (showLoading) setIsLoading(false)

    if (reservationsResponse.error || tournamentsResponse.error) {
      setIsAuthorized(false)
      setAuthError('Tu usuario no está autorizado para administrar este complejo.')
      return
    }

    setReservations(reservationsResponse.data || [])
    setTournaments(tournamentsResponse.data || [])
    setIsAuthorized(true)
  }, [complex?.id])

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadAdminData() }, [session, loadAdminData])

  async function login(event) {
    event.preventDefault()
    if (!supabase) return
    setIsLoading(true)
    setAuthError('')
    const response = await supabase.auth.signInWithPassword({ email, password })
    if (response.error) {
      setAuthError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
      setIsLoading(false)
    }
  }

  async function updateReservation(id, state) {
    if (!supabase) return
    setActionId(id)
    const response = await supabase.rpc('demo_admin_actualizar_reserva', { p_reserva_id: id, p_estado: state, p_comentario: null })
    setActionId(null)
    if (response.error) { setAuthError('No fue posible actualizar la reserva.'); return }
    loadAdminData()
  }

  async function createTournament(event) {
    event.preventDefault()
    if (!supabase || !complex?.id) return
    setIsLoading(true)
    const response = await supabase.rpc('demo_admin_crear_torneo', {
      p_complejo_id: complex.id,
      p_nombre: tournamentForm.nombre,
      p_descripcion: tournamentForm.descripcion || null,
      p_categoria: tournamentForm.categoria || null,
      p_fecha_inicio: tournamentForm.fechaInicio || null,
      p_fecha_fin: tournamentForm.fechaFin || null,
      p_formato: tournamentForm.formato,
      p_max_equipos: tournamentForm.formato === 'ELIMINACION_DIRECTA' ? Number(tournamentForm.maxEquipos) : null,
    })
    setIsLoading(false)
    if (response.error) { setAuthError('No fue posible crear el torneo. Revisa los datos ingresados.'); return }
    setTournamentForm({ nombre: '', descripcion: '', categoria: '', fechaInicio: '', fechaFin: '', formato: 'GRUPOS_Y_ELIMINACION', maxEquipos: '8' })
    setIsTournamentFormOpen(false)
    loadAdminData()
  }

  async function updateTournamentState(id, state) {
    if (!supabase) return
    setActionId(id)
    const response = await supabase.rpc('demo_admin_actualizar_estado_torneo', { p_torneo_id: id, p_estado: state })
    setActionId(null)
    if (response.error) { setAuthError('No fue posible actualizar el estado del torneo.'); return }
    loadAdminData()
  }

  if (session === undefined) return <main className="admin-page"><p className="admin-loading"><LoaderCircle className="spin" size={18} /> Preparando administración…</p></main>

  if (!session) return <main className="admin-page admin-login-page"><section className="admin-login">
    <ShieldCheck size={32} />
    <p className="eyebrow dark">ACCESO PRIVADO</p>
    <h1>Administración del complejo</h1>
    <p>Ingresa con el único usuario autorizado para {complex?.name || 'el complejo'}.</p>
    <form onSubmit={login}>
      <label>Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" /></label>
      <label>Contraseña<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
      {authError && <p className="admin-error">{authError}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? 'Ingresando…' : 'Ingresar al panel'}</button>
    </form>
  </section></main>

  if (isAuthorized === null || isLoading) return <main className="admin-page"><p className="admin-loading"><LoaderCircle className="spin" size={18} /> Verificando acceso…</p></main>

  if (!isAuthorized) return <main className="admin-page admin-login-page"><section className="admin-login admin-denied">
    <ShieldCheck size={32} /><p className="eyebrow dark">ACCESO RESTRINGIDO</p><h1>Usuario sin permisos</h1><p>{authError}</p><button onClick={() => supabase?.auth.signOut()}>Cerrar sesión</button>
  </section></main>

  const pendingCount = reservations.filter((item) => item.estado === 'PENDIENTE').length
  const activeTournaments = tournaments.filter((item) => item.estado === 'INSCRIPCIONES' || item.estado === 'EN_CURSO').length

  return <main className="admin-page"><section className="admin-shell">
    <header className="admin-topbar"><div><p className="eyebrow dark">PANEL PRIVADO</p><h1>Administración</h1><p>{complex?.name}</p></div><div className="admin-top-actions"><button onClick={loadAdminData} title="Actualizar" aria-label="Actualizar"><RefreshCw size={17} /></button><button onClick={() => supabase?.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button></div></header>
    <div className="admin-tabs"><button className={activeTab === 'reservas' ? 'is-active' : ''} onClick={() => setActiveTab('reservas')}><ClipboardList size={16} /> Reservas <b>{pendingCount}</b></button><button className={activeTab === 'torneos' ? 'is-active' : ''} onClick={() => setActiveTab('torneos')}><Trophy size={16} /> Torneos <b>{activeTournaments}</b></button></div>
    {authError && <p className="admin-error">{authError}</p>}

    {activeTab === 'reservas' && <>
      <div className="admin-summary"><article><strong>{pendingCount}</strong><span>Pendientes</span></article><article><strong>{reservations.filter((item) => item.estado === 'CONFIRMADA').length}</strong><span>Reservadas</span></article><article><strong>{reservations.length}</strong><span>Total</span></article></div>
      <section className="reservation-list">{reservations.length ? reservations.map((reservation) => <article key={reservation.id} className={`admin-reservation status-${reservation.estado.toLowerCase()}`}>
        <div className="admin-reservation-main"><div className="admin-reservation-code"><CalendarCheck2 size={17} /><span>{reservation.codigo}</span></div><h2>{reservation.cancha_nombre}</h2><p className="admin-reservation-time">{formatDateTime(reservation.inicio_at)} · hasta {new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', timeStyle: 'short' }).format(new Date(reservation.fin_at))}</p></div>
        <div className="admin-reservation-client"><strong>{reservation.cliente_nombre || 'Cliente sin nombre'}</strong><span>{reservation.cliente_telefono || 'Sin teléfono'}</span>{reservation.nombre_equipo && <span>Equipo: {reservation.nombre_equipo}</span>}</div>
        <div className="admin-reservation-status"><span>{reservationStateLabel[reservation.estado] || reservation.estado}</span>{reservation.estado === 'PENDIENTE' && <div><button className="confirm" disabled={actionId === reservation.id} onClick={() => updateReservation(reservation.id, 'CONFIRMADA')}><Check size={15} /> Confirmar</button><button className="cancel" disabled={actionId === reservation.id} onClick={() => updateReservation(reservation.id, 'CANCELADA')}><CircleX size={15} /> Cancelar</button></div>}</div>
      </article>) : <p className="admin-empty">Todavía no hay solicitudes de reserva.</p>}</section>
    </>}

    {activeTab === 'torneos' && (selectedTournament ? <AdminTournamentManager tournament={selectedTournament} onBack={() => setSelectedTournament(null)} onChanged={loadAdminData} /> : <>
      <div className="admin-tournament-toolbar"><div><p className="eyebrow dark">GESTIÓN DE COMPETENCIAS</p><h2>Torneos del complejo</h2></div><button onClick={() => setIsTournamentFormOpen(true)}><Plus size={16} /> Nuevo torneo</button></div>
      {isTournamentFormOpen && <form className="admin-tournament-form" onSubmit={createTournament}>
        <header><div><p className="eyebrow dark">NUEVO TORNEO</p><h3>Configura la competencia</h3></div><button type="button" onClick={() => setIsTournamentFormOpen(false)} aria-label="Cerrar"><X size={17} /></button></header>
        <label>Nombre<input required value={tournamentForm.nombre} onChange={(event) => setTournamentForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Copa del Complejo" /></label>
        <label>Descripción<textarea value={tournamentForm.descripcion} onChange={(event) => setTournamentForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Información para los participantes" /></label>
        <div className="admin-form-grid">
          <label>Categoría<input value={tournamentForm.categoria} onChange={(event) => setTournamentForm((current) => ({ ...current, categoria: event.target.value }))} placeholder="Libre / Sub-18" /></label>
          <label>Formato<select value={tournamentForm.formato} onChange={(event) => setTournamentForm((current) => ({ ...current, formato: event.target.value }))}><option value="GRUPOS_Y_ELIMINACION">Grupos y eliminación</option><option value="LIGA">Liga</option><option value="ELIMINACION_DIRECTA">Eliminación directa</option></select></label>
          {tournamentForm.formato === 'ELIMINACION_DIRECTA' && <label>Equipos<select value={tournamentForm.maxEquipos} onChange={(event) => setTournamentForm((current) => ({ ...current, maxEquipos: event.target.value }))}><option value="4">4 equipos · semifinales</option><option value="8">8 equipos · cuartos</option><option value="16">16 equipos · octavos</option></select></label>}
          <label>Inicio<input type="date" value={tournamentForm.fechaInicio} onChange={(event) => setTournamentForm((current) => ({ ...current, fechaInicio: event.target.value }))} /></label><label>Fin<input type="date" value={tournamentForm.fechaFin} onChange={(event) => setTournamentForm((current) => ({ ...current, fechaFin: event.target.value }))} /></label>
        </div>
        {tournamentForm.formato === 'ELIMINACION_DIRECTA' && <p className="admin-form-hint">El sistema armará las llaves automáticamente al completar los {tournamentForm.maxEquipos} equipos. Después solo asignas cancha, fecha y hora a cada partido.</p>}
        <button className="admin-primary-button" disabled={isLoading} type="submit">Crear como borrador</button>
      </form>}
      <section className="admin-tournament-list">{tournaments.length ? tournaments.map((tournament) => <article className="admin-tournament-card" key={tournament.id}><div><p className="eyebrow dark">{tournament.formato?.replaceAll('_', ' ')}</p><h3>{tournament.nombre}</h3><p>{tournament.categoria || 'Categoría por definir'} · {tournament.equipos} equipos · {tournament.partidos} partidos</p></div><div className="admin-tournament-actions"><span className={`admin-tournament-state is-${tournament.estado.toLowerCase()}`}>{tournamentStateLabel[tournament.estado] || tournament.estado}</span><button className="admin-secondary-button" onClick={() => setSelectedTournament(tournament)}>Equipos y jugadores</button>{tournament.estado === 'BORRADOR' && <button disabled={actionId === tournament.id} onClick={() => updateTournamentState(tournament.id, 'INSCRIPCIONES')}>Abrir inscripciones</button>}{tournament.estado === 'INSCRIPCIONES' && <button disabled={actionId === tournament.id} onClick={() => updateTournamentState(tournament.id, 'EN_CURSO')}>Iniciar torneo</button>}{tournament.estado === 'EN_CURSO' && <button disabled={actionId === tournament.id} onClick={() => updateTournamentState(tournament.id, 'FINALIZADO')}>Finalizar</button>}</div></article>) : <p className="admin-empty">Crea el primer torneo del complejo para empezar a configurarlo.</p>}</section>
    </>)}
  </section></main>
}
