import { ArrowLeft, CalendarDays, Clock3, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCourtAvailability } from '../hooks/useCourtAvailability'
import { supabase } from '../lib/supabase'
import { ReservationForm } from './ReservationForm'

function formatType(type) { return String(type || 'CANCHA').replaceAll('_', ' ') }

export function AvailabilityPage({ complex, courts, session }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const requestedCourtId = params.get('cancha')
  const [selectedCourtId, setSelectedCourtId] = useState(courts.some((court) => court.id === requestedCourtId) ? requestedCourtId : courts[0]?.id)
  const court = courts.find((item) => item.id === selectedCourtId)
  const availability = useCourtAvailability(court)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [isCheckingProfile, setIsCheckingProfile] = useState(false)

  async function selectSlot(slot) {
    const returnPath = `${window.location.pathname}${window.location.search}`
    if (!session) { window.location.href = `/acceso?volver=${encodeURIComponent(returnPath)}`; return }
    if (!supabase) { window.location.href = `/perfil?volver=${encodeURIComponent(returnPath)}`; return }
    setIsCheckingProfile(true)
    const response = await supabase.rpc('demo_mi_perfil')
    setIsCheckingProfile(false)
    const profile = response.data?.[0]
    if (response.error || !profile?.nombre || !profile?.telefono) {
      window.location.href = `/perfil?volver=${encodeURIComponent(returnPath)}`
      return
    }
    setSelectedSlot(slot)
  }

  if (!court) return <section className="availability-empty"><a href="/"><ArrowLeft size={16} /> Volver al complejo</a><h1>No hay canchas disponibles todavía.</h1></section>

  return <main className="availability-page">
    <section
      className="availability-hero"
      style={court.imageUrl ? { backgroundImage: `url("${court.imageUrl}")` } : undefined}
    >
      <div className="availability-hero-copy">
        <p className="eyebrow"> AGENDA DEL COMPLEJO</p>
        <h1>HORARIOS</h1>
        <p>Consulta la disponibilidad de nuestras canchas y encuentra tu próximo turno.</p>
      </div>
    </section>

    <section className="availability-content">
      <div className="availability-court-picker"><span>CANCHA SELECCIONADA</span><div>{courts.map((item) => <button key={item.id} className={item.id === court.id ? 'is-selected' : ''} onClick={() => { setSelectedCourtId(item.id); setSelectedSlot(null) }}>{item.name}<small>{formatType(item.type)}</small></button>)}</div></div>
      <div className="availability-panel">
        <div className="availability-panel-title"><div><p className="eyebrow dark"><CalendarDays size={13} /> PRÓXIMOS 14 DÍAS</p><h2>Selecciona una fecha</h2></div><p><Clock3 size={16} /> Turnos de {court.duration || 60} min</p></div>
        <div className="date-picker">{availability.days.map((day) => <button key={day.key} onClick={() => availability.setSelectedDayKey(day.key)} className={availability.selectedDayKey === day.key ? 'is-selected' : ''}><small>{day.shortDayName}</small><strong>{day.dayNumber}</strong><span>{day.month}</span></button>)}</div>
        <div className="time-slots-heading"><div><p className="eyebrow dark">HORARIOS DISPONIBLES</p><h3>{availability.selectedDay.dayName}, {availability.selectedDay.dayNumber} de {availability.selectedDay.month}</h3></div><span className="availability-legend"><i /> Disponible</span></div>
        {availability.isLoading ? <p className="availability-message">Consultando horarios…</p> : availability.error ? <p className="availability-message is-error">{availability.error}</p> : availability.slots.length ? <div className="time-slots">{availability.slots.map((slot) => <button key={slot} disabled={isCheckingProfile} onClick={() => selectSlot(slot)}><i />{isCheckingProfile ? 'Verificando…' : slot}</button>)}</div> : <p className="availability-message">No hay horarios configurados para este día. Elige otra fecha.</p>}
        {selectedSlot && <ReservationForm complex={complex} court={court} day={availability.selectedDay} slot={selectedSlot} onClose={() => setSelectedSlot(null)} onCreated={availability.reload} />}
      </div>
    </section>
  </main>
}
