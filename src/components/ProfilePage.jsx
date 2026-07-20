import { CalendarClock, LoaderCircle, LogOut, Save, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const stateLabel = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Reservada', CANCELADA: 'Cancelada', FINALIZADA: 'Finalizada', NO_ASISTIO: 'No asistió' }

function formatDate(value) {
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ProfilePage({ session }) {
  const returnPath = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('volver')
    return value?.startsWith('/') && !value.startsWith('//') ? value : null
  }, [])
  const [profile, setProfile] = useState({ nombre: session?.user?.user_metadata?.nombre || '', telefono: session?.user?.user_metadata?.telefono || '', email: session?.user?.email || '' })
  const [reservations, setReservations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadProfile = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)
    const [profileResponse, reservationsResponse] = await Promise.all([
      supabase.rpc('demo_mi_perfil'),
      supabase.rpc('demo_mis_reservas'),
    ])
    if (profileResponse.error || reservationsResponse.error) setError('No se pudo cargar tu información. Inténtalo nuevamente.')
    else {
      let data = profileResponse.data?.[0]
      if (!data && session?.user?.user_metadata?.nombre && session?.user?.user_metadata?.telefono) {
        const bootstrap = await supabase.rpc('demo_actualizar_mi_perfil', {
          p_nombre: session.user.user_metadata.nombre,
          p_telefono: session.user.user_metadata.telefono,
        })
        data = bootstrap.data?.[0]
      }
      setProfile({ nombre: data?.nombre || session?.user?.user_metadata?.nombre || '', telefono: data?.telefono || session?.user?.user_metadata?.telefono || '', email: data?.email || session?.user?.email || '' })
      setReservations(reservationsResponse.data || [])
    }
    setIsLoading(false)
  }, [session?.user?.email])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function saveProfile(event) {
    event.preventDefault()
    if (!supabase) return
    setIsSaving(true)
    setError('')
    setMessage('')
    const response = await supabase.rpc('demo_actualizar_mi_perfil', { p_nombre: profile.nombre, p_telefono: profile.telefono })
    setIsSaving(false)
    if (response.error) { setError(response.error.message || 'No se pudo guardar el perfil.'); return }
    const saved = response.data?.[0]
    if (saved) setProfile(saved)
    if (returnPath) { window.location.href = returnPath; return }
    setMessage('Tus datos fueron guardados correctamente.')
  }

  if (isLoading) return <main className="profile-page"><p className="profile-loading"><LoaderCircle className="spin" size={18} /> Cargando tu perfil…</p></main>

  return <main className="profile-page"><section className="profile-shell">
    <header className="profile-heading"><div><p className="eyebrow dark">MI CUENTA</p><h1>Mi perfil</h1><p>{profile.email}</p></div><button onClick={() => supabase?.auth.signOut()}><LogOut size={15} /> Cerrar sesión</button></header>
    {error && <p className="access-error">{error}</p>}
    <div className="profile-grid">
      <section className="profile-panel"><UserRound size={24} color="#facc15" /><h2>Mis datos</h2><p>Estos datos se usarán al solicitar una reserva.</p><form className="profile-form" onSubmit={saveProfile}>
        <label>Nombre completo<input required value={profile.nombre} onChange={(event) => setProfile({ ...profile, nombre: event.target.value })} placeholder="Tu nombre" /></label>
        <label>Teléfono / WhatsApp<input required inputMode="tel" value={profile.telefono} onChange={(event) => setProfile({ ...profile, telefono: event.target.value })} placeholder="099 000 0000" /></label>
        {message && <p className="access-message">{message}</p>}
        <button type="submit" disabled={isSaving}>{isSaving ? <><LoaderCircle className="spin" size={16} /> Guardando…</> : <><Save size={16} /> Guardar datos</>}</button>
      </form></section>
      <section className="profile-panel"><CalendarClock size={24} color="#facc15" /><h2>Mis reservas</h2><p>Consulta el estado de tus solicitudes y reservas confirmadas.</p>
        {reservations.length ? <div className="profile-reservations">{reservations.map((reservation) => <article key={reservation.id} className={`profile-reservation status-${reservation.estado.toLowerCase()}`}><div><p className="eyebrow dark">{reservation.codigo}</p><h3>{reservation.cancha_nombre}</h3><p>{formatDate(reservation.inicio_at)}</p>{reservation.nombre_equipo && <small>Equipo: {reservation.nombre_equipo}</small>}</div><span>{stateLabel[reservation.estado] || reservation.estado}</span></article>)}</div> : <p className="profile-empty">Todavía no tienes reservas. Cuando solicites una, aparecerá aquí.</p>}
      </section>
    </div>
  </section></main>
}
