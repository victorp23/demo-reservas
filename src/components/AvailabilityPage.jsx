import { ArrowLeft, CalendarDays, Clock3, MapPin, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCourtAvailability } from '../hooks/useCourtAvailability'

function formatType(type) { return String(type || 'CANCHA').replaceAll('_', ' ') }

export function AvailabilityPage({ complex, courts }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const requestedCourtId = params.get('cancha')
  const [selectedCourtId, setSelectedCourtId] = useState(courts.some((court) => court.id === requestedCourtId) ? requestedCourtId : courts[0]?.id)
  const court = courts.find((item) => item.id === selectedCourtId)
  const availability = useCourtAvailability(court)
  if (!court) return <section className="availability-empty"><a href="/"><ArrowLeft size={16} /> Volver al complejo</a><h1>No hay canchas disponibles todavía.</h1></section>

  return <main className="availability-page">
    <section className="availability-hero"><div><p className="eyebrow"><Sparkles size={13} /> CONSULTA DE DISPONIBILIDAD</p><h1>Elige tu horario<br />para <em>jugar.</em></h1><p>Selecciona una fecha y revisa los turnos disponibles para tu próxima reserva.</p></div><div className="availability-complex"><MapPin size={18} /><span><small>{complex.location || 'QUITO'}</small>{complex.address || complex.name}</span></div></section>
    <section className="availability-content">
      <div className="availability-court-picker"><span>CANCHA</span><div>{courts.map((item) => <button key={item.id} className={item.id === court.id ? 'is-selected' : ''} onClick={() => setSelectedCourtId(item.id)}>{item.name}<small>{formatType(item.type)}</small></button>)}</div></div>
      <div className="availability-panel">
        <div className="availability-panel-title"><div><p className="eyebrow dark"><CalendarDays size={13} /> PRÓXIMOS 14 DÍAS</p><h2>Selecciona una fecha</h2></div><p><Clock3 size={16} /> Turnos de {court.duration || 60} min</p></div>
        <div className="date-picker">{availability.days.map((day) => <button key={day.key} onClick={() => availability.setSelectedDayKey(day.key)} className={availability.selectedDayKey === day.key ? 'is-selected' : ''}><small>{day.shortDayName}</small><strong>{day.dayNumber}</strong><span>{day.month}</span></button>)}</div>
        <div className="time-slots-heading"><div><p className="eyebrow dark">HORARIOS DISPONIBLES</p><h3>{availability.selectedDay.dayName}, {availability.selectedDay.dayNumber} de {availability.selectedDay.month}</h3></div><span className="availability-legend"><i /> Disponible</span></div>
        {availability.isLoading ? <p className="availability-message">Consultando horarios…</p> : availability.error ? <p className="availability-message is-error">{availability.error}</p> : availability.slots.length ? <div className="time-slots">{availability.slots.map((slot) => <button key={slot} onClick={() => window.alert(`Horario seleccionado: ${slot}. La reserva en línea se habilitará en el siguiente paso.`)}><i />{slot}</button>)}</div> : <p className="availability-message">No hay horarios configurados para este día. Elige otra fecha.</p>}
      </div>
    </section>
  </main>
}
