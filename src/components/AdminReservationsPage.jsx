import { CalendarCheck2, Check, CircleX, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const stateLabel = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Reservada', CANCELADA: 'Cancelada', FINALIZADA: 'Finalizada', NO_ASISTIO: 'No asistió' }

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AdminReservationsPage({ complex }) {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [reservations, setReservations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionId, setActionId] = useState(null)

  const loadReservations = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)
    const response = await supabase.rpc('demo_admin_reservas')
    if (response.error) setAuthError(response.error.code === '42501' ? 'Tu usuario no está autorizado como administrador del complejo.' : 'No se pudieron cargar las reservas.')
    else { setReservations(response.data || []); setAuthError('') }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadReservations() }, [session, loadReservations])

  async function login(event) {
    event.preventDefault()
    if (!supabase) return
    setIsLoading(true)
    setAuthError('')
    const response = await supabase.auth.signInWithPassword({ email, password })
    if (response.error) setAuthError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
    setIsLoading(false)
  }

  async function updateReservation(id, state) {
    if (!supabase) return
    setActionId(id)
    const response = await supabase.rpc('demo_admin_actualizar_reserva', { p_reserva_id: id, p_estado: state, p_comentario: null })
    setActionId(null)
    if (response.error) { setAuthError('No fue posible actualizar la reserva.'); return }
    loadReservations()
  }

  if (session === undefined) return <main className="admin-page"><p className="admin-loading"><LoaderCircle className="spin" size={18} /> Preparando administración…</p></main>

  if (!session) return <main className="admin-page admin-login-page"><section className="admin-login">
    <ShieldCheck size={32} />
    <p className="eyebrow dark">ACCESO PRIVADO</p>
    <h1>Administración de reservas</h1>
    <p>Ingresa con el usuario autorizado para {complex?.name || 'el complejo'}.</p>
    <form onSubmit={login}>
      <label>Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" /></label>
      <label>Contraseña<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
      {authError && <p className="admin-error">{authError}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? 'Ingresando…' : 'Ingresar al panel'}</button>
    </form>
  </section></main>

  return <main className="admin-page"><section className="admin-shell">
    <header className="admin-topbar"><div><p className="eyebrow dark">PANEL DEL COMPLEJO</p><h1>Reservas</h1><p>{complex?.name}</p></div><div className="admin-top-actions"><button onClick={loadReservations} title="Actualizar" aria-label="Actualizar"><RefreshCw size={17} /></button><button onClick={() => supabase?.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button></div></header>
    {authError && <p className="admin-error">{authError}</p>}
    <div className="admin-summary"><article><strong>{reservations.filter((item) => item.estado === 'PENDIENTE').length}</strong><span>Pendientes</span></article><article><strong>{reservations.filter((item) => item.estado === 'CONFIRMADA').length}</strong><span>Reservadas</span></article><article><strong>{reservations.length}</strong><span>Total</span></article></div>
    {isLoading ? <p className="admin-loading"><LoaderCircle className="spin" size={18} /> Consultando reservas…</p> : <section className="reservation-list">{reservations.length ? reservations.map((reservation) => <article key={reservation.id} className={`admin-reservation status-${reservation.estado.toLowerCase()}`}>
      <div className="admin-reservation-main"><div className="admin-reservation-code"><CalendarCheck2 size={17} /><span>{reservation.codigo}</span></div><h2>{reservation.cancha_nombre}</h2><p className="admin-reservation-time">{formatDateTime(reservation.inicio_at)} · hasta {new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', timeStyle: 'short' }).format(new Date(reservation.fin_at))}</p></div>
      <div className="admin-reservation-client"><strong>{reservation.cliente_nombre || 'Cliente sin nombre'}</strong><span>{reservation.cliente_telefono || 'Sin teléfono'}</span>{reservation.nombre_equipo && <span>Equipo: {reservation.nombre_equipo}</span>}</div>
      <div className="admin-reservation-status"><span>{stateLabel[reservation.estado] || reservation.estado}</span>{reservation.estado === 'PENDIENTE' && <div><button className="confirm" disabled={actionId === reservation.id} onClick={() => updateReservation(reservation.id, 'CONFIRMADA')}><Check size={15} /> Confirmar</button><button className="cancel" disabled={actionId === reservation.id} onClick={() => updateReservation(reservation.id, 'CANCELADA')}><CircleX size={15} /> Cancelar</button></div>}</div>
    </article>) : <p className="admin-empty">Todavía no hay solicitudes de reserva.</p>}</section>}
  </section></main>
}
